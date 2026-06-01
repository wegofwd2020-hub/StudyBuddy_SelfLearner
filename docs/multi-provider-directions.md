# Multi-Provider LLM Support — Thoughts & Directions

> **Status:** working memo (not an ADR). Builds on **ADR-005** (the accepted
> decision + phasing) and `docs/llm-providers.md` (the design target). This adds
> engineering opinion on *how* to build it and *what order de-risks it*. Where
> this and ADR-005 differ, ADR-005 wins until amended.
> **Author:** Siva (architecture). **Date:** 2026-06-01.

---

## 1. North star

Make the **LLM a swappable commodity behind one seam**, so provider/model is a
*parameter* of a generation — exactly like design, language, and visuals already
are in Mentible. The scoping layer (the 6 dimensions + prompts + schema
validation) stays the product IP; the model underneath is interchangeable.

Three properties to design for from day one:
1. **Substitutability** — any provider can answer any generation call.
2. **Verifiability** — every response is validated against our JSON schema
   *regardless of provider*; a model that can't comply is a failed call, not a
   corrupt book.
3. **Accountability** — every call returns normalized token usage so the managed
   path can meter and cap spend.

---

## 2. What's already true (don't re-litigate)

- **Decision is made** (ADR-005): provider-agnostic; **hybrid keys** — managed
  default + optional BYOK; accounts + metering pulled to MVP; margin-aware billing.
- **The seam exists** in embryo: `pipeline/providers/base.py` `LLMProvider` with
  `generate(prompt, max_tokens) -> (text, in_tok, out_tok)`, and a single
  Anthropic impl. `backend/.../anthropic_caller.py` is the mockable call seam with
  the key-redaction discipline.
- **Default model** is `claude-sonnet-4-6` (config `anthropic_default_model`).

So this is an **evolution of an existing seam**, not a greenfield build.

---

## 3. The seam: evolve it, don't fork it

`docs/llm-providers.md` proposes a richer interface (`LLMRequest`/`LLMResponse`,
typed errors, a `factory`, a `PROVIDER_REGISTRY`). The current `base.py` returns a
bare tuple. **Direction: converge on the richer interface, minimally.**

Recommended shape (Python, in `pipeline/` — see §4 on location):

```
@dataclass(frozen=True)
class LLMRequest:
    prompt: str
    max_tokens: int = 16384
    temperature: float = 0.2
    # optional, capability-gated:
    response_format: str | None = None      # "json" when the provider supports it
    system: str | None = None

@dataclass(frozen=True)
class LLMResponse:
    text: str
    provider_id: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    raw: object | None = None                # provider payload, for debugging only

class LLMProvider(ABC):
    provider_id: str
    capabilities: "Capabilities"             # see §5
    def generate(self, req: LLMRequest) -> LLMResponse: ...
```

**Why richer, not the tuple:** token usage, model id, and a `response_format`
hint all need to ride with the call once there are N providers and a metering
requirement. Keep it a *dataclass*, not a sprawling options bag.

**Migration is mechanical:** wrap the current tuple return in `LLMResponse`;
`anthropic_caller.call_anthropic` becomes `call_llm(provider, req)`. The thing
tests mock stays a single function — preserve that; it's the cleanest test seam
we have.

**Typed error hierarchy is worth it** (`LLMAuthError`, `LLMRateLimit`,
`LLMTimeout`, `LLMResponseError`, `LLMConfig`). Routing/failover (§7) and UX
messaging both branch on error *type*, and it keeps provider SDK exceptions —
which may stringify keys — from leaking upward.

---

## 4. Where the code lives (resolve before building)

ADR-005 says "`pipeline/` (or a new `llm/` package)". **Recommendation: build it
in `pipeline/` but treat the provider layer as Mentible-owned, not vendored.**

