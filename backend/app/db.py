from __future__ import annotations

from collections.abc import Generator
from pathlib import Path
import sqlite3

from .config import BASE_DIR, settings


SCHEMA_PATH = Path(__file__).with_name('schema.sql')


def create_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(settings.db_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    return connection


def init_db(reset: bool = False) -> None:
    if settings.db_path != ':memory:':
        database_path = Path(settings.db_path)
        if not database_path.is_absolute():
            database_path = (BASE_DIR / database_path).resolve()
        database_path.parent.mkdir(parents=True, exist_ok=True)
        if reset and database_path.exists():
            database_path.unlink()

    connection = create_connection()
    try:
        connection.executescript(SCHEMA_PATH.read_text(encoding='utf-8'))
        connection.commit()
    finally:
        connection.close()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    connection = create_connection()
    try:
        yield connection
    finally:
        connection.close()
