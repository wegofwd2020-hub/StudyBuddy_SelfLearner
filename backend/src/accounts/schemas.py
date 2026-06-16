"""Request/response shapes for the account API (ADR-014).

Responses expose only the identity reference + credential-set metadata — never the
internal account UUID, and never key material (D8/D5).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from backend.src.accounts.models import CREDENTIAL_SOURCES, CREDENTIAL_STATUSES


class CredentialView(BaseModel):
    provider_id: str
    source: str
    status: str
    last_verified_at: datetime | None
    updated_at: datetime


class AccountView(BaseModel):
    # Identity reference only — `sub` + email. No internal id, nothing generated (D8).
    sub: str
    email: str | None
    credentials: list[CredentialView]


class CredentialUpsert(BaseModel):
    source: str  # validated against CREDENTIAL_SOURCES in the route
    status: str = "unverified"

    def validate_enums(self) -> str | None:
        """Return an error message if source/status are out of range, else None."""
        if self.source not in CREDENTIAL_SOURCES:
            return f"source must be one of {CREDENTIAL_SOURCES}"
        if self.status not in CREDENTIAL_STATUSES:
            return f"status must be one of {CREDENTIAL_STATUSES}"
        return None
