// LLM providers offered in the app's BYOK picker (Phase 3b). Mirrors the usable
// subset of the backend registry (pipeline/providers/registry.py). Only providers
// we've actually wired + can validate a key for are listed; the registry's
// UNVERIFIED entries (deepseek/qwen/gemma) join once their conformance tier is
// measured (Phase 5). `id` matches the backend provider_id + GenerationParams.provider.

export interface ProviderInfo {
  id: string;
  label: string;
  keyPrefix: string; // expected BYOK key prefix
  keyHint: string; // input placeholder
  // Honest capability note surfaced to the author (memo §5/§9). "authoring" =
  // reliable for published books; "experimental" = wired but conformance not yet
  // measured, treat output as draft-grade.
  tier: "authoring" | "experimental";
  note?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyPrefix: "sk-ant-",
    keyHint: "sk-ant-...",
    tier: "authoring",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyPrefix: "sk-",
    keyHint: "sk-...",
    tier: "experimental",
    note: "Wired but conformance not yet measured — treat output as draft-grade.",
  },
];

export const DEFAULT_PROVIDER_ID = "anthropic";

export function providerInfo(id: string): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
