# Mentible backend — go-live runbook (anonymous demo → identity-enabled)

Turns the live backend at `https://mambakkam.net/mentible-api` from the **anonymous
demo** (no login, no DB) into the **identity-enabled** deployment that the account API
(ADR-014) and the super-admin console (ADR-020) need. Until this is done,
`SUPER_ADMIN_EMAILS` is inert (see `USER_MANAGEMENT.md` §3.1).

**Status (updated 2026-06-27): ✅ DONE.** This go-live was completed on **2026-06-23**:
the identity-enabled image was deployed, `.env.demo` got `OIDC_ISSUER` / `DATABASE_URL`
(Supabase session pooler) / `SUPER_ADMIN_EMAILS`, migrations ran, and **account + admin
routes are live** at `https://mambakkam.net/mentible-api`. Google sign-in + the
super-admin console are **verified on production** (2026-06-27). A DB-password mismatch
in `.env.demo` (post-rotation) briefly broke authed DB endpoints and was fixed.
_Next:_ refresh the running image to current `main` — `Plans/PROD_BACKEND_REFRESH_TO_MAIN.md`.
The original "not done" runbook is kept below for reference.

## What's already known / done
- **Supabase project exists:** `vvlsaiywyfhxkjppjoiy` → `OIDC_ISSUER =
  https://vvlsaiywyfhxkjppjoiy.supabase.co/auth/v1`, `OIDC_AUDIENCE = authenticated`.
- **Backend code is ready:** account API (ADR-014) + admin API (ADR-020 #1/#2/#5) on
  `main`. Migrations `0001`→`0003`.
- **Google sign-in** code is merged (#154) — needs the 2 Supabase console steps below.
- **`docker-compose.demo.yml`** now forwards `OIDC_ISSUER`, `OIDC_AUDIENCE`,
  `DATABASE_URL`, `SUPER_ADMIN_EMAILS`, `SUPER_ADMIN_SUBS` to the container.

## What's needed from the operator (only you can supply / do)
1. **`DATABASE_URL`** — the Supabase **Session pooler** DSN (port **5432**, IPv4), with
   the DB password. From Supabase → Connect → Session pooler. (Direct `db.<ref>` is
   IPv6-only → fails in Docker; transaction pooler 6543 breaks asyncpg — see
   `USER_MANAGEMENT.md` §4.)
2. **Root / console access to the VPS** — `/opt/mentible` is `root`-owned and the
   `deploy` user's sudo is scoped (it can `docker compose` but not edit `.env.demo` nor
   `git -C /opt/mentible pull`). Steps 1–4 below need root.
3. **Supabase dashboard** (Google go-live): (a) enable the **Google** provider with a
   Google OAuth client id+secret; (b) allowlist redirect `mentible://auth-callback`.
4. **Re-enable "Confirm email"** in Supabase Auth for production (it's off for testing).

## Deploy steps (on the VPS, as root)

```bash
cd /opt/mentible
git pull                                   # bring in the current image source (admin routes + compose passthrough)

# 1) Add identity to the env file (keep the existing BYOK/OWNER secrets):
cat >> .env.demo <<'ENV'
OIDC_ISSUER=https://vvlsaiywyfhxkjppjoiy.supabase.co/auth/v1
OIDC_AUDIENCE=authenticated
DATABASE_URL=postgresql://postgres.vvlsaiywyfhxkjppjoiy:<DB-PASSWORD>@aws-<N>-<region>.pooler.supabase.com:5432/postgres
SUPER_ADMIN_EMAILS=wegofwd2020@gmail.com
ENV

# 2) Rebuild + restart from current code:
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build --remove-orphans

# 3) Run DB migrations (account + suspend + audit tables) against the same DSN:
docker compose -f docker-compose.demo.yml --env-file .env.demo run --rm api alembic upgrade head
#   (or run alembic from a host venv with DATABASE_URL exported)

# 4) Verify:
curl -fs http://127.0.0.1:8092/readyz                       # {"status":"ok","redis":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://mambakkam.net/mentible-api/api/v1/account   # 401 (was 404) = routes live, auth required
```

## Verify identity + admin end-to-end
- Sign in on a device/web with the Google account `wegofwd2020@gmail.com`; copy its
  access token.
- `curl -H "Authorization: Bearer <token>" https://mambakkam.net/mentible-api/api/v1/admin/users`
  → `200` with the user list (you're an admin). A non-allowlisted user → `403`.
- Check the audit trail: `GET /api/v1/admin/audit` after a suspend/reactivate.

## Rollback
Identity is additive and env-gated: remove `OIDC_ISSUER` + `DATABASE_URL` from
`.env.demo` and `up -d` again → back to the anonymous demo. The DB is untouched by
that (the rows simply stop being read).

## Caveats
- **Suspend ≠ generation block (ADR-020 O6):** suspending a user blocks our authed
  routes, NOT public BYOK generation (key in the request body).
- **CDN:** the `/mentible-api/*` paths are dynamic; Cloudflare should not cache them
  (POST/JSON). If a stale GET is ever cached, purge as in the web-demo runbook.
- **Same `SYSTEM_OWNER_SECRET`** must match whatever signed the committed default
  library, or the bundled-library signature check fails (CLAUDE.md pitfall #7).
