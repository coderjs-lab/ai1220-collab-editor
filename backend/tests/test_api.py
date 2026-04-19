from __future__ import annotations

import importlib
import json
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect
from ypy_websocket.yutils import YMessageType


def load_app(tmp_path: Path):
    os.environ["DB_PATH"] = str(tmp_path / "editor.db")
    os.environ["YSTORE_PATH"] = str(tmp_path / "yupdates.db")
    os.environ["JWT_SECRET"] = "test-secret-key-for-api-suite-with-safe-length-123456"
    os.environ["WS_BASE_URL"] = "ws://testserver/ws/collab"
    os.environ["REFRESH_COOKIE_NAME"] = "draftboard_refresh"
    os.environ["AI_PROVIDER"] = "stub"
    os.environ["AI_MODEL"] = "draftboard-stub-v1"
    os.environ.pop("ANTHROPIC_API_KEY", None)

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


def sample_content(text: str):
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


def parse_sse_events(raw_body: str):
    events: list[tuple[str, dict[str, object]]] = []
    for raw_event in raw_body.strip().split("\n\n"):
        if not raw_event.strip():
            continue

        event_name = "message"
        data_lines: list[str] = []
        for line in raw_event.splitlines():
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data_lines.append(line.split(":", 1)[1].strip())

        if not data_lines:
            continue

        events.append((event_name, json.loads("\n".join(data_lines))))
    return events


