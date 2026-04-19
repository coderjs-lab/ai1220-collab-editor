from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (BASE_DIR / path).resolve()


@dataclass(frozen=True)
class Settings:
    app_name: str
    port: int
    jwt_secret: str
    db_path: Path
    ystore_path: Path
    cors_origins: list[str]
    access_token_ttl_seconds: int
    collab_session_ttl_seconds: int
    ws_base_url: str
    refresh_token_days: int
    refresh_cookie_name: str
    secure_cookies: bool
    ai_provider: str
    ai_model: str
    ai_max_output_tokens: int
    anthropic_api_key: str | None


def get_settings() -> Settings:
    cors_origin = os.getenv("CORS_ORIGIN", "http://localhost:5173")

    return Settings(
        app_name=os.getenv("APP_NAME", "Draftboard Backend"),
        port=int(os.getenv("PORT", "3001")),
        jwt_secret=os.getenv("JWT_SECRET", "change-me-in-production"),
        db_path=_resolve_path(os.getenv("DB_PATH", "./data/editor.db")),
        ystore_path=_resolve_path(os.getenv("YSTORE_PATH", "./data/yupdates.db")),
        cors_origins=[origin.strip() for origin in cors_origin.split(",") if origin.strip()],
        access_token_ttl_seconds=int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", str(60 * 20))),
        collab_session_ttl_seconds=int(os.getenv("COLLAB_SESSION_TTL_SECONDS", str(60 * 30))),
        ws_base_url=os.getenv("WS_BASE_URL", "ws://localhost:3001/ws/collab"),
        refresh_token_days=int(os.getenv("REFRESH_TOKEN_DAYS", "7")),
        refresh_cookie_name=os.getenv("REFRESH_COOKIE_NAME", "draftboard_refresh"),
        secure_cookies=_bool_env("SECURE_COOKIES", False),
        ai_provider=os.getenv(
            "AI_PROVIDER",
            "anthropic" if os.getenv("ANTHROPIC_API_KEY") else "stub",
        ).strip().lower(),
        ai_model=os.getenv("AI_MODEL", "draftboard-stub-v1"),
        ai_max_output_tokens=int(os.getenv("AI_MAX_OUTPUT_TOKENS", "768")),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
    )


settings = get_settings()
