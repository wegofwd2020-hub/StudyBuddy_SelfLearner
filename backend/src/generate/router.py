"""POST /generate and GET /jobs/{job_id} for StudyBuddy Q.

PR-1 stub:
- POST /generate validates the request, envelopes the API key into Redis,
  records a "queued" job state, and returns 202 with a job_id.
- GET /jobs/{job_id} returns the recorded status. The actual Anthropic call
  and Celery worker land in PR-2.

The handler must NEVER log the request body verbatim — it contains api_key.
We log only the safe surface (job_id, request_id, topic length, format).
"""

from __future__ import annotations

import json
import uuid

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, status

from backend.config import settings
from backend.src.core.byok_envelope import encrypt_api_key, parse_master_key
from backend.src.core.log_redaction import get_logger
from backend.src.generate.schemas import (
    GenerateRequest,
    GenerateResponse,
    JobStatusResponse,
)

router = APIRouter(prefix="/api/v1", tags=["generate"])
log = get_logger("generate")


# ── Redis dependency ──────────────────────────────────────────────────────────


async def get_redis() -> redis.Redis:
    """Return a Redis client. In production this is overridden by the
    lifespan-managed pool; the default is fine for local dev and tests
    that fall through to a real fakeredis-backed client."""
    return redis.from_url(settings.redis_url, decode_responses=False)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _byok_redis_key(job_id: uuid.UUID) -> str:
    return f"byok:{job_id}"


def _job_status_redis_key(job_id: uuid.UUID) -> str:
    return f"job:{job_id}:status"


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post(
    "/generate",
    response_model=GenerateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_generate(
    body: GenerateRequest,
    r: redis.Redis = Depends(get_redis),
) -> GenerateResponse:
    """Submit a generation request.

    PR-1 behaviour:
      1. Validate (Pydantic).
      2. Generate a job_id.
      3. Encrypt the api_key with a per-job envelope; SETEX into Redis.
      4. Record initial status "queued".
      5. Return 202 with job_id.

    PR-2 will add: Celery dispatch, idempotency dedup on request_id,
    actual Anthropic call.
    """
    job_id = uuid.uuid4()

    # Encrypt the BYOK key into Redis. The plaintext key is held in body.api_key
    # only for the next two lines, then dropped.
    master_key = parse_master_key(settings.byok_master_key)
    envelope = encrypt_api_key(master_key, str(job_id), body.api_key)

    await r.setex(
        _byok_redis_key(job_id),
        settings.byok_redis_ttl_seconds,
        envelope,
    )

    # Record initial status. Result column is empty; PR-2 fills it in.
    await r.setex(
        _job_status_redis_key(job_id),
        settings.byok_redis_ttl_seconds * 2,  # status outlives the key envelope
        json.dumps({"status": "queued"}),
    )

    # Safe-surface logging only — never the api_key, never the request body.
    log.info(
        "generate_submitted",
        job_id=str(job_id),
        request_id=str(body.request_id),
        topic_len=len(body.topic),
        format=body.format,
        level=body.level,
        language=body.language,
    )

    return GenerateResponse(job_id=job_id, status="queued")


@router.get(
    "/jobs/{job_id}",
    response_model=JobStatusResponse,
)
async def get_job_status(
    job_id: uuid.UUID,
    r: redis.Redis = Depends(get_redis),
) -> JobStatusResponse:
    """Return the status of a previously submitted job.

    PR-1 returns only "queued" — PR-2 wires actual progression.
    """
    raw = await r.get(_job_status_redis_key(job_id))
    if raw is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")

    payload = json.loads(raw)
    return JobStatusResponse(
        job_id=job_id,
        status=payload.get("status", "queued"),
        error=payload.get("error"),
        result=payload.get("result"),
    )
