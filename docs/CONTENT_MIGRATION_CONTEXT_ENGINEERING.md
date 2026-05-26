# Content Migration — "Context Engineering in the Enterprise" → StudyBuddy Q

> Plan for moving a **published** authored book from the OnDemand Curriculum
> Authoring Studio into StudyBuddy Q's local-first reader. Execute when the
> project is published; the Q reader work (Phases 2–4) can start beforehand.
> Pairs with [`PORT_BRIEF.md`](PORT_BRIEF.md) and [`adr/ADR-003-book-authoring.md`](adr/ADR-003-book-authoring.md).

**Status (2026-05-26): all code phases shipped (Phases 1–4). Only the
operational run remains** — publish the book, export, import. See Phase 5.

| Phase | What | Status |
|---|---|---|
| 1 | OnDemand export script | ✅ OnDemand PR #400 |
| 2 | Q: 5-type content model | ✅ Q PR #15 |
| 3 | Q: render 5 types | ✅ Q PR #15 |
| 4 | Q: ingest `book.json` | ✅ Q PR #16 |
| 5 | Operational run + verify | ⏳ waits on the book being published in the Studio |

**Scope decision (owner, 2026-05-26): "Everything"** — carry lesson + tutorial +
3 quiz sets + experiment per topic (full fidelity), not lesson-only.

**Nature of the move:** a **data copy**, not a code port. An OnDemand-side script
reads the published content store and emits plain JSON; Q ingests plain JSON. No
code crosses repos, so ADR-002's one-way vendoring rule is **untouched** (it
forbids *code* import, not data). Content also stays in OnDemand — this is a copy.

---

## Key finding — the shapes are near-identical (shared prompt IP)

Both repos descend from the same vendored `pipeline/prompts.py`, so the **TOC is
byte-identical** and the **lesson differs only by field renames**:

| OnDemand body | Q `LessonOutput` | Transform |
|---|---|---|
| `StructuredTOC{subjects[{subject_label, units[{title, subtopics, prerequisites}]}]}` | identical | none |
| `sections[{heading, body}]` | `sections[{heading, body_markdown}]` | rename `body` → `body_markdown` |
| `key_points[]` | `key_takeaways[]` | rename |
| `synopsis`, `learning_objectives[]` | same | direct |
| `reading_level` | `level` | map |
| — | `further_reading[]`, `topic`, `language` | default `[]` / fill from unit title + lang |

Tutorial / quiz / experiment target shapes mirror the **same vendored
`pipeline/prompts.py`** (e.g. tutorial = `{title, sections[{title, content}]}`), so
Q's new types are defined from the shared prompt schema — no invented structures.
Finalize those maps against `pipeline/prompts.py` at execution time.

## Note — Q is already past the PORT_BRIEF baseline

`PORT_BRIEF.md` says "the code port has NOT started," but Q already shipped (PR #11
/ #13, now on `main`): the `/structure` endpoint, `bookStore.ts` (AsyncStorage,
local-first), `Book`/`GeneratedTopic`/`StructuredTOC` types, and a generate-all
loop. The book-authoring port has effectively landed. This migration builds on it.

---

## Phase 0 — Preconditions (the "ready" gate)

- Project **published** in the Authoring Studio (every topic accepted → publish).
  Until then `authoring_active_versions` may point at unaccepted drafts.
- Content-store files present:
  `curricula/{curriculum_id}/{unit_id}/{lesson,tutorial,quiz_set_1..3,experiment}_en.json`.

## Phase 1 — OnDemand: export script ✅ SHIPPED (OnDemand PR #400)

Lives in the **OnDemand** repo (`StudyBuddy_OnDemand`):

| File | Role |
|---|---|
| `backend/src/admin/book_export.py` | Pure, DB-free transform layer + `assemble_book()`. |
| `backend/scripts/export_book.py` | asyncpg CLI shell. |
| `backend/tests/test_book_export.py` | 12 unit tests (synthetic bodies, no DB). |

