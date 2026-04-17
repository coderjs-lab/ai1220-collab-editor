# Draftboard

Assignment 2 implementation of a collaborative document editor with Luka's core-application contribution integrated on top of the latest synced repository state.

## Luka Scope

- FastAPI backend for authentication, document management, sharing, access control, version history, and restore
- React frontend support for rich-text editing, autosave, refresh-token session recovery, and permission-aware document flows
- Compatibility-preserving `/api/...` routes for teammate-owned AI and collaboration entry points
- Assignment support files: `run.sh`, `.env.example` files, backend/frontend tests, and [DEVIATIONS.md](./DEVIATIONS.md)

## Teammate-Owned Areas Kept Intact

- AI assistant UX remains connected through the existing `/api/documents/{id}/ai/...` routes
- Collaboration session readiness remains connected through `/api/documents/{id}/session`
- Live realtime transport and production AI generation are still outside Luka's ownership slice

## Stack

- Backend: FastAPI, SQLite, PyJWT
- Frontend: React 19, Vite, TypeScript, Tiptap StarterKit
- Auth: short-lived JWT access token plus rotating refresh cookie

## Setup

### Backend

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

### Frontend

```bash
npm --prefix frontend install
cp frontend/.env.example frontend/.env.local
```

## Run The App

```bash
./run.sh
```

This starts:

- FastAPI at `http://localhost:8000`
- Vite at `http://localhost:5173`

FastAPI OpenAPI docs are available at `http://localhost:8000/docs`.

## Tests

```bash
.venv/bin/pytest backend/tests
npm --prefix frontend test
npm --prefix frontend run build
```

## Repository Docs

- Architecture and design docs remain under `docs/`
- Assignment implementation deviations are documented in [DEVIATIONS.md](./DEVIATIONS.md)
