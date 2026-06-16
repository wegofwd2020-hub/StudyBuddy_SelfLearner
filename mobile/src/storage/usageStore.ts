import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UsageObservation } from "@/types/lesson";
import { estimateCostUsd, hasKnownRate } from "@/lib/usagePricing";

// Device-local, append-only token-usage ledger (SBQ-USAGE-001, Phase 1).
// Local-first per ADR-004 (same posture as bookStore/reviewStore) — works before
// server accounts/sync land. Rows are non-sensitive metadata: no key, no content.
// A server-side `usage_events` table is Phase 2, deferred behind the ADR-014
// sync/O2 decision.
const USAGE_KEY = "sbq_usage_ledger";

// Soft cap so the ledger can't grow without bound on a long-lived device. Keeps
// the newest N events (FIFO trim). Well above the ~100-unit fair-use cap (D18).
const MAX_EVENTS = 2000;

// One recorded generation. Extends the backend observation with device-side
// attribution (when recorded) and a timestamp.
export interface UsageEvent extends UsageObservation {
  // Epoch ms when recorded on this device.
  ts: number;
  // Light attribution — the topic title, when the caller had it. book_id/topic_id
  // are intentionally optional (SBQ-USAGE-001); headline aggregation doesn't need them.
  topicTitle?: string;
}

async function readAll(): Promise<UsageEvent[]> {
  const raw = await AsyncStorage.getItem(USAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as UsageEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Append one observation to the ledger. Fire-and-forget at a generation's done
// point — never throws into the generation flow (a ledger write must not fail a
// successful generation).
export async function recordUsage(
  obs: UsageObservation,
  attribution?: { topicTitle?: string },
): Promise<void> {
  try {
    const event: UsageEvent = {
      ...obs,
      ts: Date.now(),
      topicTitle: attribution?.topicTitle,
    };
    const all = await readAll();
    const next = [event, ...all].slice(0, MAX_EVENTS);
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(next));
  } catch {
    // Recording usage is best-effort telemetry for the user's own page; a
    // failure here must never disrupt generation.
  }
}

// All recorded events, newest first.
export async function listUsage(): Promise<UsageEvent[]> {
  const all = await readAll();
  return [...all].sort((a, b) => b.ts - a.ts);
}

export async function clearUsage(): Promise<void> {
  await AsyncStorage.removeItem(USAGE_KEY);
}

// ── Aggregation ────────────────────────────────────────────────────────────────

export interface ModelUsage {
  provider: string;
  model: string;
  generations: number;
  inputTokens: number;
  outputTokens: number;
  // Any event in this group had estimated (non-reported) token counts.
  anyEstimated: boolean;
  // Estimated USD, or null when no rate is known for this model.
  estCostUsd: number | null;
}

export interface UsageSummary {
  totalGenerations: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  // Sum of known-rate costs. null only when NO row had a known rate.
  estCostUsd: number | null;
  // Some rows used estimated token counts (mark them approximate).
  anyTokensEstimated: boolean;
  // Some rows have no known price (so the total cost omits them).
  anyRateUnknown: boolean;
  // Per provider×model, highest spend first.
  byModel: ModelUsage[];
}

// Roll up events by provider × model. Pure — easy to unit-test.
export function summarizeUsage(events: UsageEvent[]): UsageSummary {
  const groups = new Map<string, ModelUsage>();
  let totalInput = 0;
  let totalOutput = 0;
  let costAccum = 0;
  let anyKnownRate = false;
  let anyEstimatedTokens = false;
  let anyRateUnknown = false;

  for (const e of events) {
    totalInput += e.input_tokens;
    totalOutput += e.output_tokens;
    if (e.tokens_estimated) anyEstimatedTokens = true;

    const cost = estimateCostUsd(e);
    if (hasKnownRate(e)) {
      anyKnownRate = true;
      costAccum += cost ?? 0;
    } else {
      anyRateUnknown = true;
    }

    const key = `${e.provider} ${e.model}`;
    const g = groups.get(key);
    if (g) {
      g.generations += 1;
      g.inputTokens += e.input_tokens;
      g.outputTokens += e.output_tokens;
      g.anyEstimated = g.anyEstimated || e.tokens_estimated;
      if (cost !== null) g.estCostUsd = (g.estCostUsd ?? 0) + cost;
    } else {
      groups.set(key, {
        provider: e.provider,
        model: e.model,
        generations: 1,
        inputTokens: e.input_tokens,
        outputTokens: e.output_tokens,
        anyEstimated: e.tokens_estimated,
        estCostUsd: cost,
      });
    }
  }

  const byModel = [...groups.values()].sort(
    (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
  );

  return {
    totalGenerations: events.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    estCostUsd: anyKnownRate ? costAccum : null,
    anyTokensEstimated: anyEstimatedTokens,
    anyRateUnknown,
    byModel,
  };
}
