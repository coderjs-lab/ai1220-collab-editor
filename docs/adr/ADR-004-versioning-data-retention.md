# ADR-004: Snapshot-Based Versioning with Bounded Retention

## Status

Accepted

## Context

The system must support document version history: users should be able to browse previous versions and understand how a document evolved over time. The AI interaction log adds a second dimension of history: every prompt and response must be retained for auditability.

The forces at play:
- **Storage growth.** Every save creates a version snapshot. For a frequently edited document (e.g., 50 saves/day for 30 days), version history can exceed the document's own size by 100×.
- **Query performance.** Listing version history must be fast (< 200 ms) even for documents with hundreds of versions.
- **Auditability.** Compliance and trust require that AI interactions be traceable: what was sent to the LLM, when, by whom, and what came back.
- **Privacy.** AI interaction logs contain document content (the prompt). Unbounded retention of this data increases privacy exposure.
- **PoC simplicity.** The initial implementation should be straightforward and built on the existing SQLite database.

## Decision

### Document versioning

We use **full-content snapshot versioning**: every `PUT` that changes document content inserts a copy of the *previous* content into the `versions` table before applying the update. This is implemented in `routes/documents.js`.

Version retention follows a **bounded policy**:
- The most recent **50 versions** are always retained.
- Versions older than **90 days** are eligible for automatic pruning.
- At least one version per calendar day is preserved (the last save of each day), even beyond the 50-version window, to support coarse-grained history browsing.

### AI interaction logs

AI interaction records in `ai_interactions` are retained for **90 days**, after which they are automatically purged. Organizations may configure a shorter retention period. The prompt and response fields can be redacted on demand by an admin.

## Consequences

### Positive

- **Simplicity.** Full-content snapshots are trivial to implement (one INSERT per save), require no diffing or patching logic, and make version retrieval a single SELECT — no reconstruction from deltas needed.
- **Instant version preview.** The frontend can display any historical version immediately because the full content is stored. This is the current behavior in `EditorPage.tsx`.
- **Bounded storage.** The retention policy prevents unbounded growth. For a document saved 50 times/day, the 50-version cap means at most ~50 × document_size is stored at any time (plus one per day for older history).
- **Audit compliance.** The 90-day AI log retention gives organizations enough history for audit purposes while limiting long-term data exposure.

### Negative

- **Storage inefficiency.** Full snapshots duplicate content. For a 10 KB document saved 50 times, the versions table stores ~500 KB. Delta-based versioning would reduce this by ~90%. Accepted as a trade-off for simplicity at the PoC stage.
- **Pruning complexity.** The retention policy requires a periodic background job (e.g., a daily cron or scheduled task) to clean old versions. Not yet implemented in the PoC.
- **No merge/diff UI.** Full snapshots support "view this version" but not "compare two versions side by side." Adding a diff view would require a text-diff algorithm on the frontend. Deferred to a later milestone.

## Alternatives Considered

### Delta-based versioning (store diffs instead of full snapshots)

Rejected for the PoC because:
- Reconstructing a historical version requires applying a chain of deltas from a base snapshot. This adds complexity to both the write path (computing diffs) and the read path (applying patches).
- For the expected document sizes (< 50 000 words), the storage savings don't justify the implementation complexity.
- Can be revisited if storage costs become a concern at scale.

### Event-sourced versioning (store every operation, reconstruct state by replay)

Rejected because:
- The CRDT sync layer already maintains an operation log for real-time sync. Duplicating this as the versioning mechanism would couple the versioning feature to the sync implementation.
- Replaying thousands of operations to reconstruct a historical version is slow compared to reading a single snapshot row.
- Event sourcing is appropriate for the sync layer's internal state but not for the user-facing version history feature.

### Unlimited retention (keep all versions forever)

Rejected because:
- Unbounded storage growth is an operational risk. A frequently edited document could accumulate gigabytes of version data over months.
- AI interaction logs containing document content create an expanding privacy surface with no expiration.
- Regulatory frameworks (GDPR) may require data minimization, making bounded retention a safer default.
