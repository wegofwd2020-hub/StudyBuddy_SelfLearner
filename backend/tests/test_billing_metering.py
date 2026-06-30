"""Managed metering — Phase 2 mechanism (ADR-005 D6): pricing, the cap policy, and the
worker's best-effort usage-recording helper. All offline (no DB) — the DB-backed
`usage_repo` is covered in test_billing_usage_repo.py (skipped without DATABASE_URL).
"""

from __future__ import annotations

import uuid

import pytest

from backend.config import settings
from backend.src.billing import caps, pricing, usage_repo


# ── Fake asyncpg pool (acquire() → async context manager → a dummy conn) ────────
class _FakePool:
    def __init__(self):
        self.acquired = 0

    def acquire(self):
        pool = self

        class _CM:
            async def __aenter__(self):
                pool.acquired += 1
                return object()  # a dummy conn; record_usage is patched in tests

            async def __aexit__(self, *exc):
                return False

        return _CM()


# ── pricing (pure mechanism) ────────────────────────────────────────────────────


def test_cost_micros_sonnet():
    # 100 input × $3/1M + 500 output × $15/1M = 300 + 7500 micro-USD.
    assert pricing.cost_micros("anthropic", "claude-sonnet-4-6", 100, 500) == 7800


def test_cost_micros_zero_tokens():
    assert pricing.cost_micros("anthropic", "claude-sonnet-4-6", 0, 0) == 0


def test_cost_micros_unknown_model_uses_default():
    # An unpriced model falls back to the conservative default rate (3, 15), never 0.
    assert pricing.cost_micros("anthropic", "some-new-model", 100, 500) == 7800
    assert pricing.cost_micros("whoever", "whatever", 1_000_000, 0) == 3_000_000


# ── caps (per-app policy) ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cap_zero_is_uncapped(monkeypatch):
    """cap = 0 ⇒ never exceeded (managed metered but never refused) — and never reads."""
    monkeypatch.setattr(settings, "managed_period_cost_cap_micros", 0)

    async def _boom(*a, **k):  # period_usage must not even be consulted
        raise AssertionError("period_usage should not be read when uncapped")

    monkeypatch.setattr(usage_repo, "period_usage", _boom)
    assert await caps.cap_exceeded(None, account_id=uuid.uuid4()) is False


@pytest.mark.asyncio
async def test_cap_not_exceeded_below_threshold(monkeypatch):
    monkeypatch.setattr(settings, "managed_period_cost_cap_micros", 10_000)

    async def _usage(*a, **k):
        return usage_repo.PeriodUsage(input_tokens=1, output_tokens=1, cost_micros=9_999, events=1)

    monkeypatch.setattr(usage_repo, "period_usage", _usage)
    assert await caps.cap_exceeded(None, account_id=uuid.uuid4()) is False


@pytest.mark.asyncio
async def test_cap_exceeded_at_or_above_threshold(monkeypatch):
    monkeypatch.setattr(settings, "managed_period_cost_cap_micros", 10_000)

    async def _usage(*a, **k):
        return usage_repo.PeriodUsage(input_tokens=1, output_tokens=1, cost_micros=10_000, events=5)

    monkeypatch.setattr(usage_repo, "period_usage", _usage)
    assert await caps.cap_exceeded(None, account_id=uuid.uuid4()) is True


# ── worker recording helper (best-effort wiring) ────────────────────────────────


@pytest.mark.asyncio
async def test_record_managed_usage_prices_and_writes(monkeypatch):
    from backend.src.generate import tasks

    captured: dict = {}

    async def _fake_record(conn, **kw):
        captured.update(kw)

    monkeypatch.setattr(tasks.usage_repo, "record_usage", _fake_record)

    pool = _FakePool()
    account_id = uuid.uuid4()
    job_id = uuid.uuid4()
    usage = {
        "provider": "anthropic",
        "model": "claude-sonnet-4-6",
        "input_tokens": 100,
        "output_tokens": 500,
        "tokens_estimated": False,
        "attempts": 1,
    }
    await tasks._record_managed_usage(pool, account_id, job_id, usage)

    assert pool.acquired == 1
    assert captured["account_id"] == account_id
    assert captured["job_id"] == job_id
    assert captured["provider"] == "anthropic"
    assert captured["cost_micros"] == 7800  # priced from the observed tokens


@pytest.mark.asyncio
async def test_record_managed_usage_noops_without_pool_or_account(monkeypatch):
    from backend.src.generate import tasks

    async def _boom(*a, **k):
        raise AssertionError("record_usage must not be called when metering is unavailable")

    monkeypatch.setattr(tasks.usage_repo, "record_usage", _boom)

    usage = {"provider": "anthropic", "model": "m", "input_tokens": 1, "output_tokens": 1}
    # No pool, no account, no usage — each is a silent no-op (BYOK / demo / no-DB path).
    await tasks._record_managed_usage(None, uuid.uuid4(), uuid.uuid4(), usage)
    await tasks._record_managed_usage(_FakePool(), None, uuid.uuid4(), usage)
    await tasks._record_managed_usage(_FakePool(), uuid.uuid4(), uuid.uuid4(), None)


@pytest.mark.asyncio
async def test_record_managed_usage_swallows_errors(monkeypatch):
    """A metering failure must never propagate (the generation already succeeded)."""
    from backend.src.generate import tasks

    async def _explode(conn, **kw):
        raise RuntimeError("db down")

    monkeypatch.setattr(tasks.usage_repo, "record_usage", _explode)
    usage = {
        "provider": "anthropic",
        "model": "claude-sonnet-4-6",
        "input_tokens": 1,
        "output_tokens": 1,
    }
    # Must not raise.
    await tasks._record_managed_usage(_FakePool(), uuid.uuid4(), uuid.uuid4(), usage)
