# C4 Architecture Diagrams

All diagrams use Mermaid and follow the [C4 model](https://c4model.com). Rendered PNGs are generated from these source blocks via the [Mermaid Live Editor](https://mermaid.live).

---

## Level 1 — System Context Diagram

Shows the Collaborative Editor as a single box and its relationships with external actors.

```mermaid
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

**Explanation.** The system serves three actor categories. Document Authors are the primary users who create content and invoke AI features. Collaborators participate via shared access at varying permission levels. Organization Admins govern policies such as role assignments and AI usage quotas. The system depends on two external services: a third-party LLM API for AI writing features, and an email/notification service for sharing workflows. All external communication flows over encrypted channels.

---

## Level 2 — Container Diagram

Zooms into the system to show the major deployable containers, their technology choices, and inter-container communication.

```mermaid
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

**Explanation.** The system decomposes into five containers:

| Container | Responsibility | Technology |
|-----------|---------------|------------|
| **Frontend SPA** | Editor UI, collaboration presence indicators, AI suggestion display and accept/reject flow | React 19, TypeScript, Vite, Tailwind CSS 4 |
| **Backend API** | Authentication (JWT + bcrypt), document CRUD, permission management, version snapshots, AI request routing | Node.js 22, Express 4 |
| **Real-Time Sync Service** | WebSocket connection management, operation broadcast, CRDT merge, presence tracking | Node.js, WebSocket |
| **Database** | Persistent storage for users, documents, permissions, versions, AI interaction logs | SQLite in WAL mode |
| **AI Service** | Prompt construction from document context, LLM API gateway, response streaming, usage metering | Node.js, Express |

The Frontend SPA maintains two connections to the backend: a standard HTTPS channel for REST operations and a persistent WebSocket for real-time sync. The AI Service is separated from the main API so that prompt logic, model routing, and cost controls can evolve independently. For the PoC milestone, the Sync Service and AI Service are logical modules within the single Express backend; they will be extracted into separate deployable containers when traffic warrants it.

---

## Level 3 — Component Diagram (Backend API)

Zooms into the Backend API container to show its internal components.

```mermaid
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

**Explanation.** The Backend API contains the following components:

| Component | File(s) | Responsibility |
|-----------|---------|---------------|
| **Auth Middleware** | `middleware/auth.js` | Extracts and verifies the JWT from the `Authorization` header; attaches `req.user = { id, email }` |
| **Auth Controller** | `routes/auth.js` | Registration (bcrypt hash + INSERT), login (bcrypt compare + JWT sign), session restore (`GET /me`) |
| **Document Controller** | `routes/documents.js` | List owned + shared documents, create, read (with collaborators), update (with version snapshot), delete |
| **Share Controller** | `routes/documents.js` | Grant access by email + role, revoke access by user ID; enforces owner-only policy |
| **Version Controller** | `routes/documents.js` | Returns version history ordered by recency; supports `?full=1` for content inclusion |
| **AI Controller** | `routes/ai.js` | Accepts prompt + optional context, logs the interaction, delegates to the AI Service, returns suggestion |
| **Document Resolver** | `resolveDoc()` in `routes/documents.js` | Central authorization gate: loads document, checks owner or permission role against the required minimum |
| **Database Layer** | `db/index.js`, `schema.sql` | Opens SQLite in WAL mode, runs schema migration, exposes synchronous prepared-statement API |
| **Error Handler** | `app.js` | Catches uncaught Express errors and returns `{ error: "Internal server error" }` with status 500 |

The Document Resolver (`resolveDoc`) is the single point of authorization for all document-scoped operations. This avoids scattering permission checks across multiple route handlers and ensures consistent 403/404 responses.
