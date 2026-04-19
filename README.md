# Draftboard

Draftboard is the AI1220 collaborative document editor. This integration branch combines:

- Luka's **core application** work for authentication, document management, sharing, rich-text editing, and version restore
- Harman's **realtime collaboration** work for authenticated websocket sync, presence, and remote carets
- the integrated **AI writing assistant** flow for streaming suggestions, comparison UX, and history tracking on top of the shared editor

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
- streaming AI suggestions over FastAPI `text/event-stream`
- AI actions for rewrite, summarize, expand, grammar fixes, and custom prompts
- editable AI suggestion review with compare-before-apply, reject, partial apply, and undo-after-apply
- prompt templates through a dedicated prompt module and provider abstraction
- AI interaction history including source context, prompt, model, response, and decision status
- explicit implementation notes in [DEVIATIONS.md](DEVIATIONS.md)

## What Is Not Final Yet

- Redis-backed multi-instance collaboration fan-out
- a production LLM API key is optional; without one the app runs on the built-in streaming stub provider

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

Backend AI env:

```bash
AI_PROVIDER=stub
AI_MODEL=draftboard-stub-v1
AI_MAX_OUTPUT_TOKENS=768
# ANTHROPIC_API_KEY=...
```

`AI_PROVIDER=stub` works out of the box for local demos and tests. If you want a live Anthropic-backed provider, set `AI_PROVIDER=anthropic` and provide `ANTHROPIC_API_KEY`.

## AI In Concurrent Collaboration

Draftboard does **not** let the assistant overwrite the shared document automatically.

- AI generation happens against a snapshot of the current editor selection / section / document context.
- The streamed suggestion stays in the assistant panel until a human explicitly accepts, edits, partially accepts, or rejects it.
- Any accepted AI output is applied through the same Tiptap + Yjs editor transaction path as normal user edits.
- That means collaborator cursors, presence, autosave, history, and websocket sync all see the AI-applied change as a normal shared-editor mutation rather than a side-channel overwrite.
- If the underlying document changes while a suggestion is streaming, the already-generated suggestion is still reviewable, but it is only merged into the current document when the user explicitly applies it.

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
