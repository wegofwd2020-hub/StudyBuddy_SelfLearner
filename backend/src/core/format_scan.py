"""Gate 3 (format-drift) scanning — shared by the generation worker and the
export/compile path.

The vendored validator (`pipeline/content_format_validator.py`) exposes
`check_content(content_type, data)`. Two adaptation facts drive this module:

  - Its rich per-section checks key on a **tutorial's** ``{title, content}``
    shape. A **lesson**'s sections carry the same information under
    ``{heading, body_markdown}`` and the validator's lesson path is a deliberate
    no-op upstream — so we adapt a lesson to the tutorial shape (without editing
    the vendored file, ADR-002) and relabel the warnings back to ``"lesson"``.
  - ``tutorial`` and ``experiment`` content match the validator natively.

Native generation produces only ``lesson`` (already gate-3'd by the worker); a
migrated/authored book may also carry ``tutorial`` and ``experiment`` content
that has never passed through a generation worker — the export scan
(``book_warnings``) is the first and only place that content meets gate 3.

All functions are pure and defensive: malformed input yields ``[]`` rather than
raising — gate 3 must never fail an already-valid generation or block a compile.
"""

from __future__ import annotations

from typing import Any

from pipeline.content_format_validator import check_content


def lesson_warnings(lesson: dict[str, Any]) -> list[dict[str, Any]]:
    """Format-drift warnings for one lesson dict (``LessonOutput`` shape).

    Adapts ``sections[].{heading, body_markdown}`` to the tutorial
    ``{title, content}`` shape the validator checks, then relabels the warnings'
    ``content_type`` back to ``"lesson"``.
    """
    try:
        sections = lesson.get("sections") or []
        adapted = {
            "sections": [
                {"title": s.get("heading", ""), "content": s.get("body_markdown", "")}
                for s in sections
                if isinstance(s, dict)
            ]
        }
        return [
            {**w.as_dict(), "content_type": "lesson"} for w in check_content("tutorial", adapted)
        ]
    except Exception:
        return []


def _typed_warnings(content_type: str, data: dict[str, Any]) -> list[dict[str, Any]]:
    """Native validator pass for content shapes the validator understands
    directly (``tutorial``, ``experiment``)."""
    try:
        return [w.as_dict() for w in check_content(content_type, data)]
    except Exception:
        return []


def book_warnings(book: dict[str, Any]) -> list[dict[str, Any]]:
    """Walk a book.json's generated content and collect format-drift warnings
    across every topic and content shape.

    Checks each topic's ``lesson`` (adapted), ``tutorial`` and ``experiment``
    (native); ``quizSets`` have no drift rules and are skipped. Each warning is
    tagged with ``topic_id`` / ``topic_title`` so a reviewer can locate it in the
    book. Pure + defensive — a malformed book yields ``[]``.
    """
    out: list[dict[str, Any]] = []
    content = book.get("content")
    if not isinstance(content, dict):
        return out

    for topic_id, topic in content.items():
        if not isinstance(topic, dict):
            continue
        topic_title = topic.get("title", "")

        per_topic: list[dict[str, Any]] = []
        lesson = topic.get("lesson")
        if isinstance(lesson, dict):
            per_topic += lesson_warnings(lesson)
        tutorial = topic.get("tutorial")
        if isinstance(tutorial, dict):
            per_topic += _typed_warnings("tutorial", tutorial)
        experiment = topic.get("experiment")
        if isinstance(experiment, dict):
            per_topic += _typed_warnings("experiment", experiment)

        for w in per_topic:
            out.append({**w, "topic_id": topic_id, "topic_title": topic_title})

    return out
