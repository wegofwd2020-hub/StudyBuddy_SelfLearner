"""Owner-gated, signed publishing of the default library — ADR-018 D2 (O1/O5).

The system-owner (ADR-018) is the only principal that may promote a default-library
book from `draft` to `published`. Promotion is **tamper-evident**: the owner signs
the book's integrity-critical fields with an HMAC keyed by the owner secret (O5).
Anyone holding the secret can *verify* (the owner CLI, a CI gate, and later the
#112 build step); the mobile app never holds the secret, so verification is a
build/publish-time gate, not a mobile-runtime check. The app trusts what was
bundled after that gate passed.

What is signed (the fields a tamper would target):
    id, file, version, status, sha256, bytes

So flipping `status` to "published", swapping the book file (sha256/bytes change),
or bumping the version all invalidate the signature unless the owner re-signs.

Only `published` books carry/need a signature. A `draft` is unsigned by definition.
"""

from __future__ import annotations

import hmac
from hashlib import sha256
from typing import Any

from backend.config import settings

# Fields covered by the signature, in a fixed order. Changing this list is a
# signature-format change and invalidates every existing signature.
_SIGNED_FIELDS = ("id", "file", "version", "status", "sha256", "bytes")


class PublishError(Exception):
    """Raised when a publish/verify precondition fails (bad status, missing field)."""


def _owner_key() -> bytes:
    # The owner secret is 64 hex chars (ADR-018 D1); use its 32 raw bytes as the
    # HMAC key for full entropy rather than the ASCII hex.
    return bytes.fromhex(settings.system_owner_secret)


def canonical_payload(entry: dict[str, Any]) -> bytes:
    """Deterministic byte payload over the signed fields of a manifest entry.

    Newline-joined `key=value` pairs in a fixed order — stable across dict
    ordering and JSON whitespace. Raises if a signed field is missing.
    """
    parts = []
    for field in _SIGNED_FIELDS:
        if field not in entry:
            raise PublishError(f"manifest entry missing signed field: {field!r}")
        parts.append(f"{field}={entry[field]}")
    return "\n".join(parts).encode("utf-8")


def sign_entry(entry: dict[str, Any]) -> str:
    """HMAC-SHA256 (hex) over the entry's signed fields, keyed by the owner secret."""
    return hmac.new(_owner_key(), canonical_payload(entry), sha256).hexdigest()


def verify_entry(entry: dict[str, Any], signature: str | None) -> bool:
    """True iff `signature` is a valid owner signature for `entry`.

    Constant-time compare; fails closed on a missing/empty/non-str signature or a
    malformed entry. Never raises on a bad signature — only returns False.
    """
    if not signature or not isinstance(signature, str):
        return False
    try:
        expected = sign_entry(entry)
    except PublishError:
        return False
    return hmac.compare_digest(signature, expected)


def verify_manifest(manifest: dict[str, Any]) -> list[str]:
    """Check every `published` book in a manifest carries a valid owner signature.

    Returns a list of human-readable problems (empty ⇒ all good). `draft` books are
    ignored. This is the gate a CI check / the #112 build step runs before a book
    is allowed to ship as a default (ADR-018 D2/O5).
    """
    problems: list[str] = []
    for entry in manifest.get("books", []):
        if entry.get("status") != "published":
            continue
        if not verify_entry(entry, entry.get("signature")):
            problems.append(
                f"book {entry.get('id', '<no-id>')!r} is published but its owner "
                f"signature is missing or invalid"
            )
    return problems
