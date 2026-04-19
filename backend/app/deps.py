from __future__ import annotations

from typing import Any

from fastapi import Depends, Header, HTTPException, status

from .database import create_connection
from .security import decode_token
from . import repository


def get_connection():
    connection = create_connection()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def get_current_user(
    authorization: str | None = Header(default=None),
    connection=Depends(get_connection),
) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    token = authorization[7:]
    payload = decode_token(token, expected_type="access")
    user = repository.find_user_by_id(connection, int(payload["sub"]))
    public_user = repository.public_user(user)
    if public_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return public_user
