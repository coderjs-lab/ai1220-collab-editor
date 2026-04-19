from __future__ import annotations

from datetime import timedelta
import sqlite3

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse

from .. import repository
from ..deps import get_connection, get_current_user
from ..config import settings
from ..schemas import AuthResponse, MeResponse, MessageResponse, RegisterRequest, LoginRequest
from ..security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    utcnow,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=settings.secure_cookies,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        samesite="lax",
        secure=settings.secure_cookies,
        path="/",
    )


def _build_auth_response(connection, user: dict[str, object], *, status_code: int = 200) -> JSONResponse:
    refresh_token = generate_refresh_token()
    repository.create_refresh_token_record(
        connection,
        int(user["id"]),
        hash_refresh_token(refresh_token),
        (utcnow() + timedelta(days=settings.refresh_token_days)).isoformat(),
    )

    response = JSONResponse(
        {
            "user": user,
            "token": create_access_token(user),
        },
        status_code=status_code,
    )
    _set_refresh_cookie(response, refresh_token)
    return response


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a Draftboard account and immediately returns an access token plus refresh cookie session.",
)
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
    return _build_auth_response(connection, public_user, status_code=status.HTTP_201_CREATED)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Sign in with email and password",
    description="Authenticates an existing user and rotates the refresh-cookie session used for silent re-authentication.",
)
def login(payload: LoginRequest, connection=Depends(get_connection)):
    user = repository.find_user_by_email(connection, payload.email)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    public_user = repository.public_user(user)
    return _build_auth_response(connection, public_user)


@router.post(
    "/refresh",
    response_model=AuthResponse,
    summary="Refresh the current session",
    description="Uses the refresh cookie to mint a new short-lived access token and rotate the stored refresh token.",
)
def refresh_session(
    connection=Depends(get_connection),
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_cookie_name),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is invalid or expired")

    token_record = repository.find_active_refresh_token(connection, hash_refresh_token(refresh_token))
    if token_record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is invalid or expired")

    user = repository.find_user_by_id(connection, int(token_record["user_id"]))
    public_user = repository.public_user(user)
    if public_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is invalid or expired")

    repository.revoke_refresh_token(connection, int(token_record["id"]))
    return _build_auth_response(connection, public_user)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Sign out",
    description="Revokes the active refresh-cookie session and clears the browser cookie.",
)
def logout(
    connection=Depends(get_connection),
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_cookie_name),
):
    if refresh_token:
        repository.revoke_refresh_token_by_hash(connection, hash_refresh_token(refresh_token))

    response = JSONResponse({"message": "Signed out successfully"})
    _clear_refresh_cookie(response)
    return response


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get the current authenticated user",
    description="Returns the public user profile for the access token currently attached to the request.",
)
def me(current_user=Depends(get_current_user)):
    return {"user": current_user}
