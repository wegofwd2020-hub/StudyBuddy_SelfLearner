// The reusable "scoped query" template (SCOPE.md §mental-model) shared by every
// generation path — the Query single lesson, the book generate-all loop, and
// per-topic regeneration. Stored per-book (Book.generationParams) and seeded
// from a global default (settingsStore). language/format are fixed at MVP but
// kept here so the template is the single source of truth.

export type Depth = "quick" | "standard" | "deep";

export interface GenerationParams {
  level: string; // one of constants/levels LEVELS
  depth: Depth;
  pages: number; // whole-book page target; 0 = no limit ("as much as possible")
  language: string; // "en" at MVP
  format: "lesson"; // D13 — only lesson at MVP
}

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  level: "student",
  depth: "standard",
  pages: 0,
  language: "en",
  format: "lesson",
};
