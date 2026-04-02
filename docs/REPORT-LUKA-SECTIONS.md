# Luka's Report Sections — Ready for Google Docs

Below is every section that Luka owns, organized by the exact assignment headings. Copy each section into the shared Google Docs report under the corresponding heading.

For tables: create a Google Docs table and fill in the rows.
For Mermaid diagrams: paste the code into https://mermaid.live, export as PNG, and insert the image into Google Docs. Also include the Mermaid source in a code block below the image.

---

## 1.3 Non-Functional Requirements

Each quality attribute below is specified with measurable targets that can be verified through testing or monitoring.

### Latency

**NFR-L1: Keystroke Propagation Between Collaborators**

Target: A keystroke made by one collaborator must be visible on all other collaborators' screens within 200 ms under normal network conditions (< 50 ms round-trip to the server).

Justification: Research on collaborative editing (e.g., Google's studies on Docs latency) shows that delays above 200 ms cause users to perceive the system as "laggy" and begin second-guessing whether their collaborator is still active. Below 100 ms, the system feels instantaneous; between 100–200 ms, the system feels responsive; above 200 ms, users notice the delay. The 200 ms target balances achievability (it accounts for server-side CRDT merge time plus one network round trip) with perceived quality.

Measurement: Instrumented end-to-end test: two clients connected to the same document; timestamp the keystroke event on Client A and the DOM update on Client B. P95 latency must be ≤ 200 ms on a 50 ms RTT network.

**NFR-L2: AI Assistant Response Initiation**

Target: The first token (or "thinking" indicator) of an AI response must appear within 2 seconds of the user pressing the AI action button. The full response must complete within 10 seconds for a standard rewrite of a single paragraph.

Justification: Users tolerate longer waits for AI because they understand inference takes time, but they need immediate feedback that the system is working. A 2-second threshold for "first visible response" prevents the user from wondering whether the button click registered. The 10-second cap ensures that even slow LLM responses don't leave the user waiting indefinitely — if the model hasn't finished, the partial result is shown with a "still generating…" indicator.

Measurement: Instrumented from button click to first streamed token arrival in the frontend. Tested against the production LLM API under typical load.

**NFR-L3: Document Load Time**

Target: Opening a document (REST fetch + rendering) must complete within 1 second for documents up to 50,000 words with up to 100 saved versions.

Justification: A 1-second load time ensures the editing experience feels instant. The main contributors to load time are the database query (document + collaborator list) and the network transfer. Version content is not included in the initial load (fetched on demand with ?full=1), keeping the payload small regardless of version count.

Measurement: Time from GET /api/documents/:id request to rendered document in the frontend, tested with a 50,000-word document seeded in the database.

### Scalability

**NFR-S1: Concurrent Editors Per Document**

Target: The system must support at least 20 concurrent editors on a single document without degradation in keystroke propagation latency (NFR-L1 still holds).

Justification: Typical collaborative editing sessions involve 2–5 users. Supporting 20 provides headroom for larger review sessions, classroom settings, and team-wide documents. Beyond 20, the CRDT operation broadcast fan-out and cursor/presence message volume become significant; this limit is declared as a design boundary.

**NFR-S2: Concurrent Documents System-Wide**

Target: The system must support at least 500 active documents (documents with at least one connected WebSocket session) simultaneously on a single backend server instance.

Justification: For a startup deployment, 500 concurrent documents serves a user base of ~2,000–5,000 registered users (assuming 10–25% peak concurrency). Each document session consumes a WebSocket connection and a CRDT state in memory; at 500 documents, memory usage is bounded at ~250 MB (assuming 500 KB average document size with CRDT metadata).

**NFR-S3: Growth Model**

Expected growth: Linear growth over the first year — 100 → 500 → 2,000 active documents. The architecture supports horizontal scaling by deploying additional sync service instances behind a load balancer with document-level session affinity. The REST API scales trivially (stateless).

### Availability

**NFR-A1: Availability Target**

Target: 99.5% uptime (roughly 44 hours of unplanned downtime per year). This applies to the REST API and document load functionality.

Justification: For an early-stage startup product, 99.5% balances reliability expectations against the operational cost of high-availability infrastructure. The real-time sync layer has a softer target (99.0%) because temporary sync outages are recoverable — users can continue editing locally and reconnect.

**NFR-A2: Behavior During Partial System Failure**

[TABLE: 4 columns — Failure scenario | Expected behavior]

| Database unavailable | REST API returns 503 for all data operations. Existing WebSocket sessions continue operating from in-memory state; changes are queued for persistence when the database recovers. |
| Sync service crash | Connected clients receive a WebSocket close event. The "connection lost" banner appears. Clients retry with exponential backoff. Edits continue locally. On reconnection, offline edits are merged. |
| AI service / LLM unavailable | AI features show "temporarily unavailable" with a retry option. All other features (editing, collaboration, sharing, versioning) continue normally. |
| Frontend CDN unavailable | Users cannot load the application initially. Users with the SPA already loaded are unaffected (it communicates directly with the API). |

**NFR-A3: No Single Point of Data Loss**

No acknowledged edit may be silently lost. If a user receives confirmation that a save succeeded (via REST 200 or WebSocket ack), that edit must be durable in the database. This is enforced by SQLite's WAL mode with synchronous commits.

### Security & Privacy

**NFR-SP1: Data in Transit**

All client-server communication must use TLS 1.2 or higher. The backend must refuse unencrypted HTTP connections in production.

**NFR-SP2: Data at Rest**

Document content stored in the database must be encrypted at rest using filesystem-level or database-level encryption in production. For the PoC, SQLite file-level encryption is deferred, but the deployment guide must document the requirement.

**NFR-SP3: Authentication Tokens**

JWT tokens are signed with HS256 using a secret of at least 256 bits. Tokens expire after 7 days. The token payload contains only the user ID and email — no document content or permission data is embedded in the token.

**NFR-SP4: AI and Third-Party Data Exposure**

When document content is sent to a third-party LLM API:
1. Only the minimum necessary context is transmitted (selection + surrounding context, not the full document).
2. Every AI invocation is logged in the ai_interactions table with the exact prompt sent, enabling audit of what was shared with the external provider.
3. The system must support a per-organization toggle to disable AI features entirely for compliance-sensitive environments.
4. Users must be informed (via a visible notice in the AI UI) that their text will be processed by a third-party service.

**NFR-SP5: Data Retention for AI Logs**

AI interaction logs (ai_interactions table) are retained for 90 days, after which they are automatically purged. Organizations may configure a shorter retention period. The prompt and response fields can be redacted on demand by an admin.

**NFR-SP6: Password Security**

Passwords are hashed with bcrypt (salt rounds ≥ 10) before storage. Plaintext passwords are never logged, stored, or transmitted beyond the initial registration/login request body.

### Usability

**NFR-U1: Large Documents with Many Collaborators**

Opening a document with 50,000 words and 15 active collaborators must not cause the UI to become unresponsive. The editor must maintain ≥ 30 FPS during normal typing.

The frontend uses viewport-based rendering: only the visible portion of the document is fully rendered in the DOM. Collaborator cursors outside the viewport are shown as indicators in the scrollbar gutter rather than full cursor overlays. Presence list UI is collapsed by default and expandable on demand.

**NFR-U2: Collaborator Awareness Without Overwhelm**

The UI must show who is currently editing and where, without cluttering the editor surface:
- Each collaborator's cursor is shown with a distinct color and a small name label that fades after 3 seconds of inactivity.
- A maximum of 5 collaborator cursors are shown inline; additional collaborators are represented as a "+N more" badge.
- A presence panel (toggled via a button) shows the full list of active users with their last-active timestamps.

**NFR-U3: Accessibility**

The application must meet WCAG 2.1 Level AA compliance:
- All interactive elements must be keyboard-navigable.
- Color is not the sole means of conveying information (e.g., AI suggestion state uses both color and icons).
- The editor must work with screen readers at a basic level (document title, toolbar actions, status messages are announced).
- Contrast ratios meet 4.5:1 for normal text and 3:1 for large text.

**NFR-U4: Error Communication**

When an operation fails (save, AI call, share invite), the user must receive a clear, actionable error message within 1 second. Error messages must describe what happened and what the user can do, not just show a generic "Something went wrong."

---

## 2.1 Architectural Drivers

This section identifies the requirements and quality attributes that most strongly shape the system architecture. They are ranked by influence: two teams with different rankings would arrive at different designs.

### 1. Real-Time Collaboration Consistency (NFR — Latency + Correctness)

Why it ranks first: The product is a collaborative editor. If two users edit the same paragraph and the result is corrupted or silently lost, the system fails at its core value proposition. Every major architectural boundary — the synchronization protocol, the data model, the API layer, and the frontend state — is designed around this constraint.

Architectural consequence: The system adopts a CRDT-based synchronization model over a persistent WebSocket connection. The backend maintains authoritative document state while each client keeps a local replica. This pushes complexity into the sync service and forces a clear separation between the "collaboration transport" layer and the REST API used for CRUD and management operations.

### 2. AI Integration Latency and UX (NFR — Latency + Usability)

Why it ranks second: The AI assistant is the differentiating feature. LLM inference is inherently slow (seconds, not milliseconds), and the user is editing in real time while waiting. A naive design that blocks the editor or overwrites concurrent edits during an AI rewrite would create an unusable experience.

Architectural consequence: AI invocations are processed asynchronously: the frontend issues a request and receives a streamed or event-based response, while the editor remains fully interactive. The AI service is isolated behind its own API contract so that model changes, prompt updates, or provider swaps do not ripple into the collaboration or document layers. During an AI operation, the affected text region enters a "pending suggestion" state visible to all collaborators, preventing silent overwrites.

### 3. Security and Privacy of Document Content (NFR — Security)

Why it ranks third: Documents may contain sensitive or proprietary content. Every editing session, every API call, and every AI invocation transmits document text. Sending content to a third-party LLM API introduces a data-residency and privacy concern that must be addressed architecturally, not just operationally.

Architectural consequence: All client-server communication is encrypted in transit (TLS). The AI service layer acts as a controlled gateway: it strips metadata, enforces per-user and per-organization content policies, and logs every prompt sent to the external LLM for auditability. The auth model uses stateless JWT with role-based access control (owner / editor / viewer), and the resolveDoc() authorization check runs on every document operation, including AI invocations. Data-at-rest encryption is delegated to the storage layer.

### 4. Horizontal Scalability (NFR — Scalability)

Why it ranks fourth: Initial deployment targets small teams (≤ 20 concurrent editors per document, hundreds of documents system-wide), but the architecture must not introduce scaling walls that would require a rewrite. The stateless JWT design already avoids server-side session stores; the next bottleneck is the synchronization layer.

Architectural consequence: The REST API is stateless and can be load-balanced trivially. The WebSocket sync service is the stateful component; it is deployed separately so that it can scale independently. For the PoC, SQLite is sufficient, but the data-access layer uses a repository abstraction that can be swapped for PostgreSQL or another database without modifying business logic.

### 5. Developer Productivity and Module Independence (Quality — Maintainability)

Why it ranks fifth: The team has three members with distinct ownership areas (frontend, backend/API, collaboration/AI architecture). The architecture must allow each member to develop, test, and deploy their area with minimal cross-owner coordination.

Architectural consequence: The codebase is organized as a monorepo with clearly separated frontend/, backend/, and docs/ directories. The API contract (documented in the README and type definitions) serves as the integration boundary: frontend and backend communicate only through the defined REST and WebSocket interfaces. Shared type definitions live in frontend/src/types/api.ts and are validated against the backend's actual responses through integration tests.

**Driver–Architecture Summary Table:**

[TABLE: 4 columns — Rank | Driver | Primary quality attribute | Key architectural decision]

| 1 | Collaboration consistency | Correctness, Latency | CRDT sync over WebSocket; local-first replicas |
| 2 | AI integration UX | Latency, Usability | Async AI pipeline; isolated AI service; pending-suggestion state |
| 3 | Content security | Security, Privacy | TLS, JWT RBAC, AI gateway with audit logging |
| 4 | Horizontal scalability | Scalability | Stateless REST; separately deployable sync service |
| 5 | Developer productivity | Maintainability | Monorepo with contract-first module boundaries |

---

## 2.2 System Design Using the C4 Model

### Level 1 — System Context Diagram

[INSERT RENDERED PNG FROM MERMAID LIVE EDITOR]

Mermaid source:

```
C4Context
  title System Context — Collaborative Document Editor

  Person(author, "Document Author", "Creates, edits, and manages documents")
  Person(collaborator, "Collaborator", "Views or co-edits shared documents")
  Person(admin, "Organization Admin", "Manages users, roles, and AI feature policies")

  System(editor, "Collaborative Document Editor", "Real-time collaborative editing platform with AI writing assistant")

  System_Ext(llm, "LLM API", "Third-party large-language-model service (e.g., OpenAI) for text rewrite, summarization, translation")
  System_Ext(email, "Email / Notification Service", "Sends sharing invitations and collaboration notifications")

  Rel(author, editor, "Creates and edits documents, invokes AI assistant")
  Rel(collaborator, editor, "Views or co-edits shared documents in real time")
  Rel(admin, editor, "Configures roles, AI quotas, and organization policies")
  Rel(editor, llm, "Sends prompts with document context, receives AI suggestions", "HTTPS/JSON")
  Rel(editor, email, "Triggers invitation and notification emails", "SMTP/API")
```

The system serves three actor categories. Document Authors are the primary users who create content and invoke AI features. Collaborators participate via shared access at varying permission levels. Organization Admins govern policies such as role assignments and AI usage quotas. The system depends on two external services: a third-party LLM API for AI writing features, and an email/notification service for sharing workflows. All external communication flows over encrypted channels.

### Level 2 — Container Diagram

[INSERT RENDERED PNG FROM MERMAID LIVE EDITOR]

Mermaid source:

```
C4Container
  title Container Diagram — Collaborative Document Editor

  Person(user, "User", "Document author or collaborator")

  System_Boundary(system, "Collaborative Document Editor") {
    Container(spa, "Frontend SPA", "React 19, TypeScript, Vite, Tailwind CSS 4", "Document editor UI, collaboration presence, AI suggestion panel")
    Container(api, "Backend API", "Node.js 22, Express 4", "REST endpoints for auth, documents, sharing, versions, AI invocation")
    Container(sync, "Real-Time Sync Service", "Node.js, WebSocket", "Broadcasts document operations to connected clients; CRDT merge logic")
    Container(db, "Database", "SQLite (WAL mode)", "Stores users, documents, permissions, versions, AI interaction logs")
    Container(ai, "AI Service", "Node.js, Express", "Prompt construction, LLM gateway, response streaming, quota enforcement")
  }

  System_Ext(llm, "LLM API", "OpenAI / third-party inference")

  Rel(user, spa, "Interacts via browser", "HTTPS")
  Rel(spa, api, "REST calls for CRUD, auth, sharing", "HTTPS/JSON")
  Rel(spa, sync, "Real-time editing operations", "WSS")
  Rel(api, db, "Reads/writes all persistent data", "SQL")
  Rel(api, ai, "Delegates AI requests", "Internal HTTP")
  Rel(sync, db, "Persists merged document state", "SQL")
  Rel(ai, llm, "Sends prompts, receives completions", "HTTPS/JSON")
```

The system decomposes into five containers:

[TABLE: 3 columns — Container | Responsibility | Technology]

| Frontend SPA | Editor UI, collaboration presence indicators, AI suggestion display and accept/reject flow | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend API | Authentication (JWT + bcrypt), document CRUD, permission management, version snapshots, AI request routing | Node.js 22, Express 4 |
| Real-Time Sync Service | WebSocket connection management, operation broadcast, CRDT merge, presence tracking | Node.js, WebSocket |
| Database | Persistent storage for users, documents, permissions, versions, AI interaction logs | SQLite in WAL mode |
| AI Service | Prompt construction from document context, LLM API gateway, response streaming, usage metering | Node.js, Express |

The Frontend SPA maintains two connections to the backend: a standard HTTPS channel for REST operations and a persistent WebSocket for real-time sync. The AI Service is separated from the main API so that prompt logic, model routing, and cost controls can evolve independently. For the PoC milestone, the Sync Service and AI Service are logical modules within the single Express backend; they will be extracted into separate deployable containers when traffic warrants it.

### Level 3 — Component Diagram (Backend API)

[INSERT RENDERED PNG FROM MERMAID LIVE EDITOR]

Mermaid source:

```
C4Component
  title Component Diagram — Backend API

  Container_Boundary(api, "Backend API") {
    Component(authMiddleware, "Auth Middleware", "Express middleware", "Verifies JWT Bearer token, attaches user identity to request context")
    Component(authController, "Auth Controller", "Express router — routes/auth.js", "Handles POST /register, POST /login, GET /me; issues JWT tokens")
    Component(docController, "Document Controller", "Express router — routes/documents.js", "CRUD operations, document listing, update with version snapshot")
    Component(shareController, "Share Controller", "Part of routes/documents.js", "POST /share, DELETE /share/:userId; permission grant and revocation")
    Component(versionController, "Version Controller", "Part of routes/documents.js", "GET /versions; returns snapshot history with optional full content")
    Component(aiController, "AI Controller", "Express router — routes/ai.js", "POST /suggest, GET /history; delegates to AI Service, logs interactions")
    Component(resolveDoc, "Document Resolver", "resolveDoc() function", "Loads document, verifies caller role against minimum required permission")
    Component(dbLayer, "Database Layer", "db/index.js + schema.sql", "SQLite connection, WAL mode, schema initialization, prepared statements")
    Component(errorHandler, "Error Handler", "Express middleware", "Catches unhandled errors, returns structured JSON error responses")
  }

  Container_Ext(spa, "Frontend SPA")
  Container_Ext(db, "Database (SQLite)")
  Container_Ext(aiService, "AI Service")

  Rel(spa, authController, "Register / Login / Me", "HTTPS/JSON")
  Rel(spa, docController, "Document CRUD", "HTTPS/JSON")
  Rel(spa, shareController, "Share / Revoke", "HTTPS/JSON")
  Rel(spa, versionController, "Version history", "HTTPS/JSON")
  Rel(spa, aiController, "AI suggest / history", "HTTPS/JSON")

  Rel(authController, dbLayer, "INSERT/SELECT users")
  Rel(docController, dbLayer, "CRUD documents, INSERT versions")
  Rel(docController, resolveDoc, "Authorize access")
  Rel(shareController, dbLayer, "INSERT/DELETE permissions")
  Rel(shareController, resolveDoc, "Authorize owner")
  Rel(versionController, dbLayer, "SELECT versions")
  Rel(versionController, resolveDoc, "Authorize viewer")
  Rel(aiController, dbLayer, "INSERT/SELECT ai_interactions")
  Rel(aiController, aiService, "Delegate prompt + context")
  Rel(dbLayer, db, "SQL queries", "node:sqlite")
  Rel(authMiddleware, authController, "Applied before all authenticated routes")
```

The Backend API contains the following components:

[TABLE: 3 columns — Component | File(s) | Responsibility]

| Auth Middleware | middleware/auth.js | Extracts and verifies the JWT from the Authorization header; attaches req.user = { id, email } |
| Auth Controller | routes/auth.js | Registration (bcrypt hash + INSERT), login (bcrypt compare + JWT sign), session restore (GET /me) |
| Document Controller | routes/documents.js | List owned + shared documents, create, read (with collaborators), update (with version snapshot), delete |
| Share Controller | routes/documents.js | Grant access by email + role, revoke access by user ID; enforces owner-only policy |
| Version Controller | routes/documents.js | Returns version history ordered by recency; supports ?full=1 for content inclusion |
| AI Controller | routes/ai.js | Accepts prompt + optional context, logs the interaction, delegates to the AI Service, returns suggestion |
| Document Resolver | resolveDoc() in routes/documents.js | Central authorization gate: loads document, checks owner or permission role against the required minimum |
| Database Layer | db/index.js, schema.sql | Opens SQLite in WAL mode, runs schema migration, exposes synchronous prepared-statement API |
| Error Handler | app.js | Catches uncaught Express errors and returns { error: "Internal server error" } with status 500 |

The Document Resolver (resolveDoc) is the single point of authorization for all document-scoped operations. This avoids scattering permission checks across multiple route handlers and ensures consistent 403/404 responses.

### Feature Decomposition

The system is decomposed into six modules. Each module has a defined responsibility, a clear set of dependencies, and an interface contract that other modules consume.

**1. Rich-Text Editor and Frontend State Management**

Responsibility: Renders the document editing surface, manages local editor state (cursor position, selection, undo stack), and translates user keystrokes into document operations that can be transmitted to the sync layer.

Dependencies: Consumes operations from the Real-Time Synchronization module to apply remote changes. Uses the API Layer to load and persist document metadata (title, sharing settings). Depends on the AI Assistant module to display suggestion overlays and accept/reject flows.

Interface exposed:

[TABLE: 2 columns — Interface | Description]

| onLocalOperation(op) | Emits a document operation when the user types, deletes, or formats text |
| applyRemoteOperation(op) | Accepts an incoming operation from a remote collaborator and integrates it into the local editor state |
| showAISuggestion(suggestion) | Renders an AI-generated suggestion inline with accept / reject / partial-accept controls |
| getSelection() | Returns the current text selection and its document-relative offsets for AI context |

Current PoC state: The frontend (EditorPage.tsx) provides a plain-text textarea with manual save via PUT /documents/:id. Rich-text editing, operation-level sync, and AI suggestion UI are deferred.

**2. Real-Time Synchronization Layer**

Responsibility: Keeps all connected clients in sync when editing the same document. Receives local operations from each client, merges them using a conflict resolution algorithm (CRDT), and broadcasts the merged result to all other connected clients. Manages presence information (who is online, cursor positions).

Dependencies: Communicates with clients over WebSocket. Reads and writes document state to the Database via the Database Layer. Coordinates with the AI Assistant module to handle "pending suggestion" regions during AI operations.

Interface exposed:

[TABLE: 2 columns — Interface | Description]

| connect(documentId, userId) | Opens a WebSocket session for a user on a specific document |
| broadcastOperation(op) | Distributes a merged operation to all clients in the same document session |
| updatePresence(userId, cursor) | Broadcasts cursor/selection position updates to other collaborators |
| lockRegion(range) / unlockRegion(range) | Marks a text region as "AI pending" so that concurrent edits are handled gracefully |

Current PoC state: Not yet implemented. Real-time sync is deferred to a later milestone.

**3. AI Assistant Service**

Responsibility: Handles all AI-powered writing features: rewrite, summarize, translate, restructure. Constructs prompts from the selected text and surrounding context, sends them to the LLM API, streams the response back, and manages usage quotas and interaction logging.

Dependencies: Receives requests from the API Layer. Reads document content from the Database to build prompt context. Calls the external LLM API. Logs every interaction to the ai_interactions table.

Interface exposed:

[TABLE: 2 columns — Interface | Description]

| POST /api/documents/:id/ai/suggest | Accepts { prompt, context? }, returns { suggestion } (streamed in production) |
| GET /api/documents/:id/ai/history | Returns the audit log of all AI interactions on a document |
| Prompt templates | Internally maintained templates for each AI action type (rewrite, summarize, translate, restructure) |

Current PoC state: The endpoint exists (routes/ai.js) and logs interactions to the database. LLM calls return a stub response; real integration is deferred.

**4. Document Storage and Versioning**

Responsibility: Persists document content, metadata, and version history. Every content update creates a snapshot of the previous content in the versions table, enabling history browsing and future restoration.

Dependencies: Uses the Database Layer for all reads and writes. Consumed by the Document Controller (CRUD), the Sync Service (persisting merged state), and the AI Service (reading context for prompt construction).

Interface exposed:

[TABLE: 2 columns — Interface | Description]

| createDocument(title, content, ownerId) | Inserts a new document |
| updateDocument(id, fields) | Updates title/content; snapshots previous content to versions if content changed |
| getVersions(documentId, full?) | Returns version history; full=true includes content blobs |
| getDocument(id) | Returns current document state with metadata |

Current PoC state: Fully implemented. routes/documents.js handles CRUD with automatic version snapshots on content updates.

**5. User Authentication and Authorization**

Responsibility: Verifies user identity (authentication) and enforces access control on every document operation (authorization). Issues and validates stateless JWT tokens. Manages the role hierarchy (owner > editor > viewer).

Dependencies: Uses bcrypt for password hashing and JWT for token management. Reads/writes the users and permissions tables via the Database Layer. The resolveDoc() function is called by every document-scoped route handler.

Interface exposed:

[TABLE: 2 columns — Interface | Description]

| POST /api/auth/register | Creates a user account, returns { user, token } |
| POST /api/auth/login | Validates credentials, returns { user, token } |
| GET /api/auth/me | Restores a session from a valid JWT |
| requireAuth middleware | Verifies Bearer token on all protected routes |
| resolveDoc(req, res, minRole) | Central authorization gate for document access |

Current PoC state: Fully implemented. JWT auth with 7-day expiry, bcrypt password hashing, and role-based document access control.

**6. API Layer**

Responsibility: Provides the HTTP interface connecting the frontend SPA to all backend services. Defines the request/response contracts, handles input validation, error formatting, and CORS. Serves as the single integration boundary between frontend and backend teams.

Dependencies: Delegates to the Auth, Document, Sharing, Version, and AI controllers. Applies the Auth Middleware to all protected routes. Uses the central Error Handler for consistent error responses.

Interface exposed (summary):

[TABLE: 2 columns — Area | Endpoints]

| Auth | POST /register, POST /login, GET /me |
| Documents | GET /, POST /, GET /:id, PUT /:id, DELETE /:id |
| Sharing | POST /:id/share, DELETE /:id/share/:userId |
| Versions | GET /:id/versions |
| AI | POST /:id/ai/suggest, GET /:id/ai/history |

All endpoints return JSON. Authenticated endpoints require Authorization: Bearer <token>. Error responses use { error: string } with appropriate HTTP status codes (400, 401, 403, 404, 500).

Current PoC state: Fully implemented. The frontend type definitions (types/api.ts) are aligned with the backend response shapes. Integration tests verify the full contract.

**Module Dependency Graph:**

[INSERT AS FIGURE — or paste this ASCII diagram]

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

### AI Integration Design

The AI writing assistant is a core product feature, not an afterthought. This section addresses how AI capabilities are woven into the collaborative editing experience.

**Context and Scope — What the AI Sees**

When a user invokes the AI assistant, the system constructs a prompt from three layers of context:

[TABLE: 3 columns — Layer | Content | When included]

| Selection | The exact text the user highlighted | Always — this is the primary input |
| Surrounding context | ~500 tokens before and after the selection | Always — provides semantic continuity |
| Document summary | A compressed representation of the full document (title, headings, first paragraph) | Only for restructure and summarize actions on long documents (> 4,000 tokens) |

Trade-off rationale: Sending the full document on every AI call would maximize relevance but introduces three problems: (1) cost scales linearly with document length, (2) latency increases with token count, and (3) privacy exposure is maximized. The tiered approach balances relevance against cost and latency. For a 10-page document, sending only the selection + surrounding context reduces the prompt to ~1,200 tokens versus ~8,000 for the full document — a ~6× cost reduction per invocation.

Handling very long documents: Documents exceeding 8,000 tokens (roughly 6,000 words) trigger a "chunked context" strategy: the system extracts the selection's section (detected by heading boundaries) plus the document's structural outline (headings only). This keeps prompt size bounded at ~2,000 tokens regardless of document length, at the cost of potentially missing distant context.

**Suggestion UX — How Suggestions Are Presented**

AI suggestions are displayed as tracked-change-style inline proposals:

1. The selected text is dimmed and marked with a strikethrough style.
2. The AI-generated replacement appears immediately below/after, highlighted in a distinct color (green for additions).
3. A floating toolbar appears with three actions:
   - Accept — replaces the original text with the suggestion and commits the change as a normal edit operation.
   - Reject — discards the suggestion and restores the original text.
   - Edit — opens the suggestion in an editable state so the user can partially modify it before accepting.

This approach was chosen over a side-panel design because inline display preserves reading context — the user sees the suggestion exactly where it will appear in the document. Side panels force the user to mentally map between two locations.

Partial acceptance: Users can accept a suggestion and then immediately edit it further. The accepted text enters the normal editing flow, so standard undo (Ctrl+Z) reverts the acceptance. This avoids the need for a separate "partial accept" mechanism while still letting users cherry-pick parts of a suggestion.

Undo: An accepted AI suggestion is recorded as a single operation in the undo stack. One Ctrl+Z reverts the entire acceptance, restoring the original text. The version history also captures a snapshot before the AI change is applied, so users can revert via the version panel even after saving.

**AI During Collaboration**

The problem: When User A selects a paragraph and requests an AI rewrite, User B may simultaneously be editing words within that same paragraph. Applying the AI suggestion naively would overwrite User B's changes.

The approach — pending-suggestion state:

1. Request phase: When User A invokes the AI, the selected text range is marked as "AI pending" in the sync layer. All collaborators see a subtle visual indicator (a pulsing border or shaded background) on that region, along with a label: "AI suggestion in progress (requested by User A)."

2. Concurrent edits: Other users can continue editing the pending region — their edits are not blocked. However, the system tracks that the region has been modified since the AI request was issued.

3. Response phase: When the AI response arrives:
   - If the region was not modified by others: the suggestion is shown inline to User A with accept/reject controls. Other collaborators see the suggestion as a pending proposal.
   - If the region was modified by others: User A is notified that the context has changed. The suggestion is still shown, but with a warning: "The text was edited while the AI was processing. Review the suggestion carefully." The user can still accept, reject, or edit.

4. Accept/Reject: When User A accepts, the suggestion is applied as a normal CRDT operation that propagates to all collaborators. If User A rejects, the pending indicator is simply removed.

Why not lock the region? Locking would force User B to wait for the AI response (potentially several seconds). In a real-time collaborative editor, blocking is a poor UX choice. The "warn but don't block" approach respects both users' workflows.

**Prompt Design — Template-Based Construction**

Prompts are constructed from templates, not hardcoded strings. Each AI action type has a corresponding template file:

```
templates/
├── rewrite.txt
├── summarize.txt
├── translate.txt
└── restructure.txt
```

A template receives variables: {{selection}}, {{before_context}}, {{after_context}}, {{target_language}} (for translate), and {{document_outline}} (for restructure). Example for rewrite:

```
You are an AI writing assistant embedded in a collaborative document editor.
The user has selected the following text and asked you to rewrite it.

Context before the selection:
{{before_context}}

Selected text to rewrite:
{{selection}}

Context after the selection:
{{after_context}}

Rewrite the selected text to improve clarity, flow, and readability.
Preserve the original meaning and tone. Return only the rewritten text,
without explanations or preamble.
```

Why templates over hardcoded prompts: Templates can be updated, A/B tested, and versioned without redeploying the application. A product manager or prompt engineer can iterate on prompt quality by editing template files. The application code only needs to know which template to select and which variables to inject.

Future extensibility: The template system supports adding new AI actions (e.g., "expand", "make formal", "simplify") by adding a new template file and registering it in a configuration map — no code changes to the AI controller.

**Model and Cost Strategy**

Not all AI actions require the same model capability:

[TABLE: 3 columns — Action | Recommended model tier | Reasoning]

| Rewrite | Standard (e.g., GPT-4o-mini) | Requires good writing quality; standard models are sufficient |
| Summarize | Standard | Compression is a well-understood task |
| Translate | Standard | Translation quality is adequate at the standard tier for common languages |
| Restructure | Advanced (e.g., GPT-4o) | Requires understanding document-level structure; benefits from stronger reasoning |

Cost controls:

[TABLE: 2 columns — Mechanism | Description]

| Per-user daily quota | Each user gets N AI invocations per 24-hour period (configurable per organization). Default: 50 invocations/day. |
| Token budget per request | Maximum output tokens are capped per action type (e.g., rewrite: 1,000 tokens, summarize: 500 tokens). |
| Organization-level budget | Monthly spending cap; when reached, AI features degrade gracefully to "quota exceeded" messages. |

Quota exceeded behavior: When a user exceeds their limit, the AI button remains visible but triggers a clear message: "You've used your AI quota for today. Your quota resets at midnight UTC." The editor remains fully functional — only AI features are restricted. The API returns HTTP 429 with { error: "AI quota exceeded", resets_at: "..." }.

Graceful degradation when the LLM is unavailable: If the external LLM API returns an error or times out (> 30 s):
1. The user sees: "The AI assistant is temporarily unavailable. Your document is unaffected."
2. The pending-suggestion indicator is removed.
3. The failed interaction is logged with a null response for monitoring.
4. A retry button appears so the user can try again when the service recovers.

The editor and collaboration features continue working normally — AI unavailability never disrupts editing.

### Communication Model

This section describes how the system keeps multiple users in sync as they edit the same document, and the implications of the chosen approach for user experience.

**Approach: Real-Time Push-Based Communication**

The system uses push-based real-time communication via persistent WebSocket connections. When a user makes an edit, the change is sent immediately to the server and broadcast to all other connected clients — there is no polling interval. Users see each other's keystrokes within the latency target of < 200 ms.

Why push-based over polling:

[TABLE: 3 columns — Criterion | Push (WebSocket) | Polling]

| Perceived latency | < 200 ms (near-instant) | Bounded by poll interval (typically 1–5 s) |
| Bandwidth efficiency | Only sends data when changes occur | Sends requests even when nothing changed |
| Conflict resolution | Fine-grained, operation-level | Coarse-grained, full-document replacement |
| Server load at scale | One persistent connection per client | N requests/minute per client regardless of activity |
| Implementation complexity | Higher (connection management, reconnection, heartbeats) | Lower (stateless HTTP requests) |

For a collaborative editor, the latency and granularity advantages of push-based communication are decisive. Polling at any reasonable interval would introduce visible "lag" between collaborators and make the system feel disconnected rather than collaborative.

**Connection Lifecycle — Opening a Shared Document**

When a user opens a document:

1. Client loads document via REST: GET /api/documents/:id → Receives current content, metadata, and collaborator list.
2. Client opens WebSocket: ws://host/sync/:documentId → Sends auth token in the connection handshake. Server validates token and permission level.
3. Server adds client to the document's session room → Broadcasts presence update ("User X joined") to existing clients. Sends the current presence list to the new client.
4. Client initializes local CRDT state from the loaded document content → Ready to send and receive operations.

The REST call in step 1 ensures the client has a consistent baseline before joining the WebSocket session. This avoids a race condition where the client could receive operations against a document state it hasn't loaded yet.

**Editing Flow:**

```
User A types        Client A              Server              Client B
   │                   │                     │                    │
   ├─ keystroke ──────▶│                     │                    │
   │                   ├─ operation ────────▶│                    │
   │                   │                     ├─ merge (CRDT) ───▶│
   │                   │                     ├─ broadcast ──────▶│
   │                   │                     │                    ├─ apply
   │                   │◀── ack ─────────────┤                    │
   │                   ├─ confirm local ─────│                    │
```

Each keystroke generates a CRDT operation that is applied optimistically to the local state (so the user sees their own edit immediately). The operation is sent to the server, which merges it into the authoritative document state and broadcasts the result to all other clients.

**Presence and Cursors**

In addition to document operations, the WebSocket carries presence messages: each client periodically sends its cursor position and selection range. These are broadcast to other clients, enabling the "colored cursor" UX where each collaborator's position is visible in the editor. Presence updates are sent on a throttled schedule (at most every 100 ms) to avoid flooding the WebSocket with cursor movements during rapid typing.

**Disconnection and Reconnection**

What happens when a user loses connectivity:

1. Immediate: The client detects the WebSocket close event. A banner appears: "Connection lost — your changes are saved locally."
2. Offline editing continues: The user can keep typing. Edits are accumulated in the local CRDT state. No data is lost.
3. Reconnection attempt: The client implements exponential backoff reconnection (1 s → 2 s → 4 s → 8 s → max 30 s). On each attempt, it re-authenticates via the WebSocket handshake.
4. Reconnected: The client sends its accumulated offline operations to the server. The server merges them with any operations that occurred while the client was disconnected. The server sends back the merged result. The client reconciles its local state and removes the "offline" banner.
5. Presence update: Other collaborators see the user reappear in the presence list.

Conflict resolution during reconnection: Because the system uses CRDTs (Conflict-free Replicated Data Types), merging offline edits with concurrent edits is mathematically guaranteed to converge to the same state on all clients, regardless of the order operations arrive. This eliminates the need for manual conflict resolution dialogs.

**Communication Channels Summary:**

[TABLE: 4 columns — Channel | Protocol | Purpose | Statefulness]

| REST API | HTTPS | Auth, document CRUD, sharing, versions, AI invocation | Stateless |
| Sync | WebSocket (WSS) | Real-time operations, presence, cursor positions | Stateful (per-document session) |

---

## 2.5 Architecture Decision Records (ADRs)

### ADR-001: CRDT-Based Synchronization Over Operational Transformation

Status: Accepted

Context: The core value proposition of the product is real-time collaborative editing: multiple users must see each other's changes with sub-200 ms latency, and concurrent edits to the same region must be resolved without data loss or manual conflict dialogs. Two dominant approaches exist: Operational Transformation (OT), used by Google Docs, and Conflict-free Replicated Data Types (CRDTs). The system must support offline editing and reconnection. The team has three members. The PoC must run on a single server with SQLite. Future scaling may require multiple sync service instances.

Decision: We adopt a CRDT-based synchronization model (specifically, a sequence CRDT such as Yjs or Automerge) for document text synchronization.

Consequences — Positive:
- Offline-first by design. CRDTs allow each client to apply edits locally and merge later. Reconnection simply exchanges operations.
- No central transform server required. CRDTs can merge operations on any node, simplifying horizontal scaling.
- Deterministic merge. CRDT merge is commutative, associative, and idempotent, eliminating an entire class of subtle OT bugs.
- Library ecosystem. Mature libraries (Yjs, Automerge) provide production-quality implementations.

Consequences — Negative:
- Higher memory overhead. CRDTs maintain metadata per character. A 10,000-character document may require 2–4× more memory.
- Garbage collection complexity. Deleted characters leave tombstones requiring periodic cleanup.
- Learning curve. The team must understand CRDT semantics to debug sync issues.

Alternatives considered:
- Operational Transformation (OT): Rejected because OT requires a centralized transform server (scaling bottleneck), has notoriously difficult correctness proofs, and does not natively support offline editing.
- Last-Write-Wins: Rejected because silently discarding concurrent edits violates the product's core promise.
- Manual Conflict Resolution (Git-style): Rejected because it forces users into a technical workflow inappropriate for real-time character-level editing.

### ADR-002: Tiered AI Context Strategy Over Full-Document Prompts

Status: Accepted

Context: When a user invokes the AI assistant, the system must decide how much document content to include in the LLM prompt. The trade-offs involve relevance vs. cost, relevance vs. latency, and privacy exposure. Average AI invocation should cost < $0.01. P95 time-to-first-token should be < 2 seconds (NFR-L2). The system must handle documents from a single paragraph to 50,000+ words.

Decision: We adopt a tiered context strategy with three levels:

[TABLE: 4 columns — Tier | Content included | Token budget | Used for]

| Selection only | Selected text | ~500 tokens | Short rewrites, translations of sentences |
| Selection + surrounding | Selected text + ~500 tokens before and after | ~1,500 tokens | Standard rewrites, summarize a paragraph |
| Selection + section outline | Selected text + section heading hierarchy + document title | ~2,000 tokens | Restructure, summarize a long document |

The tier is determined by a simple rule: if the selected text is < 200 tokens, use Tier 1; if the action is restructure or the document exceeds 4,000 tokens, use Tier 3; otherwise use Tier 2.

Consequences — Positive:
- Cost-efficient: average prompt ~1,200 tokens vs. 5,000–8,000 for full document.
- Faster responses: smaller prompts reduce inference time.
- Minimized privacy surface: only relevant portions sent externally.
- Bounded prompt size regardless of document length.

Consequences — Negative:
- Potential quality loss for long-range references.
- Tier selection heuristic may be imperfect.
- Section detection requires document structure (falls back to Tier 2 for unstructured docs).

Alternatives considered:
- Always send full document: Rejected — prohibitively expensive and slow for long documents.
- Always send only the selection: Rejected — produces tonally disconnected suggestions.
- Let user manually choose context: Rejected as primary mechanism — adds friction. Retained as optional override via the context API field.

### ADR-003: Monorepo Organization Over Multi-Repo

Status: Accepted

Context: The codebase consists of a React frontend, a Node.js backend, and shared documentation. The team has three members. The frontend and backend share implicit API contracts. The assignment requires a single Git repository link.

Decision: We use a monorepo with backend/, frontend/, and docs/ as top-level directories. Each component has its own package.json and can be installed, built, and tested independently. No monorepo build tool (Turborepo, Nx) is used.

Consequences — Positive:
- Atomic changes: API contract changes update backend, frontend types, and tests in one commit.
- Shared visibility: all changes visible in one git log.
- Simple CI: single pipeline for both components.
- Assignment compliance: single repository link.

Consequences — Negative:
- Larger clone size (mitigated by .gitignore excluding node_modules).
- Potential for unrelated changes in the same PR (mitigated by branch naming conventions).
- No independent deployment (acceptable for PoC stage).

Alternatives considered:
- Multi-repo: Rejected — cross-repo contract sync is the largest source of integration bugs in small teams.
- Monorepo with Turborepo/Nx: Rejected — overhead exceeds benefit for two packages. Can be revisited if project grows.

### ADR-004: Snapshot-Based Versioning with Bounded Retention

Status: Accepted

Context: The system must support document version history and AI interaction audit logs. Every save creates a version snapshot, so storage grows linearly. AI logs contain document content, creating privacy concerns with unbounded retention.

Decision: We use full-content snapshot versioning: every PUT that changes content inserts a copy of the previous content into the versions table. Retention policy: most recent 50 versions always retained; versions older than 90 days are eligible for pruning; at least one version per calendar day is preserved. AI interaction logs are retained for 90 days.

Consequences — Positive:
- Simplicity: one INSERT per save, no diffing/patching logic.
- Instant version preview: full content stored, no reconstruction needed.
- Bounded storage: retention policy prevents unbounded growth.
- Audit compliance: 90-day AI log retention balances audit needs with privacy.

Consequences — Negative:
- Storage inefficiency: full snapshots duplicate content (~2–4× vs. delta storage).
- Pruning requires a periodic background job (not yet implemented in PoC).
- No side-by-side diff UI (deferred).

Alternatives considered:
- Delta-based versioning: Rejected for PoC — adds complexity on both write and read paths for modest storage savings.
- Event-sourced versioning: Rejected — couples versioning to CRDT sync layer; replaying operations is slow for history browsing.
- Unlimited retention: Rejected — unbounded storage growth and expanding privacy surface; GDPR requires data minimization.

---

## 3.1 Team Structure & Ownership

**Team Members and Roles:**

[TABLE: 3 columns — Member | Primary role | Ownership area]

| Harmanjot Singh | Frontend and requirements lead | Frontend SPA (React, editor UI, auth pages, documents dashboard), functional requirements, user stories, traceability draft |
| Zhengxi | Backend core, API, and data lead | Backend API (Express, routes, middleware), database schema, auth/authorization design, integration tests, README |
| Luka | Architecture, AI design, and documentation integration lead | C4 diagrams, architectural drivers, AI integration design, communication model, NFRs, ADRs, project management sections, final QA |

**Code Ownership Map:**

[TABLE: 3 columns — Directory / File | Primary owner | Reviewer]

| frontend/src/ | Harmanjot | Zhengxi |
| frontend/src/types/api.ts | Harmanjot (structure), Zhengxi (contract alignment) | Luka |
| backend/src/ | Zhengxi | Harmanjot |
| backend/test/ | Zhengxi | Luka |
| docs/traceability.md | Harmanjot | Luka |
| docs/auth-design.md | Zhengxi | Luka |
| docs/architectural-drivers.md | Luka | Harmanjot |
| docs/c4-diagrams.md | Luka | Zhengxi |
| docs/ai-integration-design.md | Luka | Zhengxi |
| docs/communication-model.md | Luka | Harmanjot |
| docs/nfr.md | Luka | Zhengxi |
| docs/feature-decomposition.md | Luka | All |
| docs/adr/ | Luka | Zhengxi + Harmanjot |
| docs/project-management.md | Luka | All |
| README.md | Zhengxi | All |

**Handling Cross-Cutting Features:**

The AI assistant is the primary cross-cutting feature: it touches the frontend (suggestion UI), the backend (API route, LLM gateway), and the architecture (prompt design, cost strategy, privacy). Ownership is split:

- Luka owns the design (AI integration design document, ADR-002 on context strategy, communication model for AI during collaboration).
- Zhengxi owns the implementation (API route routes/ai.js, database schema for ai_interactions, future LLM integration).
- Harmanjot owns the frontend UX (AI suggestion display, accept/reject flow, quota-exceeded UI).

Changes to the AI feature require a pull request reviewed by at least two of the three owners.

**Decision-Making Process:**

When team members disagree on a technical choice:
1. Document the options: The proposer writes a brief comparison (2–3 paragraphs) in a GitHub issue or as a draft ADR.
2. Time-boxed discussion: The team discusses for at most 15 minutes in the next sync meeting.
3. Default to the primary owner: If no consensus, the primary owner of the affected component makes the final call. The decision is recorded as an ADR.
4. Revisit clause: Any decision can be revisited if new evidence emerges, but the burden of proof is on the person requesting the change.

---

## 3.2 Development Workflow

**Branching Strategy:**

We use feature branches off main:

[TABLE: 3 columns — Branch type | Naming convention | Example]

| Feature | feat/<area>-<short-description> | feat/frontend-editor-shell |
| Documentation | docs/<topic> | docs/c4-architecture |
| Bug fix | fix/<area>-<short-description> | fix/api-share-validation |
| Traceability / contract | docs/traceability, fix/api-contract | — |

Merge policy:
- All branches merge into main via pull request.
- No direct pushes to main.
- Squash merge is preferred for feature branches to keep main history clean.
- No PoC branch may be merged unless the request and response schema match the written contract in the report.

**Code Review Process:**

[TABLE: 2 columns — Criterion | Requirement]

| Who reviews | At least one team member who is not the primary owner of the changed code |
| Turnaround | Reviews should be completed within 12 hours during active development days |
| Approval criteria | Code compiles/lints, tests pass, API contracts match documentation, no unintended scope creep |
| PR description | Must mention: what changed, what part of the rubric it supports, any screenshots or sample JSON, and what still remains |

**Commit Message Convention:**

Format: <type>(<scope>): <short summary>

Types: feat, fix, docs, test, refactor, chore
Scopes: frontend, backend, docs, shared

Examples:
- feat(backend): add version snapshot on document update
- docs(architecture): add C4 Level 2 container diagram
- fix(frontend): handle 403 on shared document access

**Issue Tracking and Task Assignment:**

- GitHub Issues are used for task tracking. Each issue is labeled with the rubric section it addresses (e.g., part-1, part-2-architecture, part-3-pm, part-4-poc).
- Issues are assigned to the primary owner from the ownership table.
- A GitHub Project board with three columns (To Do, In Progress, Done) tracks progress.
- Each team member moves their own issues through the board during daily syncs.

**Communication:**

[TABLE: 2 columns — Tool | Purpose]

| Discord | Real-time chat, quick questions, daily sync meetings |
| GitHub Issues + PRs | All technical decisions, code review, task tracking |
| Google Drive | Shared report document, diagram source files, meeting notes |
| docs/adr/ folder | Persistent record of architectural decisions (not lost in chat) |

Two short syncs run each day until submission: a 10–15 minute morning plan sync and a 10–15 minute evening merge/blocker sync.

---

## 3.3 Development Methodology

**Chosen Methodology: Kanban with Time-Boxed Milestones**

We use Kanban rather than Scrum because:
- The team has 3 members and a fixed 5-day timeline — formal sprints with retrospectives would consume more time than they save.
- Work items vary in size (a 30-minute documentation update vs. a full-day PoC implementation). Kanban's pull-based flow handles this naturally.
- The assignment has a hard deadline with clear rubric sections, which map directly to Kanban columns.

Iteration structure: The project runs as a single iteration with daily milestones (see Section 3.5). Each day has a defined "done" state that the team verifies in the evening sync.

Backlog prioritization is determined by two factors:
1. Rubric weight: System Architecture (45%) items are prioritized over Requirements Engineering (30%), which is prioritized over Project Management (15%) and PoC (10%).
2. Dependency chain: Items that block other team members are prioritized over independent work.

Handling non-user-visible work: Architecture documentation, ADRs, and risk assessments are treated as first-class deliverables with their own issues and milestones, not as "overhead" to be done after coding. This reflects the assignment's weighting: documentation and architecture are 75% of the grade.

---

## 3.4 Risk Assessment

### Risk 1: AI Integration Cost Overrun

[TABLE: 2 columns — Aspect | Detail]

| Description | If the AI assistant is used heavily, LLM API costs could exceed the budget, especially during development and testing when prompts are being iterated. |
| Likelihood | Medium |
| Impact | Development costs increase unexpectedly. In production, the feature becomes unsustainable without usage controls. |
| Mitigation | Implement per-user daily quotas (50 invocations/day default). Use GPT-4o-mini for standard tasks and reserve GPT-4o for restructure only. Cap output tokens per action type. Monitor cost dashboards daily. |
| Contingency | If cost exceeds 2× the projected budget: reduce the default quota, switch all actions to the cheaper model, and add a "cost estimate" confirmation dialog before each AI invocation. |

### Risk 2: CRDT Library Compatibility with Existing Editor

[TABLE: 2 columns — Aspect | Detail]

| Description | Integrating a CRDT library (e.g., Yjs) with the chosen text editor component may require significant adapter code, or the library may not support features the editor needs. |
| Likelihood | Medium |
| Impact | Real-time sync is the highest-ranked architectural driver. If the CRDT library doesn't integrate cleanly, the sync feature is delayed, and the demo shows only manual-save collaboration. |
| Mitigation | For the PoC, the sync layer is deferred — the current architecture validates all other components without CRDT. The CRDT integration will be prototyped in isolation before being wired into the main editor. |
| Contingency | If the chosen CRDT library proves incompatible: switch to an alternative (e.g., from Yjs to Automerge). If no CRDT library works: fall back to OT with last-writer-wins merge at the paragraph level. |

### Risk 3: API Contract Drift Between Frontend and Backend

[TABLE: 2 columns — Aspect | Detail]

| Description | The frontend type definitions (types/api.ts) may diverge from the actual backend response shapes, causing runtime errors invisible at compile time. |
| Likelihood | High (common monorepo issue) |
| Impact | Frontend displays incorrect data, crashes on unexpected fields, or silently drops data. Integration bugs surface late. |
| Mitigation | The backend integration test validates the full API contract. Any PR that changes a response shape must update both the test and the frontend type definition. PR reviews explicitly check contract alignment. |
| Contingency | If drift is detected late: add a shared JSON schema (e.g., Zod) that both frontend and backend validate against. |

### Risk 4: Team Coordination Failure Under Tight Timeline

[TABLE: 2 columns — Aspect | Detail]

| Description | With three members working in parallel on a 5-day timeline, miscommunication or blocked handoffs could waste entire days. Key dependencies: API contract freeze (Zhengxi → Harmanjot), architecture component naming (Luka → all). |
| Likelihood | Medium |
| Impact | Deliverables are incomplete or internally inconsistent at submission. |
| Mitigation | Mandatory cross-owner handoffs with deadlines. Daily sync meetings (morning + evening). Naming freeze by end of day 2. |
| Contingency | If a team member is blocked for > 4 hours: the blocker is escalated and the member switches to an independent task. If a deliverable is at risk: the support owner takes over. |

### Risk 5: LLM API Latency or Unavailability During Demo

[TABLE: 2 columns — Aspect | Detail]

| Description | The demo depends on the AI feature working. If the LLM API is slow or down during the recording, the AI part of the demo fails. |
| Likelihood | Low–Medium |
| Impact | The demo fails to show the AI feature, the core product differentiator. |
| Mitigation | The AI endpoint supports a stub mode (already implemented) that returns a hardcoded response. The demo can be recorded with the stub if needed. |
| Contingency | Record in two takes: one with real AI, one with stub. Use whichever is more reliable. |

### Risk 6: SQLite Concurrency Limitations Under Real-Time Load

[TABLE: 2 columns — Aspect | Detail]

| Description | SQLite supports only one writer at a time (even in WAL mode). Under real-time collaboration load, write contention could become a bottleneck. |
| Likelihood | Low (for PoC scale) |
| Impact | Write latency increases under concurrent saves, potentially violating the 200 ms sync propagation target. |
| Mitigation | For the PoC, SQLite is sufficient. The data access layer is abstracted, making a future PostgreSQL migration straightforward. |
| Contingency | Migrate to PostgreSQL. The schema is standard SQL; only the connection layer (db/index.js) and prepared statement syntax need updating. |

---

## 3.5 Timeline and Milestones

### Day-by-Day Schedule (29 March – 3 April 2026)

**Day 1 — Saturday, 29 March: Scope, Stack, and Skeleton**

Team milestone: Repository structure, document skeleton, and naming conventions frozen.

[TABLE: 3 columns — Member | Tasks | Acceptance criteria]

| Harmanjot | Create report headings, start FR structure and user stories, sketch frontend editor shell | Report document exists with all Part 1–4 headings. At least 3 FRs drafted. Frontend project renders a placeholder page. |
| Zhengxi | Set repo layout, decide backend stack, draft API objects and data entities | backend/ and frontend/ directories exist with package.json. Initial schema.sql drafted. API endpoint list documented. |
| Luka | Draft architectural drivers, stakeholder categories, and C4 diagram skeletons | docs/architectural-drivers.md exists with ranked driver list. C4 Level 1 Mermaid source drafted. Component naming convention documented. |

**Day 2 — Sunday, 30 March: Part 1 First Draft + Architecture Backbone**

Team milestone: First draft of all Part 1 sections. Architecture naming frozen.

[TABLE: 3 columns — Member | Tasks | Acceptance criteria]

| Harmanjot | Finish FR tables and most user stories; define traceability IDs; start UI integration stubs | FR table covers all 4 capability areas with ≥ 3 sub-requirements each. ≥ 8 user stories written. |
| Zhengxi | Draft API contracts, auth section, repo structure, and ERD first pass; scaffold backend endpoint | docs/auth-design.md exists. API contract table matches schema.sql. At least register, login, and list documents return valid JSON. |
| Luka | Finish NFRs, C4 L1/L2, communication model, and AI design outline; freeze component names | docs/nfr.md with all 5 quality attributes. C4 Level 1 and Level 2 complete. Component names frozen. |

**Day 3 — Monday, 31 March: Working PoC Path + Architecture Near-Final**

Team milestone: Frontend-to-backend communication working for at least one major flow.

[TABLE: 3 columns — Member | Tasks | Acceptance criteria]

| Harmanjot | Connect frontend to backend for the chosen flow; polish traceability draft | Frontend successfully calls login and list documents and renders results. Traceability links ≥ 10 user stories to FRs. |
| Zhengxi | Finish endpoint implementation, response validation, and one integration test; draft README | All endpoints return correct shapes. npm test passes with ≥ 5 test cases. README has setup instructions. |
| Luka | Complete C4 L3, ADRs, risk table, timeline, and architecture prose; review API/data consistency | All 3 C4 levels complete. All 4 ADRs written. Project management has risks (≥ 5) and timeline. |

**Day 4 — Tuesday, 1 April: All Major Content Complete; Final QA; Demo Ready**

Team milestone: Report and PoC are submission-ready pending final review.

[TABLE: 3 columns — Member | Tasks | Acceptance criteria]

| Harmanjot | UI polish for demo, screenshot support, final wording fixes | Demo can be recorded end-to-end. All FRs have acceptance criteria. ≥ 10 user stories. |
| Zhengxi | Final README pass, backend cleanup, error response confirmation, merge assistance | README accurately describes setup, run, test. Error responses match convention. All PRs merged. |
| Luka | Lead consistency pass, final assembly checklist, figure labels, demo script alignment, document QA | All docs/ files use consistent component names matching code. Traceability references match FR IDs and file paths. |

**Days 5–6 — Wednesday–Thursday, 2–3 April: Buffer and Submission**

Team milestone: Final export and submission.

[TABLE: 2 columns — Member | Tasks]

| Harmanjot | Only fix bugs or wording defects discovered in QA |
| Zhengxi | Only fix mismatches between code and document |
| Luka | Export final PDF, verify diagram sources, verify repo/demo links, and package submission artifacts |

### Milestone Verification Criteria

[TABLE: 3 columns — Milestone | Verified by | Acceptance criteria]

| M1: Repo skeleton | Luka | git clone + npm install succeeds in both backend/ and frontend/ |
| M2: API contract freeze | Zhengxi + Harmanjot | All endpoints in README return documented shapes; frontend types/api.ts matches |
| M3: Frontend-to-backend flow | Harmanjot | Screen recording shows register → login → create document → view document list |
| M4: Architecture docs complete | Luka | All files in docs/ exist, render correctly in GitHub markdown, and pass a cross-reference check |
| M5: Integration test suite | Zhengxi | npm test passes with ≥ 10 assertions covering auth, documents, sharing, versions, AI |
| M6: Demo recorded | Harmanjot + Luka | 3-minute video shows frontend communicating with backend for at least one complete flow |
| M7: Final PDF | Luka | Single PDF with all Part 1–4 sections, embedded diagrams, and no broken cross-references |
