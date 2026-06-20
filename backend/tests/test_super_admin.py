"""Super-admin operator role — ADR-020 D1/D2 (ticket #1).

Covers the config-allowlist derivation (`admin.is_super_admin`), the
`VerifiedToken → Principal` mapping that derives the flag (`deps._to_principal`),
and the `require_super_admin` dependency's 403/pass behaviour. No network, no DB.
"""

from __future__ import annotations

import datetime as dt
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from backend.src.auth import admin, deps
from backend.src.auth.principal import Principal, VerifiedToken

ISSUER = "https://proj.supabase.co/auth/v1"
AUDIENCE = "authenticated"
_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


# ── allowlist parsing ────────────────────────────────────────────────────────


def test_parse_csv_trims_and_drops_blanks():
    assert admin._parse_csv("  a@x.com , ,b@y.com,") == frozenset({"a@x.com", "b@y.com"})
    assert admin._parse_csv("") == frozenset()
    assert admin._parse_csv("   ") == frozenset()


# ── is_super_admin derivation ────────────────────────────────────────────────


def test_email_match_is_case_insensitive(monkeypatch):
    monkeypatch.setattr(admin, "_ADMIN_EMAILS", frozenset({"boss@x.com"}))
    monkeypatch.setattr(admin, "_ADMIN_SUBS", frozenset())
    assert admin.is_super_admin(sub="s1", email="BOSS@X.com") is True
    assert admin.is_super_admin(sub="s1", email="  boss@x.com  ") is True
    assert admin.is_super_admin(sub="s1", email="other@x.com") is False


def test_sub_match_is_exact(monkeypatch):
    monkeypatch.setattr(admin, "_ADMIN_EMAILS", frozenset())
    monkeypatch.setattr(admin, "_ADMIN_SUBS", frozenset({"sub-abc"}))
    assert admin.is_super_admin(sub="sub-abc", email=None) is True
    assert admin.is_super_admin(sub="sub-ABC", email=None) is False  # opaque, exact


def test_empty_allowlist_means_nobody(monkeypatch):
    monkeypatch.setattr(admin, "_ADMIN_EMAILS", frozenset())
    monkeypatch.setattr(admin, "_ADMIN_SUBS", frozenset())
    assert admin.is_super_admin(sub="anyone", email="anyone@x.com") is False


def test_none_email_is_safe(monkeypatch):
    monkeypatch.setattr(admin, "_ADMIN_EMAILS", frozenset({"boss@x.com"}))
    monkeypatch.setattr(admin, "_ADMIN_SUBS", frozenset())
    assert admin.is_super_admin(sub="s1", email=None) is False


# ── mapping VerifiedToken → Principal derives the flag ───────────────────────


def test_to_principal_derives_admin(monkeypatch):
    monkeypatch.setattr(admin, "_ADMIN_EMAILS", frozenset({"boss@x.com"}))
    monkeypatch.setattr(admin, "_ADMIN_SUBS", frozenset())
    vt = VerifiedToken(sub="s1", email="boss@x.com", issuer=ISSUER, raw_claims={})
    p = deps._to_principal(vt)
    assert isinstance(p, Principal)
    assert p.is_super_admin is True


def test_to_principal_ordinary_user_not_admin(monkeypatch):
    monkeypatch.setattr(admin, "_ADMIN_EMAILS", frozenset({"boss@x.com"}))
    monkeypatch.setattr(admin, "_ADMIN_SUBS", frozenset())
    p = deps._to_principal(VerifiedToken(sub="s2", email="user@x.com", issuer=ISSUER))
    assert p.is_super_admin is False


# ── require_super_admin dependency ───────────────────────────────────────────


def test_require_super_admin_allows_admin():
    p = Principal(sub="s1", email="boss@x.com", issuer=ISSUER, is_super_admin=True)
    assert deps.require_super_admin(principal=p) is p


def test_require_super_admin_forbids_ordinary_user():
    p = Principal(sub="s2", email="user@x.com", issuer=ISSUER, is_super_admin=False)
    with pytest.raises(HTTPException) as ei:
        deps.require_super_admin(principal=p)
    assert ei.value.status_code == 403


def test_require_super_admin_403_body_names_no_identity():
    p = Principal(sub="s2", email="user@x.com", issuer=ISSUER, is_super_admin=False)
    try:
        deps.require_super_admin(principal=p)
    except HTTPException as e:
        assert "s2" not in str(e.detail)
        assert "user@x.com" not in str(e.detail)


# ── end-to-end through the dependency: allowlisted token → admin principal ────


def _mint(**overrides) -> str:
    now = dt.datetime.now(dt.UTC)
    payload = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": "user-uuid-123",
        "email": "boss@x.com",
        "iat": now,
        "exp": now + dt.timedelta(hours=1),
    }
    payload.update(overrides)
    return jwt.encode(payload, _KEY, algorithm="RS256")


def _verifier():
    from backend.src.auth.verifier import JwtVerifier

    return JwtVerifier(issuer=ISSUER, audience=AUDIENCE, key_resolver=lambda _t: _KEY.public_key())


def _req(authorization: str | None = None):
    headers = {"authorization": authorization} if authorization is not None else {}
    return SimpleNamespace(headers=headers)


def test_require_user_derives_admin_from_allowlisted_token(monkeypatch):
    monkeypatch.setattr(deps, "_verifier", _verifier())
    monkeypatch.setattr(admin, "_ADMIN_EMAILS", frozenset({"boss@x.com"}))
    monkeypatch.setattr(admin, "_ADMIN_SUBS", frozenset())
    p = deps.require_user(_req(f"Bearer {_mint()}"))
    assert p.sub == "user-uuid-123"
    assert p.is_super_admin is True


def test_require_user_ordinary_token_not_admin(monkeypatch):
    monkeypatch.setattr(deps, "_verifier", _verifier())
    monkeypatch.setattr(admin, "_ADMIN_EMAILS", frozenset({"boss@x.com"}))
    monkeypatch.setattr(admin, "_ADMIN_SUBS", frozenset())
    p = deps.require_user(_req(f"Bearer {_mint(email='nobody@x.com')}"))
    assert p.is_super_admin is False
