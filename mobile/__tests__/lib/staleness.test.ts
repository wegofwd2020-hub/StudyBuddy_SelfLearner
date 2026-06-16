import { countStaleTopics, isUnitStale } from "@/lib/staleness";
import type { Provenance } from "@/types/lesson";

// isUnitStale decides the TrustBadge `isStale` hint (ADR-016 D7). It must mirror
// the backend engine drift keys (model + integration + contract), be pin-aware
// (deliberate pins never flagged), and stay silent (undefined) when it can't tell.

const current: Provenance = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  model_verified: true,
  integration_version: 2,
  contract_version: 1,
};

function stored(extra: Partial<Provenance> = {}): Provenance {
  return { ...current, ...extra };
}

describe("isUnitStale", () => {
  it("is false when the unit matches the current resolved config (AC3)", () => {
    expect(isUnitStale(stored(), current)).toBe(false);
  });

  it("is true when integration_version moved on (AC2)", () => {
    expect(isUnitStale(stored({ integration_version: 1 }), current)).toBe(true);
  });

  it("is true when the seam contract_version changed", () => {
    expect(isUnitStale(stored({ contract_version: 0 }), current)).toBe(true);
  });

  it("is true when the recommended model moved (no-pin book, AC5)", () => {
    // current.model is the registry default; the unit was made with the old one.
    expect(isUnitStale(stored({ model: "claude-sonnet-4-5" }), current)).toBe(true);
  });

  it("is false for a deliberately pinned model (AC6)", () => {
    // current is the book's PIN-RESOLVED provenance, so a pinned-opus unit
    // compared against pinned-opus current is equal — never flagged.
    const pinned: Provenance = { ...current, model: "claude-opus-4-8" };
    expect(isUnitStale(stored({ model: "claude-opus-4-8" }), pinned)).toBe(false);
  });

  it("is undefined when either side is missing (AC4)", () => {
    expect(isUnitStale(undefined, current)).toBeUndefined();
    expect(isUnitStale(stored(), undefined)).toBeUndefined();
  });

  it("is undefined when a version is not stamped (older content / AC4)", () => {
    expect(isUnitStale(stored({ integration_version: undefined }), current)).toBeUndefined();
    expect(
      isUnitStale(stored(), { ...current, integration_version: undefined }),
    ).toBeUndefined();
  });
});

describe("countStaleTopics — Books degradation rollup", () => {
  it("counts only confidently-stale topics", () => {
    const topics = [
      { provenance: stored() }, // fresh
      { provenance: stored({ integration_version: 1 }) }, // stale
      { provenance: stored({ model: "claude-sonnet-4-5" }) }, // stale (moved default)
    ];
    expect(countStaleTopics(topics, current)).toBe(2);
  });

  it("never counts 'can't tell' units (undefined ⇒ not stale)", () => {
    const topics = [
      { provenance: undefined }, // no provenance → undefined
      { provenance: stored({ integration_version: undefined }) }, // unstamped → undefined
      { provenance: stored({ integration_version: 1 }) }, // genuinely stale
    ];
    expect(countStaleTopics(topics, current)).toBe(1);
  });

  it("returns 0 when current is unknown (offline) — no nag on a guess", () => {
    const topics = [{ provenance: stored({ integration_version: 1 }) }];
    expect(countStaleTopics(topics, undefined)).toBe(0);
  });

  it("returns 0 for a book with no generated topics", () => {
    expect(countStaleTopics([], current)).toBe(0);
  });
});
