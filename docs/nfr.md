# Non-Functional Requirements

Each quality attribute below is specified with measurable targets that can be verified through testing or monitoring. Vague aspirations are avoided in favor of concrete constraints.

---

## 1. Latency

### NFR-L1: Keystroke Propagation Between Collaborators

**Target.** A keystroke made by one collaborator must be visible on all other collaborators' screens within **200 ms** under normal network conditions (< 50 ms round-trip to the server).

**Justification.** Research on collaborative editing (e.g., Google's studies on Docs latency) shows that delays above 200 ms cause users to perceive the system as "laggy" and begin second-guessing whether their collaborator is still active. Below 100 ms, the system feels instantaneous; between 100–200 ms, the system feels responsive; above 200 ms, users notice the delay. The 200 ms target balances achievability (it accounts for server-side CRDT merge time plus one network round trip) with perceived quality.

**Measurement.** Instrumented end-to-end test: two clients connected to the same document; timestamp the keystroke event on Client A and the DOM update on Client B. P95 latency must be ≤ 200 ms on a 50 ms RTT network.

### NFR-L2: AI Assistant Response Initiation

**Target.** The first token (or "thinking" indicator) of an AI response must appear within **2 seconds** of the user pressing the AI action button. The full response must complete within **10 seconds** for a standard rewrite of a single paragraph.

**Justification.** Users tolerate longer waits for AI because they understand inference takes time, but they need immediate feedback that the system is working. A 2-second threshold for "first visible response" prevents the user from wondering whether the button click registered. The 10-second cap ensures that even slow LLM responses don't leave the user waiting indefinitely — if the model hasn't finished, the partial result is shown with a "still generating..." indicator.

**Measurement.** Instrumented from button click to first streamed token arrival in the frontend. Tested against the production LLM API under typical load.

### NFR-L3: Document Load Time

**Target.** Opening a document (REST fetch + rendering) must complete within **1 second** for documents up to 50 000 words with up to 100 saved versions.

**Justification.** A 1-second load time ensures the editing experience feels instant. The main contributors to load time are the database query (document + collaborator list) and the network transfer. Version content is not included in the initial load (fetched on demand with `?full=1`), keeping the payload small regardless of version count.

**Measurement.** Time from `GET /api/documents/:id` request to rendered document in the frontend, tested with a 50 000-word document seeded in the database.

---

## 2. Scalability

### NFR-S1: Concurrent Editors Per Document

**Target.** The system must support at least **20 concurrent editors** on a single document without degradation in keystroke propagation latency (NFR-L1 still holds).

**Justification.** Typical collaborative editing sessions involve 2–5 users. Supporting 20 provides headroom for larger review sessions, classroom settings, and team-wide documents. Beyond 20, the CRDT operation broadcast fan-out and cursor/presence message volume become significant; this limit is declared as a design boundary.

### NFR-S2: Concurrent Documents System-Wide

**Target.** The system must support at least **500 active documents** (documents with at least one connected WebSocket session) simultaneously on a single backend server instance.

**Justification.** For a startup deployment, 500 concurrent documents serves a user base of ~2 000–5 000 registered users (assuming 10–25% peak concurrency). Each document session consumes a WebSocket connection and a CRDT state in memory; at 500 documents, memory usage is bounded at ~250 MB (assuming 500 KB average document size with CRDT metadata).

### NFR-S3: Growth Model

**Expected growth.** Linear growth over the first year: 100 → 500 → 2 000 active documents. The architecture supports horizontal scaling by deploying additional sync service instances behind a load balancer with document-level session affinity. The REST API scales trivially (stateless).

---

## 3. Availability

### NFR-A1: Availability Target

**Target.** **99.5% uptime** (roughly 44 hours of unplanned downtime per year). This applies to the REST API and document load functionality.

**Justification.** For an early-stage startup product, 99.5% balances reliability expectations against the operational cost of high-availability infrastructure. The real-time sync layer has a softer target (99.0%) because temporary sync outages are recoverable — users can continue editing locally and reconnect.

### NFR-A2: Behavior During Partial System Failure

| Failure scenario | Expected behavior |
|-----------------|-------------------|
| **Database unavailable** | REST API returns 503 for all data operations. Existing WebSocket sessions continue operating from in-memory state; changes are queued for persistence when the database recovers. |
| **Sync service crash** | Connected clients receive a WebSocket close event. The "connection lost" banner appears. Clients retry with exponential backoff. Edits continue locally. On reconnection, offline edits are merged. |
| **AI service / LLM unavailable** | AI features show "temporarily unavailable" with a retry option. All other features (editing, collaboration, sharing, versioning) continue normally. |
| **Frontend CDN unavailable** | Users cannot load the application initially. Users with the SPA already loaded are unaffected (it communicates directly with the API). |

### NFR-A3: No Single Point of Data Loss

No acknowledged edit may be silently lost. If a user receives confirmation that a save succeeded (via REST 200 or WebSocket ack), that edit must be durable in the database. This is enforced by SQLite's WAL mode with synchronous commits.

---

## 4. Security & Privacy

### NFR-SP1: Data in Transit

**Requirement.** All client-server communication must use TLS 1.2 or higher. The backend must refuse unencrypted HTTP connections in production.

### NFR-SP2: Data at Rest

**Requirement.** Document content stored in the database must be encrypted at rest using filesystem-level or database-level encryption in production. For the PoC, SQLite file-level encryption is deferred, but the deployment guide must document the requirement.

### NFR-SP3: Authentication Tokens

**Requirement.** JWT tokens are signed with HS256 using a secret of at least 256 bits. Tokens expire after 7 days. The token payload contains only the user ID and email — no document content or permission data is embedded in the token.

### NFR-SP4: AI and Third-Party Data Exposure

**Requirement.** When document content is sent to a third-party LLM API:

1. Only the minimum necessary context is transmitted (selection + surrounding context, not the full document — see [AI Integration Design](ai-integration-design.md)).
2. Every AI invocation is logged in the `ai_interactions` table with the exact prompt sent, enabling audit of what was shared with the external provider.
3. The system must support a per-organization toggle to disable AI features entirely for compliance-sensitive environments.
4. Users must be informed (via a visible notice in the AI UI) that their text will be processed by a third-party service.

### NFR-SP5: Data Retention for AI Logs

**Requirement.** AI interaction logs (`ai_interactions` table) are retained for 90 days, after which they are automatically purged. Organizations may configure a shorter retention period. The prompt and response fields can be redacted on demand by an admin.

### NFR-SP6: Password Security

**Requirement.** Passwords are hashed with bcrypt (salt rounds ≥ 10) before storage. Plaintext passwords are never logged, stored, or transmitted beyond the initial registration/login request body.

---

## 5. Usability

### NFR-U1: Large Documents with Many Collaborators

**Requirement.** Opening a document with 50 000 words and 15 active collaborators must not cause the UI to become unresponsive. The editor must maintain ≥ 30 FPS during normal typing.

**Approach.** The frontend uses viewport-based rendering: only the visible portion of the document is fully rendered in the DOM. Collaborator cursors outside the viewport are shown as indicators in the scrollbar gutter rather than full cursor overlays. Presence list UI is collapsed by default and expandable on demand.

### NFR-U2: Collaborator Awareness Without Overwhelm

**Requirement.** The UI must show who is currently editing and where, without cluttering the editor surface. Design constraints:

- Each collaborator's cursor is shown with a distinct color and a small name label that fades after 3 seconds of inactivity.
- A maximum of 5 collaborator cursors are shown inline; additional collaborators are represented as a "+N more" badge.
- A presence panel (toggled via a button) shows the full list of active users with their last-active timestamps.

### NFR-U3: Accessibility

**Requirement.** The application must meet WCAG 2.1 Level AA compliance:

- All interactive elements must be keyboard-navigable.
- Color is not the sole means of conveying information (e.g., AI suggestion state uses both color and icons).
- The editor must work with screen readers at a basic level (document title, toolbar actions, status messages are announced).
- Contrast ratios meet 4.5:1 for normal text and 3:1 for large text.

### NFR-U4: Error Communication

**Requirement.** When an operation fails (save, AI call, share invite), the user must receive a clear, actionable error message within 1 second. Error messages must describe what happened and what the user can do, not just show a generic "Something went wrong." The existing `StatusBanner` component and `ApiError` class in the codebase support this pattern.
