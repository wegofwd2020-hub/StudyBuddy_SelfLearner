# Default Library

Canonical, product-owned source for the **default shareable library** — the
curated set of books that ship with the app and seed a new device's local
library on first run.

See **[ADR-017](../docs/adr/ADR-017-default-shareable-library.md)** for the why
and the full decision (location, full-content policy, read-only / copy-on-write
semantics, D18 cap exclusion).

## Layout

```
library/
  manifest.json   ← the index: one entry per book (id, file, version, status, checksum)
  README.md       ← this file
  books/          ← the book.json files, full content committed
```

## Why this lives at the repo root (not in `mobile/`)

This directory is the **single source of truth**. It is consumed by:

- **mobile/** — a build step copies it into `mobile/assets/library/` so Expo
  bundles it; the first-run seeder imports each book via `importBook`.
- **compiler/** — the EPUB3/PDF pipeline (ADR-004) can compile these books
  directly.
- the **reader app** (separate repo, ADR-004) — same shareable `.book.json`.

Putting it under `mobile/assets/` would make it mobile-only and force the
compiler and reader to duplicate it.

## Book file format

Each file is a standard `.book.json` — the same shape `importBook`
(`mobile/src/storage/importBook.ts`) ingests and the OnDemand Authoring Studio
exports: `{ id, title, toc, createdAt, updatedAt, content?, generationParams?,
metadata? }`.

`metadata.status` is meaningful here:

- `draft` — structure only (or partial content). **Not promoted to a shipped
  default** until lessons are generated. The seeder may skip drafts.
- `published` — full content, reviewed, safe to seed as a default.

## Adding or updating a book

1. Drop the `.book.json` into `books/`.
2. Add/update its entry in `manifest.json` (id, title, file, version, status,
   counts). The `sha256`/`bytes` are recomputed for you on publish.
3. Default-library books carry **full generated content** (ADR-017) once
   `published` — ship the finished book so users get value without spending
   their own BYOK tokens.

## Publishing (owner-only, signed) — ADR-018

A book only ships as a default once the **system-owner** publishes it. Promotion
is owner-gated and tamper-evident (ADR-018 D2): publishing signs the entry's
integrity fields (`id, file, version, status, sha256, bytes`) with an HMAC keyed
by `SYSTEM_OWNER_SECRET`. Editing a `published` book, swapping its file, or
hand-flipping `status` invalidates the signature.

```bash
# (SYSTEM_OWNER_SECRET must be set in the environment)
python -m backend.src.core.owner_cli publish   <book-id>   # draft → published, recompute sha256/bytes, sign
python -m backend.src.core.owner_cli unpublish <book-id>   # → draft, drop signature
python -m backend.src.core.owner_cli verify                # every published book must be validly signed
```

`verify` is also a CI gate (`backend/tests/test_library_publish.py`): a
`status: published` entry without a valid owner signature fails the build, so a
book can't ship as a default without the owner's key. Mobile never holds the
secret — verification runs owner-/build-side; the app trusts what was bundled.

## Current contents

| Book | Status | Units | Content |
|---|---|---|---|
| Claude Certified Architect — Foundations | `draft` | 30 | scaffold only — lessons not yet generated |

> The cert guide is committed as a **draft scaffold** (TOC only). It is the
> first library entry but must have its 30 lessons generated before it is
> promoted to a shipped default. See ADR-017 §Status.
