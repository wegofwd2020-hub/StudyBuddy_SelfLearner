// Per-unit staleness for the TrustBadge `isStale` hint (ADR-016 D7 / SBQ-TRUST-004).
//
// Mirrors the engine subset of the backend drift definition
// (pipeline/providers/config.py::_DRIFT_KEYS): model + integration_version +
// contract_version. Config-version keys are intentionally excluded (that's the
// separate "you changed your settings" signal, not the "older model" hint).

import type { Provenance } from "@/types/lesson";

/**
 * Is a stored unit stale relative to what's current?
 *
 * `current` MUST be the book's *pin-resolved* provenance (see
 * `getCurrentProvenance`, which passes the book's model pin) — so a unit made
 * with a deliberately pinned model compares equal and is never flagged; only a
 * moved default or a changed pin is.
 *
 * Returns `undefined` when we can't decide (either side missing, or no version
 * stamped) — the badge then shows NO hint rather than guessing stale/fresh.
 */
export function isUnitStale(
  stored: Provenance | undefined,
  current: Provenance | undefined,
): boolean | undefined {
  if (!stored || !current) return undefined;
  if (stored.integration_version == null || current.integration_version == null) {
    return undefined;
  }
  return (
    stored.model !== current.model ||
    stored.integration_version !== current.integration_version ||
    stored.contract_version !== current.contract_version
  );
}
