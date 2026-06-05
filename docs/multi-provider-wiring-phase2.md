# Multi-provider wiring — Phase 2 (the make-or-break)

> **Status:** scope for the second wiring slice on `feat/multi-provider-llm`.
> Builds on Phase 1 (`docs/multi-provider-wiring-phase1.md`, commit 48fde12) and
> memo §11.2 / §5. **This is where the thesis is tested:** can a second model
> produce schema-valid books? Do it with the least infra — *before* any vault,
> metering, or billing.

Phase 2 splits into two PRs, smallest-risk first.

---

## Phase 2a — swap blind retry for the validate→repair loop (Anthropic-only)

**Why first:** prove the loop change in isolation, with the provider we trust,
before a new provider + new key format are also in play.

**Today** (`tasks.py` §3): 6× blind re-roll with the *same* prompt; each attempt
`call_anthropic → parse_json_response → LessonOutput.model_validate`.

**After:** drive `pipeline.providers.conformance.generate_validated(provider,
req, validate, max_repairs)`:
- `provider` = `AnthropicAdapter` (Phase 1's), built once per job.
- `validate = lambda text: LessonOutput.model_validate(parse_json_response(text))`
  — raises on bad JSON/schema (the loop repairs), returns the model on success.
- On a schema failure the loop sends a **repair prompt** (original + validator
  error + the bad text) instead of an identical re-roll — cheaper, more
  effective, and the lever weaker models will need in 2b.

**Refactor:** introduce `call_llm(provider, req, validate) -> ConformanceResult`
in `anthropic_caller.py` (rename memo §3) that runs `generate_validated` and
remaps the typed `LLMError` hierarchy to the existing key-free `AnthropicCallError`.
`tasks.py` calls it inside a single `asyncio.to_thread` (the loop is sync), not
per-attempt. Envelope shredding / key handling unchanged.

**Decisions (2a):**
- **Repair budget** — `max_repairs` (default memo = 2 → 3 total calls). Current
  blind budget is 6. *Open: set the new budget (see question below).*
- **Transport vs schema errors** — `generate_validated` repairs *schema*
  failures but propagates provider errors (auth/rate-limit/timeout) unchanged.
  Decide whether a transient `LLMRateLimitError`/`LLMTimeoutError` gets a small
  **outer retry** or fails fast. *Open (see question below).*

**Test impact:** the retry e2e tests (`test_retries_invalid_json_then_succeeds`,
schema/invalid-json → failed) change to *repair* semantics — the mock returns
bad-then-good and we assert a repair prompt was sent. `test_idempotency`'s
"3 retries = 1 instantiation" becomes "N repair calls = 1 provider build".

---

## Phase 2b — one OpenAI-compatible BYOK provider + conformance gate

**Adds** real provider choice + the suite that decides authoring-grade vs draft.

- **Request surface:** add `provider_id` to `GenerateRequest` (default
  `"anthropic"`), resolved via `registry.validate_selection`; build the provider
  with `registry.build_provider(provider_id, api_key=…, model=…)`. (Full mobile
  picker is Phase 3 — here it's just the API param.)
- **`OpenAICompatibleProvider`** is ready (Bearer BYOK, capability-gated
  `response_format`, typed errors, usage + `tokens_estimated`). Route it through
  the same `call_llm` + `generate_validated` path from 2a.
- **🔐 Key redaction (security gate):** a second key format now flows. The
  structlog redaction filter + exception scrubber + the `GenerateRequest.api_key`
  validator (currently asserts `sk-ant-`) must cover `sk-…` (OpenAI) too. Extend
  the mandatory "no key in any log line" test to the OpenAI key format. **This is
  a hard gate — no non-Anthropic key flows until redaction covers it (memo §8).**
- **Conformance suite:** the same N lesson prompts across {anthropic, openai}
  with **recorded fixtures** (record once, replay — never live in CI, per
  CLAUDE.md), asserting schema-valid output and measuring the repair rate. This
  *is* the authoring-grade tier gate from memo §5.

**Decisions (2b):**
- Which JSON mode for OpenAI first — `json_object` (broad) vs `json_schema`
  (strict, needs our LessonOutput schema exported). Recommend `json_object` +
  repair loop initially; add `json_schema` once measured.
- Anthropic stays on the legacy adapter (prompt-embedded JSON) here; tool-use is
  Phase 4 — so the two providers use *different* JSON strategies, which the
  conformance suite should make visible.

---

## Risk
Highest of the phases (memo says so): the loop semantics change, the test rework
is non-trivial, and a second key format touches the security-critical redaction
path. Mitigation: ship **2a** (one provider, no new key) green first; gate **2b**
behind the extended redaction test.

## Deferred to Phase 3+
Per-book provider pinning + `provenance`, the mobile provider/model picker,
Anthropic tool-use (Phase 4), remaining providers (Phase 5), managed vault +
metering + billing (Phase 6).
