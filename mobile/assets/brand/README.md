# Brand assets — Mentible

Candidate product logos (mark + "Mentible" wordmark). SVG is the source of
truth; the PNGs are transparent-background exports at 1200×1240.

| File | Concept |
|---|---|
| `mentible-growing-mind.{svg,png}` | "M" over an open book with a green "growing mind" tree — tagline *AI-Driven Self-Learner* |
| `mentible-pathway.{svg,png}` | Ascending pathway of learning steps (book → chat → video → compass) — tagline *Self-Learner Journey* |

### Gemini-generated concept set (`*-gemini.png`)

A six-up exploration generated with Gemini. **Raster only** (no SVG source),
469×384, on a light card background (not transparent). Wordmark reads "MENTIBLE"
with an *I*. Concept candidates for review — **not production-ready** (need a
text-free, transparent, higher-res redraw before any real use).

| File | Concept | Tagline |
|---|---|---|
| `mentible-growing-mind-gemini.png` | Tree-in-book "M" | *AI-Driven Self-Learner* |
| `mentible-guiding-light-gemini.png` | Lamp | *Guided Learning Hub* |
| `mentible-digital-spark-gemini.png` | Pencil / comet | *AI-Assisted Study* |
| `mentible-folded-m-gemini.png` | Folded-"M" monogram | *Modern Education Platform* |
| `mentible-mark-m-gemini.png` | 3-D "M" mark | — |
| `mentible-pathway-gemini.png` | Pathway | *Self-Learner Journey* |

### Text-free mark extracted from the Gemini growing-mind concept

Transparent, **text-free** crops of just the tree-in-book "M" glyph, pulled from
`mentible-growing-mind-gemini.png` (background keyed out; wordmark/tagline/header
removed). **Upscaled from a 469×384 raster — soft at large sizes.** Good for an
in-app hero or icon review; for a crisp store/launcher icon, redraw as vector
(cf. the SVG-sourced `mentible-growing-mind.svg`, a different rendition).

| File | Size | Use |
|---|---|---|
| `mentible-mark-growing-mind.png` | 224×214 | tight transparent mark |
| `mentible-icon-1024.png` | 1024×1024 | square, centered, ~12% safe margin — drop-in for `assets/icon.png` etc. (see below) |

> Brand note: "Mentible" is **provisional pending trademark clearance** (see the
> rebrand/ADR memory). Don't ship to a store under this name until cleared.

## Promoting one to the app

These are full logos (they include the wordmark), so they are **not** drop-in
launcher icons. To use one:

- **App launcher / splash / favicon** — produce a **square, text-free** crop of
  just the mark (e.g. 1024×1024), save as `assets/icon.png`,
  `assets/adaptive-icon.png` (foreground), `assets/splash.png`,
  `assets/favicon.png`, then wire them in `app.json` under
  `expo.icon`, `expo.android.adaptiveIcon.foregroundImage`, `expo.splash.image`,
  `expo.web.favicon`.
- **In-app hero** — the Query screen renders the wordmark as text
  (`BRAND_NAME`/`BRAND_TAGLINE` in `app/(tabs)/index.tsx`). To show the logo
  image instead, render one of these via `expo-image`/`Image` there (the full
  logo already contains the wordmark, so drop the text lines).

Original drop: `~/Downloads/mentible_recolored.zip` (also had opaque
white-background PNGs).
