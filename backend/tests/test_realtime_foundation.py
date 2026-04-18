from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient


def load_app(tmp_path: Path):
    os.environ["DB_PATH"] = str(tmp_path / "editor.db")
    os.environ["YSTORE_PATH"] = str(tmp_path / "yupdates.db")
    os.environ["JWT_SECRET"] = "test-secret-key-for-realtime-suite"
    os.environ["WS_BASE_URL"] = "ws://testserver/ws/collab"

    for module_name in list(sys.modules):
        if module_name == "backend.app" or module_name.startswith("backend.app."):
            sys.modules.pop(module_name)

    main_module = importlib.import_module("backend.app.main")
    return main_module.app


def register_user(client: TestClient, *, username: str, email: str, password: str = "password123"):
    response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_health_endpoint(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_owner_can_create_document_and_issue_collab_session(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        owner = register_user(client, username="owner", email="owner@example.com")

        create_response = client.post(
            "/api/documents",
            headers=auth_headers(owner["token"]),
            json={
                "title": "Realtime Demo",
                "content": {
                    "type": "doc",
                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello"}]}],
                },
            },
        )

        assert create_response.status_code == 201, create_response.text
        document_id = create_response.json()["document"]["id"]

        session_response = client.post(
            f"/api/documents/{document_id}/session",
            headers=auth_headers(owner["token"]),
        )

        assert session_response.status_code == 200, session_response.text
        session = session_response.json()
        assert session["role"] == "owner"
        assert session["session_token"]
        assert session["ws_url"] == "ws://testserver/ws/collab"
        assert session["expires_in"] > 0


def test_viewer_receives_viewer_role_for_collaboration_session(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        owner = register_user(client, username="owner", email="owner@example.com")
        viewer = register_user(client, username="viewer", email="viewer@example.com")

        create_response = client.post(
            "/api/documents",
            headers=auth_headers(owner["token"]),
            json={"title": "Shared Draft"},
        )
        assert create_response.status_code == 201, create_response.text
        document_id = create_response.json()["document"]["id"]

        share_response = client.post(
            f"/api/documents/{document_id}/share",
            headers=auth_headers(owner["token"]),
            json={"email": viewer["user"]["email"], "role": "viewer"},
        )
        assert share_response.status_code == 201, share_response.text

        session_response = client.post(
            f"/api/documents/{document_id}/session",
            headers=auth_headers(viewer["token"]),
        )

        assert session_response.status_code == 200, session_response.text
        session = session_response.json()
        assert session["role"] == "viewer"
