# Multi-provider wiring — Phase 3 (per-book pinning + the picker)

> **Status:** scope for the third wiring slice on `feat/multi-provider-llm`.
> Builds on Phase 2b (`561cdd2`). Memo §6/§7/§9. The backend already accepts a
> `provider_id` + `model` (Phase 2b); Phase 3 makes the *client* carry, pin, and
> eventually expose that choice.

Splits into three slices, smallest-risk first.

---

## Phase 3a — provider/model as a (pinned) GenerationParam  ← THIS PR

**Why first & safe:** `GenerationParams` is stored **per book**
(`Book.generationParams`) and seeded from a global default. Adding `provider` +
`model` here means a book's choice is **pinned automatically** (memo §7 — one
model per book, reused for every chapter + regeneration). Default `provider =
"anthropic"`, `model = null` ⇒ behavior is unchanged and existing books are
unaffected (`loadDefaultParams` already merges over defaults; an absent provider
defaults to anthropic at the backend).

**Changes (mobile, Jest-tested):**
- `types/generationParams.ts`: add `provider: string` (default `"anthropic"`) and
  `model: string | null` (default `null`) to `GenerationParams` + DEFAULT.
- `types/lesson.ts`: `GenerateRequest` gains `provider_id?: string`, `model?: string`.
- `lib/buildGenerateRequest.ts`: send `provider_id: params.provider` and, when
  set, `model`. Both `useGenerateAll` and `useGenerateTopic` flow through this
  one builder, so the whole book pins to the same pair.

No UI yet — the field exists and is plumbed; exposing it is 3b.

---

## Phase 3b — the picker + per-provider BYOK keys (UI)

- **GenerationParamsEditor:** an *advanced* provider/model selector (default
  hidden; managed/anthropic is the default). Slots in beside Level/Depth/Diagrams.
- **Settings:** managed-vs-BYOK framing + a **per-provider key field** (last-4
  display), each in `expo-secure-store` under a provider-scoped key — today there
  is one Anthropic key; this generalizes the keystore to `{provider → key}`.
- **Capability tier surfaced** honestly (e.g. "draft-grade for structured books")
  so authors aren't surprised (memo §5/§9).
- Needs emulator verification (the white/yellow chip styling applies).

> ⚠ Coupling: a book pinned to a non-Anthropic provider needs that provider's key
> present, or generation fails the backend key-shape check. 3b must land the
> per-provider keystore before the picker can offer non-Anthropic providers.

---

## Phase 3c — provenance stamping (detect drift)

- Stamp `registry.provenance(provider, model)` (provider, model, model_verified,
  integration_version, contract_version) onto each generated unit + the book's
  pinned params, so the app can flag content made with an outdated model/
  integration and offer to regenerate (memo §6/§7). Backend returns it on the job
  result; mobile stores it per unit.

---

## Risk
3a is low (default-safe plumbing, unit-tested). 3b is the heavy slice (UI +
multi-key secure-store + a real behavioral coupling). 3c is additive metadata.

## Deferred to later phases
Phase 4 Anthropic tool-use; Phase 5 more providers (gated by conformance tier);
Phase 6 managed vault + metering + billing. Richer cross-provider conformance
suite still a follow-up.
