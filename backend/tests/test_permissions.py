from __future__ import annotations

import sqlite3

import pytest
from pydantic import ValidationError

from backend.app.database import SCHEMA
from backend.app.repository import create_document, create_user, resolve_document_access, upsert_permission
from backend.app.schemas import ShareDocumentRequest


def in_memory_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA)
    return connection


def test_resolve_document_access_distinguishes_owner_editor_and_no_access():
    connection = in_memory_connection()
    try:
        owner = create_user(connection, "owner", "owner@example.com", "hash")
        editor = create_user(connection, "editor", "editor@example.com", "hash")
        outsider = create_user(connection, "outsider", "outsider@example.com", "hash")

        document = create_document(connection, owner["id"], "Shared doc", None)
        upsert_permission(connection, document["id"], editor["id"], "editor")

        owner_document, owner_role = resolve_document_access(connection, document["id"], owner["id"])
        editor_document, editor_role = resolve_document_access(connection, document["id"], editor["id"])
        outsider_document, outsider_role = resolve_document_access(connection, document["id"], outsider["id"])

        assert owner_document is not None
        assert owner_role == "owner"

        assert editor_document is not None
        assert editor_role == "editor"

        assert outsider_document is not None
        assert outsider_role is None
    finally:
        connection.close()


def test_share_document_request_requires_identifier_or_email():
    with pytest.raises(ValidationError) as error:
        ShareDocumentRequest(role="viewer")

    assert "identifier or email is required" in str(error.value)


def test_share_document_request_accepts_username_identifier():
    payload = ShareDocumentRequest(identifier="alice", role="editor")

    assert payload.identifier == "alice"
    assert payload.role == "editor"
