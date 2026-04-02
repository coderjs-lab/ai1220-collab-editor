# Collaborative Editor

Real-time collaborative document editor with an integrated AI writing assistant.
AI1220 Assignment 1 — Proof of Concept.

## Project Structure

```
editor/
├── backend/   Node.js + Express REST API (Zhengxi)
└── frontend/  Vite + React + TypeScript + Tailwind product-aligned UI (Harmanjot Singh)
```

## Backend

### Stack

| Concern | Choice |
|---------|--------|
| Runtime | Node.js ≥ 22 |
| Framework | Express 4 |
| Database | SQLite via built-in `node:sqlite` |
| Auth | JWT (7-day expiry) + bcrypt |

### Setup

```bash
cd backend
cp .env.example .env      # set JWT_SECRET to a strong random value
npm install
npm start                 # http://localhost:3001
```

`npm run dev` uses `--watch` for auto-reload during development.

### Running tests

```bash
cd backend
npm test
```

Tests use an in-memory SQLite database — no `.env` needed. The suite covers the full PoC flow: register → login → create/update/share document → version history → AI stub → delete.

### API Contract

All endpoints return JSON. Authenticated endpoints require `Authorization: Bearer <token>`.

#### Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{ username, email, password }` | `{ user, token }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ user, token }` |
| GET | `/api/auth/me` | — | `{ user }` |

`user` shape: `{ id, username, email }`

#### Documents

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/documents` | — | `{ documents[] }` |
| POST | `/api/documents` | `{ title?, content? }` | `{ document }` |
| GET | `/api/documents/:id` | — | `{ document, collaborators[] }` |
| PUT | `/api/documents/:id` | `{ title?, content? }` | `{ document }` |
| DELETE | `/api/documents/:id` | — | `{ message }` |
| POST | `/api/documents/:id/share` | `{ email, role }` | `{ permission }` |
| DELETE | `/api/documents/:id/share/:userId` | — | `{ message }` |
| GET | `/api/documents/:id/versions` | `?full=1` for content | `{ versions[] }` |

`role` ∈ `"viewer" \| "editor"`. Only the owner can share or delete.
Every `PUT` that changes `content` snapshots the previous content to `versions`.

#### AI (stub)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/documents/:id/ai/suggest` | `{ prompt, context? }` | `{ suggestion }` |
| GET | `/api/documents/:id/ai/history` | — | `{ history[] }` |

LLM integration is deferred to a later milestone.

#### Collaboration Session (stub)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/documents/:id/session` | — | `{ sessionToken, expiresIn }` |

Returns a short-lived stub token for future Collab Server handoff. Real WebSocket session validation is deferred.

### Data Model

```
users              documents             permissions
─────              ─────────             ───────────
id                 id                    id
username           title                 document_id → documents
email              content               user_id     → users
password_hash      owner_id  → users     role  (viewer|editor)
created_at         created_at            created_at
                   updated_at

versions                      ai_interactions
────────                      ───────────────
id                            id
document_id → documents       document_id → documents
content                       user_id     → users
created_by  → users           prompt
created_at                    response
                              created_at
```

### Docs

| File | Contents |
|------|----------|
| `docs/traceability.md` | User stories → Functional requirements → Backend components |
| `docs/auth-design.md` | JWT auth flow, password storage, access-control model |
| `docs/repo-structure.md` | Monorepo choice, directory layout, config, testing structure |
| `docs/erd.mmd` | Mermaid ERD source for users/documents/permissions/versions/AI interactions |
| `docs/error-contract.md` | Confirmed PoC error response format and status mapping |
| `docs/architectural-drivers.md` | Ranked architectural drivers and their consequences |
| `docs/c4-diagrams.md` | C4 Level 1 (context), Level 2 (container), Level 3 (component) in Mermaid |
| `docs/feature-decomposition.md` | Module breakdown with responsibilities, dependencies, and interfaces |
| `docs/ai-integration-design.md` | AI context strategy, suggestion UX, collaboration handling, prompt design, cost model |
| `docs/communication-model.md` | Push-based sync via WebSocket, connection lifecycle, reconnection strategy |
| `docs/nfr.md` | Non-functional requirements: latency, scalability, availability, security, usability |
| `docs/project-management.md` | Team ownership, workflow, methodology, risk assessment, timeline |
| `docs/adr/ADR-001-synchronization-strategy.md` | CRDT over OT for real-time sync |
| `docs/adr/ADR-002-ai-context-strategy.md` | Tiered AI context over full-document prompts |
| `docs/adr/ADR-003-monorepo-organization.md` | Monorepo over multi-repo |
| `docs/adr/ADR-004-versioning-data-retention.md` | Snapshot versioning with bounded retention |

### What is intentionally deferred

- Real-time collaboration (WebSocket / CRDT) — planned for a later milestone
- LLM API calls in `/ai/suggest`
- Version restore endpoint and UI flow
- Advanced share roles (commenter/admin policy model)
- Export UI

## Frontend

### Stack

| Concern | Choice |
|---------|--------|
| Build tool | Vite |
| UI | React 19 + TypeScript |
| Routing | React Router |
| Styling | Tailwind CSS 4 + custom CSS variables |

### Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev               # http://localhost:5173
```

Set the frontend API base URL in `.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:3001/api
```

The backend must already be running so the frontend can restore JWT sessions and load documents.

### Implemented frontend routes

| Route | Purpose |
|-------|---------|
| `/login` | Product-facing sign-in screen using `POST /api/auth/login` |
| `/register` | Product-facing registration screen using `POST /api/auth/register` |
| `/documents` | Authenticated workspace using list, create, and delete document flows |
| `/documents/:id` | Editor workspace using load, save, share, revoke, version-history, beta AI, and collaboration-session readiness flows |

### Current frontend scope

- Register, login, and restore a saved JWT session
- Search, sort, and browse owned and shared documents
- Create and delete owned documents
- Open a document in a polished plain-text editor workspace
- Save title/content changes manually
- Manage collaborator access for owners using existing share routes
- Review saved version history using the existing versions route
- Generate beta AI suggestions and review assistant history for the current document
- Request collaboration-session readiness for any accessible document
- Render explicit read-only UI for viewer access
- Warn before leaving with unsaved changes
- Show visible loading, auth, access, not-found, and server-error states

### Frontend limitations in this milestone

- No rich-text editor
- No realtime collaboration UI
- AI suggestions still use the current backend stub response
- Collaboration readiness does not mean live sync is active yet
- No persistent accept/reject AI workflow
- No version restore flow
- No autosave

## QA Evidence (1 Apr Milestone)

Final QA checks completed on April 2, 2026:

- Backend integration tests: `23/23` passing (`npm --prefix backend test`)
- Frontend production build: pass (`npm --prefix frontend run build`)

This verifies the documented PoC path remains runnable end-to-end on current `main`.
