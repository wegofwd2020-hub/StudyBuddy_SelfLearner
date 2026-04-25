"""Tests for the BYOK envelope (HKDF + AES-GCM)."""

from __future__ import annotations

import uuid

import pytest
from cryptography.exceptions import InvalidTag

from backend.src.core.byok_envelope import (
    decrypt_api_key,
    derive_job_key,
    encrypt_api_key,
    parse_master_key,
)


def _master() -> bytes:
    return parse_master_key("0" * 64)


def test_round_trip():
    job_id = str(uuid.uuid4())
    api_key = "sk-ant-test-1234567890abcdef"

    blob = encrypt_api_key(_master(), job_id, api_key)
    recovered = decrypt_api_key(_master(), job_id, blob)

    assert recovered == api_key


def test_different_job_ids_yield_different_ciphertexts():
    api_key = "sk-ant-test-key"
    blob_a = encrypt_api_key(_master(), "job-a", api_key)
    blob_b = encrypt_api_key(_master(), "job-b", api_key)
    # Different nonce + different derived key → ciphertexts differ
    assert blob_a != blob_b


def test_wrong_job_id_cannot_decrypt():
    api_key = "sk-ant-test-key"
    blob = encrypt_api_key(_master(), "job-real", api_key)
    with pytest.raises(InvalidTag):
        decrypt_api_key(_master(), "job-impostor", blob)


def test_tampered_ciphertext_rejected():
    api_key = "sk-ant-test-key"
    blob = encrypt_api_key(_master(), "job-x", api_key)
    tampered = blob[:-1] + bytes([blob[-1] ^ 0x01])
    with pytest.raises(InvalidTag):
        decrypt_api_key(_master(), "job-x", tampered)


def test_master_key_must_be_64_hex():
    with pytest.raises(ValueError, match="64 hex characters"):
        parse_master_key("abc")
    with pytest.raises(ValueError, match="valid hex"):
        parse_master_key("Z" * 64)


def test_empty_api_key_rejected():
    with pytest.raises(ValueError, match="must not be empty"):
        encrypt_api_key(_master(), "job-x", "")


def test_derive_is_deterministic():
    """HKDF with same (master, job_id) produces same key — required for
    handler+worker symmetry without exchanging keys via Redis."""
    k1 = derive_job_key(_master(), "abc")
    k2 = derive_job_key(_master(), "abc")
    assert k1 == k2
    k3 = derive_job_key(_master(), "abd")
    assert k1 != k3


def test_nonce_uniqueness():
    """Two encryptions of the same plaintext with the same job_id should still
    differ (random nonce per call). Critical for AES-GCM safety."""
    api_key = "sk-ant-test"
    blob_a = encrypt_api_key(_master(), "job-x", api_key)
    blob_b = encrypt_api_key(_master(), "job-x", api_key)
    assert blob_a != blob_b
