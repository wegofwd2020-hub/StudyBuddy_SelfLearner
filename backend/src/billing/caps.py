"""Managed usage cap — per-app POLICY (ADR-005 D6, Phase 2; ADR-019: policy stays per-app).

Phase 2 is a single fixed cost cap from config (`MANAGED_PERIOD_COST_CAP_MICROS` over a
rolling `MANAGED_USAGE_WINDOW_DAYS`), enough to *prove the loop* — exceed it and the next
managed generation is refused before it spends. Per-plan allowances replace this fixed
cap in Phase 3 (the `plan`/`entitlement` model), which is why the cap reads from config
here, not the eligibility allowlist.

The cap reads the metering total (`usage_repo.period_usage`, mechanism); this module is
the policy that interprets it. A cap of 0 ⇒ uncapped (metered but never refused), the
safe default so managed works the moment a key + allowlist are set.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import asyncpg

from backend.config import settings
from backend.src.billing import usage_repo


def _window_start() -> datetime:
    """Start of the current rolling usage window (now − MANAGED_USAGE_WINDOW_DAYS)."""
    return datetime.now(UTC) - timedelta(days=settings.managed_usage_window_days)


async def cap_exceeded(conn: asyncpg.Connection, *, account_id: UUID) -> bool:
    """True iff this account has met or exceeded the fixed managed cost cap for the
    current window. Always False when the cap is 0 (uncapped — the default)."""
    cap = settings.managed_period_cost_cap_micros
    if cap <= 0:
        return False
    usage = await usage_repo.period_usage(conn, account_id=account_id, since=_window_start())
    return usage.cost_micros >= cap
