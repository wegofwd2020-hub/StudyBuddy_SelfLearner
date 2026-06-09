# Multi-provider wiring — Phase 1 (Anthropic parity through the seam)

> **Status:** implementation scope for the first wiring PR on
> `feat/multi-provider-llm`. Builds on `docs/multi-provider-directions.md`
> (the design memo) and ADR-005. Phase numbering follows the memo §11.
> **Goal of Phase 1:** route live Anthropic generation through the new
> `Provider` contract with **zero behavior change**. No tool-use, no repair
> loop, no second provider yet — just prove the seam swap is byte-for-byte
> neutral so everything after it is low-risk.

## The two ends

**Live path (today):**
`backend/src/generate/tasks.py` (6× blind retry) →
`anthropic_caller.call_anthropic(api_key, prompt, model, max_tokens) -> str` →
`pipeline.providers.anthropic.AnthropicProvider(api_key, model).generate(prompt, max_tokens) -> (text, in, out)`.

**New seam (ready, additive, currently unused by the backend):**
`pipeline.providers.contract.Provider.generate(LLMRequest) -> LLMResponse`;
`AnthropicAdapter` (wraps the legacy tuple provider — *no behavior change*);
`AnthropicNativeProvider` (tool-use — a behavior change, deferred);
`registry.build_provider()`; `conformance.generate_validated()` (repair loop, deferred).

## Decisions (Phase 1)

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Which provider | **`AnthropicAdapter`** (legacy `messages.create` + prompt-embedded JSON) | Native = tool-use = behavior change. Parity first. |
| 2 | `build_provider()` | **Not yet** — it returns the *Native* provider for `"anthropic"`. Construct `AnthropicAdapter` directly. | Keep parity; revisit when adopting tool-use. |
| 3 | Retry vs repair | **Keep** the 6× blind retry in `tasks.py`; don't wire `generate_validated` | Repair loop changes prompts + budget = behavior change. |
| 4 | `call_anthropic` | **Keep name + signature + `-> str`**; swap only internals to build `LLMRequest` and call a `Provider` | Memo §3: the single mockable function stays. `tasks.py` untouched. |
| 5 | Usage surfacing | Still discard `input/output_tokens` (return `str`) | Metering is a later phase. |

## Changes

1. **`pipeline/providers/anthropic_adapter.py`** — honor `req.max_tokens`:
   `self._inner.generate(req.prompt, max_tokens=req.max_tokens)` (was dropping it,
   hardcoding 16384 — would regress the page-scaled ceiling). `anthropic.py`
   already accepts `max_tokens`. Update the stale docstring note.
2. **`backend/src/generate/anthropic_caller.py`** — `call_anthropic` builds an
   `AnthropicAdapter`, calls `provider.generate(LLMRequest(prompt, max_tokens))`,
   returns `resp.text`. Map the typed `LLMError` hierarchy → existing
   `AnthropicCallError` (generic, key-free, `from None`). Signature unchanged.
3. **`backend/src/generate/tasks.py`** — untouched.
4. **Tests** — mechanical repoint of the patch target in 6 files:
   `backend.src.generate.anthropic_caller.AnthropicProvider` →
   `pipeline.providers.anthropic_adapter.AnthropicProvider`. Because the adapter
   constructs the inner provider with `(api_key=, model=)` and calls
   `.generate(prompt, max_tokens=…)`, **every existing assertion stays valid**
   (construction args, call args, tuple return, error/leak behavior).

## Parity argument
With the adapter, the bytes sent to Anthropic are identical to today: same
`messages.create`, same prompt, same `max_tokens` (after change #1). The
adapter's error remap is strictly *more* key-safe (typed `LLMError`, `from None`),
then `call_anthropic` re-wraps to `AnthropicCallError` as before. Gate: the full
`backend/tests/` + `tests/llm/` suites stay green.

## Deferred (each its own later PR)
- Tool-use via `AnthropicNativeProvider` (#1/#2) — needs a tools-schema prompt path.
- Repair loop via `generate_validated` (#3).
- Request-level `provider_id` + `validate_selection` + mobile picker; per-book
  pinning + `provenance` (memo §6/§7/§9).
- Usage surfacing + metering; key-redaction regex extended to `sk-…` when the
  OpenAI BYOK provider lands (memo §8).
- Rename `call_anthropic` → `call_llm(provider, req)` once a second provider exists.
