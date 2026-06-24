#!/usr/bin/env python3
"""Completely remove a test user so the same Google email can re-register from
scratch — repeatably, for demos.

The app's own deletion paths (the in-app "Delete account" button and the admin
`DELETE /api/v1/admin/users/{sub}`) only purge the app DB `account` row; they do
NOT touch the Supabase auth identity. So after them, the same Google account is
still a *returning* Supabase user on next sign-in, not a fresh registration.

This script closes that gap. For a given email it:
  1. deletes the Supabase auth user(s) (the Google identity) via the Auth Admin
     API — this is what makes the next sign-in a genuine new registration; and
  2. deletes the app DB `account` row(s) (provider_credential rows cascade).

It is idempotent: re-running on an already-clean email is a no-op.

It does NOT touch the test *device* — there is no remote control of the phone.
After running this, reset the device too (see the printed reminder) so the
first-run onboarding shows from scratch.

Usage:
  python scripts/reset_test_user.py --email you@gmail.com
  python scripts/reset_test_user.py --email you@gmail.com --yes        # no prompt
  python scripts/reset_test_user.py --email you@gmail.com --keep-db     # identity only
  python scripts/reset_test_user.py --email you@gmail.com --keep-supabase  # DB only

Config (read from --env-file, default backend/.env, then overridden by the real
process env):
  SUPABASE_SERVICE_ROLE_KEY   required unless --keep-supabase. HIGH-PRIVILEGE
                              secret — Supabase → Project Settings → API → service_role.
  SUPABASE_URL                optional; else derived from OIDC_ISSUER.
  OIDC_ISSUER                 used to derive SUPABASE_URL (strip trailing /auth/v1).
  DATABASE_URL                required unless --keep-db. Same Session-Pooler DSN
                              the backend uses.

Run it with the backend's interpreter so asyncpg + httpx are importable, e.g.
  ./.venv/bin/python scripts/reset_test_user.py --email you@gmail.com
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

try:
    import asyncpg
    import httpx
except ModuleNotFoundError as exc:  # pragma: no cover - environment guard
    sys.exit(
        f"Missing dependency '{exc.name}'. Run this with the backend interpreter, e.g.\n"
        "  ./.venv/bin/python scripts/reset_test_user.py --email you@gmail.com"
    )

_DEFAULT_ENV_FILE = Path(__file__).resolve().parent.parent / "backend" / ".env"
_SUPABASE_PER_PAGE = 200
_SUPABASE_MAX_PAGES = 100  # safety cap (200 * 100 = 20k users scanned)


def load_env_file(path: Path) -> dict[str, str]:
    """Minimal KEY=VALUE .env reader (no interpolation). Missing file → {}."""
    env: dict[str, str] = {}
    if not path.is_file():
        return env
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def supabase_base(get) -> str | None:
    """Resolve the Supabase project base URL (no trailing slash)."""
    url = get("SUPABASE_URL")
    if url:
        return url.rstrip("/")
    issuer = get("OIDC_ISSUER")
    if not issuer:
        return None
    base = issuer.rstrip("/")
    suffix = "/auth/v1"
    return base[: -len(suffix)] if base.endswith(suffix) else base


def _admin_headers(service_key: str) -> dict[str, str]:
    return {"apikey": service_key, "Authorization": f"Bearer {service_key}"}


async def find_supabase_user_ids(client, base, service_key, email) -> list[str]:
    """Page the Auth Admin user list, returning ids whose email matches."""
    wanted = email.lower()
    ids: list[str] = []
    for page in range(1, _SUPABASE_MAX_PAGES + 1):
        resp = await client.get(
            f"{base}/auth/v1/admin/users",
            params={"page": page, "per_page": _SUPABASE_PER_PAGE},
            headers=_admin_headers(service_key),
        )
        resp.raise_for_status()
        data = resp.json()
        users = data.get("users", []) if isinstance(data, dict) else data
        if not users:
            break
        ids.extend(u["id"] for u in users if (u.get("email") or "").lower() == wanted)
        if len(users) < _SUPABASE_PER_PAGE:
            break
    return ids


async def delete_supabase_user(client, base, service_key, user_id) -> int:
    """Hard-delete one Supabase auth user. 404 (already gone) is treated as OK."""
    resp = await client.delete(
        f"{base}/auth/v1/admin/users/{user_id}",
        headers=_admin_headers(service_key),
    )
    if resp.status_code not in (200, 204, 404):
        resp.raise_for_status()
    return resp.status_code


async def db_find_subs(conn, email) -> list[str]:
    rows = await conn.fetch(
        "SELECT idp_sub FROM account WHERE lower(email) = lower($1)", email
    )
    return [r["idp_sub"] for r in rows]


async def db_delete_accounts(conn, *, email, subs) -> int:
    """Delete account rows by email OR by any known sub (credentials cascade)."""
    result = await conn.execute(
        "DELETE FROM account WHERE lower(email) = lower($1) OR idp_sub = ANY($2::text[])",
        email,
        list(subs),
    )
    # asyncpg returns a status string like "DELETE 3".
    return int(result.split()[-1]) if result.startswith("DELETE") else 0


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Completely remove a test user (Supabase identity + app DB account)."
    )
    parser.add_argument("--email", required=True, help="The test user's email address.")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt.")
    parser.add_argument("--keep-supabase", action="store_true", help="Don't delete the Supabase identity.")
    parser.add_argument("--keep-db", action="store_true", help="Don't delete the app DB account row.")
    parser.add_argument("--env-file", default=str(_DEFAULT_ENV_FILE), help="Path to a .env file.")
    return parser.parse_args(argv)


async def run(args) -> int:
    file_env = load_env_file(Path(args.env_file))

    def get(key):
        return os.environ.get(key) or file_env.get(key)

    email = args.email.strip()
    do_supabase = not args.keep_supabase
    do_db = not args.keep_db

    if not do_supabase and not do_db:
        sys.exit("Nothing to do: --keep-supabase and --keep-db were both set.")

    base = supabase_base(get)
    service_key = get("SUPABASE_SERVICE_ROLE_KEY")
    dsn = get("DATABASE_URL")

    if do_supabase and (not base or not service_key):
        sys.exit(
            "Supabase identity deletion needs SUPABASE_SERVICE_ROLE_KEY and a base URL\n"
            "(SUPABASE_URL or OIDC_ISSUER). See backend/env.example, or pass --keep-supabase."
        )
    if do_db and not dsn:
        sys.exit("App-DB deletion needs DATABASE_URL. See backend/env.example, or pass --keep-db.")

    # ── Discover ─────────────────────────────────────────────────────────────
    supabase_ids: list[str] = []
    db_subs: list[str] = []
    conn = await asyncpg.connect(dsn) if do_db else None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            if do_supabase:
                supabase_ids = await find_supabase_user_ids(client, base, service_key, email)
            if conn is not None:
                db_subs = await db_find_subs(conn, email)

            all_subs = set(db_subs) | set(supabase_ids)
            print(f"Target: {email}")
            print(f"  Supabase identities found: {supabase_ids or '(none)'}")
            print(f"  App DB account rows found: {sorted(all_subs) or '(none)'}")

            if not supabase_ids and not all_subs:
                print("Already clean — nothing to delete. (idempotent)")
                return 0

            if not args.yes:
                typed = input(f'Type the email "{email}" to confirm permanent deletion: ').strip()
                if typed != email:
                    print("Aborted — confirmation did not match.")
                    return 1

            # ── Delete ───────────────────────────────────────────────────────
            if do_supabase:
                for uid in supabase_ids:
                    code = await delete_supabase_user(client, base, service_key, uid)
                    print(f"  Supabase user {uid}: deleted (HTTP {code}).")

            if conn is not None:
                deleted = await db_delete_accounts(conn, email=email, subs=all_subs)
                print(f"  App DB: deleted {deleted} account row(s) (credentials cascaded).")
    finally:
        if conn is not None:
            await conn.close()

    print("\nDone. This email can now register from scratch.")
    print(
        "Device step (not done here): on the test phone, clear the app's local state so\n"
        "the first-run onboarding shows again — reinstall the app, or Android: App info →\n"
        "Storage → Clear storage. That wipes the saved session, device BYOK keys and the\n"
        "onboarding 'seen' flags."
    )
    return 0


def main() -> None:
    args = parse_args()
    raise SystemExit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
