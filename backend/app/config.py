from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def _bool_env(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {'1', 'true', 'yes', 'on'}


@dataclass(frozen=True)
class Settings:
    app_name: str
    db_path: str
    jwt_secret: str
    cors_origins: list[str]
    access_token_minutes: int
    refresh_token_days: int
    refresh_cookie_name: str
    secure_cookies: bool


settings = Settings(
    app_name='Draftboard API',
    db_path=os.getenv('DB_PATH', str(BASE_DIR / 'data' / 'editor.db')),
    jwt_secret=os.getenv('JWT_SECRET', 'change-me-before-production'),
    cors_origins=[
        origin.strip()
        for origin in os.getenv('CORS_ORIGIN', 'http://localhost:5173').split(',')
        if origin.strip()
    ],
    access_token_minutes=int(os.getenv('ACCESS_TOKEN_MINUTES', '20')),
    refresh_token_days=int(os.getenv('REFRESH_TOKEN_DAYS', '7')),
    refresh_cookie_name=os.getenv('REFRESH_COOKIE_NAME', 'draftboard_refresh'),
    secure_cookies=_bool_env('SECURE_COOKIES', False),
)
