from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    port: int
    jwt_secret: str
    db_path: Path
    ystore_path: Path
    cors_origins: list[str]
    access_token_ttl_seconds: int
    collab_session_ttl_seconds: int
    ws_base_url: str


def _resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return Path.cwd() / path


def get_settings() -> Settings:
    cors_origin = os.getenv("CORS_ORIGIN", "http://localhost:5173")
    port = int(os.getenv("PORT", "3001"))

    return Settings(
        port=port,
        jwt_secret=os.getenv("JWT_SECRET", "change-me-in-production"),
        db_path=_resolve_path(os.getenv("DB_PATH", "./data/editor.db")),
        ystore_path=_resolve_path(os.getenv("YSTORE_PATH", "./data/yupdates.db")),
        cors_origins=[origin.strip() for origin in cors_origin.split(",") if origin.strip()],
        access_token_ttl_seconds=int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 7))),
        collab_session_ttl_seconds=int(os.getenv("COLLAB_SESSION_TTL_SECONDS", str(60 * 30))),
        ws_base_url=os.getenv("WS_BASE_URL", "ws://localhost:3001/ws/collab"),
    )


settings = get_settings()
