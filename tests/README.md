# tests/

Cross-cutting tests for **StudyBuddy Q**.

Backend unit tests live in `backend/tests/`. This top-level directory is
reserved for cross-product tests:

| Test | Purpose |
|---|---|
| `test_no_key_in_logs.py` | **Mandatory** — CI-gating test that exercises every `/generate` code path with a known API key, then asserts the key never appears in any log line. See ADR-001 |
| `test_vendor_consistency.py` | Verifies `pipeline/VENDORED.md` SHA matches the actual file contents — catches forgotten `VENDORED.md` updates after a sync |

## Status

⏳ Empty. Mandatory tests land with the MVP PR.
