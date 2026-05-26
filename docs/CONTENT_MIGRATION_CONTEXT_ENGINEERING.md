# Content Migration — "Context Engineering in the Enterprise" → StudyBuddy Q

> Plan for moving a **published** authored book from the OnDemand Curriculum
> Authoring Studio into StudyBuddy Q's local-first reader. Execute when the
> project is published; the Q reader work (Phases 2–4) can start beforehand.
> Pairs with [`PORT_BRIEF.md`](PORT_BRIEF.md) and [`adr/ADR-003-book-authoring.md`](adr/ADR-003-book-authoring.md).

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

## Phase 1 — OnDemand: export script (`pipeline/export_book.py` or `backend/scripts/`)

- Args: `--curriculum-id <published Context Engineering id>`, `--out book.json`.
- Read the **content store** (preferred over DB — bodies already serialized) for
  every unit; transform each of the 5 bodies per the maps above.
- Lift `toc` from the project's `structured_toc` (identical shape); assign stable
  `topicId`s (UUIDs) and key generated content by them.
- Emit one Q-shaped `Book`:
  `{id, title, toc: StructuredTOC, content: {[topicId]: GeneratedTopic}}`.
- Lives in OnDemand; emits plain JSON only.

## Phase 2 — Q: grow the content model to hold 5 types

- `mobile/src/types/book.ts` — extend `GeneratedTopic` from `{lesson}` to
  `{lesson, tutorial?, quizSets?, experiment?}`; add `TutorialOutput`, `QuizSet`,
  `ExperimentOutput` mirroring the vendored prompt schema.
- `mobile/src/storage/bookStore.ts` — already keys by `topicId`; just a larger
  payload. Watch the **AsyncStorage quota** (an open ADR-003 question) — a full
  multi-format book may need per-topic keys instead of one blob.

## Phase 3 — Q: render the new types

- `mobile/src/components/LessonRenderer.tsx` (or a new `TopicRenderer`) — add
  Tutorial / Quiz-set / Experiment views. Reuse the existing Markdown + KaTeX +
  Mermaid WebView path (it renders the quiz GFM tables correctly). Decide
  interactive vs. static quiz rendering at build time.

## Phase 4 — Q: ingest path

- **Recommended for this one-off:** bundle `book.json` as a seed asset the library
  imports on first run.
- **Durable option:** an "Import book" action (Expo file picker / paste) →
  validate → `saveBook()`.

## Phase 5 — Verify

- Book appears in the library; TOC navigable; each topic shows lesson + tutorial +
  quizzes + experiment; Mermaid/KaTeX/tables render. Round-trip a couple of topics
  against the OnDemand originals.

## Sequencing

Phases 2–4 (Q reader) are the bulk and **do not depend on the specific book** —
build them ahead. Phase 1 (export) needs the published curriculum. The Q reader
work belongs in a **Q-rooted session**; the OnDemand export script can be done
from the OnDemand side.
