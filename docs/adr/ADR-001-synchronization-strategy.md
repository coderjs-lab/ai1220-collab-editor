# ADR-001: CRDT-Based Synchronisation Over Operational Transformation

## Status

Accepted

## Context

The core value proposition of Draftboard is real-time collaborative editing: multiple users must see each other's changes with low latency, concurrent edits to the same region must resolve without data loss, and users who lose connectivity must be able to resume editing and rejoin without manual conflict resolution.

The Collaboration Server — shown in the C4 Level 2 container diagram as a planned Socket.IO + Y.js container — is the component responsible for broadcasting document operations to connected clients and merging concurrent edits into a single authoritative document state. The backend already provisions an integration seam for this component: `POST /api/documents/:id/session` issues a short-lived JWT session token that the frontend will present during the WebSocket handshake when the Collaboration Server is built.

The team must choose a merge strategy that is correct, scalable, and implementable within a three-person team's capacity.

**Forces at play:**

- **Correctness.** Two editors making conflicting edits must always arrive at the same final document state. Silent data loss is not acceptable (FR-COL-03).
- **Offline resilience.** A user who loses connectivity must be able to continue editing locally and merge buffered operations on reconnect without requiring the server to be reachable during the edit window (FR-COL-04).
- **Scalability.** The merge strategy must not require a single transform server that becomes a bottleneck under horizontal scaling (NFR-SCL-03). The C4 Level 2 diagram shows the Collaboration Server as a separately deployable container precisely because it may need to scale independently of the REST API.
- **Implementation risk.** The team has three members and a defined delivery timeline. Any algorithm requiring custom correctness proofs from first principles is too risky.
- **Library ecosystem.** A production-quality open-source implementation significantly reduces custom code and debugging surface.

## Decision

We adopt **Conflict-free Replicated Data Types (CRDT)** — specifically Y.js — as the merge algorithm for the Collaboration Server.

CRDT merge is commutative (A ∘ B = B ∘ A), associative, and idempotent. Any number of clients can apply the same set of operations in any order and will converge to the same document state. This property eliminates an entire class of subtle concurrency bugs that plague OT implementations.

In the PoC milestone, real-time sync is deferred to a later milestone. The CRDT strategy governs the design of the Collaboration Server module boundary as shown in the C4 Level 2 container diagram, and is reflected in the session stub endpoint (`POST /api/documents/:id/session`) that exists now as a forward-compatible integration seam. The `session_api` component (C4 Level 3) is designed so that the real JWT scoping and WebSocket handshake can be dropped in without changing the REST API contract.

## Consequences

### Positive

- **Offline-first by design.** Each client maintains a local CRDT replica. Operations are buffered during disconnection and applied on reconnect. The reconnection protocol — `rejoin_document` message, server responds with `catch_up` delta or `sync_state` — works correctly because CRDT merge is idempotent: re-applying already-seen operations produces the same result.
- **No central transform server required.** OT requires a single serialisation point (the transform server) that becomes both a scaling bottleneck and a single point of failure. CRDTs can merge on any node — server, client, or peer — which directly supports the C4 Level 2 architecture where the Collaboration Server is a stateless-enough container that can be horizontally scaled.
- **Deterministic merge.** The same set of operations always produces the same document state regardless of arrival order. This makes automated testing of the sync layer tractable: a test can replay a fixed set of concurrent operations and assert the exact resulting document content.
- **Mature library.** Y.js provides a production-quality sequence CRDT with a Socket.IO adapter (`y-socket.io`), built-in awareness protocol for cursor positions, and direct SQLite persistence adapters — reducing the custom code surface to the session-token handshake and room lifecycle management.

### Negative

- **Higher memory overhead.** CRDTs maintain metadata per character (logical timestamps, tombstones for deletions). A 10,000-character document may require 2–4× more memory than its plain-text representation. For expected document sizes (< 100,000 words), this is acceptable at PoC and early-production scale.
- **Tombstone accumulation.** Deleted characters leave tombstones in the CRDT state. Periodic garbage collection is required to prevent unbounded growth. Y.js handles this internally, but the GC configuration and its interaction with the SQLite persistence adapter adds an operational concern in later milestones.
- **Learning curve.** The team must understand CRDT semantics well enough to debug convergence issues when they occur. Mitigation: Y.js is well-documented and sync logic is isolated to a single module (the Collaboration Server container), so bugs in the sync layer cannot propagate to the REST API or database layers.

## Alternatives Considered

### Operational Transformation (OT)

OT expresses each edit as an operation that is transformed against concurrent operations on a centralised server before being applied. This is the approach used by Google Docs.

**Rejected because:**
- OT requires a single serialisation point — the transform server — that must apply a correctness-preserving transformation to every pair of concurrent operations. This server becomes both a scaling bottleneck (violates NFR-SCL-03) and a single point of failure (violates NFR-AVL-01).
- OT correctness proofs for arbitrary operation sets are notoriously difficult to verify. Published OT algorithms (Jupiter, dOPT) have been found to have correctness bugs years after publication. A three-person team cannot afford to build and debug a correct OT implementation from scratch.
- OT does not natively support offline editing: the transform server must be reachable to validate operations, breaking the offline-resilience requirement (FR-COL-04).

### Last-Write-Wins (LWW)

Each client timestamps its operations. On conflict, the later timestamp wins and the earlier operation is silently discarded.

**Rejected because:**
- LWW silently discards concurrent edits, directly violating FR-COL-03 (concurrent edits to the same region must produce a valid, consistent document state without data loss). This is the most fundamental functional requirement for a collaborative editor.
- LWW is retained as the interim strategy for the single-user save flow in the PoC (the last `PUT /api/documents/:id` wins), but it is not appropriate as the production collaboration strategy.

### Manual Conflict Resolution (Git-style three-way merge)

Conflicts are surfaced to users as merge conflicts that they must resolve manually, similar to `git merge`.

**Rejected because:**
- Appropriate for source code with discrete line-level semantics and long-lived branches; unacceptable for a real-time character-level document editor where users expect changes to propagate in under 200 ms (NFR-LAT-01).
- Forcing users to resolve merge conflicts interrupts the writing workflow and creates confusion for non-technical users — a direct violation of the usability requirements (NFR-USB-01, NFR-USB-02).
