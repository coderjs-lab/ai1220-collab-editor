# Draftboard

Draftboard is the AI1220 collaborative document editor. This integration branch combines:

- Luka's **core application** work for authentication, document management, sharing, rich-text editing, and version restore
- Harman's **realtime collaboration** work for authenticated websocket sync, presence, and remote carets

The **AI writing assistant branch is still pending final integration**, so AI behavior in this branch should be treated as compatibility-preserving rather than final.

## What This Branch Demonstrates

- FastAPI backend under `backend/app`
- React + TypeScript frontend under `frontend/`
- JWT access tokens with refresh-cookie session recovery
- document CRUD, owner-managed sharing, revoke access, and version history
- autosave with immediate manual save override
- restore of previous versions
- Tiptap-based rich-text document content
- authenticated realtime collaboration over websocket at `/ws/collab/{document_id}`
- Yjs / `ypy-websocket` shared sync
- IndexedDB-backed local collaborative state for offline editing and sync-on-reconnect
- collaborator presence, typing/activity state, and remote cursor / selection rendering
- share-by-link creation, acceptance, and revocation
- browser E2E coverage for the core + realtime flow with Playwright
- explicit implementation notes in [DEVIATIONS.md](DEVIATIONS.md)

## What Is Not Final Yet

- final AI assistant implementation from the teammate-owned AI branch
- Redis-backed multi-instance collaboration fan-out
- partial acceptance of AI suggestion fragments

## How To Run

### Single command

```bash
./run.sh
```

This starts:

- FastAPI backend on `http://localhost:3001`
- Vite frontend on `http://localhost:5173`

### Manual run

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

Frontend env:

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

These routes remain available for compatibility with the not-yet-integrated AI branch:

| Method | Path | Response |
|--------|------|----------|
| POST | `/api/documents/:id/ai/suggest` | `{ suggestion }` |
| GET | `/api/documents/:id/ai/history` | `{ history[] }` |

### Collaboration

| Method | Path | Response |
|--------|------|----------|
| POST | `/api/documents/:id/session` | `{ session_token, ws_url, expires_in, role }` |

Websocket endpoint:

| Path | Notes |
|------|-------|
| `/ws/collab/{document_id}?token=<session_token>` | document-scoped authenticated collaboration socket |

## Verification

Recommended checks on this branch:

```bash
npm --prefix frontend run build
npm --prefix frontend test
backend/.venv/bin/python -m pytest
npm --prefix frontend run test:e2e
```

The Playwright E2E suite is configured to run against local FastAPI + Vite servers and uses the system Chrome channel.

## Key Docs

- [DEVIATIONS.md](DEVIATIONS.md)
- [docs/realtime-contract.md](docs/realtime-contract.md)
- `docs/adr/`
- `docs/c4-diagrams/`
- `docs/erd.mmd`
