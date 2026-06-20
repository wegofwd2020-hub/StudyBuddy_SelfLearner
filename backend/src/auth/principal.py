"""The authenticated end-user principal — ADR-014 D1.

Two types, deliberately separated so the verification *seam* can later be lifted
into the shared `wegofwd-identity` package while authorization stays per-app
(ADR-019 D4 / ADR-020 D8):

- `VerifiedToken` — the **portable** result of verifying a JWT: "who does this
  valid token claim to be?" Pure identity claims, no DB, no roles. This is the
  exact shape the future `wegofwd-identity` will return; the verifier produces it.
- `Principal` — the **per-app** authenticated user the routes see. Built from a
  `VerifiedToken` and enriched with app-specific authorization (here:
  `is_super_admin`, ADR-020). Pramana's `Principal` is a different shape entirely;
  that divergence is exactly why the mapping stays per-app.

Both carry only an identity reference (the IdP `sub`, the account key per ADR-014
D8) and non-sensitive claims — **never** a credential, an LLM key, or the raw
token. The session JWT is OUR token, never the user's LLM key (CLAUDE.md).

Distinct from the ADR-018 system-owner, which is a config-bootstrapped signing
*capability* (a secret), not an IdP account or a human role (ADR-020 D4).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


class AuthError(Exception):
    """The caller's identity token is missing, malformed, or fails verification.

    Carries a KEY-FREE, token-FREE message (type/reason only) — the token and its
    claims must never reach a log line or an exception string. Mapped to HTTP 401
    at the dependency boundary (see `deps.py`).
    """


@dataclass(frozen=True)
class VerifiedToken:
    """A verified IdP token's identity claims — the portable verify→claims result.

    The shared `wegofwd-identity` seam (ADR-019 D4 / ADR-020 D8) returns exactly
    this: stateless, no DB, no roles, no `Principal`. Each app maps it to its own
    principal and derives its own authorization.
    """

    sub: str
    email: str | None
    issuer: str
    # The full verified claim set, for app-specific mapping. Never logged.
    raw_claims: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Principal:
    """An authenticated user. Immutable; safe to stash on the request."""

    # The IdP subject — the stable, opaque user id. This is the key the account
    # row and the synced library hang off (ADR-014 D8); it is NOT an email.
    sub: str
    # Convenience claims, when the IdP includes them. Never required for identity.
    email: str | None
    # The token issuer that was verified (the configured OIDC issuer).
    issuer: str
    # Server-DERIVED operator flag (ADR-020 D2): true iff the verified identity is
    # in the config allowlist. NEVER read from a token claim — a client must not be
    # able to assert its own admin status. Defaults false (ordinary user).
    is_super_admin: bool = False
