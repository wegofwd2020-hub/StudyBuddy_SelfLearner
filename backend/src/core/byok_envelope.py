"""Per-job encryption envelope for BYOK API keys.

Implements the Pattern B encryption layer described in ADR-001.

For each in-flight `/generate` job:

1. The handler derives a per-job ephemeral key from the server master key
   and the job_id, using HKDF-SHA256.
2. The user's API key is encrypted with that ephemeral key using AES-256-GCM.
3. The ciphertext is stored in Redis at `byok:{job_id}` with a TTL.
4. The Celery worker re-derives the ephemeral key (HKDF is deterministic),
   decrypts the ciphertext, calls Anthropic, then deletes the Redis entry.

A Redis snapshot alone yields ciphertext only — the master key lives in an
env var (separate blast radius). Rotating the master key invalidates all
in-flight jobs (acceptable per the 120 s TTL).

This module's tests live in tests/test_byok_envelope.py.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

# AES-256 = 32-byte key. AES-GCM nonce = 12 bytes.
_KEY_BYTES = 32
_NONCE_BYTES = 12
_HKDF_INFO = b"studybuddy-q/byok/v1"


# ── Master key parsing ────────────────────────────────────────────────────────


def parse_master_key(hex_key: str) -> bytes:
    """Parse and validate a 64-hex-char master key string into 32 bytes.

    Raises ValueError if the input is malformed.
    """
    if len(hex_key) != 64:
        raise ValueError(
            f"BYOK master key must be 64 hex characters ({_KEY_BYTES} bytes); got {len(hex_key)}"
        )
    try:
        return bytes.fromhex(hex_key)
    except ValueError as exc:
        raise ValueError("BYOK master key must be valid hex") from exc


# ── Per-job key derivation (HKDF) ─────────────────────────────────────────────


def derive_job_key(master_key: bytes, job_id: str) -> bytes:
    """Derive a per-job 32-byte key from the master key.

    Deterministic — handler and worker both call this with the same job_id
    and get the same key without sharing it through Redis.
    """
    if len(master_key) != _KEY_BYTES:
        raise ValueError(f"master_key must be exactly {_KEY_BYTES} bytes")
    if not job_id:
        raise ValueError("job_id must not be empty")

    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=_KEY_BYTES,
        salt=job_id.encode("utf-8"),
        info=_HKDF_INFO,
    )
    return hkdf.derive(master_key)


# ── Encrypt / decrypt ─────────────────────────────────────────────────────────


@dataclass(frozen=True)
class EnvelopedKey:
    """Bundle of (nonce, ciphertext) suitable for storage in Redis.

    Wire format: nonce (12 bytes) || ciphertext (variable).
    """

    nonce: bytes
    ciphertext: bytes

    def serialize(self) -> bytes:
        return self.nonce + self.ciphertext

    @classmethod
    def deserialize(cls, blob: bytes) -> EnvelopedKey:
        if len(blob) < _NONCE_BYTES + 1:
            raise ValueError("enveloped key blob is too short")
        return cls(nonce=blob[:_NONCE_BYTES], ciphertext=blob[_NONCE_BYTES:])


def encrypt_api_key(master_key: bytes, job_id: str, api_key: str) -> bytes:
    """Encrypt the user's API key for storage in Redis.

    Returns the serialized envelope (bytes safe to SETEX). The plaintext
    api_key is not retained anywhere by this function.
    """
    if not api_key:
        raise ValueError("api_key must not be empty")

    job_key = derive_job_key(master_key, job_id)
    nonce = os.urandom(_NONCE_BYTES)
    aesgcm = AESGCM(job_key)
    ciphertext = aesgcm.encrypt(nonce, api_key.encode("utf-8"), associated_data=None)

    # Defensive: best-effort overwrite of the local job_key reference. CPython
    # bytes immutability prevents true zeroing, but dropping the reference
    # makes the GC's job easier and signals intent to readers.
    del job_key

    return EnvelopedKey(nonce=nonce, ciphertext=ciphertext).serialize()


def decrypt_api_key(master_key: bytes, job_id: str, envelope_blob: bytes) -> str:
    """Decrypt a Redis envelope back into the user's API key.

    Raises:
        cryptography.exceptions.InvalidTag — if blob was tampered with or
            the master_key/job_id pair doesn't match.
        ValueError — if blob is malformed.
    """
    envelope = EnvelopedKey.deserialize(envelope_blob)
    job_key = derive_job_key(master_key, job_id)
    aesgcm = AESGCM(job_key)
    plaintext = aesgcm.decrypt(envelope.nonce, envelope.ciphertext, associated_data=None)
    del job_key
    return plaintext.decode("utf-8")
