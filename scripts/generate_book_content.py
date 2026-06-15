#!/usr/bin/env python3
"""Headless book-content generator (ADR-018 #113).

Fill a `.book.json`'s per-topic lesson content via the *real* Mentible pipeline —
the same prompt builder, provider seam, schema validation and repair loop that
`backend/src/generate/tasks.run_generation` uses, minus the Redis/job envelope.
The Anthropic key is read locally, used in-process, and NEVER printed or logged
(ADR-001 discipline).

Resumable: content is checkpointed to disk after every topic, and topics that
already have content are skipped — so a rate-limit/interrupt mid-run is safe to
re-run.

Usage:
    # key from a gitignored file (preferred — keeps it out of shell history/logs)
    python scripts/generate_book_content.py library/books/<book>.book.json --key-file .anthropic_key.local
    # or from the environment
    ANTHROPIC_API_KEY=sk-ant-... python scripts/generate_book_content.py library/books/<book>.book.json

Then publish with the owner CLI:
    python -m backend.src.core.owner_cli publish <book-id>
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# backend.config validates these at import; this runner never uses them (it talks
# to the provider directly), so set harmless placeholders before importing.
os.environ.setdefault("BYOK_MASTER_KEY", "0" * 64)
os.environ.setdefault("SYSTEM_OWNER_SECRET", "0" * 64)

from wegofwd_llm.conformance import generate_validated  # noqa: E402
from wegofwd_llm.contract import LLMRequest  # noqa: E402
from wegofwd_llm.registry import build_provider, provenance  # noqa: E402

from backend.src.generate.anthropic_caller import parse_json_response  # noqa: E402
from backend.src.generate.lesson_schema import LessonOutput  # noqa: E402
from backend.src.generate.prompt_builder import build_lesson_prompt  # noqa: E402

_MAX_TOKENS = 16384  # matches tasks._DEFAULT_MAX_TOKENS for a no-page-target lesson
_MAX_REPAIRS = 2  # matches tasks._MAX_REPAIRS (1 call + 2 targeted repairs)


def _read_key(key_file: str | None) -> str:
    """Anthropic key from env or a gitignored file. Never echoed."""
    env_key = os.environ.get("ANTHROPIC_API_KEY")
    if env_key:
        return env_key.strip()
    if key_file:
        p = Path(key_file)
        if p.is_file():
            return p.read_text(encoding="utf-8").strip()
    raise SystemExit(
        "no Anthropic key found — set ANTHROPIC_API_KEY or pass --key-file <gitignored file>"
    )


def _topic_prompt(title: str, subtopics: list[str]) -> str:
    # Mirrors mobile buildTopicPrompt: fold subtopics into the topic so the lesson
    # stays scoped to its place in the book.
    if not subtopics:
        return title
    return f"{title} — covering: {', '.join(subtopics)}"


def _iter_units(book: dict):
    for subject in book.get("toc", {}).get("subjects", []):
        yield from subject.get("units", [])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Generate per-topic lesson content for a book.json")
    ap.add_argument("book", help="path to the .book.json to fill")
    ap.add_argument("--key-file", default=None, help="file containing the Anthropic key (gitignored)")
    ap.add_argument("--limit", type=int, default=0, help="generate at most N topics this run (0 = all)")
    args = ap.parse_args(argv)

    book_path = Path(args.book)
    book = json.loads(book_path.read_text(encoding="utf-8"))
    params = book.get("generationParams", {})
    level = params.get("level", "professional")
    language = params.get("language", "en")
    depth = params.get("depth", "deep")
    diagram_register = params.get("diagramRegister", "technical")
    model = params.get("model")  # None → provider default (settings.anthropic_default_model)

    api_key = _read_key(args.key_file)
    content: dict = book.setdefault("content", {})

    todo = [u for u in _iter_units(book) if u.get("id") and u["id"] not in content]
    if args.limit > 0:
        todo = todo[: args.limit]

    total = sum(1 for _ in _iter_units(book))
    print(f"{len(content)}/{total} topics already have content; generating {len(todo)} now")
    if not todo:
        return 0

    provider = build_provider("anthropic", api_key=api_key, model=model)

    def _validate(text: str) -> LessonOutput:
        return LessonOutput.model_validate(parse_json_response(text))

    for i, unit in enumerate(todo, 1):
        tid, title = unit["id"], unit["title"]
        print(f"[{i}/{len(todo)}] {title[:70]}", flush=True)
        prompt = build_lesson_prompt(
            topic=_topic_prompt(title, unit.get("subtopics", [])),
            level=level,
            language=language,
            depth=depth,
            target_pages=0,
            diagram_register=diagram_register,
            prior_knowledge=None,
            framing=None,
            instructions=unit.get("enhancementInstructions"),
        )
        req = LLMRequest(prompt=prompt, max_tokens=_MAX_TOKENS, response_format="json")
        try:
            result = generate_validated(provider, req, _validate, max_repairs=_MAX_REPAIRS)
        except Exception as err:  # never print the key; type only
            print(f"  failed: {type(err).__name__} — stopping. Re-run to resume.", file=sys.stderr)
            return 1
        content[tid] = {
            "topicId": tid,
            "title": title,
            "lesson": result.parsed.model_dump(),
            "generatedAt": _now(),
            "provenance": provenance("anthropic", provider.model),
        }
        book["updatedAt"] = _now()
        # Checkpoint after every topic so an interrupt loses at most one lesson.
        book_path.write_text(json.dumps(book, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"done — {len(content)}/{total} topics now have content")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
