#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { compileEpub } from "./epub";
import { MermaidCliRenderer } from "./mermaid";
import type { Book } from "./types";

// compile-epub <book.json> [-o out.epub] [--mermaid]
//   --mermaid  render diagrams to inline SVG via @mermaid-js/mermaid-cli
//              (needs headless Chromium; install it in compiler/). Without it,
//              diagrams fall back to a readable text placeholder.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inPath = args.find((a) => !a.startsWith("-"));
  if (!inPath) {
    process.stderr.write("usage: compile-epub <book.json> [-o out.epub] [--mermaid]\n");
    process.exit(1);
  }
  const oIdx = args.indexOf("-o");
  const outPath = oIdx >= 0 ? args[oIdx + 1] : inPath.replace(/\.json$/i, "") + ".epub";
  const useMermaid = args.includes("--mermaid");

  const book = JSON.parse(readFileSync(inPath, "utf8")) as Book;
  const epub = await compileEpub(book, useMermaid ? { mermaid: new MermaidCliRenderer() } : {});
  writeFileSync(outPath, epub);
  process.stderr.write(
    `wrote ${outPath} (${epub.length} bytes, ${book.title})${useMermaid ? " [diagrams: SVG]" : ""}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
