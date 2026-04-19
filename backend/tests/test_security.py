from __future__ import annotations

from fastapi import HTTPException

import backend.app.security as security
from backend.app.security import (
    create_access_token,
    create_collab_session_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


TEST_JWT_SECRET = "test-secret-key-for-unit-security-suite-with-safe-length-123456"


def with_test_jwt_secret():
    original = security.settings.jwt_secret
    object.__setattr__(security.settings, "jwt_secret", TEST_JWT_SECRET)
    return original


def test_password_hash_and_verify_round_trip():
    password_hash = hash_password("password123")

    assert password_hash != "password123"
    assert verify_password("password123", password_hash) is True
    assert verify_password("wrong-password", password_hash) is False


def test_access_token_round_trip_decodes_expected_claims():
    original = with_test_jwt_secret()
    try:
        token = create_access_token({"id": 7, "email": "owner@example.com"})
        payload = decode_token(token, expected_type="access")

        assert payload["sub"] == "7"
        assert payload["email"] == "owner@example.com"
        assert payload["type"] == "access"
        assert payload["exp"] > payload["iat"]
    finally:
        object.__setattr__(security.settings, "jwt_secret", original)


def test_collaboration_token_carries_document_and_role_claims():
    original = with_test_jwt_secret()
    try:
        token = create_collab_session_token(
            user={"id": 9, "username": "alice", "email": "alice@example.com"},
            document_id=12,
            role="editor",
        )
        payload = decode_token(token, expected_type="collab")

        assert payload["sub"] == "9"
        assert payload["document_id"] == 12
        assert payload["role"] == "editor"
        assert payload["username"] == "alice"
    finally:
        object.__setattr__(security.settings, "jwt_secret", original)


def test_decode_token_rejects_wrong_token_type():
    original = with_test_jwt_secret()
    try:
        token = create_access_token({"id": 7, "email": "owner@example.com"})

        try:
            decode_token(token, expected_type="collab")
        except HTTPException as error:
            assert error.status_code == 401
            assert error.detail == "Invalid token type"
        else:
            raise AssertionError("Expected decode_token to reject the wrong token type")
    finally:
        object.__setattr__(security.settings, "jwt_secret", original)


def test_refresh_token_hash_is_stable_for_same_input():
    token = "refresh-token-value"

    assert hash_refresh_token(token) == hash_refresh_token(token)
    assert hash_refresh_token(token) != hash_refresh_token("other-token")
