# PORT BRIEF — Curriculum Authoring Studio → StudyBuddy Q

> Paste-ready context for a fresh, **Q-rooted** Claude session that does the port.
> Launch the session from this repo root so Q's CLAUDE.md + ADRs load as primary
> context. Pairs with [`docs/adr/ADR-003-book-authoring.md`](adr/ADR-003-book-authoring.md)
> and [`docs/CONTENT_MIGRATION_CONTEXT_ENGINEERING.md`](CONTENT_MIGRATION_CONTEXT_ENGINEERING.md).

## ⚠️ Current state — reconciled against shipped code (2026-05-26)

**The "port has NOT started" framing below is STALE.** A reconciliation of Q
`main` (@ b835420) against this brief found the Phase-1 slice **already shipped**.
Read this section first; treat the rest as design background.

**Already shipped in Q `main`:**
- `POST /structure` (TOC → topic tree) — `backend/src/structure/`; polls shared `GET /jobs/{id}`.
- Topic-tree editor — `mobile/src/components/TopicTreeEditor.tsx`, `BookEditor.tsx`, `app/book/new.tsx`.
- Generate-all loop — `mobile/src/hooks/useGenerateAll.ts`, `app/book/generate/[id].tsx`,
  `bookStore.setTopicContent` (gap-fills; doesn't re-bill finished topics).
- Bonus: saved-books browser, per-topic reader, BYOK key store (`secure/keyStore.ts`),
  dual web+native `LessonRenderer` (WebView), local-first `bookStore`/`lessonStore`.

**Still genuinely absent (deferred):** flow analysis · snapshots/versioning ·
regenerate-with-reason · EPUB export.

**What actually remains for the goal "read *Context Engineering in the Enterprise*
in Q"** (= content-migration Phases 2–4, see the migration doc):
- **Storage gap:** `GeneratedTopic` (`mobile/src/types/book.ts`) holds **only `lesson`** —
  add `tutorial` / `quizSets` / `experiment`.
- **Render gap:** `LessonRenderer.tsx` renders **only `LessonOutput`** — add the 3 new views.
- **Ingest:** load the exported `book.json` (bundled seed asset, or an import action).

**Discrepancies to resolve (not in the original brief):**
1. **Format vocabulary:** Q's backend declares `OutputFormat = Literal["lesson",
   "explanation", "quiz"]` — **"explanation", not "tutorial"**. OnDemand + the export
   use `tutorial`. The migration doc pinned `GeneratedTopic` keys as
   `tutorial`/`quizSets`/`experiment` — reconcile when building Phase 2.
2. **Native 5-type generation is NOT wired** — `backend/src/generate/` has only
   `build_lesson_prompt` + `lesson_schema.LessonOutput`. (Only matters if Q should
   *generate* non-lesson content itself — beyond the migration, which arrives pre-made.)
3. **Prompt IP for all 5 types is already vendored** (`pipeline/prompts.py` has
   `build_quiz/tutorial/experiment_prompt`) — just unwired. No vendored `schemas.py`
   validators yet (only `content_format_validator.py`).

---

## Mission

Bring multi-topic **book authoring** to StudyBuddy Q. A working PROTOTYPE of the
workflow already exists in the sibling repo `StudyBuddy_OnDemand` (the "Curriculum
Authoring Studio"). This is a **re-implementation on Q's stack — NOT a code
transplant, NOT a cross-import.**

## Binding decisions (already made — do not relitigate)

- **OnDemand ADR-004 ("Q grows up"):** the standalone, BYOK, individual
  "author-your-own-book + read it" product lives in Q, not the school platform.
  Q's old "not a course platform" line is relaxed to cover personal book authoring.
- **Reuse is PORT + VENDOR, ONE-WAY.** Honor Q's ADR-002: never `import` from
  `StudyBuddy_OnDemand`; vendor prompt/pipeline IP only. The prototype runs on
  Postgres + RLS + Celery + super_admin — none of that comes across.
- **Honor Q's ADR-001 (BYOK):** keys never stored; adults only; no COPPA/FERPA.

## First step

~~Read + finalize the draft ADR already written for this.~~ **Done:**
`docs/adr/ADR-003-book-authoring.md` (status: Proposed) is now on Q `main`,
alongside `docs/CONTENT_MIGRATION_CONTEXT_ENGINEERING.md`. The actual first step
now is the **content-migration Phases 2–4** (storage + render + ingest) — see the
reconciliation banner at the top and the migration doc.

## Reference sources in the sibling repo (READ to learn the workflow; never import)

Sibling path from this repo root: `../StudyBuddy_OnDemand/`

**Workflow / LLM IP — the parts worth vendoring + porting:**

| File | What it does |
|---|---|
| `pipeline/toc_structurer.py` | free-text TOC → structured topic tree (LLM) |
| `pipeline/flow_analyzer.py` | advisory pedagogical-order analysis (LLM) |
| `backend/src/admin/authoring_generation.py` | per-topic generate / regenerate / 3× retry |
| `backend/src/admin/authoring_flow.py` | cheap no-LLM ordering check |

**Behaviour spec — read as the de-facto requirements:**
`backend/tests/test_authoring.py`, `test_authoring_pr_b.py`, `test_authoring_pipeline.py`

**Stack-specific — DO NOT port (this is exactly what Q replaces):**
`backend/alembic/versions/0060_*.py` (Postgres tables/RLS) ·
`backend/src/admin/authoring_service.py` (Celery, RLS, super_admin, content store) ·
`backend/src/admin/authoring_router.py` (16 endpoints, `_require_author` admin gate) ·
`web/app/(admin)/admin/authoring/**` + `web/components/authoring/**` (Next.js admin)

## Stack translation (prototype → Q)

| Prototype (OnDemand) | Q |
|---|---|
| Postgres + migration 0060 tables | SQLite (or Redis-only at MVP), device-local |
| RLS / `app.current_school_id` | **DROP** — single-user, no tenancy |
| Celery async tasks | in-process async (Q's `/generate` + `/jobs` pattern) |
| super_admin JWT / `_require_author` | **DROP** — BYOK, no auth |
| `content_subject_versions` + publish | device library + reader (Q already has this) |
| Next.js admin console | RN/Expo screens (Q is mobile-first) |
| `SBMarkdown` + Mermaid/KaTeX renderer | Q's existing `LessonRenderer` (WebView) |

## Q's current state (on `main`)

> Stale snapshot — superseded by the reconciliation banner at the top.
> `feat/mobile-skeleton` has since merged to `main` (Q PRs #11/#13), so the
> "extends from one-artefact" framing is already done.

Single-lesson generate (`/generate` + `/jobs`), RN/Expo lesson library with
per-lesson delete + PDF export, vendored pipeline, BYOK. The book-authoring work
**extends** this from one-artefact to TOC → multi-topic-book.

## Phase 1 scope (smallest end-to-end slice) — ✅ SHIPPED (see banner)

1. Stateless `POST /structure` — paste TOC → structured topic tree (port `toc_structurer`).
2. Topic-tree editor screen — RN: edit / reorder / add / remove topics.
3. Generate-all loop — iterate topics → the existing single-lesson generator.

**Defer:** flow analysis, snapshots/versioning, regenerate-with-reason, EPUB export.

## Gotchas that DO carry over (re-solve on Q's stack)

- `generate_one` needs a **3× retry on malformed LLM JSON** (LaTeX/markdown backslashes).
- Generation prompts use `diagram_emphasis=True` (Mermaid + richer prose) to counter
  "too terse" output — keep that.

## Gotchas that DON'T apply (prototype-only — Postgres/Celery/RLS artifacts)

jsonb codec registration · `ensure_pipeline_path()` sys.path hack · RLS bypass ·
`unit_name NOT NULL` · `content_subject_versions` provider CHECK — all **N/A** on Q.
