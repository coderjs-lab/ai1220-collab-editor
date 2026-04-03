# ADR-004: Snapshot-Based Versioning with Bounded Retention

## Status

Accepted

## Context

The system must maintain a recoverable version history for every document and a queryable log of AI interactions. These are two distinct but related persistence concerns, both handled by `doc_repo` and `doc_service` (visible in the C4 Level 3 component diagram under the Repository & Library layer).

**Version history requirements:**
- Users must be able to browse the saved history of a document and understand how it evolved over time (FR-DOC-03, US-10).
- The version history endpoint (`GET /api/documents/:id/versions?full=1`) is implemented and tested in 23/23 integration tests.
- Every content-changing `PUT /api/documents/:id` already inserts the previous content as a snapshot row in `doc_repo.insertVersion()` before overwriting — this is the live behaviour in the PoC.

**AI interaction log requirements:**
- Every AI prompt and response must be persisted for auditability (FR-AI-03, US-11).
- AI interaction history must be queryable per document (`GET /api/documents/:id/ai/history`).
- AI prompts contain selected document text that was transmitted to a third-party LLM Provider (visible in the C4 Level 1 system context diagram). Unbounded retention of this data creates an expanding privacy surface.

**Forces at play:**

- **Implementation complexity.** The write path for versioning must be simple enough to implement reliably within the PoC timeline. Incorrect versioning that loses content is worse than no versioning.
- **Recovery simplicity.** Version revert must be a fast, constant-time operation. Requiring the system to reconstruct content from a chain of deltas adds latency and failure modes to a user-facing operation.
- **Storage growth.** Full-content snapshots on every save duplicate content. A document saved 200 times stores 200 full copies. Without a retention policy, storage grows without bound.
- **Privacy and GDPR.** AI prompts and responses contain user-authored content sent to a third-party provider. Unlimited retention conflicts with data minimisation principles and creates compliance risk (NFR-SEC-05).
- **Audit requirements.** AI interaction history supports auditability (US-11: review the AI interaction history for a document). Some retention period is required, but it does not need to be permanent.
- **PoC scope.** The pruning background job and the version revert UI are post-PoC concerns. The schema and retention constants must be correct from the start even if the enforcement mechanism is deferred.

## Decision

We adopt **full-content snapshot versioning** with a **bounded retention policy**.

### Versioning model

Every `PUT /api/documents/:id` that changes `content` inserts the *previous* content as a new row in the `versions` table before overwriting the document. This is implemented in `doc_service.updateDocument()` — the snapshot logic lives in the service layer, not the route handler, so it cannot be bypassed by a future route addition.

```
versions
─────────────────────────────────────
id          INTEGER PRIMARY KEY
document_id INTEGER → documents(id)
content     TEXT    (full snapshot)
created_by  INTEGER → users(id)
created_at  DATETIME
```

The `GET /api/documents/:id/versions?full=1` endpoint returns the full snapshot content for each version, enabling the frontend `VersionHistoryPanel` to display any historical state immediately without any reconstruction step.

Version revert is a documented stub in the PoC: the endpoint contract is specified, the schema supports it, and the implementation is deferred to the next milestone.

### Retention policy

| Data | Retention rule |
|------|---------------|
| Version snapshots | Most recent **50 versions** always retained. Versions older than **90 days** eligible for pruning. At least **one version per calendar day** preserved even beyond the 50-version window. |
| AI interaction logs (`ai_interactions`) | Retained for **90 days**, then automatically purged. The `prompt` and `response` fields can be redacted on demand. |

A background pruning job enforces this policy. The job is not yet implemented in the PoC; the retention constants (50 snapshots, 90 days) are configurable and documented for the next milestone.

## Consequences

### Positive

- **Simplicity.** One `INSERT` per save with no diff/patch logic. The write path is a single prepared SQL statement in `doc_repo.insertVersion()`. The 23/23 integration tests confirm it works correctly: `update document content snapshots previous version` verifies that after a `PUT` the versions endpoint returns the prior content.
- **Instant version preview.** Full content is stored directly; no reconstruction chain is needed. The frontend `VersionHistoryPanel` (visible in `EditorPage.tsx`) can display any historical version with a single `SELECT` query.
- **Bounded storage.** The retention policy prevents unbounded growth for both version snapshots and AI interaction logs. For a document saved 50 times per day, the 50-version cap means at most ~50 × document_size is stored at any time.
- **Privacy compliance.** The 90-day AI log retention satisfies data minimisation requirements (NFR-SEC-05). AI prompts contain text that was transmitted to an external provider; indefinite retention of this data is a compliance risk that bounded retention directly mitigates.
- **Audit trail regardless of LLM outcome.** The `ai_service` inserts the `ai_interactions` row with the prompt *before* dispatching to `llm_client.complete()`. If the LLM call fails, the prompt is still recorded. This audit-first pattern means the history log is complete even when the LLM stub or real API returns an error.

### Negative

- **Storage inefficiency.** Full snapshots duplicate content. For a 10 KB document saved 50 times, the `versions` table stores ~500 KB. Delta-based versioning would reduce this by ~80–90 %. Accepted as a trade-off for implementation simplicity at PoC scale; migration to delta storage is the documented upgrade path.
- **Pruning is not yet enforced.** The retention policy is aspirational until the background pruning job is implemented. In the interim, the database grows without bound on a busy installation. The constants are correct and documented; enforcement is a post-PoC task.
- **No side-by-side diff UI.** Full snapshots make diffing possible (any standard text-diff algorithm applied to two `content` fields), but the UI that displays a character-level diff between two versions is deferred. The current frontend shows each snapshot in full; users must visually compare if they need a diff.

## Alternatives Considered

### Delta-based versioning (store diffs instead of full snapshots)

Each version stores only the diff between the previous and current content, computed by a text-diffing algorithm (e.g., Myers diff).

**Rejected because:**
- Adds complexity to both the write path (compute the diff before saving) and the read path (reconstruct content by applying a chain of deltas from a base snapshot). Incorrect delta application silently corrupts content — a worse failure mode than no versioning.
- For the expected document sizes (< 50,000 words) and the PoC timeline, storage savings do not justify the implementation risk.
- Can be revisited as a storage optimisation in a later milestone once the versioning feature is stable and well-tested.

### Event-sourced versioning (store every edit operation, reconstruct by replay)

Each individual edit (insert character, delete character) is stored as an immutable event. Document state at any point is reconstructed by replaying events from the beginning.

**Rejected because:**
- Directly couples the versioning layer to the CRDT sync layer. The Collaboration Server (planned in C4 Level 2) maintains its own operation log for real-time sync. Duplicating this as the versioning mechanism would mean the two layers must agree on an operation schema — a tight coupling that makes both harder to evolve independently.
- Replaying thousands of operations to reconstruct a historical version is slow compared to reading a single snapshot row. For documents with long edit histories (months of daily edits), replay latency would make version browsing unusable.
- Inappropriate for the user-facing version history feature, which operates at the granularity of "saved states", not individual keystrokes.

### Unlimited retention (no pruning policy)

Keep all version snapshots and all AI interaction logs forever.

**Rejected because:**
- Unbounded storage growth is an operational risk. A document saved 50 times per day for a year accumulates ~18,000 version rows. At 10 KB per document, that is ~180 MB of version data for a single document.
- AI interaction logs containing document content create an indefinitely expanding privacy surface. Prompts sent to the external LLM Provider are retained permanently, conflicting with data minimisation principles (NFR-SEC-05) and GDPR requirements.
- The 90-day retention period for AI logs provides sufficient audit history for the use cases described in the requirements (US-11: review AI interaction history) without requiring permanent storage.
