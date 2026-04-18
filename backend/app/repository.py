from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any

from .content import coerce_content, serialize_content


VERSION_CHECKPOINT_INTERVAL_SECONDS = 30


def public_user(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {"id": row["id"], "username": row["username"], "email": row["email"]}


def public_document(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "content": coerce_content(row["content"]),
        "owner_id": row["owner_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def version_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "document_id": row["document_id"],
        "created_by": row["created_by"],
        "created_by_username": row["created_by_username"],
        "content": coerce_content(row["content"]),
        "created_at": row["created_at"],
        "restored_from": row["restored_from"],
    }


def find_user_by_id(connection: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def find_user_by_email(connection: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def find_user_by_username(connection: sqlite3.Connection, username: str) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()


def find_user_by_identifier(connection: sqlite3.Connection, identifier: str) -> sqlite3.Row | None:
    user = find_user_by_email(connection, identifier)
    if user is not None:
        return user
    return find_user_by_username(connection, identifier)


def create_user(
    connection: sqlite3.Connection, username: str, email: str, password_hash: str
) -> sqlite3.Row:
    cursor = connection.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (username, email, password_hash),
    )
    return find_user_by_id(connection, int(cursor.lastrowid))


def list_documents_for_user(connection: sqlite3.Connection, user_id: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT DISTINCT d.*
        FROM documents d
        LEFT JOIN permissions p ON p.document_id = d.id
        WHERE d.owner_id = ? OR p.user_id = ?
        ORDER BY datetime(d.updated_at) DESC
        """,
        (user_id, user_id),
    ).fetchall()
    return [public_document(row) for row in rows]


def create_document(
    connection: sqlite3.Connection, owner_id: int, title: str | None, content: Any | None
) -> dict[str, Any]:
    serialized = serialize_content(content)
    cursor = connection.execute(
        """
        INSERT INTO documents (title, content, owner_id)
        VALUES (?, ?, ?)
        """,
        ((title or "Untitled").strip() or "Untitled", serialized, owner_id),
    )
    row = connection.execute("SELECT * FROM documents WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return public_document(row)


def find_document(connection: sqlite3.Connection, document_id: int) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()


def list_collaborators(connection: sqlite3.Connection, document_id: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT u.id, u.username, u.email, p.role
        FROM permissions p
        JOIN users u ON u.id = p.user_id
        WHERE p.document_id = ?
        ORDER BY CASE p.role WHEN 'editor' THEN 0 ELSE 1 END, lower(u.username)
        """,
        (document_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def find_permission(connection: sqlite3.Connection, document_id: int, user_id: int) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT * FROM permissions WHERE document_id = ? AND user_id = ?",
        (document_id, user_id),
    ).fetchone()


def resolve_document_access(
    connection: sqlite3.Connection, document_id: int, user_id: int
) -> tuple[sqlite3.Row | None, str | None]:
    document = find_document(connection, document_id)
    if document is None:
        return None, None

    if document["owner_id"] == user_id:
        return document, "owner"

    permission = find_permission(connection, document_id, user_id)
    if permission is None:
        return document, None

    return document, permission["role"]


def update_document(
    connection: sqlite3.Connection,
    document_id: int,
    user_id: int,
    title: str | None,
    content: Any | None,
) -> dict[str, Any]:
    existing = find_document(connection, document_id)
    if existing is None:
        raise LookupError("Document not found")

    next_title = ((title if title is not None else existing["title"]).strip() or "Untitled")
    next_content = coerce_content(content if content is not None else existing["content"])
    serialized_next = serialize_content(next_content)

    if content is not None and serialized_next != existing["content"]:
        maybe_checkpoint_version(connection, existing, user_id)

    connection.execute(
        """
        UPDATE documents
        SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (next_title, serialized_next, document_id),
    )
    updated = find_document(connection, document_id)
    return public_document(updated)


def maybe_checkpoint_version(
    connection: sqlite3.Connection, existing_document: sqlite3.Row, user_id: int
) -> None:
    latest = connection.execute(
        """
        SELECT created_at
        FROM versions
        WHERE document_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT 1
        """,
        (existing_document["id"],),
    ).fetchone()

    if latest is not None:
        latest_time = datetime.fromisoformat(latest["created_at"].replace("Z", "+00:00"))
        if latest_time.tzinfo is None:
            latest_time = latest_time.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - latest_time < timedelta(seconds=VERSION_CHECKPOINT_INTERVAL_SECONDS):
            return

    connection.execute(
        """
        INSERT INTO versions (document_id, content, created_by)
        VALUES (?, ?, ?)
        """,
        (existing_document["id"], existing_document["content"], user_id),
    )


def delete_document(connection: sqlite3.Connection, document_id: int) -> None:
    connection.execute("DELETE FROM documents WHERE id = ?", (document_id,))


def find_version(connection: sqlite3.Connection, document_id: int, version_id: int) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT *
        FROM versions
        WHERE id = ? AND document_id = ?
        """,
        (version_id, document_id),
    ).fetchone()


def restore_version(
    connection: sqlite3.Connection,
    document_id: int,
    version_id: int,
    user_id: int,
) -> dict[str, Any]:
    document = find_document(connection, document_id)
    version = find_version(connection, document_id, version_id)
    if document is None or version is None:
        raise LookupError("Version not found")

    connection.execute(
        """
        INSERT INTO versions (document_id, content, created_by, restored_from)
        VALUES (?, ?, ?, ?)
        """,
        (document_id, document["content"], user_id, version_id),
    )

    connection.execute(
        """
        UPDATE documents
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (version["content"], document_id),
    )

    updated = find_document(connection, document_id)
    return public_document(updated)


def upsert_permission(
    connection: sqlite3.Connection, document_id: int, user_id: int, role: str
) -> dict[str, Any]:
    connection.execute(
        """
        INSERT INTO permissions (document_id, user_id, role)
        VALUES (?, ?, ?)
        ON CONFLICT(document_id, user_id)
        DO UPDATE SET role = excluded.role
        """,
        (document_id, user_id, role),
    )
    user = find_user_by_id(connection, user_id)
    return {
        "user": public_user(user),
        "role": role,
    }


def revoke_permission(connection: sqlite3.Connection, document_id: int, user_id: int) -> None:
    connection.execute(
        "DELETE FROM permissions WHERE document_id = ? AND user_id = ?",
        (document_id, user_id),
    )


def list_versions(connection: sqlite3.Connection, document_id: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT v.*, u.username AS created_by_username
        FROM versions v
        JOIN users u ON u.id = v.created_by
        WHERE v.document_id = ?
        ORDER BY datetime(v.created_at) DESC
        """,
        (document_id,),
    ).fetchall()
    return [version_payload(row) for row in rows]


def insert_ai_interaction(
    connection: sqlite3.Connection, document_id: int, user_id: int, prompt: str, response: str
) -> None:
    connection.execute(
        """
        INSERT INTO ai_interactions (document_id, user_id, prompt, response)
        VALUES (?, ?, ?, ?)
        """,
        (document_id, user_id, prompt, response),
    )


def list_ai_history(connection: sqlite3.Connection, document_id: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT ai.id, ai.prompt, ai.response, ai.created_at, u.username
        FROM ai_interactions ai
        JOIN users u ON u.id = ai.user_id
        WHERE ai.document_id = ?
        ORDER BY datetime(ai.created_at) DESC
        """,
        (document_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def create_refresh_token_record(
    connection: sqlite3.Connection,
    user_id: int,
    token_hash: str,
    expires_at: str,
) -> None:
    connection.execute(
        """
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
        """,
        (user_id, token_hash, expires_at),
    )


def find_active_refresh_token(
    connection: sqlite3.Connection,
    token_hash: str,
) -> sqlite3.Row | None:
    row = connection.execute(
        """
        SELECT id, user_id, expires_at, revoked_at
        FROM refresh_tokens
        WHERE token_hash = ?
        """,
        (token_hash,),
    ).fetchone()

    if row is None or row["revoked_at"] is not None:
        return None

    expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        return None

    return row


def revoke_refresh_token(connection: sqlite3.Connection, refresh_token_id: int) -> None:
    connection.execute(
        """
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (refresh_token_id,),
    )


def revoke_refresh_token_by_hash(connection: sqlite3.Connection, token_hash: str) -> None:
    connection.execute(
        """
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = ? AND revoked_at IS NULL
        """,
        (token_hash,),
    )
