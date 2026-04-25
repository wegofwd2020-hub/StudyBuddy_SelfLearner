# pipeline/

Vendored from `StudyBuddy_OnDemand`. **This is shared IP, copied — not imported.**

See `../docs/adr/ADR-002-repo-structure-and-vendoring.md` for the rationale.

## Files (target — empty until first vendor sync)

```
pipeline/
  prompts.py                    Universal + per-subject formatting blocks (Epic 11 IP)
  providers/
    __init__.py
    base.py                     LLMProvider ABC
    anthropic.py                AnthropicProvider — MODIFIED for BYOK per-call key
  content_format_validator.py   Drift detection on generated content
  config.py                     Q-specific (NOT vendored — model pins, max_tokens defaults)
  VENDORED.md                   Source SHA tracker — required after first sync
```

## Sync process

Updates from OnDemand are deliberate, scripted, and reviewed:

```bash
./scripts/sync-from-ondemand.sh /path/to/StudyBuddy_OnDemand
```

The script copies the vendored files, updates `VENDORED.md` with the source
commit SHA, and stages a PR. **Never** auto-sync on CI. **Never** symlink to
the OnDemand checkout. **Never** import OnDemand modules at runtime.

## Local modifications

`pipeline/providers/anthropic.py` is intentionally divergent from OnDemand:
the constructor accepts a `api_key` argument per call rather than reading it
from the environment. This is required by the BYOK model (see ADR-001). The
sync script flags this file as "modified locally" and requires a manual
three-way merge when OnDemand changes it.

## Status

⏳ Empty. First vendor sync happens in the MVP PR.