Two deviations from the original sketch, both deliberate:
- **Reads the DB authoring tables, not the content store** — `authoring_projects`
  (TOC + title + grade), `authoring_active_versions`⋈`authoring_topic_versions`
  (accepted bodies), `curriculum_units` (authoritative unit order). One source,
  no filesystem-layout coupling.
- **Keyed by `--project-id`, not `--curriculum-id`** (the authoring tables are
  project-scoped). Use `--list` to find it by title.

Run (when published): `python scripts/export_book.py --project-id <uuid> --out book.json`.

Emits one Q-shaped `Book`:
`{id: "authored-<project_id>", title, toc: StructuredTOC, content: {[topicId]: GeneratedTopic}}`,
with `topicId = uuid5(unit_id)` (stable across re-exports) injected into each TOC unit.

**`book_export.py` is the de-facto contract for the Phase-2 Q types below.** The
tutorial / quiz / experiment objects it emits use the vendored-schema field names
(snake_case, pipeline metadata like `model`/`content_version`/`unit_id` stripped):
- `tutorial`: `{title, sections[{section_id, title, content, examples[], practice_question}], common_mistakes[]}`
- `quizSets[]`: `{set_number, questions[{question_id, question_text, question_type, options[{option_id, text}], correct_option, explanation, difficulty}], total_questions, passing_score, estimated_duration_minutes}`
- `experiment`: `{experiment_title, materials[], safety_notes[], steps[{step_number, instruction, expected_observation}], questions[{question, answer}], conclusion_prompt}`
- `lesson`: Q's existing `LessonOutput` (the field-rename map above).

## Phase 2 — Q: grow the content model to hold 5 types ✅ SHIPPED (Q PR #15)

`mobile/src/types/book.ts` — `GeneratedTopic` extended to
`{lesson, tutorial?, quizSets?, experiment?}`; added `TutorialOutput`, `QuizSet`,
`ExperimentOutput` matching the `book_export.py` contract above. `bookStore.ts`
keys by `topicId` unchanged (larger payload). AsyncStorage-quota concern still
open (ADR-003) — revisit if a full multi-format book is large.

## Phase 3 — Q: render the new types ✅ SHIPPED (Q PR #15)

`mobile/src/components/contentHtml.ts` (new) — pure HTML builders; `buildTopicHtml`
renders lesson + tutorial + quiz sets + experiment. `LessonRenderer.tsx` refactored
onto a shared `HtmlView` + new `TopicRenderer`; the per-topic screen renders the
full topic. Quiz question text + explanations route through markdown so GFM tables
/ KaTeX render. Quizzes rendered **static** (question + options + answer + explanation).

## Phase 4 — Q: ingest path ✅ SHIPPED (Q PR #16)

`mobile/src/storage/importBook.ts` — `parseBook()` (validate → normalized `Book`)
+ `importBook()` (validate + `saveBook`). `app/book/import.tsx` — **paste-based**
import screen (chose paste over file-picker to match the existing "paste a TOC"
flow and avoid a native dependency); "Import a book" entry on the books screen.

## Phase 5 — Operational run + verify ⏳ REMAINING

The code is done; this is the manual run, gated on the book being **published** in
the Studio:
1. Publish "Context Engineering in the Enterprise" in the Authoring Studio.
2. OnDemand: `python scripts/export_book.py --project-id <uuid> --out book.json`.
3. Q: open the app → Books → **Import a book** → paste `book.json`.
4. Verify: book appears in the library; TOC navigable; each topic shows lesson +
   tutorial + quizzes + experiment; Mermaid/KaTeX/tables render. Round-trip a
   couple of topics against the OnDemand originals.

## What's left

Nothing in code — Phases 1–4 are merged (OnDemand `main`: export; Q `main`:
reader + import). The remainder is the **operational run in Phase 5**, gated on
the book being published in the Authoring Studio.
