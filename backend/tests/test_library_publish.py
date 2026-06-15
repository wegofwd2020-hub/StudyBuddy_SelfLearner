"""Tests for owner-gated, signed library publishing — ADR-018 D2 (O1/O5)."""

from __future__ import annotations

import json

import pytest

from backend.config import _REPO_ROOT
from backend.src.core import owner_cli
from backend.src.core.library_publish import (
    PublishError,
    canonical_payload,
    sign_entry,
    verify_entry,
    verify_manifest,
)


def _entry(**over):
    base = {
        "id": "b1",
        "file": "books/b1.book.json",
        "version": "1.0",
        "status": "published",
        "sha256": "a" * 64,
        "bytes": 1234,
    }
    base.update(over)
    return base


def test_sign_verify_roundtrip():
    e = _entry()
    assert verify_entry(e, sign_entry(e)) is True


@pytest.mark.parametrize("field", ["id", "file", "version", "status", "sha256", "bytes"])
def test_tampering_any_signed_field_breaks_the_signature(field):
    e = _entry()
    sig = sign_entry(e)
    tampered = _entry(
        **{field: "9" * 64 if field == "sha256" else 9999 if field == "bytes" else "x"}
    )
    assert verify_entry(tampered, sig) is False


@pytest.mark.parametrize("bad", [None, "", "deadbeef", "a" * 64])
def test_verify_fails_closed_on_bad_signature(bad):
    assert verify_entry(_entry(), bad) is False


def test_canonical_payload_requires_all_signed_fields():
    with pytest.raises(PublishError):
        canonical_payload({"id": "b1"})  # missing file/version/status/sha256/bytes


def test_verify_manifest_passes_for_signed_published_book():
    e = _entry()
    e["signature"] = sign_entry(e)
    assert verify_manifest({"books": [e]}) == []


def test_verify_manifest_flags_published_without_valid_signature():
    e = _entry()  # status published, no signature
    problems = verify_manifest({"books": [e]})
    assert len(problems) == 1 and "b1" in problems[0]


def test_verify_manifest_ignores_draft_books():
    assert verify_manifest({"books": [_entry(status="draft")]}) == []


def test_committed_default_library_manifest_is_valid():
    # The CI gate: every published book in the shipped manifest must be signed.
    # (The cert guide is currently draft, so this is vacuously true — but the gate
    # is live the moment anything is published.)
    manifest = json.loads((_REPO_ROOT / "library" / "manifest.json").read_text(encoding="utf-8"))
    assert verify_manifest(manifest) == []


def test_cli_publish_then_verify_then_unpublish(tmp_path, monkeypatch):
    # Build a throwaway library/ tree so the CLI doesn't touch the real manifest.
    books = tmp_path / "books"
    books.mkdir()
    book_file = books / "b1.book.json"
    book_file.write_text(
        json.dumps({"id": "b1", "title": "T", "toc": {"subjects": []}, "content": {}})
    )
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "books": [
                    {"id": "b1", "file": "books/b1.book.json", "version": "1.0", "status": "draft"}
                ],
            }
        )
    )
    monkeypatch.setattr(owner_cli, "_MANIFEST_PATH", manifest_path)

    assert owner_cli.main(["publish", "b1"]) == 0
    published = json.loads(manifest_path.read_text())["books"][0]
    assert published["status"] == "published"
    assert verify_entry(published, published["signature"]) is True
    # sha256/bytes were recomputed from the actual file.
    assert published["bytes"] == len(book_file.read_bytes())

    assert owner_cli.main(["verify"]) == 0

    assert owner_cli.main(["unpublish", "b1"]) == 0
    reverted = json.loads(manifest_path.read_text())["books"][0]
    assert reverted["status"] == "draft" and "signature" not in reverted


def test_cli_verify_fails_on_unsigned_published(tmp_path, monkeypatch):
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "books": [
                    {
                        "id": "x",
                        "file": "f",
                        "version": "1",
                        "status": "published",
                        "sha256": "a" * 64,
                        "bytes": 1,
                    }
                ]
            }
        )
    )
    monkeypatch.setattr(owner_cli, "_MANIFEST_PATH", manifest_path)
    assert owner_cli.main(["verify"]) == 1  # unsigned published → non-zero exit
