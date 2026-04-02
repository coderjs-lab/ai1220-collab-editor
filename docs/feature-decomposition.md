# Feature Decomposition

The system is decomposed into six modules. Each module has a defined responsibility, a clear set of dependencies, and an interface contract that other modules consume. The goal is a design where modules can be developed, tested, and evolved somewhat independently.

---

## 1. Rich-Text Editor and Frontend State Management

**Responsibility.** Renders the document editing surface, manages local editor state (cursor position, selection, undo stack), and translates user keystrokes into document operations that can be transmitted to the sync layer.

**Dependencies.** Consumes operations from the Real-Time Synchronization module to apply remote changes. Uses the API Layer to load and persist document metadata (title, sharing settings). Depends on the AI Assistant module to display suggestion overlays and accept/reject flows.

**Interface exposed.**

| Interface | Description |
|-----------|-------------|
| `onLocalOperation(op)` | Emits a document operation when the user types, deletes, or formats text |
| `applyRemoteOperation(op)` | Accepts an incoming operation from a remote collaborator and integrates it into the local editor state |
| `showAISuggestion(suggestion)` | Renders an AI-generated suggestion inline with accept / reject / partial-accept controls |
| `getSelection()` | Returns the current text selection and its document-relative offsets for AI context |

**Current PoC state.** The frontend (`EditorPage.tsx`) provides a plain-text `<textarea>` with manual save via `PUT /documents/:id`. Rich-text editing, operation-level sync, and AI suggestion UI are deferred.

---

## 2. Real-Time Synchronization Layer

**Responsibility.** Keeps all connected clients in sync when editing the same document. Receives local operations from each client, merges them using a conflict resolution algorithm (CRDT), and broadcasts the merged result to all other connected clients. Manages presence information (who is online, cursor positions).

**Dependencies.** Communicates with clients over WebSocket. Reads and writes document state to the Database via the Database Layer. Coordinates with the AI Assistant module to handle "pending suggestion" regions during AI operations.

**Interface exposed.**

| Interface | Description |
|-----------|-------------|
| `connect(documentId, userId)` | Opens a WebSocket session for a user on a specific document |
| `broadcastOperation(op)` | Distributes a merged operation to all clients in the same document session |
| `updatePresence(userId, cursor)` | Broadcasts cursor/selection position updates to other collaborators |
| `lockRegion(range)` / `unlockRegion(range)` | Marks a text region as "AI pending" so that concurrent edits are handled gracefully |

**Current PoC state.** Not yet implemented. Real-time sync is deferred to a later milestone. The current system uses manual save–reload.

---

## 3. AI Assistant Service

**Responsibility.** Handles all AI-powered writing features: rewrite, summarize, translate, restructure. Constructs prompts from the selected text and surrounding context, sends them to the LLM API, streams the response back, and manages usage quotas and interaction logging.

**Dependencies.** Receives requests from the API Layer (or directly from the frontend via the API). Reads document content from the Database to build prompt context. Calls the external LLM API. Logs every interaction to the `ai_interactions` table.

**Interface exposed.**

| Interface | Description |
|-----------|-------------|
| `POST /api/documents/:id/ai/suggest` | Accepts `{ prompt, context? }`, returns `{ suggestion }` (streamed in production) |
| `GET /api/documents/:id/ai/history` | Returns the audit log of all AI interactions on a document |
| Prompt templates | Internally maintained templates for each AI action type (rewrite, summarize, translate, restructure) |

**Current PoC state.** The endpoint exists (`routes/ai.js`) and logs interactions to the database. LLM calls return a stub response; real integration is deferred.

---

## 4. Document Storage and Versioning

**Responsibility.** Persists document content, metadata, and version history. Every content update creates a snapshot of the previous content in the `versions` table, enabling history browsing and future restoration.

**Dependencies.** Uses the Database Layer for all reads and writes. Consumed by the Document Controller (CRUD), the Sync Service (persisting merged state), and the AI Service (reading context for prompt construction).

**Interface exposed.**

| Interface | Description |
|-----------|-------------|
| `createDocument(title, content, ownerId)` | Inserts a new document |
| `updateDocument(id, fields)` | Updates title/content; snapshots previous content to `versions` if content changed |
| `getVersions(documentId, full?)` | Returns version history; `full=true` includes content blobs |
| `getDocument(id)` | Returns current document state with metadata |

**Current PoC state.** Fully implemented. `routes/documents.js` handles CRUD with automatic version snapshots on content updates.

---

## 5. User Authentication and Authorization

**Responsibility.** Verifies user identity (authentication) and enforces access control on every document operation (authorization). Issues and validates stateless JWT tokens. Manages the role hierarchy (owner > editor > viewer).

**Dependencies.** Uses bcrypt for password hashing and JWT for token management. Reads/writes the `users` and `permissions` tables via the Database Layer. The `resolveDoc()` function is called by every document-scoped route handler.

**Interface exposed.**

| Interface | Description |
|-----------|-------------|
| `POST /api/auth/register` | Creates a user account, returns `{ user, token }` |
| `POST /api/auth/login` | Validates credentials, returns `{ user, token }` |
| `GET /api/auth/me` | Restores a session from a valid JWT |
| `requireAuth` middleware | Verifies Bearer token on all protected routes |
| `resolveDoc(req, res, minRole)` | Central authorization gate for document access |

**Current PoC state.** Fully implemented. JWT auth with 7-day expiry, bcrypt password hashing, and role-based document access control.

---

## 6. API Layer

**Responsibility.** Provides the HTTP interface connecting the frontend SPA to all backend services. Defines the request/response contracts, handles input validation, error formatting, and CORS. Serves as the single integration boundary between frontend and backend teams.

**Dependencies.** Delegates to the Auth, Document, Sharing, Version, and AI controllers. Applies the Auth Middleware to all protected routes. Uses the central Error Handler for consistent error responses.

**Interface exposed.**

The full contract is documented in the [README API Contract section](../README.md). Summary:

| Area | Endpoints |
|------|-----------|
| Auth | `POST /register`, `POST /login`, `GET /me` |
| Documents | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` |
| Sharing | `POST /:id/share`, `DELETE /:id/share/:userId` |
| Versions | `GET /:id/versions` |
| AI | `POST /:id/ai/suggest`, `GET /:id/ai/history` |

All endpoints return JSON. Authenticated endpoints require `Authorization: Bearer <token>`. Error responses use `{ error: string }` with appropriate HTTP status codes (400, 401, 403, 404, 500).

**Current PoC state.** Fully implemented. The frontend type definitions (`types/api.ts`) are aligned with the backend response shapes. Integration tests verify the full contract.

---

## Module Dependency Graph

```
┌──────────────────┐     ┌──────────────────┐
│  Rich-Text Editor │────▶│  Real-Time Sync   │
│  (Frontend)       │     │  (WebSocket/CRDT) │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │   ┌────────────────┐   │
         ├──▶│  API Layer      │◀──┘
         │   │  (REST/HTTP)    │
         │   └───────┬────────┘
         │           │
         │   ┌───────┴────────┐
         │   │   Auth & RBAC   │
         │   └───────┬────────┘
         │           │
    ┌────┴───┐  ┌────┴────────┐  ┌───────────┐
    │AI Asst.│  │Doc Storage  │  │ Database   │
    │Service │─▶│& Versioning │─▶│ (SQLite)   │
    └────────┘  └─────────────┘  └───────────┘
```
