# ADR-001: CRDT-Based Synchronization Over Operational Transformation

## Status

Accepted

## Context

The core value proposition of the product is real-time collaborative editing: multiple users must see each other's changes with sub-200 ms latency, and concurrent edits to the same region must be resolved without data loss or manual conflict dialogs.

Two dominant approaches exist for real-time collaborative text synchronization:

1. **Operational Transformation (OT)** — the approach used by Google Docs. Each edit is expressed as an operation that is transformed against concurrent operations on a centralized server before being applied.
2. **Conflict-free Replicated Data Types (CRDTs)** — a family of data structures that guarantee eventual consistency without a central transformation server. Concurrent operations commute by construction.

The forces at play:
- The system must support offline editing and reconnection (a user loses connectivity and continues typing).
- The team has three members; the synchronization layer should be understandable and testable by a small team.
- The PoC must run on a single server with SQLite; the sync mechanism should not require a distributed consensus protocol.
- Future scaling may require multiple sync service instances.

## Decision

We adopt a **CRDT-based synchronization model** (specifically, a sequence CRDT such as Yjs or Automerge) for document text synchronization.

## Consequences

### Positive

- **Offline-first by design.** CRDTs allow each client to apply edits locally and merge later. Reconnection simply exchanges operations — no special "catch-up" protocol is needed.
- **No central transform server required.** OT requires a single serialization point (the transform server) that becomes a bottleneck. CRDTs can merge operations on any node — server, client, or peer — which simplifies horizontal scaling.
- **Deterministic merge.** CRDT merge is commutative, associative, and idempotent. The same set of operations always produces the same document state regardless of arrival order, eliminating an entire class of subtle OT bugs.
- **Library ecosystem.** Mature open-source libraries (Yjs, Automerge) provide production-quality CRDT implementations with WebSocket adapters, reducing the amount of custom code.

### Negative

- **Higher memory overhead.** CRDTs maintain metadata per character (logical timestamps, tombstones for deletions). A 10 000-character document may require 2–4× more memory than its plain-text representation. For the expected document sizes (< 100 000 words), this is acceptable.
- **Garbage collection complexity.** Deleted characters leave tombstones. Periodic garbage collection is needed to prevent unbounded growth. This is handled by Yjs internally but adds an operational concern.
- **Learning curve.** The team must understand CRDT semantics to debug synchronization issues. We mitigate this by using a well-documented library (Yjs) and by isolating sync logic into a single module.

## Alternatives Considered

### Operational Transformation (OT)

Rejected because:
- OT requires a centralized transform server that serializes all operations, creating a scaling bottleneck.
- OT correctness proofs are notoriously difficult; the Google Wave team documented multiple subtle bugs in their OT implementation.
- OT does not natively support offline editing — reconnection requires replaying and transforming a potentially long operation history.

### Last-Write-Wins (simple conflict resolution)

Rejected because:
- Silently discarding concurrent edits violates the product's core promise. Users would lose work without knowing it.
- Acceptable only for metadata fields (e.g., document title) but not for document content.

### Manual Conflict Resolution (Git-style merge dialogs)

Rejected because:
- Forces users into a technical workflow that disrupts the editing experience.
- Inappropriate for a real-time editor where conflicts are frequent and granular (character-level, not file-level).
