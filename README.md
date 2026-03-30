# Collaborative Editor

Real-time collaborative document editor with an integrated AI writing assistant.
AI1220 Assignment 1 — Proof of Concept.

## Project Structure

```
editor/
├── backend/   Node.js + Express REST API (Zhengxi)
└── frontend/  (Harman)
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

### What is intentionally deferred

- Real-time collaboration (WebSocket / CRDT) — planned for a later milestone
- LLM API calls in `/ai/suggest`
- Frontend
