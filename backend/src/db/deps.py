"""FastAPI dependency that hands a route an asyncpg connection from the app pool.

The pool is created once in the app lifespan (`app.state.db`). When no DATABASE_URL
is configured the pool is None and account routes return 503 — the anonymous demo
has no account store.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import asyncpg
from fastapi import HTTPException, Request, status


async def get_conn(request: Request) -> AsyncIterator[asyncpg.Connection]:
    pool: asyncpg.Pool | None = getattr(request.app.state, "db", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="account store not configured",
        )
    async with pool.acquire() as conn:
        yield conn
