"""Gate 3 — whole-book format-drift scan (core.format_scan.book_warnings).

The export path is the only place tutorial + experiment content meets gate 3
(native generation emits only lessons, checked by the worker). book_warnings
walks every topic and content shape and tags each warning with its topic.
"""

from __future__ import annotations

from backend.src.core.format_scan import book_warnings, lesson_warnings


def _book(content: dict) -> dict:
    return {"id": "b1", "title": "T", "content": content}


def test_flags_lesson_tutorial_and_experiment_drift():
    book = _book(
        {
            "u1": {
                "topicId": "u1",
                "title": "Accounting",
                # lesson: tabular-by-title section with no GFM table
                "lesson": {
                    "sections": [
                        {"heading": "The Balance Sheet", "body_markdown": "Prose, no table."}
                    ],
                },
                # tutorial: formula-by-title section with no KaTeX (native shape)
                "tutorial": {
                    "title": "Accounting Tutorial",
                    "sections": [
                        {"title": "The Quadratic Formula", "content": "Just prose, no math."}
                    ],
                },
                # experiment: formula title but no math in any answer (native shape)
                "experiment": {
                    "experiment_title": "Kinematics Equation Lab",
                    "questions": [{"question": "Q?", "answer": "A prose answer, no math."}],
                },
            }
        }
    )

    warnings = book_warnings(book)
    rules = sorted(w["rule"] for w in warnings)
    assert rules == ["expected_formula", "expected_formula", "expected_table"]
    # Every warning is tagged back to its topic for locating in the book.
    assert all(w["topic_id"] == "u1" and w["topic_title"] == "Accounting" for w in warnings)
    # The lesson warning is relabelled to content_type "lesson", not "tutorial".
    table = next(w for w in warnings if w["rule"] == "expected_table")
    assert table["content_type"] == "lesson"


def test_clean_book_has_no_warnings():
    book = _book(
        {
            "u1": {
                "topicId": "u1",
                "title": "Accounting",
                "lesson": {
                    "sections": [
                        {
                            "heading": "The Balance Sheet",
                            "body_markdown": "| A | B |\n|---|---|\n| 1 | 2 |",
                        }
                    ],
                },
            }
        }
    )
    assert book_warnings(book) == []


def test_missing_or_malformed_content_is_safe():
    assert book_warnings({"title": "no content key"}) == []
    assert book_warnings({"content": "not a dict"}) == []
    assert book_warnings({"content": {"u1": "not a dict"}}) == []
    assert book_warnings({"content": {"u1": {"lesson": "not a dict"}}}) == []


def test_lesson_warnings_handles_missing_sections():
    assert lesson_warnings({}) == []
    assert lesson_warnings({"sections": None}) == []
    assert lesson_warnings({"sections": ["not a dict"]}) == []
