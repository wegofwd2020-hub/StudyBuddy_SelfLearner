"""Tests for the PR-1 /generate stub.

PR-1 verifies submit + status flow without an actual Anthropic call.
PR-2 will add the worker tests.
"""

from __future__ import annotations

import uuid

import pytest


def _request_body(api_key: str, **overrides) -> dict:
    body = {
        "request_id": str(uuid.uuid4()),
        "topic": "Quadratic formula",
        "level": "high_school",
        "language": "en",
        "format": "lesson",
        "api_key": api_key,
        "depth": "standard",
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
async def test_submit_returns_202_with_job_id(client, known_test_api_key):
    resp = await client.post("/api/v1/generate", json=_request_body(known_test_api_key))
    assert resp.status_code == 202
    body = resp.json()
    uuid.UUID(body["job_id"])  # parses
    assert body["status"] == "queued"


@pytest.mark.asyncio
async def test_submit_envelopes_key_into_redis(client, fake_redis, known_test_api_key):
    resp = await client.post("/api/v1/generate", json=_request_body(known_test_api_key))
    job_id = resp.json()["job_id"]

    blob = await fake_redis.get(f"byok:{job_id}")
    assert blob is not None
    # Envelope is binary AES-GCM ciphertext, not the plaintext key
    assert known_test_api_key.encode("utf-8") not in blob


@pytest.mark.asyncio
async def test_submit_with_invalid_api_key_shape_rejected(client):
    body = _request_body("not-an-anthropic-key")
    resp = await client.post("/api/v1/generate", json=body)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_submit_with_empty_topic_rejected(client, known_test_api_key):
    body = _request_body(known_test_api_key, topic="")
    resp = await client.post("/api/v1/generate", json=body)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_status_returns_queued_after_submit(client, known_test_api_key):
    submit = await client.post("/api/v1/generate", json=_request_body(known_test_api_key))
    job_id = submit.json()["job_id"]

    status = await client.get(f"/api/v1/jobs/{job_id}")
    assert status.status_code == 200
    assert status.json()["status"] == "queued"


@pytest.mark.asyncio
async def test_status_unknown_job_returns_404(client):
    resp = await client.get(f"/api/v1/jobs/{uuid.uuid4()}")
    assert resp.status_code == 404
