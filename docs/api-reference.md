# API Reference

This document is the complete repository-level API reference for the final integrated Draftboard implementation.

Use it together with the generated FastAPI docs:

- `/docs` for interactive OpenAPI exploration
- `/redoc` for schema browsing

This file exists because some important interfaces are not fully represented in OpenAPI:

- Server-Sent Event payload semantics for AI streaming
- websocket collaboration auth and transport details
- repo-level guidance about auth, error shape, and rich-text document content

## Base URLs

Local development defaults:

- frontend: `http://localhost:5173`
- backend REST API: `http://localhost:3001/api`
- backend websocket base: `ws://localhost:3001/ws/collab`

## Authentication Model

REST routes use:

`Authorization: Bearer <access_token>`

Session lifecycle:

- `POST /api/auth/register` or `POST /api/auth/login` returns a short-lived access token
- the backend also sets a refresh cookie
- `POST /api/auth/refresh` rotates the refresh cookie and returns a new access token
- `POST /api/auth/logout` revokes the refresh session

Collaboration websocket auth does **not** use the access token directly. It uses a short-lived document-scoped token issued by:

- `POST /api/documents/{id}/session`

## Common Response Shape

Successful responses use typed JSON payloads defined in:

- `backend/app/schemas.py`

Validation and error responses use:

```json
{
  "error": "Human-readable message"
}
```

Typical failure cases:

- `400` invalid request or invalid operation
- `401` invalid credentials or expired auth state
- `403` access denied
- `404` document / share link / interaction not found
- `409` duplicate user identity on registration
- `422` request validation failure
- `500` unexpected backend failure

## Rich-Text Content Shape

`document.content` uses Tiptap/ProseMirror-style JSON rather than plain text.

Example:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Example paragraph"
        }
      ]
    }
  ]
}
```

This same shape is used for:

- document create/update
- document fetch
- version history snapshots
- restore-version targets

## REST Endpoints

### System

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Minimal backend health probe |

### Auth

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/register` | Create account and return auth session |
| `POST` | `/api/auth/login` | Sign in and return auth session |
| `POST` | `/api/auth/refresh` | Rotate refresh session and return new access token |
| `POST` | `/api/auth/logout` | Revoke active refresh session |
| `GET` | `/api/auth/me` | Return current authenticated user |

### Documents

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/documents` | List accessible documents |
| `POST` | `/api/documents` | Create document |
| `GET` | `/api/documents/{document_id}` | Fetch document and collaborator list |
| `PUT` | `/api/documents/{document_id}` | Update title and/or content |
| `DELETE` | `/api/documents/{document_id}` | Delete document |
| `GET` | `/api/documents/{document_id}/versions` | List saved versions |
| `POST` | `/api/documents/{document_id}/versions/{version_id}/restore` | Restore an older version |

### Direct Sharing

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/documents/{document_id}/share` | Grant or update direct share access |
| `DELETE` | `/api/documents/{document_id}/share/{user_id}` | Revoke direct collaborator access |

### Share Links

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/documents/{document_id}/share-links` | List active share links |
| `POST` | `/api/documents/{document_id}/share-links` | Create a share link |
| `DELETE` | `/api/documents/{document_id}/share-links/{link_id}` | Revoke a share link |
| `POST` | `/api/share-links/{token}/accept` | Accept a share link |

### AI

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/documents/{document_id}/ai/suggest` | Generate a non-streaming AI suggestion |
| `POST` | `/api/documents/{document_id}/ai/suggest/stream` | Stream an AI suggestion via SSE |
| `GET` | `/api/documents/{document_id}/ai/history` | List AI history for a document |
| `POST` | `/api/documents/{document_id}/ai/history/{interaction_id}/decision` | Record accepted / rejected / partial / edited status |

### Collaboration Session Bootstrap

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/documents/{document_id}/session` | Issue a document-scoped collaboration token and websocket URL |

## AI Streaming Contract

`POST /api/documents/{document_id}/ai/suggest/stream`

Content type:

- `text/event-stream`

The frontend consumes Server-Sent Events emitted from the backend AI service pipeline.

Event types emitted by the backend stream:

- `metadata`
  - emitted once at the beginning
  - includes interaction metadata such as interaction id, feature, model, and context preview
- `chunk`
  - emitted zero or more times
  - carries partial text generated by the AI provider
- `complete`
  - emitted once on success
  - indicates the final stored interaction state is ready
- `error`
  - emitted on backend/provider failure
  - indicates the interaction did not complete successfully

The final persisted interaction can then be inspected through:

- `GET /api/documents/{document_id}/ai/history`

## Collaboration Websocket

OpenAPI does not document websocket routes, so the collaboration channel is defined here explicitly.

### 1. Session handshake

Request:

`POST /api/documents/{document_id}/session`

Response:

```json
{
  "session_token": "<collab-jwt>",
  "ws_url": "ws://localhost:3001/ws/collab",
  "expires_in": 1800,
  "role": "editor"
}
```

### 2. Websocket endpoint

Path:

`/ws/collab/{document_id}`

Connection query:

`?token=<session_token>`

Example:

`ws://localhost:3001/ws/collab/12?token=<session_token>`

### 3. Backend checks performed before join

The backend rejects the socket if any of these fail:

- collaboration token is missing
- token signature is invalid
- token type is not `collab`
- token document id does not match the route document id
- current user no longer has access to the document

### 4. Effective role behavior

- `owner` and `editor` may edit and persist document state
- `viewer` joins in read-only mode but still receives presence and awareness updates

### 5. Transport semantics

Realtime sync uses:

- Yjs document updates
- `ypy-websocket`
- awareness metadata for presence / cursors / activity

It is **not** a custom JSON patch protocol.

## Presence / Awareness Metadata

Representative awareness payload:

```json
{
  "user": {
    "id": 12,
    "name": "harman",
    "role": "editor",
    "color": "#115e59"
  }
}
```

Used by the frontend for:

- collaborator presence list
- typing/activity UI
- remote cursor color and labeling

## Where To Inspect The Live Contracts

- OpenAPI REST schema: `/docs`, `/redoc`
- collaboration contract: [realtime-contract.md](./realtime-contract.md)
- implementation deviations from Assignment 1: [../DEVIATIONS.md](../DEVIATIONS.md)
