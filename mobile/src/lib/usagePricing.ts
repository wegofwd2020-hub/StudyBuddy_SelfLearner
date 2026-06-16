// Token-cost estimation for the Usage page (SBQ-USAGE-001, step 4).
//
// ⚠️ BYOK HONESTY: this is *our estimate of what we sent* — observed tokens ×
// public list rates. It is NOT the provider's billed amount. It cannot see
// caching discounts, batch rates, free-tier credits, or the provider's actual
// invoice. The UI must say so and point the user to their provider console.
//
// ⚠️ MAINTENANCE (open question in SBQ-USAGE-001): these are approximate public
// list rates and DRIFT over time. Unknown models return a null cost (shown as
// "—") rather than a wrong number. Keep this table conservative; when in doubt,
// omit a model so we under-promise rather than mislead.

import type { UsageObservation } from "@/types/lesson";

// USD per 1,000,000 tokens, {input, output}. Keyed by model id (as the seam
// reports it). Free providers are 0/0. Approximate public list rates.
interface Rate {
  inputPerM: number;
  outputPerM: number;
}

const PRICE_TABLE: Record<string, Rate> = {
  // Anthropic (Claude)
  "claude-sonnet-4-6": { inputPerM: 3, outputPerM: 15 },
  "claude-3-5-haiku": { inputPerM: 0.8, outputPerM: 4 },
  // OpenAI
  "gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "gpt-4o": { inputPerM: 2.5, outputPerM: 10 },
  // Google Gemini
  "gemini-1.5-flash": { inputPerM: 0.075, outputPerM: 0.3 },
  "gemini-1.5-pro": { inputPerM: 1.25, outputPerM: 5 },
};

// Free providers (no per-token cost to the user). Matched by provider id.
const FREE_PROVIDERS = new Set(["groq", "openrouter-free"]);

// Estimated USD for one observation, or null when the rate is unknown. Free
// providers are 0 (still "estimated" in the honesty sense, but zero cost).
export function estimateCostUsd(obs: UsageObservation): number | null {
  if (FREE_PROVIDERS.has(obs.provider)) return 0;
  const rate = PRICE_TABLE[obs.model];
  if (!rate) return null;
  return (
    (obs.input_tokens / 1_000_000) * rate.inputPerM +
    (obs.output_tokens / 1_000_000) * rate.outputPerM
  );
}

// Whether we have a known rate (or free) for this observation.
export function hasKnownRate(obs: UsageObservation): boolean {
  return FREE_PROVIDERS.has(obs.provider) || obs.model in PRICE_TABLE;
}
