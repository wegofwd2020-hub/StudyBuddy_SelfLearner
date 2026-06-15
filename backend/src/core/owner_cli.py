"""Owner CLI for the default library — ADR-018 D2 (O1).

The system-owner's out-of-band surface (ADR-018 D5): promote a default-library
book to `published` (signing it, O5), revert it to `draft`, or verify the whole
manifest. Authorisation is possession of `SYSTEM_OWNER_SECRET` — signing and
verifying both require it, and config fails fast at startup if it is unset.

Usage:
    python -m backend.src.core.owner_cli verify
    python -m backend.src.core.owner_cli publish <book-id>
    python -m backend.src.core.owner_cli unpublish <book-id>

`verify` exits non-zero if any published book lacks a valid owner signature — wire
it into CI so a hand-edited `status: published` (without a real signature) fails
the build (ADR-018 D2/O5).
"""

from __future__ import annotations

import argparse
import json
import sys
from hashlib import sha256
from pathlib import Path
from typing import Any

from backend.config import _REPO_ROOT
from backend.src.core.library_publish import PublishError, sign_entry, verify_manifest

_MANIFEST_PATH = _REPO_ROOT / "library" / "manifest.json"


def _load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    # Pretty, UTF-8, trailing newline — matches the committed file's style and
    # keeps diffs minimal. Insertion order is preserved by json.
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _find_book(manifest: dict[str, Any], book_id: str) -> dict[str, Any]:
    for entry in manifest.get("books", []):
        if entry.get("id") == book_id:
            return entry
    raise PublishError(f"no book with id {book_id!r} in {_MANIFEST_PATH}")


def _refresh_integrity(entry: dict[str, Any]) -> None:
    """Recompute sha256/bytes (and generatedCount) from the actual book file, so a
    signature can't be produced over stale integrity metadata."""
    book_path = _MANIFEST_PATH.parent / entry["file"]
    raw = book_path.read_bytes()
    entry["sha256"] = sha256(raw).hexdigest()
    entry["bytes"] = len(raw)
    try:
        book = json.loads(raw)
        entry["generatedCount"] = len(book.get("content") or {})
    except (ValueError, AttributeError):
        pass  # leave generatedCount as-is if the book file isn't parseable here


def cmd_publish(book_id: str) -> int:
    manifest = _load_manifest(_MANIFEST_PATH)
    entry = _find_book(manifest, book_id)
    _refresh_integrity(entry)
    entry["status"] = "published"
    entry["signature"] = sign_entry(entry)
    _write_manifest(_MANIFEST_PATH, manifest)
    print(f"published {book_id!r} — signed {entry['sha256'][:12]}… ({entry['bytes']} bytes)")
    return 0


def cmd_unpublish(book_id: str) -> int:
    manifest = _load_manifest(_MANIFEST_PATH)
    entry = _find_book(manifest, book_id)
    entry["status"] = "draft"
    entry.pop("signature", None)
    _write_manifest(_MANIFEST_PATH, manifest)
    print(f"reverted {book_id!r} to draft")
    return 0


def cmd_verify() -> int:
    manifest = _load_manifest(_MANIFEST_PATH)
    problems = verify_manifest(manifest)
    if problems:
        print("✗ default-library signature check FAILED:")
        for p in problems:
            print(f"  - {p}")
        return 1
    published = sum(1 for b in manifest.get("books", []) if b.get("status") == "published")
    print(f"✓ default-library OK — {published} published book(s), all owner-signed")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="owner_cli", description="Default-library owner actions (ADR-018)"
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("verify", help="verify every published book carries a valid owner signature")
    p_pub = sub.add_parser("publish", help="promote a book to published and sign it")
    p_pub.add_argument("book_id")
    p_unpub = sub.add_parser("unpublish", help="revert a book to draft and drop its signature")
    p_unpub.add_argument("book_id")

    args = parser.parse_args(argv)
    try:
        if args.command == "verify":
            return cmd_verify()
        if args.command == "publish":
            return cmd_publish(args.book_id)
        if args.command == "unpublish":
            return cmd_unpublish(args.book_id)
    except (PublishError, OSError) as err:
        print(f"error: {err}", file=sys.stderr)
        return 2
    return 2  # unreachable (subparser is required)


if __name__ == "__main__":
    raise SystemExit(main())
