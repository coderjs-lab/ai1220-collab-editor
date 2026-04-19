# Real-Time Collaboration Contract

This document freezes the collaboration-facing interfaces for the Assignment 2 realtime slice so the **core-app**, **AI**, and **collaboration** branches can evolve in parallel without contract drift.

## Scope

This contract covers:

- shared document content shape
- collaboration session handshake
- websocket endpoint and auth model
- awareness/presence metadata
- connection-state semantics
- the editor integration boundary that AI and core-app work must respect

It does **not** define the AI provider pipeline or the final core-app editor chrome.

## Shared Content Shape

`document.content` is now structured rich-text JSON rather than a plain string.

Expected shape:

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

Rules:

- REST document routes return this JSON directly.
- version history entries store the same content shape.
- the collaboration editor is responsible for translating user interaction into collaborative editor transactions.
- accepted AI output must enter the editor through that same transaction path, not through a separate overwrite channel.

## Roles

Document roles remain:

- `owner`
- `editor`
- `viewer`

Behavior:

- `owner` and `editor` may edit and persist document state.
- `viewer` may join collaboration in read-only mode and should still receive presence and cursor awareness.

## Session Handshake

The frontend must create a document-scoped collaboration session before opening a websocket.

### Request

`POST /api/documents/{id}/session`

### Response

```json
{
  "session_token": "<jwt>",
  "ws_url": "ws://localhost:3001/ws/collab",
  "expires_in": 1800,
  "role": "editor"
}
```

Rules:

- `session_token` is short-lived and scoped to one document.
- `role` reflects the backend access decision for the current user and document.
- the frontend must use the returned role to configure editable vs read-only collaboration behavior.

## WebSocket Endpoint

Endpoint:

`/ws/collab/{document_id}`

Auth:

- the websocket connection includes the session token as a query param:
  - `?token=<session_token>`
- the backend validates:
  - token signature
  - token type
  - document id match
  - current document access

Transport:

- realtime sync uses Yjs / ypy-websocket sync semantics
- awareness/presence is exchanged through Yjs awareness messages
- the protocol must not be replaced with ad hoc last-write-wins JSON patches

## Presence Metadata

The local awareness payload should expose:

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

Frontend rendering assumptions:

- collaborators list uses awareness state
- remote cursor/caret color is derived from `color`
- read-only participants still appear in presence

## Connection-State Semantics

Frontend collaboration UI should use these states:

- `idle`
- `connecting`
- `connected`
- `reconnecting`
- `offline`
- `resynced`
- `error`

Interpretation:

- `connected`: socket active and collaboration session healthy
- `reconnecting`: socket dropped after a previously healthy session
- `resynced`: socket recovered after reconnect
- `offline`: no active collaboration socket
- `error`: handshake or socket maintenance failure

## Editor Integration Boundary

The collaboration branch exposes one seam for the core-app and AI branches:

- `CollaborativeEditorAdapter`

Responsibilities:

- accepts document id, initial document JSON, session metadata, current user, and read-only flag
- wires Tiptap + Yjs + websocket collaboration
- exposes current plain-text projection for counts and summaries
- exposes manual persistence of the current collaborative snapshot through the REST document update route
- exposes suggestion application through editor transactions

Core-app branch assumptions:

- page shell, autosave policy, version-restore UX, and surrounding chrome may evolve independently
- collaboration logic should be mounted through the adapter rather than reimplemented elsewhere

AI branch assumptions:

- accepted AI suggestions must be applied through the editor transaction path
- AI must not mutate document state through a separate direct-overwrite API that bypasses the collaborative document
