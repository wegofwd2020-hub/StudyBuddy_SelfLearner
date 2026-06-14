"""GET /registry/current — current provenance for client-side staleness diffing
(ADR-016 D7 / SBQ-TRUST-004). Key-free public registry metadata."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_registry_current_default_model(client):
    resp = await client.get("/api/v1/registry/current?provider=anthropic")
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "anthropic"
    assert body["model"] == "claude-sonnet-4-6"  # provider default
    assert body["model_verified"] is True
    assert isinstance(body["integration_version"], int)
    assert isinstance(body["contract_version"], int)


@pytest.mark.asyncio
async def test_registry_current_is_cacheable(client):
    resp = await client.get("/api/v1/registry/current?provider=anthropic")
    assert "max-age" in resp.headers.get("cache-control", "")


@pytest.mark.asyncio
async def test_registry_current_echoes_pinned_model(client):
    # A book pinned to a non-default model: current.model must reflect the pin so
    # a deliberate pin compares equal client-side and is never flagged stale.
    resp = await client.get(
        "/api/v1/registry/current?provider=anthropic&model=claude-opus-4-8"
    )
    assert resp.status_code == 200
    assert resp.json()["model"] == "claude-opus-4-8"


@pytest.mark.asyncio
async def test_registry_current_unknown_provider_404(client):
    resp = await client.get("/api/v1/registry/current?provider=nope")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_registry_current_carries_no_key_material(client):
    resp = await client.get("/api/v1/registry/current?provider=anthropic")
    body = resp.json()
    assert set(body) == {
        "provider",
        "model",
        "model_verified",
        "integration_version",
        "contract_version",
    }
