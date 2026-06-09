# Multi-provider wiring — Phase 4 (Anthropic tool-use)

> **Status:** scope for the Anthropic tool-use switch on `feat/multi-provider-llm`.
> Builds on Phases 1–3. Memo §5. **This is a deliberate behavior change** (not a
> parity step), so it carries a live-verification gate before merge.

## What changes
Switch the backend's Anthropic **lesson** path from the legacy `AnthropicAdapter`
(prose JSON via `messages.create`) to `AnthropicNativeProvider` (tool-use: forces
a single `emit_result` tool whose `input` IS the JSON object). Tool-use is
Anthropic's most reliable structured-output path and pairs with the repair loop.

- `tasks.py` already builds non-anthropic providers via `registry.build_provider`,
  which returns `AnthropicNativeProvider` for `"anthropic"`. So: **unify the
  construction** — always `build_provider(provider_id, api_key, model)` — and drop
  the adapter special-case. Preserve the settings-based default model for
  anthropic (`model or settings.anthropic_default_model`) since the registry
  default is a fixed string.
- `req.response_format="json"` (already set) → the native provider uses tool-use
  with a generic `{"type":"object"}` input schema. The prompt still describes the
  LessonOutput shape; the tool forces the model to emit a JSON object.

**Out of scope (follow-up):** passing the full `LessonOutput.model_json_schema()`
as the tool `input_schema` (`response_format="json_schema"`). Stronger, but pydantic
schemas use `$defs/$ref` and must be verified against live Anthropic first.

**Unchanged:** the structure (TOC) path still uses `call_anthropic` → the adapter
(Anthropic-only, prose JSON). Only lesson generation moves to tool-use.

## Test-seam migration (the bulk of the work)
The lesson e2e/idempotency/leak tests mock `anthropic_adapter.AnthropicProvider`
(legacy, tuple-returning). Tool-use doesn't go through that class, so those mocks
must move to the **provider-agnostic seam** the OpenAI test already uses:
`patch("backend.src.generate.tasks.build_provider", return_value=<fake Provider>)`
where the fake's `.generate(req)` returns an `LLMResponse` (or raises a typed
`LLMError`). A shared `_fake_provider(...)` helper replaces the per-test tuple
setup. Assertions about the *inner* provider's construction/call args are dropped
(construction is now mocked); prompt-threading assertions read `req.prompt`.

Files: `test_generate_e2e.py` (lesson tests), `test_idempotency.py`,
`test_no_key_in_logs.py` (worker path). `test_anthropic_caller.py` and
`test_structure.py` are **unaffected** (they exercise the adapter via the
unchanged `call_anthropic`/structure path).

## Verification
- Unit gate: backend/tests + tests/llm green after the migration.
- **⚠ LIVE GATE (before merge):** a real BYOK lesson generation through tool-use
  on a device/emulator — CI cannot hit Anthropic, so tool-use acceptance + JSON
  quality must be confirmed manually. Until then, Phase 4 is "unit-green,
  live-unverified".

## Risk
Higher than 1–3: a behavior change whose real effect is unobservable in CI, plus
a non-trivial test rewrite. The adapter stays in the tree as the instant rollback.
