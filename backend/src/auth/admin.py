"""Super-admin derivation from the config allowlist — ADR-020 D1/D2.

This is the **per-app authorization** half of the split in ADR-020 D8: the
authentication seam (`verifier.py` → `VerifiedToken`) is portable and will move
to `wegofwd-identity`; *this* — "is that verified caller an operator?" — stays in
the app, because each product answers it differently (Mentible: a flat config
allowlist; Pramana: a DB multi-tenant 5-role RBAC).

An identity is super-admin iff its **verified** email (case-insensitive) or sub
(exact) is in the allowlist. The allowlist comes from config only (`SUPER_ADMIN_*`)
— never from a token claim (D2), so a client cannot assert its own admin status.
Empty allowlist ⇒ nobody is admin (safe default).
"""

from __future__ import annotations

from backend.config import settings


def _parse_csv(raw: str) -> frozenset[str]:
    """Split a comma-separated config value into a set of trimmed, non-empty items."""
    return frozenset(item.strip() for item in raw.split(",") if item.strip())


# Computed once at import from config (like the verifier). Emails are matched
# case-insensitively, so normalise to lower-case here; subs are opaque, matched
# exactly. Tests monkeypatch these module-level sets to vary the allowlist.
_ADMIN_EMAILS: frozenset[str] = frozenset(
    e.lower() for e in _parse_csv(settings.super_admin_emails)
)
_ADMIN_SUBS: frozenset[str] = _parse_csv(settings.super_admin_subs)


def is_super_admin(*, sub: str, email: str | None) -> bool:
    """True iff this verified identity is in the operator allowlist (ADR-020 D1)."""
    if email and email.strip().lower() in _ADMIN_EMAILS:
        return True
    return bool(sub) and sub in _ADMIN_SUBS
