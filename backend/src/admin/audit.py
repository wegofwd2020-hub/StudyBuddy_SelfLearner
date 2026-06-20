"""Persistent admin-action audit trail — ADR-020 D5 (O2).

The durable sink for super-admin actions: who did what to whom, when. Records
actor + action + target + timestamp only — NEVER secrets, key material, or
generated content (D5/D6). Rows are append-only and outlive the target account
(no FK), so a `user.delete` is still attributable afterwards.

Callers record inside the same transaction as the action (admin/router.py), so an
action and its audit row commit together — there is no privileged mutation without
its trail.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import asyncpg


@dataclass(frozen=True)
class AuditEntry:
    id: UUID
    actor_sub: str
    actor_email: str | None
    action: str
    target_sub: str | None
    created_at: datetime


async def record(
    conn: asyncpg.Connection,
    *,
    actor_sub: str,
    actor_email: str | None,
    action: str,
    target_sub: str | None,
) -> None:
    """Append one audit row. No secrets — actor/action/target metadata only."""
    await conn.execute(
        "INSERT INTO admin_audit (actor_sub, actor_email, action, target_sub) "
        "VALUES ($1, $2, $3, $4)",
        actor_sub,
        actor_email,
        action,
        target_sub,
    )


async def list_entries(conn: asyncpg.Connection, *, limit: int, offset: int) -> list[AuditEntry]:
    """Recent audit entries, newest first."""
    rows = await conn.fetch(
        "SELECT id, actor_sub, actor_email, action, target_sub, created_at "
        "FROM admin_audit ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2",
        limit,
        offset,
    )
    return [
        AuditEntry(
            id=r["id"],
            actor_sub=r["actor_sub"],
            actor_email=r["actor_email"],
            action=r["action"],
            target_sub=r["target_sub"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


async def count_entries(conn: asyncpg.Connection) -> int:
    return int(await conn.fetchval("SELECT count(*) FROM admin_audit"))
