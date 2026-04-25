#!/bin/bash
# Vendor sync from StudyBuddy_OnDemand → StudyBuddy_SelfLearner.
#
# Usage:
#   ./scripts/sync-from-ondemand.sh /path/to/StudyBuddy_OnDemand [--dry-run]
#
# See docs/adr/ADR-002-repo-structure-and-vendoring.md for the strategy.
#
# Files marked "Modified locally" in pipeline/VENDORED.md are NEVER overwritten
# by this script — they require a manual three-way merge.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-OnDemand-repo> [--dry-run]" >&2
  exit 2
fi

ONDEMAND="$1"
DRY_RUN="${2:-}"

if [ ! -d "$ONDEMAND" ]; then
  echo "Error: $ONDEMAND does not exist" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
TARGET="$(pwd)"

# ── Auto-syncable files (no local modifications) ─────────────────────────────
SAFE_FILES=(
  "pipeline/prompts.py"
  "pipeline/content_format_validator.py"
  "pipeline/providers/base.py"
)

# ── Modified-locally files (manual merge required, NOT overwritten) ──────────
MODIFIED_FILES=(
  "pipeline/providers/__init__.py"
  "pipeline/providers/anthropic.py"
)

ONDEMAND_SHA=$(git -C "$ONDEMAND" rev-parse HEAD)
echo "→ Syncing from OnDemand@${ONDEMAND_SHA:0:8}"

for f in "${SAFE_FILES[@]}"; do
  src="$ONDEMAND/$f"
  dst="$TARGET/$f"
  if [ ! -f "$src" ]; then
    echo "  ✗ Source missing: $f"
    continue
  fi
  if [ "$DRY_RUN" = "--dry-run" ]; then
    if ! diff -q "$src" "$dst" >/dev/null 2>&1; then
      echo "  ! Would update: $f"
    else
      echo "  = Unchanged:    $f"
    fi
  else
    cp "$src" "$dst"
    echo "  ✓ Updated:      $f"
  fi
done

for f in "${MODIFIED_FILES[@]}"; do
  src="$ONDEMAND/$f"
  if ! diff -q "$src" "$TARGET/$f" >/dev/null 2>&1; then
    echo "  ⚠ MANUAL REVIEW: $f (modified locally; OnDemand has changes — review and merge by hand)"
  else
    echo "  = Unchanged:     $f (locally modified, OnDemand happens to match)"
  fi
done

if [ "$DRY_RUN" != "--dry-run" ]; then
  echo ""
  echo "→ Update pipeline/VENDORED.md with the new SHA: ${ONDEMAND_SHA:0:8}"
  echo "→ Then commit:"
  echo "    git add -A pipeline/"
  echo "    git commit -m 'chore(vendor): sync pipeline from OnDemand@${ONDEMAND_SHA:0:8}'"
fi
