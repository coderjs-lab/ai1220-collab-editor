from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository
from ..deps import get_connection, get_current_user
from ..schemas import AuthResponse, MeResponse, RegisterRequest, LoginRequest
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, connection=Depends(get_connection)):
    if repository.find_user_by_email(connection, payload.email) or repository.find_user_by_username(connection, payload.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already taken")

    try:
        user = repository.create_user(
            connection,
            username=payload.username.strip(),
            email=payload.email,
            password_hash=hash_password(payload.password),
        )
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already taken") from error

    public_user = repository.public_user(user)
    return {"user": public_user, "token": create_access_token(public_user)}


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, connection=Depends(get_connection)):
    user = repository.find_user_by_email(connection, payload.email)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    public_user = repository.public_user(user)
    return {"user": public_user, "token": create_access_token(public_user)}


@router.get("/me", response_model=MeResponse)
def me(current_user=Depends(get_current_user)):
    return {"user": current_user}

