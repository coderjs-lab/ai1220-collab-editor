# Draftboard

Draftboard is a collaborative document editor for AI1220. This branch implements the **realtime collaboration slice** for Assignment 2 on top of a new **FastAPI + React** foundation, while keeping clear ownership boundaries with the parallel **core-app** and **AI** branches.

## What This Branch Demonstrates

This branch demonstrates:

- FastAPI backend foundation for the collaboration slice
- JWT-based REST auth reused by the collaboration workflow
- document-scoped collaboration session issuance
- authenticated websocket collaboration endpoint at `/ws/collab/{document_id}`
- Yjs / ypy-websocket based shared document sync
- Tiptap-based collaborative editor adapter in the React frontend
- remote presence metadata and collaboration connection-state UI
- manual snapshot persistence of the shared draft through the existing document update route
- explicit contract and deviation documentation for parallel team delivery

## What This Branch Intentionally Does Not Finalize Yet

This branch does **not** claim ownership of the full Assignment 2 app.

Still owned by parallel teammate branches:

- final core-app editor shell and autosave policy
- final version-restore UX
- full auth lifecycle polish beyond what collaboration needs
- AI streaming backend and final AI assistant workflow

Intentionally deferred on this branch:

- Redis-backed multi-instance collaboration fan-out
- distributed room coordination
- production LLM integration
- final version restore pipeline
- final merged UI after all team branches land

## Realtime Collaboration Contract

The collaboration-facing interface is frozen in:

- [docs/realtime-contract.md](docs/realtime-contract.md)

This is the contract the AI, core-app, and collaboration branches should code against in parallel.

## Architecture Deviations

Implementation differences from the Assignment 1 report are documented in:

- [DEVIATIONS.md](DEVIATIONS.md)

Each deviation records:

- what changed
- why it changed
- whether it was an improvement or a compromise

## Stack

### Backend

| Concern | Choice |
|---------|--------|
| Runtime | Python 3.12+ |
| Framework | FastAPI |
| Realtime sync | `ypy-websocket` with Yjs-compatible sync semantics |
| Storage | SQLite |
| Auth | JWT |

### Frontend

| Concern | Choice |
|---------|--------|
| Build tool | Vite |
| UI | React 19 + TypeScript |
| Editor | Tiptap |
| Collaboration client | Yjs + `y-websocket` |
| Styling | Tailwind CSS 4 + custom CSS variables |

## Project Structure

```text
ai1220-collab-editor/
├── backend/
│   ├── app/                  # FastAPI collaboration foundation
│   ├── tests/                # backend collaboration tests
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── features/ai/
│       ├── features/documents/
│       └── features/editor/  # collaborative editor adapter + session hooks
├── docs/
│   ├── adr/
│   ├── c4-diagrams/
│   ├── realtime-contract.md
│   └── ...
├── DEVIATIONS.md
└── run.sh
```

## How To Run This Branch

### Option 1: single command

```bash
./run.sh
```

This starts:

- FastAPI backend on `http://localhost:3001`
- Vite frontend on `http://localhost:5173`

### Option 2: run services manually

#### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 3001
```

Key backend env vars:

```bash
PORT=3001
JWT_SECRET=change-me-in-production
DB_PATH=./data/editor.db
YSTORE_PATH=./data/yupdates.db
ACCESS_TOKEN_TTL_SECONDS=604800
COLLAB_SESSION_TTL_SECONDS=1800
WS_BASE_URL=ws://localhost:3001/ws/collab
CORS_ORIGIN=http://localhost:5173
```

#### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Set:

```bash
VITE_API_BASE_URL=http://localhost:3001/api
```

## Backend API Surface

All authenticated REST endpoints use:

`Authorization: Bearer <token>`

### Auth

| Method | Path | Response |
|--------|------|----------|
| POST | `/api/auth/register` | `{ user, token }` |
| POST | `/api/auth/login` | `{ user, token }` |
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
| POST | `/api/documents/:id/share` | `{ permission }` |
| DELETE | `/api/documents/:id/share/:userId` | `{ message }` |

`document.content` and version `content` now use structured rich-text JSON.

### AI

These routes remain present for compatibility with the AI branch:

| Method | Path | Response |
|--------|------|----------|
| POST | `/api/documents/:id/ai/suggest` | `{ suggestion }` |
| GET | `/api/documents/:id/ai/history` | `{ history[] }` |

### Collaboration

#### REST session handshake

| Method | Path | Response |
|--------|------|----------|
| POST | `/api/documents/:id/session` | `{ session_token, ws_url, expires_in, role }` |

#### Websocket

| Path | Notes |
|------|-------|
| `/ws/collab/{document_id}?token=<session_token>` | document-scoped authenticated collaboration socket |

## Frontend Scope On This Branch

Implemented in the current collaboration frontend layer:

- collaborative editor adapter mounted inside the existing editor page
- websocket provider setup and teardown
- role-aware editable vs read-only behavior
- awareness-driven collaborator list
- connection status reporting:
  - `idle`
  - `connecting`
  - `connected`
  - `reconnecting`
  - `offline`
  - `resynced`
  - `error`
- AI suggestion application through editor transactions
- manual persistence of the current collaborative snapshot

## Verification

Verified on this branch:

- frontend production build:
  - `npm --prefix frontend run build`
- backend foundation tests:
  - `backend/.venv/bin/python -m pytest backend/tests/test_realtime_foundation.py`

## Docs Index

| File | Contents |
|------|----------|
| `docs/realtime-contract.md` | Collaboration contracts for parallel team delivery |
| `DEVIATIONS.md` | Explicit implementation differences from the Assignment 1 design |
| `docs/traceability.md` | Requirements traceability |
| `docs/auth-design.md` | Auth design notes |
| `docs/repo-structure.md` | Repo layout and structure decisions |
| `docs/error-contract.md` | Error-response contract |
| `docs/erd.mmd` | Mermaid ERD source |
| `docs/erd.png` | Exported ERD image |
| `docs/c4-diagrams/` | Draw.io sources and exported C4 Level 1/2/3 diagrams |
| `docs/adr/` | Architecture Decision Records |
