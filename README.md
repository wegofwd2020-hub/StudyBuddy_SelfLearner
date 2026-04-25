# StudyBuddy Q

> **A purpose-built Anthropic client for self-learners.**
> *Q = Query — references the scoped-query model that is the engineering IP.*

Repo: `StudyBuddy_SelfLearner` (internal name).
Brand: **StudyBuddy Q** (public-facing).

---

## What is this?

A focused, opinionated mobile client on top of the Anthropic API. Adults paste
their own Anthropic API key (BYOK), describe what they want to learn, and get
a beautifully rendered lesson, explanation, or quiz back.

Not a chatbot. Not a course platform. Not a children's product.

Think *"Claude Code, but for learners instead of coders."*

---

## Status

🚧 **Pre-MVP** — directory stubs only, no application code yet.

| Doc | Purpose |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Durable spec — repo conventions, layer rules, pitfalls |
| [`SCOPE.md`](./SCOPE.md) | Full scope decisions and the reasoning behind each |
| [`docs/MVP_v1.md`](./docs/MVP_v1.md) | What the first usable slice looks like |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records |

Start with `SCOPE.md` if you want context. Read `CLAUDE.md` if you're about to
write code (you aren't yet — the codebase is empty).

---

## Quick links

- Mobile (RN + Expo) → [`mobile/`](./mobile/)
- Backend (FastAPI) → [`backend/`](./backend/)
- Vendored pipeline → [`pipeline/`](./pipeline/)
- ADRs → [`docs/adr/`](./docs/adr/)

---

## Key constraints (read these before any code lands)

1. **BYOK** — User pays Anthropic directly. We never store keys.
   See [`docs/adr/ADR-001-byok-security-model.md`](./docs/adr/ADR-001-byok-security-model.md).
2. **Vendored pipeline only** — Never import from `../StudyBuddy_OnDemand/`.
   See [`docs/adr/ADR-002-repo-structure-and-vendoring.md`](./docs/adr/ADR-002-repo-structure-and-vendoring.md).
3. **Adults only** — No COPPA, no FERPA, no school logic.
4. **Quality over scale** — This is a demo of the IP, not a mass-market consumer play.

---

## Sister project

[`StudyBuddy_OnDemand`](../StudyBuddy_OnDemand/) — the institutional B2B product
for schools. Different audience, different compliance, different infra. Shares
prompt IP via vendoring (one-way), nothing else.