def test_register_login_refresh_and_logout(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        register_response = register_user(client, username="alice", email="alice@test.com")
        assert register_response["user"]["username"] == "alice"
        first_refresh_cookie = client.cookies.get("draftboard_refresh")
        assert first_refresh_cookie

        login_response = client.post(
            "/api/auth/login",
            json={"email": "alice@test.com", "password": "password123"},
        )
        assert login_response.status_code == 200, login_response.text
        assert login_response.json()["user"]["email"] == "alice@test.com"

        refresh_response = client.post("/api/auth/refresh")
        assert refresh_response.status_code == 200, refresh_response.text
        second_refresh_cookie = client.cookies.get("draftboard_refresh")
        assert second_refresh_cookie
        assert second_refresh_cookie != first_refresh_cookie

        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == 200
        assert logout_response.json()["message"] == "Signed out successfully"

        stale_refresh = client.post("/api/auth/refresh")
        assert stale_refresh.status_code == 401
        assert stale_refresh.json()["error"] == "Refresh token is invalid or expired"


def test_document_crud_permissions_and_restore(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        alice = register_user(client, username="alice", email="alice@test.com")
        bob = register_user(client, username="bob", email="bob@test.com")
        carol = register_user(client, username="carol", email="carol@test.com")

        create_response = client.post(
            "/api/documents",
            json={"title": "Notes", "content": sample_content("Hello world")},
            headers=auth_headers(alice["token"]),
        )
        assert create_response.status_code == 201, create_response.text
        document_id = create_response.json()["document"]["id"]

        share_editor = client.post(
            f"/api/documents/{document_id}/share",
            json={"identifier": "bob", "role": "editor"},
            headers=auth_headers(alice["token"]),
        )
        assert share_editor.status_code == 201, share_editor.text
        assert share_editor.json()["permission"]["user"]["email"] == "bob@test.com"

        share_viewer = client.post(
            f"/api/documents/{document_id}/share",
            json={"identifier": "carol@test.com", "role": "viewer"},
            headers=auth_headers(alice["token"]),
        )
        assert share_viewer.status_code == 201, share_viewer.text

        viewer_update = client.put(
            f"/api/documents/{document_id}",
            json={"content": sample_content("Blocked")},
            headers=auth_headers(carol["token"]),
        )
        assert viewer_update.status_code == 403

        editor_update = client.put(
            f"/api/documents/{document_id}",
            json={"content": sample_content("Editor change")},
            headers=auth_headers(bob["token"]),
        )
        assert editor_update.status_code == 200, editor_update.text
        assert editor_update.json()["document"]["content"]["content"][0]["content"][0]["text"] == "Editor change"

        versions_response = client.get(
            f"/api/documents/{document_id}/versions",
            headers=auth_headers(alice["token"]),
        )
        assert versions_response.status_code == 200, versions_response.text
        versions = versions_response.json()["versions"]
        assert len(versions) == 1
        assert versions[0]["content"]["content"][0]["content"][0]["text"] == "Hello world"

        restore_response = client.post(
            f"/api/documents/{document_id}/versions/{versions[0]['id']}/restore",
            headers=auth_headers(bob["token"]),
        )
        assert restore_response.status_code == 200, restore_response.text
        assert restore_response.json()["document"]["content"]["content"][0]["content"][0]["text"] == "Hello world"


def test_share_link_lifecycle(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        owner = register_user(client, username="owner", email="owner@example.com")
        guest = register_user(client, username="guest", email="guest@example.com")

        document_id = client.post(
            "/api/documents",
            json={"title": "Shared draft", "content": sample_content("Realtime doc")},
            headers=auth_headers(owner["token"]),
        ).json()["document"]["id"]

        create_link = client.post(
            f"/api/documents/{document_id}/share-links",
            json={"role": "viewer"},
            headers=auth_headers(owner["token"]),
        )
        assert create_link.status_code == 201, create_link.text
        share_link = create_link.json()["share_link"]
        assert share_link["url"].endswith(f"/share/{share_link['token']}")

        list_links = client.get(
            f"/api/documents/{document_id}/share-links",
            headers=auth_headers(owner["token"]),
        )
        assert list_links.status_code == 200
        assert len(list_links.json()["share_links"]) == 1

        accept_link = client.post(
            f"/api/share-links/{share_link['token']}/accept",
            headers=auth_headers(guest["token"]),
        )
        assert accept_link.status_code == 200, accept_link.text
        assert accept_link.json()["role"] == "viewer"

        guest_document = client.get(
            f"/api/documents/{document_id}",
            headers=auth_headers(guest["token"]),
        )
        assert guest_document.status_code == 200

        revoke_link = client.delete(
            f"/api/documents/{document_id}/share-links/{share_link['id']}",
            headers=auth_headers(owner["token"]),
        )
        assert revoke_link.status_code == 200

        stale_accept = client.post(
            f"/api/share-links/{share_link['token']}/accept",
            headers=auth_headers(guest["token"]),
        )
        assert stale_accept.status_code == 404


def test_ai_permissions_and_history(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        owner = register_user(client, username="owner", email="owner@example.com")
        viewer = register_user(client, username="viewer", email="viewer@example.com")

        document_id = client.post(
            "/api/documents",
            json={"title": "AI test", "content": sample_content("Important context for the assistant.")},
            headers=auth_headers(owner["token"]),
        ).json()["document"]["id"]

        client.post(
            f"/api/documents/{document_id}/share",
            json={"identifier": "viewer@example.com", "role": "viewer"},
            headers=auth_headers(owner["token"]),
        )

        blocked_ai = client.post(
            f"/api/documents/{document_id}/ai/suggest",
            json={"prompt": "Summarize this"},
            headers=auth_headers(viewer["token"]),
        )
        assert blocked_ai.status_code == 403

        allowed_ai = client.post(
            f"/api/documents/{document_id}/ai/suggest",
            json={"feature": "summarize", "prompt": "Summarize this", "context": "document"},
            headers=auth_headers(owner["token"]),
        )
        assert allowed_ai.status_code == 200
        payload = allowed_ai.json()
        assert payload["interaction_id"] > 0
        assert payload["feature"] == "summarize"
        assert payload["model"]
        assert payload["context_preview"]
        assert payload["suggestion"]

        history_response = client.get(
            f"/api/documents/{document_id}/ai/history",
            headers=auth_headers(viewer["token"]),
        )
        assert history_response.status_code == 200
        assert history_response.json()["history"][0]["username"] == "owner"
        assert history_response.json()["history"][0]["feature"] == "summarize"
        assert history_response.json()["history"][0]["status"] == "generated"
        assert history_response.json()["history"][0]["context_scope"] == "document"
        assert "Document excerpt:" in history_response.json()["history"][0]["context_preview"]


def test_ai_streaming_and_decision_tracking(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        owner = register_user(client, username="owner", email="owner@example.com")

        document_id = client.post(
            "/api/documents",
            json={"title": "Stream test", "content": sample_content("Please rewrite this introduction with clearer wording.")},
            headers=auth_headers(owner["token"]),
        ).json()["document"]["id"]

        with client.stream(
            "POST",
            f"/api/documents/{document_id}/ai/suggest/stream",
            json={"feature": "rewrite", "context": "selection", "context_text": "Please rewrite this introduction with clearer wording."},
            headers=auth_headers(owner["token"]),
        ) as response:
            assert response.status_code == 200, response.text
            raw_body = "".join(response.iter_text())

        events = parse_sse_events(raw_body)
        event_names = [name for name, _ in events]
        assert "meta" in event_names
        assert "chunk" in event_names
        assert "done" in event_names

        meta_payload = next(payload for name, payload in events if name == "meta")
        interaction_id = int(meta_payload["interaction_id"])
        assert interaction_id > 0
        assert meta_payload["feature"] == "rewrite"
        assert meta_payload["context_preview"]

        decision_response = client.post(
            f"/api/documents/{document_id}/ai/history/{interaction_id}/decision",
            json={"status": "accepted"},
            headers=auth_headers(owner["token"]),
        )
        assert decision_response.status_code == 200, decision_response.text

        history_response = client.get(
            f"/api/documents/{document_id}/ai/history",
            headers=auth_headers(owner["token"]),
        )
        assert history_response.status_code == 200
        assert history_response.json()["history"][0]["status"] == "accepted"
        assert history_response.json()["history"][0]["context_scope"] == "selection"
        assert "Please rewrite this introduction" in history_response.json()["history"][0]["context_preview"]


def test_collaboration_session_and_websocket_handshake(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        owner = register_user(client, username="owner", email="owner@example.com")

        document_id = client.post(
            "/api/documents",
            json={"title": "Realtime Demo", "content": sample_content("Hello")},
            headers=auth_headers(owner["token"]),
        ).json()["document"]["id"]

        session_response = client.post(
            f"/api/documents/{document_id}/session",
            headers=auth_headers(owner["token"]),
        )
        assert session_response.status_code == 200, session_response.text
        session = session_response.json()
        assert session["role"] == "owner"
        assert session["expires_in"] > 0

        with client.websocket_connect(
            f"/ws/collab/{document_id}?token={session['session_token']}"
        ) as websocket:
            assert websocket is not None


def test_collaboration_websocket_rejects_invalid_token(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as error:
            with client.websocket_connect("/ws/collab/1?token=invalid-token"):
                pass

        assert error.value.code == 1008


def test_collaboration_websocket_relays_basic_awareness_messages(tmp_path: Path):
    app = load_app(tmp_path)

    with TestClient(app) as client:
        owner = register_user(client, username="owner", email="owner@example.com")
        guest = register_user(client, username="guest", email="guest@example.com")

        document_id = client.post(
            "/api/documents",
            json={"title": "Realtime Demo", "content": sample_content("Hello")},
            headers=auth_headers(owner["token"]),
        ).json()["document"]["id"]

        share_response = client.post(
            f"/api/documents/{document_id}/share",
            headers=auth_headers(owner["token"]),
            json={"identifier": "guest@example.com", "role": "editor"},
        )
        assert share_response.status_code == 201, share_response.text

        owner_session = client.post(
            f"/api/documents/{document_id}/session",
            headers=auth_headers(owner["token"]),
        ).json()
        guest_session = client.post(
            f"/api/documents/{document_id}/session",
            headers=auth_headers(guest["token"]),
        ).json()

        with client.websocket_connect(
            f"/ws/collab/{document_id}?token={owner_session['session_token']}"
        ) as owner_ws, client.websocket_connect(
            f"/ws/collab/{document_id}?token={guest_session['session_token']}"
        ) as guest_ws:
            # Flush the initial sync packet each client receives on connect.
            owner_ws.receive_bytes()
            guest_ws.receive_bytes()

            awareness_message = bytes([int(YMessageType.AWARENESS), 1, 9, 8, 7])
            owner_ws.send_bytes(awareness_message)

            received = None
            for _ in range(3):
                candidate = guest_ws.receive_bytes()
                if candidate == awareness_message:
                    received = candidate
                    break

            assert received == awareness_message
