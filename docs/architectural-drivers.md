# Architectural Drivers

This section identifies the requirements and quality attributes that most strongly shape the system architecture. They are ranked by influence: two teams with different rankings would arrive at different designs.

## Ranked Drivers

### 1. Real-Time Collaboration Consistency (NFR — Latency + Correctness)

**Why it ranks first.** The product is a *collaborative* editor. If two users edit the same paragraph and the result is corrupted or silently lost, the system fails at its core value proposition. Every major architectural boundary — the synchronization protocol, the data model, the API layer, and the frontend state — is designed around this constraint.

**Architectural consequence.** The system adopts a CRDT-based synchronization model over a persistent WebSocket connection. The backend maintains authoritative document state while each client keeps a local replica. This pushes complexity into the sync service and forces a clear separation between the "collaboration transport" layer and the REST API used for CRUD and management operations.

### 2. AI Integration Latency and UX (NFR — Latency + Usability)

**Why it ranks second.** The AI assistant is the differentiating feature. LLM inference is inherently slow (seconds, not milliseconds), and the user is editing in real time while waiting. A naive design that blocks the editor or overwrites concurrent edits during an AI rewrite would create an unusable experience.

**Architectural consequence.** AI invocations are processed asynchronously: the frontend issues a request and receives a streamed or event-based response, while the editor remains fully interactive. The AI service is isolated behind its own API contract so that model changes, prompt updates, or provider swaps do not ripple into the collaboration or document layers. During an AI operation, the affected text region enters a "pending suggestion" state visible to all collaborators, preventing silent overwrites.

### 3. Security and Privacy of Document Content (NFR — Security)

**Why it ranks third.** Documents may contain sensitive or proprietary content. Every editing session, every API call, and every AI invocation transmits document text. Sending content to a third-party LLM API introduces a data-residency and privacy concern that must be addressed architecturally, not just operationally.

**Architectural consequence.** All client-server communication is encrypted in transit (TLS). The AI service layer acts as a controlled gateway: it strips metadata, enforces per-user and per-organization content policies, and logs every prompt sent to the external LLM for auditability. The auth model uses stateless JWT with role-based access control (owner / editor / viewer), and the `resolveDoc()` authorization check runs on every document operation, including AI invocations. Data-at-rest encryption is delegated to the storage layer.

### 4. Horizontal Scalability (NFR — Scalability)

**Why it ranks fourth.** Initial deployment targets small teams (≤ 20 concurrent editors per document, hundreds of documents system-wide), but the architecture must not introduce scaling walls that would require a rewrite. The stateless JWT design already avoids server-side session stores; the next bottleneck is the synchronization layer.

**Architectural consequence.** The REST API is stateless and can be load-balanced trivially. The WebSocket sync service is the stateful component; it is deployed separately so that it can scale independently. For the PoC, SQLite is sufficient, but the data-access layer uses a repository abstraction that can be swapped for PostgreSQL or another database without modifying business logic.

### 5. Developer Productivity and Module Independence (Quality — Maintainability)

**Why it ranks fifth.** The team has three members with distinct ownership areas (frontend, backend/API, collaboration/AI architecture). The architecture must allow each member to develop, test, and deploy their area with minimal cross-owner coordination.

**Architectural consequence.** The codebase is organized as a monorepo with clearly separated `frontend/`, `backend/`, and `docs/` directories. The API contract (documented in the README and type definitions) serves as the integration boundary: frontend and backend communicate only through the defined REST and WebSocket interfaces. Shared type definitions live in `frontend/src/types/api.ts` and are validated against the backend's actual responses through integration tests.

## Driver–Architecture Summary

| Rank | Driver | Primary quality attribute | Key architectural decision |
|------|--------|--------------------------|---------------------------|
| 1 | Collaboration consistency | Correctness, Latency | CRDT sync over WebSocket; local-first replicas |
| 2 | AI integration UX | Latency, Usability | Async AI pipeline; isolated AI service; pending-suggestion state |
| 3 | Content security | Security, Privacy | TLS, JWT RBAC, AI gateway with audit logging |
| 4 | Horizontal scalability | Scalability | Stateless REST; separately deployable sync service |
| 5 | Developer productivity | Maintainability | Monorepo with contract-first module boundaries |
