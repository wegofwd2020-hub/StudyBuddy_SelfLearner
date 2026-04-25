# backend/

FastAPI service for **StudyBuddy Q**.

## Layout (target — empty until first MVP PR)

```
backend/
  main.py                  FastAPI entrypoint + lifespan (Redis pool)
  config.py                pydantic-settings; env vars only
  alembic/                 Migrations (v1.1+ when accounts/library land)
  src/
    auth/                  Account creation · sign in · refresh (v1.1+)
    generate/              POST /generate · GET /jobs/{id}
    library/               v1.1+ — saved lessons CRUD
    sync/                  v1.1+ — cloud sync
    core/
      log_redaction.py     Mandatory key-redaction structlog processor
      byok_envelope.py     Per-job key encryption (HKDF + AES-GCM)
      anthropic_client.py  Wraps vendored AnthropicProvider
      tasks.py             Celery tasks
  tests/
  requirements.txt
```

## Key constraints

- **Never log the user's API key.** See `../docs/adr/ADR-001-byok-security-model.md`.
  CI test `test_no_key_in_logs.py` is mandatory.
- **Single-tenant per user.** No multi-tenancy, no RLS, no `app.current_school_id`.
- **Async only.** asyncpg, aioredis, httpx.AsyncClient — never block the event loop.
- **Vendored pipeline only.** Never import from `../../StudyBuddy_OnDemand/`.
  See `../docs/adr/ADR-002-repo-structure-and-vendoring.md`.

## Bootstrap (when ready)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Status

⏳ Empty. To be populated in the first MVP PR.
