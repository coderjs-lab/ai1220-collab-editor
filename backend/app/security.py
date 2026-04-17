from __future__ import annotations

from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
from typing import Any

import jwt

from .config import settings


SCRYPT_N = 1 << 14
SCRYPT_R = 8
SCRYPT_P = 1
JWT_ALGORITHM = 'HS256'


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcnow_iso() -> str:
    return utcnow().isoformat()


def _b64encode(raw: bytes) -> str:
    return urlsafe_b64encode(raw).decode('ascii').rstrip('=')


def _b64decode(raw: str) -> bytes:
    padding = '=' * (-len(raw) % 4)
    return urlsafe_b64decode(raw + padding)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(
        password.encode('utf-8'),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=64,
    )
    return f'scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64encode(salt)}${_b64encode(digest)}'


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, n_value, r_value, p_value, salt, digest = password_hash.split('$')
    except ValueError:
        return False

    if algorithm != 'scrypt':
        return False

    derived = hashlib.scrypt(
        password.encode('utf-8'),
        salt=_b64decode(salt),
        n=int(n_value),
        r=int(r_value),
        p=int(p_value),
        dklen=64,
    )
    return hmac.compare_digest(_b64encode(derived), digest)


def create_access_token(user_id: int, email: str) -> str:
    expires_at = utcnow() + timedelta(minutes=settings.access_token_minutes)
    payload = {'sub': str(user_id), 'email': email, 'exp': expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def create_collaboration_token(user_id: int, document_id: int) -> str:
    expires_at = utcnow() + timedelta(hours=1)
    payload = {
        'sub': str(user_id),
        'document_id': document_id,
        'kind': 'collaboration-session',
        'exp': expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    return {'id': int(payload['sub']), 'email': payload['email']}


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()