Rationale: `pipeline/` is partly vendored from OnDemand (ADR-002), and the
provider files have *already diverged* (the BYOK positional-key constructor).
A multi-provider layer will diverge completely — keeping it under the OnDemand
sync would create constant three-way-merge pain. Options:
- **(preferred)** keep `pipeline/providers/` but mark it **non-vendored** in
  `VENDORED.md` (it's ours now); the sync script must stop touching it.
- **(alt)** lift it to a new top-level `llm/` package that imports nothing from
  `backend/` (stay portable) — cleaner boundary, but a bigger move.

Either way the rule from CLAUDE.md holds: **the provider layer imports no backend
code** and stays independently testable.

---

## 5. The hard problem: JSON conformance across providers

This is the real risk, not the plumbing. Our pipeline depends on the model
returning **schema-valid JSON** (lesson/TOC), with a **3× retry** budget today.
Anthropic is reliable here; the OpenAI-compatible four vary, and open models
(Qwen/Gemma) vary a lot.

**Directions:**
- **Use each provider's strongest JSON mode, not raw prompting.** Capability flags
  on the provider drive this:
  - Anthropic → tool-use / `tools` with an input schema (most reliable), or prefill.
  - OpenAI / compatible → `response_format={"type":"json_schema", ...}` where
    supported, else `json_object`, else prompt-only.
  - capability matrix: `{ json_schema, json_object, tools, system_prompt,
    max_context, vision }`. Application asks the provider "can you guarantee
    JSON?" and adapts.
- **A validate → repair loop, not just retry.** On schema failure, send the
  validator error back to the model ("your JSON failed at `sections[2].body`:
  …fix and resend") before counting a hard retry. Cheaper and far more effective
  than blind re-rolls, especially for weaker models.
- **Per-provider prompt adapters.** Keep one canonical prompt; allow a thin
  per-provider preamble/format-shim. Don't fork the prompt library.
- **A conformance test suite** (see §10) is the gate that decides which providers
  are "authoring-grade" vs "draft-only".

> Practical stance: treat **schema-conformance as a capability tier**. Some
> providers are good enough for a *published book*; others only for a *fast draft
> / preview*. Surface that honestly rather than letting a weak model silently
> degrade a book.

---

## 6. Model selection: pin logical roles, not raw IDs

Add an indirection so the app pins **logical model roles** to concrete IDs in one
registry, rather than scattering `"claude-sonnet-4-6"` through the code:

```
ROLE_DEFAULTS = {
  "authoring":   ("anthropic", "claude-sonnet-4-6"),   # long, schema-heavy lessons
  "toc":         ("anthropic", "claude-sonnet-4-6"),   # structuring
  "fast-draft":  ("openai",    "<small/cheap model>"),
}
PROVIDER_REGISTRY = { provider_id: {base_url, env_key, default_model, caps} }
```

- One place to bump versions; a clear update policy (the doc's `deepseek-v4-pro`
  etc. are **unverified** — registry entries must be validated, not copied).
- Anthropic default stays `claude-sonnet-4-6` (ADR-005), **not** opus.
- Lets us route a *cheap* model at the TOC/structure step and a *strong* one at
  lesson generation — a real cost lever for the managed path.

---

## 7. Routing & failover — but protect book coherence

Capability/cost-aware routing is the payoff (failover on outage/rate-limit;
cheap-tier for drafts; regional access). **One caution specific to books:**

> **Pin one provider+model per book (or per generation batch).** A book is dozens
> of generations; silently switching models mid-book drifts voice, formatting, and
> diagram style. Store the chosen `(provider, model)` on the book's
> `generationParams` and reuse it for every chapter + regeneration. Failover may
> swap *within a call* on hard error, but the **default** stays pinned for
> consistency, and a model change should be a deliberate, logged event.

---

## 8. Keys & metering (managed vs BYOK)

Two regimes, kept isolated (ADR-005 D2/D3):
- **BYOK** — per-provider key in the request body, Redis TTL, used + shredded,
  never logged (ADR-001 discipline, extended per provider). Key is **scoped to its
  provider** — never send an OpenAI key to Anthropic, etc.
- **Managed** — provider keys are *our* secrets in a vault, rotated, never logged;
  gated behind accounts; every call metered.

**Normalized usage is the linchpin of the managed path.** `LLMResponse.{input,
output}_tokens` must be populated for every provider (some SDKs omit it → estimate
from a tokenizer as a fallback, and flag estimates). Per-user running totals +
plan caps live above the provider layer, not inside it.

The redaction rule is now **two keys to protect** (ours + theirs): the structlog
filter and exception scrubber must cover all provider key formats
(`sk-ant-…`, `sk-…`, etc.), not just `sk-ant`.

---

## 9. Mentible UX surface

- Provider/model becomes a **generation parameter** alongside size/language/
  visuals — it slots into the existing `GenerationParams` editor and the book's
  `generationParams`. Default = managed; advanced reveals provider + model.
- **Settings:** managed (just works) vs BYOK toggle; under BYOK, a per-provider
  key field (last-4 display only), each in `expo-secure-store`.
- Show the **capability tier** honestly (e.g. "this model is draft-grade for
  structured books") so authors aren't surprised by quality.

---

## 10. Testing (CLAUDE.md: never hit live APIs in CI)

- **Provider-contract tests** against the `LLMProvider` interface, with **recorded
  fixtures** per provider (record once, replay in CI).
- **JSON-conformance suite** — the same N prompts across every provider, asserting
  schema-valid output and measuring the repair-loop rate. This *is* the
  authoring-grade gate from §5.
- Keep the single mockable call function so existing tests barely change.
- Per-provider key-redaction test (extend the mandatory "no key in any log line"
  test to every key format).

---

## 11. Suggested build order (a de-risking refinement of ADR-005's phasing)

ADR-005 lists 5 phases. I'd **reorder the early steps to prove the risky part
with the least infra**:

1. **Evolve the seam** (`LLMRequest`/`LLMResponse`, typed errors, registry) —
   Anthropic-only, full parity. No behavior change. *(low risk, unblocks all)*
2. **Add ONE OpenAI-compatible provider behind BYOK** (OpenAI first — best JSON
   support). Stand up the **conformance + repair loop** here. *(this is where we
   learn if the whole thesis holds — do it before any vault/billing work)*
3. **Per-book provider pinning** + capability-tier surfacing in the app.
4. **Add the remaining OpenAI-compatible providers** (DeepSeek/Qwen/Gemma),
   gated by their conformance-tier result.
5. **Managed-key vault → accounts/metering → billing** (ADR-005 phases 3–5,
   unchanged) — the big infra, attempted only once the model layer is proven.

The shift vs ADR-005: **prove JSON conformance on a second provider (cheap, BYOK)
before building the managed vault + metering** (expensive, and pointless if the
output isn't authoring-grade).

---

## 12. Open questions / risks (extends ADR-005)

- **Conformance tiers** — formalize "authoring-grade vs draft-grade" and where the
  line sits; who decides, and is it per-model or per-(model × format-mode)?
- **Diagram quality varies by model.** Relevant to the book work — Mermaid output
  differs a lot across models. A weaker model may need diagram generation routed
  to a stronger one even within the same book. Worth measuring.
- **Token estimation fallback** when an SDK omits usage — accuracy vs. our caps.
- **Cross-provider temperature/length parity** — same `GenerationParams` may yield
  different page counts per provider; the 50-page target (per the book spec) is
  provider-sensitive.
- **Vendor ToS on reselling tokens** (managed path) — verify per provider (ADR-005).
- **Registry currency** — process to keep pinned model IDs valid as vendors churn.

---

## TL;DR

Evolve the existing `LLMProvider` seam into a small typed request/response +
capability + registry layer that we own (un-vendor it). The make-or-break is
**schema conformance across providers** — solve it with provider-native JSON
modes + a validate-and-repair loop + a conformance test gate, and treat
conformance as a *tier*. Pin one model per book for coherence. Prove all this on
**one cheap BYOK provider before** building the managed vault, metering, and
billing. Keep both key regimes isolated and unlogged.
