# Draftboard

Draftboard is the AI1220 collaborative document editor: a React + FastAPI application that combines rich-text document management, realtime collaboration, and an AI writing assistant in one shared workspace.

The final integrated implementation includes:

- secure JWT-based authentication with refresh-token session recovery
- document CRUD, sharing, version history, and restore
- Tiptap-based rich-text editing with autosave
- authenticated websocket collaboration with Yjs / `ypy-websocket`
- presence, typing/activity awareness, remote cursors, and reconnect handling
- streaming AI suggestions with review-before-apply workflows
- share-by-link, partial AI acceptance, and browser E2E coverage

## Quick Links

- [Team Ownership](#team-ownership)
- [Assignment Coverage](#assignment-coverage)
- [Architecture Overview](#architecture-overview)
- [Technology Choices](#technology-choices)
- [How To Run](#how-to-run)
- [Testing](#testing)
- [API Docs](#api-docs)
- [Backend API Surface](#backend-api-surface)
- [Key Docs](#key-docs)

## Team Ownership

The table below separates the original Assignment 1 ownership model from the final Assignment 2 implementation split, because the final integration work redistributed the build ownership across the three parts.

| Team Member | Assignment 1 Role (from report) | Assignment 1 Primary Domain | Final Assignment 2 Delivery |
|-------------|----------------------------------|-----------------------------|-----------------------------|
| Harmanjot Singh | Frontend & Requirements Lead | User-facing flows and Part 1 requirements ownership | Realtime collaboration implementation and final integration of all three parts |
| Zhengxi Li | Backend, API & Data Lead | REST API server, authentication, database, and data model | AI writing assistant implementation |
| Luka Tsulaia | Architecture & Collaboration Lead | Realtime collaboration architecture, AI integration service, C4 diagrams, ADRs, and project-management sections | Core application implementation |

Concise ownership summary from the Assignment 1 report section `3.1 Team Structure & Ownership`:

- Harmanjot owned the frontend and requirements domain.
- Zhengxi owned the backend core, API, and data domain.
- Luka owned architecture and collaboration.

Final Assignment 2 implementation ownership:

- Luka delivered the core application slice.
- Zhengxi delivered the AI writing assistant slice.
- Harmanjot delivered realtime collaboration and performed the final integration across all parts.

## Assignment Coverage

### Part 1: Core Application

- registration and login with hashed passwords
- JWT access tokens plus refresh-token session recovery
- protected routes and graceful session expiry handling
- document CRUD with title, ownership, dates, and dashboard listing
- rich-text editor with headings, bold, italic, lists, and code blocks
- autosave with status indication and manual save override
- version history and restore
- server-side enforced roles: `owner`, `editor`, `viewer`
- direct sharing by username/email with role assignment

### Part 2: Real-Time Collaboration

- authenticated websocket collaboration
- realtime propagation of edits between connected users
- Yjs-based character-level conflict resolution
- active collaborator list and activity/typing state
- remote cursor and selection rendering
- reconnection lifecycle handling
- IndexedDB-backed local persistence for offline editing and sync-on-reconnect

### Part 3: AI Writing Assistant

- rewrite
- summarize
- expand
- fix grammar and spelling
- custom prompt
- FastAPI SSE streaming responses
- cancel-in-progress generation
- compare-before-apply suggestion UX
- accept, reject, edit, undo, and partial acceptance
- configurable prompt module and provider abstraction
- AI interaction history per document

### Part 4: Testing & Quality

- backend unit tests for auth/security, permissions, and prompts
- backend API integration tests for auth, document CRUD, permissions, AI, share links, and collaboration session bootstrap
- websocket tests for auth and message exchange
- frontend component tests for auth flow, document UI, and AI suggestion UI
- Playwright E2E coverage for realtime collaboration and AI workflows
- single-command local run script
- `.env.example` files for backend and frontend
- README, deviations report, API docs, and traceability documentation

### Bonus Coverage

| Bonus Item | Status |
|------------|--------|
| Character-level conflict resolution via CRDTs | Implemented |
| Remote cursor and selection tracking | Implemented |
| Share-by-link with configurable permissions and revocation | Implemented |
| Partial acceptance of AI suggestions | Implemented |
| End-to-end tests covering login through AI suggestion acceptance | Implemented |

## Architecture Overview

Updated high-level PoC architecture, shown as a markdown-only container diagram of the final integrated system:

```text
                                   DRAFTBOARD POC

  +---------------------------+                      +---------------------------+
  |   Document Owner / Editor |                      |     Collaborating User    |
  +-------------+-------------+                      +-------------+-------------+
                |                                                  |
                | browser interaction                              | browser interaction
                v                                                  v
      +--------------------------------------------------------------------------+
      |                React + TypeScript SPA  (frontend/)                        |
      |--------------------------------------------------------------------------|
      | Auth UI | Dashboard | Rich-text Editor | Sharing UI | Collab UI | AI UI  |
      +-----------+----------------------+----------------------+-----------------+
                  |                      |                      |
                  | REST + JWT           | WebSocket + session  | SSE stream
                  |                      | bootstrap            |
                  v                      v                      v
      +--------------------------------------------------------------------------+
      |                    FastAPI Backend  (backend/app/)                        |
      |--------------------------------------------------------------------------|
      | REST API              | Collaboration Session + WebSocket | AI Routes     |
      | auth/documents/share  | /api/documents/:id/session        | suggest/history|
      | versions/share-links  | /ws/collab/{document_id}          | decisions      |
      +-----------------------+----------------------+----------------------------+
                              \                     |                    /
                               \                    |                   /
                                \                   |                  /
                                 v                  v                 v
                          +------------------------------------------------+
                          |              Repository Layer                   |
                          +------------------------+-----------------------+
                                                   |
                                                   | SQL / durable storage
                                                   v
                          +------------------------------------------------+
                          |                    SQLite                      |
                          | documents | versions | permissions | sessions  |
                          | share links | AI history | Y update store      |
                          +------------------------------------------------+

                  +-----------------------------------+
                  |  IndexedDB in Browser (`y-indexeddb`) |
                  |  local Yjs state for offline/reconnect |
                  +-------------------+-------------------+
                                      ^
                                      |
                              local collaborative state

                  +-----------------------------------+
                  |      AI Provider (stub / live)    |
                  +-------------------+---------------+
                                      ^
                                      |
                              AI generation requests
```

Reading the diagram:

- `frontend/` is the only browser client surface and contains the document workspace, collaboration UX, and AI review/apply UI.
- `backend/app/` is the single integrated FastAPI backend and serves REST, SSE, and websocket collaboration entrypoints.
- SQLite is the durable PoC data store for documents, versions, sharing, auth refresh sessions, AI history, and Y update persistence.
- realtime collaboration uses Yjs over authenticated websockets, while offline recovery uses local IndexedDB-backed Yjs persistence in the browser.
- AI suggestions are generated through backend AI routes and only become document changes when they are applied back through the shared editor flow.

## Technology Choices

These are the main implementation choices and why they were used.

| Technology | Why It Was Used |
|------------|-----------------|
| React + TypeScript | Required frontend stack. TypeScript keeps the editor, API contracts, and collaboration state safer and easier to refactor. |
| FastAPI | Required backend stack. Gives JWT-protected REST routes, OpenAPI generation, SSE support, and websocket support in one framework. |
| SQLite | The brief allows file-based persistence. SQLite provides durable local persistence without external infrastructure and is stronger than in-memory storage for a submission-grade proof of concept. |
| Tiptap / ProseMirror | Meets the rich-text editing requirement with a real structured editor model instead of a fragile textarea/HTML string workflow. |
| Yjs + `ypy-websocket` | Provides CRDT-based collaborative editing, presence, reconnect handling, and bonus-tier conflict resolution. |
| `y-indexeddb` | Supports offline editing with sync-on-reconnect instead of only transient in-memory recovery. |
| SSE via FastAPI `StreamingResponse` | Satisfies the hard AI streaming requirement with a straightforward integration into the existing backend. |
| Playwright | Verifies real browser workflows across auth, document editing, collaboration, and AI acceptance. |

## What Is Not Final Yet

- Redis-backed multi-instance collaboration fan-out is not implemented; the current collaboration backend is single-node.
- A production LLM API key is optional; without one the app runs with the built-in stub streaming provider.

## How To Run

### Single Command

```bash
./run.sh
```

This starts:

- FastAPI backend on `http://localhost:3001`
- Vite frontend on `http://localhost:5173`

### Manual Run

#### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 3001
```

#### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Environment Configuration

Frontend example:

```bash
VITE_API_BASE_URL=http://localhost:3001/api
```

Backend example:

```bash
APP_NAME=Draftboard Backend
PORT=3001
JWT_SECRET=change-me-before-production
ACCESS_TOKEN_TTL_SECONDS=1200
REFRESH_TOKEN_DAYS=7
REFRESH_COOKIE_NAME=draftboard_refresh
SECURE_COOKIES=false
DB_PATH=./data/editor.db
YSTORE_PATH=./data/yupdates.db
COLLAB_SESSION_TTL_SECONDS=1800
WS_BASE_URL=ws://localhost:3001/ws/collab
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
AI_PROVIDER=stub
AI_MODEL=draftboard-stub-v1
AI_MAX_OUTPUT_TOKENS=768
# ANTHROPIC_API_KEY=
```

`AI_PROVIDER=stub` works out of the box for local demos and tests. If you want a live Anthropic-backed provider, set `AI_PROVIDER=anthropic` and provide `ANTHROPIC_API_KEY`.

## Testing

Recommended verification commands:

```bash
npm --prefix frontend run build
npm --prefix frontend test
backend/.venv/bin/python -m pytest
npm --prefix frontend run test:e2e
```

Current testing scope:

- backend unit tests for auth/security, permissions, and AI prompt construction
- backend integration tests for auth, document CRUD, permissions, AI routes, share links, and collaboration session bootstrap
- websocket tests for invalid-token rejection and basic message exchange
- frontend component tests for auth, document/editor UI, API auth recovery, and AI suggestion review flows
- Playwright E2E tests for:
  - share-by-link collaboration
  - login through AI suggestion acceptance
  - partial AI suggestion acceptance

The Playwright suite runs against local FastAPI + Vite servers and uses the system Chrome channel.

## API Docs

When the backend is running, FastAPI publishes auto-generated API docs at:

- `http://localhost:3001/docs`
- `http://localhost:3001/redoc`

The generated OpenAPI schema includes documented request/response models, examples, endpoint summaries, and route descriptions for:

- auth
- documents
- direct sharing
- share links
- AI suggestion and history routes
- collaboration session bootstrap

OpenAPI does **not** include websocket routes, and it does not fully express the SSE event semantics used by streamed AI suggestions. Those interfaces are documented separately in:

- [docs/api-reference.md](docs/api-reference.md)
- [docs/realtime-contract.md](docs/realtime-contract.md)

## AI In Concurrent Collaboration

Draftboard does **not** let the assistant overwrite the shared document automatically.

- AI generation uses a snapshot of the current selection / section / document context.
- The streamed suggestion stays in the assistant panel until a human explicitly accepts, edits, partially accepts, or rejects it.
- Any accepted AI output is applied through the same Tiptap + Yjs editor transaction path as normal user edits.
- That means collaborator cursors, presence, autosave, history, and websocket sync all observe AI-applied changes as normal collaborative editor mutations instead of side-channel overwrites.
- If the underlying document changes while a suggestion is streaming, the generated suggestion remains reviewable but is only merged when the user explicitly applies it.

## Backend API Surface

All authenticated REST endpoints use:

`Authorization: Bearer <token>`

### Auth

| Method | Path | Response |
|--------|------|----------|
| POST | `/api/auth/register` | `{ user, token }` |
| POST | `/api/auth/login` | `{ user, token }` |
| POST | `/api/auth/refresh` | `{ user, token }` |
| POST | `/api/auth/logout` | `{ message }` |
| GET | `/api/auth/me` | `{ user }` |

### Documents

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/documents` | `{ documents[] }` |
| POST | `/api/documents` | `{ document }` |
| GET | `/api/documents/:id` | `{ document, collaborators[] }` |
| PUT | `/api/documents/:id` | `{ document }` |
| DELETE | `/api/documents/:id` | `{ message }` |
| GET | `/api/documents/:id/versions` | `{ versions[] }` |
| POST | `/api/documents/:id/versions/:versionId/restore` | `{ document }` |
| POST | `/api/documents/:id/share` | `{ permission }` |
| DELETE | `/api/documents/:id/share/:userId` | `{ message }` |
| GET | `/api/documents/:id/share-links` | `{ share_links[] }` |
| POST | `/api/documents/:id/share-links` | `{ share_link }` |
| DELETE | `/api/documents/:id/share-links/:linkId` | `{ message }` |
| POST | `/api/share-links/:token/accept` | `{ document, role }` |

`document.content` and version `content` use structured rich-text JSON.

### AI

| Method | Path | Response |
|--------|------|----------|
| POST | `/api/documents/:id/ai/suggest` | `{ interaction_id, suggestion, model, status, feature, context_preview }` |
| POST | `/api/documents/:id/ai/suggest/stream` | `text/event-stream` |
| GET | `/api/documents/:id/ai/history` | `{ history[] }` |
| POST | `/api/documents/:id/ai/history/:interactionId/decision` | `{ message }` |

### Collaboration

| Method | Path | Response |
|--------|------|----------|
| POST | `/api/documents/:id/session` | `{ session_token, ws_url, expires_in, role }` |

Websocket endpoint:

| Path | Notes |
|------|-------|
| `/ws/collab/{document_id}?token=<session_token>` | Document-scoped authenticated collaboration socket |

## Key Docs

- [DEVIATIONS.md](DEVIATIONS.md)
- [docs/api-reference.md](docs/api-reference.md)
- [docs/realtime-contract.md](docs/realtime-contract.md)
- [docs/traceability.md](docs/traceability.md)
- `docs/adr/`
- `docs/c4-diagrams/`
- `docs/erd.mmd`
