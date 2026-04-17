from __future__ import annotations

from pathlib import Path
import os
import sys

from fastapi.testclient import TestClient


TEST_DB_PATH = Path(__file__).resolve().parent / '.test-editor.db'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['JWT_SECRET'] = 'test-secret-key-with-safe-length-123456'
os.environ['DB_PATH'] = str(TEST_DB_PATH)
os.environ['REFRESH_COOKIE_NAME'] = 'draftboard_refresh'

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.security import decode_access_token, hash_password, verify_password  # noqa: E402


client = TestClient(app)


def setup_function() -> None:
    init_db(reset=True)


def test_password_hash_round_trip() -> None:
    password_hash = hash_password('pass12345')
    assert password_hash != 'pass12345'
    assert verify_password('pass12345', password_hash) is True
    assert verify_password('wrong-pass', password_hash) is False


def register_user(username: str, email: str, password: str = 'pass12345') -> dict:
    response = client.post(
        '/api/auth/register',
        json={'username': username, 'email': email, 'password': password},
    )
    assert response.status_code == 201
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


def test_register_login_and_refresh_rotation() -> None:
    register_response = register_user('alice', 'alice@test.com')
    token = register_response['token']
    payload = decode_access_token(token)
    assert payload['email'] == 'alice@test.com'

    first_refresh_cookie = client.cookies.get('draftboard_refresh')
    assert first_refresh_cookie

    refresh_response = client.post('/api/auth/refresh')
    assert refresh_response.status_code == 200
    assert refresh_response.json()['user']['username'] == 'alice'
    second_refresh_cookie = client.cookies.get('draftboard_refresh')
    assert second_refresh_cookie
    assert second_refresh_cookie != first_refresh_cookie

    stale_client = TestClient(app)
    stale_client.cookies.set('draftboard_refresh', first_refresh_cookie)
    stale_response = stale_client.post('/api/auth/refresh')
    assert stale_response.status_code == 401
    assert stale_response.json()['error'] == 'Refresh token is invalid or expired'


def test_document_crud_permissions_and_restore() -> None:
    alice = register_user('alice', 'alice@test.com')
    bob = register_user('bob', 'bob@test.com')
    carol = register_user('carol', 'carol@test.com')

    create_response = client.post(
        '/api/documents',
        json={'title': 'Notes', 'content': '<p>Hello world</p>'},
        headers=auth_headers(alice['token']),
    )
    assert create_response.status_code == 201
    document_id = create_response.json()['document']['id']

    share_editor = client.post(
        f'/api/documents/{document_id}/share',
        json={'identifier': 'bob', 'role': 'editor'},
        headers=auth_headers(alice['token']),
    )
    assert share_editor.status_code == 201
    assert share_editor.json()['permission']['user']['email'] == 'bob@test.com'

    share_viewer = client.post(
        f'/api/documents/{document_id}/share',
        json={'identifier': 'carol@test.com', 'role': 'viewer'},
        headers=auth_headers(alice['token']),
    )
    assert share_viewer.status_code == 201

    viewer_update = client.put(
        f'/api/documents/{document_id}',
        json={'content': '<p>Blocked</p>'},
        headers=auth_headers(carol['token']),
    )
    assert viewer_update.status_code == 403

    editor_update = client.put(
        f'/api/documents/{document_id}',
        json={'content': '<h2>Updated</h2><p>Editor change</p>'},
        headers=auth_headers(bob['token']),
    )
    assert editor_update.status_code == 200

    versions_response = client.get(
        f'/api/documents/{document_id}/versions',
        params={'full': True},
        headers=auth_headers(alice['token']),
    )
    assert versions_response.status_code == 200
    versions = versions_response.json()['versions']
    assert len(versions) == 1
    assert versions[0]['content'] == '<p>Hello world</p>'

    restore_response = client.post(
        f'/api/documents/{document_id}/versions/{versions[0]["id"]}/restore',
        headers=auth_headers(bob['token']),
    )
    assert restore_response.status_code == 200
    assert restore_response.json()['document']['content'] == '<p>Hello world</p>'

    restored_versions = client.get(
        f'/api/documents/{document_id}/versions',
        params={'full': True},
        headers=auth_headers(alice['token']),
    ).json()['versions']
    assert len(restored_versions) == 2
    assert restored_versions[0]['content'] == '<h2>Updated</h2><p>Editor change</p>'


def test_ai_stub_and_collaboration_session_permissions() -> None:
    alice = register_user('alice', 'alice@test.com')
    bob = register_user('bob', 'bob@test.com')

    document_id = client.post(
        '/api/documents',
        json={'title': 'AI Test', 'content': '<p>Important context for the assistant.</p>'},
        headers=auth_headers(alice['token']),
    ).json()['document']['id']

    client.post(
        f'/api/documents/{document_id}/share',
        json={'identifier': 'bob', 'role': 'viewer'},
        headers=auth_headers(alice['token']),
    )

    blocked_ai = client.post(
        f'/api/documents/{document_id}/ai/suggest',
        json={'prompt': 'Summarize this'},
        headers=auth_headers(bob['token']),
    )
    assert blocked_ai.status_code == 403

    allowed_ai = client.post(
        f'/api/documents/{document_id}/ai/suggest',
        json={'prompt': 'Summarize this'},
        headers=auth_headers(alice['token']),
    )
    assert allowed_ai.status_code == 200
    assert 'Suggested revision' in allowed_ai.json()['suggestion']

    history_response = client.get(
        f'/api/documents/{document_id}/ai/history',
        headers=auth_headers(bob['token']),
    )
    assert history_response.status_code == 200
    assert history_response.json()['history'][0]['model'] == 'draftboard-stub-v1'

    session_response = client.post(
        f'/api/documents/{document_id}/session',
        headers=auth_headers(bob['token']),
    )
    assert session_response.status_code == 200
    assert session_response.json()['expiresIn'] == 3600


def test_logout_revokes_refresh_cookie() -> None:
    register_user('alice', 'alice@test.com')
    refresh_cookie = client.cookies.get('draftboard_refresh')
    assert refresh_cookie

    logout_response = client.post('/api/auth/logout')
    assert logout_response.status_code == 200

    refresh_response = client.post('/api/auth/refresh')
    assert refresh_response.status_code == 401
