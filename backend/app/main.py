from __future__ import annotations

from datetime import timedelta
from html import unescape
from typing import Any
import re
import sqlite3

import jwt
from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .db import get_db, init_db
from .schemas import (
    AiHistoryResponse,
    AiSuggestRequest,
    AiSuggestResponse,
    AuthResponse,
    CreateDocumentRequest,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentSessionResponse,
    DocumentVersionsResponse,
    LoginRequest,
    MeResponse,
    MessageResponse,
    RegisterRequest,
    ShareDocumentRequest,
    ShareDocumentResponse,
    UpdateDocumentRequest,
)
from .security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    utcnow,
    utcnow_iso,
    verify_password,
)


EMPTY_DOCUMENT_HTML = '<p></p>'
ROLE_ORDER = {'viewer': 1, 'editor': 2, 'owner': 3}
MODEL_NAME = 'draftboard-stub-v1'
STUB_SESSION_TOKEN = '[stub] collab-server not yet implemented'
bearer_scheme = HTTPBearer(auto_error=False)


def create_app() -> FastAPI:
    init_db()

    application = FastAPI(
        title=settings.app_name,
        version='2.0.0',
        summary='FastAPI backend for Draftboard Assignment 2.',
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    @application.exception_handler(HTTPException)
    async def http_exception_handler(_request: Any, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={'error': str(exc.detail)})

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Any,
        exc: RequestValidationError,
    ) -> JSONResponse:
        first_error = exc.errors()[0] if exc.errors() else {'msg': 'Invalid request'}
        return JSONResponse(status_code=422, content={'error': str(first_error['msg'])})

    @application.get('/api/health')
    def health() -> dict[str, str]:
        return {'status': 'ok'}

    @application.post('/api/auth/register', response_model=AuthResponse, status_code=201)
    def register(body: RegisterRequest, db: sqlite3.Connection = Depends(get_db)) -> JSONResponse:
        existing_user = db.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            (body.username, body.email),
        ).fetchone()
        if existing_user:
            raise HTTPException(status_code=409, detail='Username or email already taken')

        created_at = utcnow_iso()
        cursor = db.execute(
            '''
            INSERT INTO users (username, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
            ''',
            (body.username, body.email, hash_password(body.password), created_at),
        )
        db.commit()
        user = get_user_by_id(db, cursor.lastrowid)
        return build_auth_json_response(db, user, status_code=201)

    @application.post('/api/auth/login', response_model=AuthResponse)
    def login(body: LoginRequest, db: sqlite3.Connection = Depends(get_db)) -> JSONResponse:
        user = db.execute(
            'SELECT * FROM users WHERE email = ?',
            (body.email,),
        ).fetchone()
        if not user or not verify_password(body.password, user['password_hash']):
            raise HTTPException(status_code=401, detail='Invalid credentials')
        return build_auth_json_response(db, user)

    @application.post('/api/auth/refresh', response_model=AuthResponse)
    def refresh_session(
        db: sqlite3.Connection = Depends(get_db),
        refresh_token: str | None = Cookie(default=None, alias=settings.refresh_cookie_name),
    ) -> JSONResponse:
        token_record = get_active_refresh_token_record(db, refresh_token)
        user = get_user_by_id(db, token_record['user_id'])
        if not user:
            raise HTTPException(status_code=401, detail='Refresh token is invalid or expired')
        revoke_refresh_token(db, token_record['id'])
        db.commit()
        return build_auth_json_response(db, user)

    @application.post('/api/auth/logout', response_model=MessageResponse)
    def logout(
        db: sqlite3.Connection = Depends(get_db),
        refresh_token: str | None = Cookie(default=None, alias=settings.refresh_cookie_name),
    ) -> JSONResponse:
        if refresh_token:
            token_hash = hash_refresh_token(refresh_token)
            db.execute(
                'UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL',
                (utcnow_iso(), token_hash),
            )
            db.commit()
        response = JSONResponse({'message': 'Signed out successfully'})
        clear_refresh_cookie(response)
        return response

    @application.get('/api/auth/me', response_model=MeResponse)
    def me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        return {'user': current_user}

    @application.get('/api/documents', response_model=DocumentListResponse)
    def list_documents(
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        rows = db.execute(
            '''
            SELECT DISTINCT d.*
            FROM documents d
            LEFT JOIN permissions p ON p.document_id = d.id
            WHERE d.owner_id = ? OR p.user_id = ?
            ORDER BY d.updated_at DESC
            ''',
            (current_user['id'], current_user['id']),
        ).fetchall()
        return {'documents': [serialize_document(row) for row in rows]}

    @application.post('/api/documents', response_model=DocumentResponse, status_code=201)
    def create_document(
        body: CreateDocumentRequest,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        created_at = utcnow_iso()
        title = (body.title or 'Untitled').strip() or 'Untitled'
        content = normalize_document_content(body.content)
        cursor = db.execute(
            '''
            INSERT INTO documents (title, content, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (title, content, current_user['id'], created_at, created_at),
        )
        db.commit()
        document = get_document_by_id(db, cursor.lastrowid)
        return {'document': serialize_document(document)}

    @application.get('/api/documents/{document_id}', response_model=DocumentDetailResponse)
    def get_document(
        document_id: int,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        document, _role = require_document_access(db, document_id, current_user['id'], 'viewer')
        collaborators = db.execute(
            '''
            SELECT u.id, u.username, u.email, p.role
            FROM permissions p
            JOIN users u ON u.id = p.user_id
            WHERE p.document_id = ?
            ORDER BY CASE p.role WHEN 'editor' THEN 0 ELSE 1 END, u.username
            ''',
            (document_id,),
        ).fetchall()
        return {
            'document': serialize_document(document),
            'collaborators': [serialize_collaborator(row) for row in collaborators],
        }

    @application.put('/api/documents/{document_id}', response_model=DocumentResponse)
    def update_document(
        document_id: int,
        body: UpdateDocumentRequest,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        document, _role = require_document_access(db, document_id, current_user['id'], 'editor')
        if body.title is None and body.content is None:
            raise HTTPException(status_code=400, detail='Nothing to update')

        next_title = document['title'] if body.title is None else (body.title.strip() or 'Untitled')
        next_content = document['content'] if body.content is None else normalize_document_content(body.content)

        if next_content != document['content']:
            insert_version(db, document['id'], document['content'], current_user['id'])

        db.execute(
            '''
            UPDATE documents
            SET title = ?, content = ?, updated_at = ?
            WHERE id = ?
            ''',
            (next_title, next_content, utcnow_iso(), document_id),
        )
        db.commit()
        updated_document = get_document_by_id(db, document_id)
        return {'document': serialize_document(updated_document)}

    @application.delete('/api/documents/{document_id}', response_model=MessageResponse)
    def delete_document(
        document_id: int,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, str]:
        document = get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail='Document not found')
        if document['owner_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail='Only the owner can delete')

        db.execute('DELETE FROM documents WHERE id = ?', (document_id,))
        db.commit()
        return {'message': 'Document deleted'}

    @application.get('/api/documents/{document_id}/versions', response_model=DocumentVersionsResponse)
    def list_versions(
        document_id: int,
        full: bool = Query(default=False, alias='full'),
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        document, _role = require_document_access(db, document_id, current_user['id'], 'viewer')
        select_content = ', v.content' if full else ''
        rows = db.execute(
            f'''
            SELECT v.id, v.document_id, v.created_by, v.created_at, u.username AS created_by_username
            {select_content}
            FROM versions v
            JOIN users u ON u.id = v.created_by
            WHERE v.document_id = ?
            ORDER BY v.created_at DESC
            ''',
            (document['id'],),
        ).fetchall()
        return {'versions': [serialize_version(row) for row in rows]}

    @application.post('/api/documents/{document_id}/versions/{version_id}/restore', response_model=DocumentResponse)
    def restore_version(
        document_id: int,
        version_id: int,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        document, _role = require_document_access(db, document_id, current_user['id'], 'editor')
        version = db.execute(
            '''
            SELECT id, content
            FROM versions
            WHERE id = ? AND document_id = ?
            ''',
            (version_id, document_id),
        ).fetchone()
        if not version:
            raise HTTPException(status_code=404, detail='Version not found')

        if version['content'] != document['content']:
            insert_version(db, document['id'], document['content'], current_user['id'])

        db.execute(
            'UPDATE documents SET content = ?, updated_at = ? WHERE id = ?',
            (version['content'], utcnow_iso(), document_id),
        )
        db.commit()
        updated_document = get_document_by_id(db, document_id)
        return {'document': serialize_document(updated_document)}

    @application.post('/api/documents/{document_id}/share', response_model=ShareDocumentResponse, status_code=201)
    def share_document(
        document_id: int,
        body: ShareDocumentRequest,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        document = get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail='Document not found')
        if document['owner_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail='Only the owner can share')

        identifier = (body.identifier or body.email or '').strip()
        target_user = db.execute(
            'SELECT id, username, email FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)',
            (identifier, identifier),
        ).fetchone()
        if not target_user:
            raise HTTPException(status_code=404, detail='User not found')
        if target_user['id'] == current_user['id']:
            raise HTTPException(status_code=400, detail='Cannot share with yourself')

        db.execute(
            '''
            INSERT INTO permissions (document_id, user_id, role, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(document_id, user_id)
            DO UPDATE SET role = excluded.role
            ''',
            (document_id, target_user['id'], body.role, utcnow_iso()),
        )
        db.commit()
        return {
            'permission': {
                'user': serialize_user(target_user),
                'role': body.role,
            },
        }

    @application.delete('/api/documents/{document_id}/share/{user_id}', response_model=MessageResponse)
    def revoke_share(
        document_id: int,
        user_id: int,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, str]:
        document = get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail='Document not found')
        if document['owner_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail='Only the owner can revoke access')

        db.execute(
            'DELETE FROM permissions WHERE document_id = ? AND user_id = ?',
            (document_id, user_id),
        )
        db.commit()
        return {'message': 'Access revoked'}

    @application.post('/api/documents/{document_id}/ai/suggest', response_model=AiSuggestResponse)
    def suggest_ai(
        document_id: int,
        body: AiSuggestRequest,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, str]:
        document, _role = require_document_access(db, document_id, current_user['id'], 'editor')
        base_text = strip_html(body.context or document['content'])
        summary = base_text[:220] if base_text else 'The document is currently empty.'
        suggestion = (
            f"Prompt: {body.prompt}\n\n"
            f"Suggested revision based on the current document:\n{summary}"
        )

        db.execute(
            '''
            INSERT INTO ai_interactions (document_id, user_id, prompt, response, model, status, context, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                document_id,
                current_user['id'],
                body.prompt,
                suggestion,
                MODEL_NAME,
                'generated',
                body.context,
                utcnow_iso(),
            ),
        )
        db.commit()
        return {'suggestion': suggestion}

    @application.get('/api/documents/{document_id}/ai/history', response_model=AiHistoryResponse)
    def ai_history(
        document_id: int,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        _document, _role = require_document_access(db, document_id, current_user['id'], 'viewer')
        rows = db.execute(
            '''
            SELECT ai.id, ai.prompt, ai.response, ai.created_at, ai.model, ai.status, u.username
            FROM ai_interactions ai
            JOIN users u ON u.id = ai.user_id
            WHERE ai.document_id = ?
            ORDER BY ai.created_at DESC
            ''',
            (document_id,),
        ).fetchall()
        return {
            'history': [
                {
                    'id': row['id'],
                    'prompt': row['prompt'],
                    'response': row['response'],
                    'created_at': row['created_at'],
                    'username': row['username'],
                    'model': row['model'],
                    'status': row['status'],
                }
                for row in rows
            ],
        }

    @application.post('/api/documents/{document_id}/session', response_model=DocumentSessionResponse)
    def create_collaboration_session(
        document_id: int,
        current_user: dict[str, Any] = Depends(get_current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> dict[str, Any]:
        _document, _role = require_document_access(db, document_id, current_user['id'], 'viewer')
        return {
            'sessionToken': STUB_SESSION_TOKEN,
            'expiresIn': 3600,
        }

    return application


def build_auth_json_response(
    db: sqlite3.Connection,
    user: sqlite3.Row,
    *,
    status_code: int = 200,
) -> JSONResponse:
    access_token = create_access_token(user['id'], user['email'])
    refresh_token = persist_refresh_token(db, user['id'])
    payload = {'user': serialize_user(user), 'token': access_token}
    response = JSONResponse(payload, status_code=status_code)
    set_refresh_cookie(response, refresh_token)
    return response


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Missing or invalid Authorization header',
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail='Invalid or expired token') from exc

    user = get_user_by_id(db, payload['id'])
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return serialize_user(user)


def get_document_by_id(db: sqlite3.Connection, document_id: int) -> sqlite3.Row | None:
    return db.execute('SELECT * FROM documents WHERE id = ?', (document_id,)).fetchone()


def get_user_by_id(db: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return db.execute(
        'SELECT id, username, email FROM users WHERE id = ?',
        (user_id,),
    ).fetchone()


def require_document_access(
    db: sqlite3.Connection,
    document_id: int,
    user_id: int,
    minimum_role: str,
) -> tuple[sqlite3.Row, str]:
    document = get_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail='Document not found')

    if document['owner_id'] == user_id:
        role = 'owner'
    else:
        permission = db.execute(
            'SELECT role FROM permissions WHERE document_id = ? AND user_id = ?',
            (document_id, user_id),
        ).fetchone()
        role = permission['role'] if permission else None

    if role is None or ROLE_ORDER[role] < ROLE_ORDER[minimum_role]:
        raise HTTPException(status_code=403, detail='Access denied')
    return document, role


def persist_refresh_token(db: sqlite3.Connection, user_id: int) -> str:
    refresh_token = generate_refresh_token()
    expires_at = (utcnow() + timedelta(days=settings.refresh_token_days)).isoformat()
    db.execute(
        '''
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        ''',
        (user_id, hash_refresh_token(refresh_token), expires_at, utcnow_iso()),
    )
    db.commit()
    return refresh_token


def get_active_refresh_token_record(
    db: sqlite3.Connection,
    refresh_token: str | None,
) -> sqlite3.Row:
    if not refresh_token:
        raise HTTPException(status_code=401, detail='Refresh token is invalid or expired')

    row = db.execute(
        '''
        SELECT id, user_id, expires_at, revoked_at
        FROM refresh_tokens
        WHERE token_hash = ?
        ''',
        (hash_refresh_token(refresh_token),),
    ).fetchone()
    if not row or row['revoked_at'] is not None:
        raise HTTPException(status_code=401, detail='Refresh token is invalid or expired')
    if row['expires_at'] <= utcnow_iso():
        raise HTTPException(status_code=401, detail='Refresh token is invalid or expired')
    return row


def revoke_refresh_token(db: sqlite3.Connection, refresh_token_id: int) -> None:
    db.execute(
        'UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?',
        (utcnow_iso(), refresh_token_id),
    )


def insert_version(
    db: sqlite3.Connection,
    document_id: int,
    content: str,
    created_by: int,
) -> None:
    db.execute(
        '''
        INSERT INTO versions (document_id, content, created_by, created_at)
        VALUES (?, ?, ?, ?)
        ''',
        (document_id, content, created_by, utcnow_iso()),
    )


def normalize_document_content(content: str | None) -> str:
    if content is None:
        return EMPTY_DOCUMENT_HTML
    compact = content.strip()
    return compact or EMPTY_DOCUMENT_HTML


def serialize_user(row: sqlite3.Row) -> dict[str, Any]:
    return {'id': row['id'], 'username': row['username'], 'email': row['email']}


def serialize_document(row: sqlite3.Row) -> dict[str, Any]:
    return {
        'id': row['id'],
        'title': row['title'],
        'content': row['content'],
        'owner_id': row['owner_id'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


def serialize_collaborator(row: sqlite3.Row) -> dict[str, Any]:
    return {
        'id': row['id'],
        'username': row['username'],
        'email': row['email'],
        'role': row['role'],
    }


def serialize_version(row: sqlite3.Row) -> dict[str, Any]:
    payload = {
        'id': row['id'],
        'document_id': row['document_id'],
        'created_by': row['created_by'],
        'created_at': row['created_at'],
        'created_by_username': row['created_by_username'],
    }
    if 'content' in row.keys():
        payload['content'] = row['content']
    return payload


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        samesite='lax',
        secure=settings.secure_cookies,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path='/',
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        samesite='lax',
        secure=settings.secure_cookies,
        path='/',
    )


def strip_html(value: str) -> str:
    without_tags = re.sub(r'<[^>]+>', ' ', value)
    normalized = re.sub(r'\s+', ' ', unescape(without_tags)).strip()
    return normalized


app = create_app()
