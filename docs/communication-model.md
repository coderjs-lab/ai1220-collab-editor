# Communication Model

This document describes how the system keeps multiple users in sync as they edit the same document, and the implications of the chosen approach for user experience.

---

## Approach: Real-Time Push-Based Communication

The system uses **push-based real-time communication** via persistent WebSocket connections. When a user makes an edit, the change is sent immediately to the server and broadcast to all other connected clients — there is no polling interval. Users see each other's keystrokes within the latency target of < 200 ms.

### Why push-based over polling

| Criterion | Push (WebSocket) | Polling |
|-----------|------------------|---------|
| Perceived latency | < 200 ms (near-instant) | Bounded by poll interval (typically 1–5 s) |
| Bandwidth efficiency | Only sends data when changes occur | Sends requests even when nothing changed |
| Conflict resolution | Fine-grained, operation-level | Coarse-grained, full-document replacement |
| Server load at scale | One persistent connection per client | N requests/minute per client regardless of activity |
| Implementation complexity | Higher (connection management, reconnection, heartbeats) | Lower (stateless HTTP requests) |

For a collaborative editor, the latency and granularity advantages of push-based communication are decisive. Polling at any reasonable interval would introduce visible "lag" between collaborators and make the system feel disconnected rather than collaborative.

---

## Connection Lifecycle

### Opening a shared document

When a user opens a document:

```
1. Client loads document via REST:  GET /api/documents/:id
   → Receives current content, metadata, and collaborator list.

2. Client opens WebSocket:  ws://host/sync/:documentId
   → Sends auth token in the connection handshake.
   → Server validates token and permission level.

3. Server adds client to the document's session room.
   → Broadcasts presence update ("User X joined") to existing clients.
   → Sends the current presence list to the new client.

4. Client initializes local CRDT state from the loaded document content.
   → Ready to send and receive operations.
```

The REST call in step 1 ensures the client has a consistent baseline before joining the WebSocket session. This avoids a race condition where the client could receive operations against a document state it hasn't loaded yet.

### Editing flow

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

Each keystroke generates a CRDT operation that is applied optimistically to the local state (so the user sees their own edit immediately). The operation is sent to the server, which merges it into the authoritative document state and broadcasts the result to all other clients. The originating client receives an acknowledgment confirming the operation was accepted.

### Presence and cursors

In addition to document operations, the WebSocket carries **presence messages**: each client periodically sends its cursor position and selection range. These are broadcast to other clients, enabling the "colored cursor" UX where each collaborator's position is visible in the editor.

Presence updates are sent on a throttled schedule (at most every 100 ms) to avoid flooding the WebSocket with cursor movements during rapid typing.

---

## Disconnection and Reconnection

### What happens when a user loses connectivity

1. **Immediate:** The client detects the WebSocket close event. A banner appears: "Connection lost — your changes are saved locally."

2. **Offline editing continues.** The user can keep typing. Edits are accumulated in the local CRDT state. No data is lost.

3. **Reconnection attempt.** The client implements exponential backoff reconnection (1 s → 2 s → 4 s → 8 s → max 30 s). On each attempt, it re-authenticates via the WebSocket handshake.

4. **Reconnected.** On successful reconnection:
   - The client sends its accumulated offline operations to the server.
   - The server merges them with any operations that occurred while the client was disconnected.
   - The server sends back the merged result.
   - The client reconciles its local state and removes the "offline" banner.

5. **Presence update.** Other collaborators see the user reappear in the presence list.

### Conflict resolution during reconnection

Because the system uses CRDTs (Conflict-free Replicated Data Types), merging offline edits with concurrent edits is mathematically guaranteed to converge to the same state on all clients, regardless of the order operations arrive. This eliminates the need for manual conflict resolution dialogs.

---

## Communication Channels Summary

| Channel | Protocol | Purpose | Statefulness |
|---------|----------|---------|-------------|
| REST API | HTTPS | Auth, document CRUD, sharing, versions, AI invocation | Stateless |
| Sync | WebSocket (WSS) | Real-time operations, presence, cursor positions | Stateful (per-document session) |

The two channels serve complementary roles: REST handles all "management" operations (create, share, delete, configure), while WebSocket handles all "live editing" operations (keystrokes, cursor movements, presence). This separation keeps the REST API simple and testable while isolating the complexity of real-time sync into a dedicated service.
