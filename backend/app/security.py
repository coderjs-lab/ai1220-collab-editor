from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _encode_token(payload: dict[str, Any], expires_in_seconds: int) -> str:
    now = datetime.now(timezone.utc)
    body = {
        **payload,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_seconds)).timestamp()),
    }
    return jwt.encode(body, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(user: dict[str, Any]) -> str:
    return _encode_token(
        {"sub": str(user["id"]), "email": user["email"], "type": "access"},
        settings.access_token_ttl_seconds,
    )


def create_collab_session_token(*, user: dict[str, Any], document_id: int, role: str) -> str:
    return _encode_token(
        {
            "sub": str(user["id"]),
            "document_id": int(document_id),
            "role": role,
            "username": user["username"],
            "type": "collab",
        },
        settings.collab_session_ttl_seconds,
    )


def decode_token(token: str, *, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from error

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    return payload
