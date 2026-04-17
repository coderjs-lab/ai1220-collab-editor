# Architecture Deviations

This file records implementation differences between the Assignment 1 design/report and the realtime collaboration implementation work on this branch.

The purpose is explicit traceability, not penalty avoidance. Designs evolved; the key requirement is to record the changes and why they happened.

This document is intentionally implementation-truthful. It includes both architectural changes that were made and important collaboration limitations that remain on this branch.

## 1. Express backend replaced with FastAPI foundation

### What changed

The Assignment 1 PoC backend was an Express application under `backend/src`. This branch introduces a FastAPI application under `backend/app` as the collaboration foundation.

### Why

Assignment 2 explicitly constrains the stack to React + FastAPI. Realtime collaboration also benefits from FastAPI’s native websocket support and a simpler Python-side integration with `ypy-websocket`.

### Improvement or compromise

Improvement for Assignment 2 alignment. It reduces stack mismatch and makes the websocket collaboration layer simpler to build on the required backend framework.

## 2. Socket.IO + Redis plan replaced with FastAPI websocket + in-process Yjs room management

### What changed

The Assignment 1 report discussed a future collaboration server using Socket.IO with Redis for pub/sub and room coordination. This branch uses FastAPI websocket handling with `ypy-websocket` and in-process room management backed by a SQLite Y update store.

### Why

The course environment and delivery scope prioritize a working local proof-of-concept over distributed deployment. `ypy-websocket` already implements the Yjs sync semantics needed for CRDT-based collaboration and fits a single-node assignment deployment well.

### Improvement or compromise

Mixed:

- improvement because it is faster to implement correctly for the assignment and preserves CRDT semantics
- compromise because it does not provide Redis-backed multi-instance fan-out or horizontal scaling

## 3. Plain-text content replaced by structured rich-text JSON

### What changed

Assignment 1 stored document content as plain text. This branch stores `document.content` as structured rich-text JSON compatible with a Tiptap editor model.

### Why

Realtime collaboration is materially stronger with a collaborative rich-text editor than with a raw textarea. Remote selections, structured editing, and collaborative transactions are better supported by a ProseMirror/Tiptap model.

### Improvement or compromise

Improvement. It enables a more realistic collaboration experience and aligns with the richer editor expected in Assignment 2.

## 4. Session stub replaced by a real document-scoped websocket handshake

### What changed

Assignment 1 exposed a placeholder session endpoint for future collaboration. This branch turns that endpoint into a real document-scoped handshake that returns:

- `session_token`
- `ws_url`
- `expires_in`
- `role`

### Why

The frontend needs a secure bridge from REST auth to websocket collaboration. A short-lived document-scoped token avoids sending the long-lived access token directly through the websocket channel.

### Improvement or compromise

Improvement. This is a stronger and more explicit security boundary than the previous stub.

## 5. No Redis or multi-instance collaboration fan-out in the current implementation

### What changed

The current implementation does not include Redis, cross-instance room coordination, or distributed awareness propagation.

### Why

Those concerns are beyond the assignment’s local proof-of-concept requirements and would expand infrastructure and deployment complexity significantly.

### Improvement or compromise

Compromise. The implementation is intentionally single-node for speed and assignment fit.

## 6. Persistence bridge remains REST snapshot persistence rather than fully server-side collaborative checkpointing

### What changed

The collaborative editor maintains live shared state through Yjs, but the REST document snapshot and versions model are still persisted through the existing document update route rather than a fully separate server-side checkpointing pipeline.

### Why

This keeps compatibility with the existing document/version contract while the core-app teammate continues to own final autosave and version-restore behavior.

### Improvement or compromise

Compromise. It keeps branch boundaries clear and avoids duplicating the core-app teammate’s scope, but it is not the final ideal persistence architecture for a production collaborative editor.

## 7. Direct SQLite access used in the temporary FastAPI foundation instead of SQLAlchemy

### What changed

The planning direction referenced SQLAlchemy-style infrastructure, but the current FastAPI foundation uses direct `sqlite3` repository helpers.

### Why

The collaboration slice needed a fast, low-friction way to preserve the existing PoC contract and stand up the realtime foundation without expanding the migration scope too early.

### Improvement or compromise

Compromise. It reduced migration time and kept the foundation small, but it is less extensible than a fuller ORM-backed data layer.

## 8. Reconnect support exists, but durable offline-first editing is not implemented

### What changed

The Assignment 1 collaboration direction emphasized CRDT-friendly reconnect and offline resilience. The current branch supports temporary connection drops while the editor remains open, but it does **not** persist unsynced Yjs state locally across browser refresh, tab close, or machine restart.

### Why

This branch focused on getting authenticated realtime collaboration, presence, and cursor awareness working first. Durable offline editing would require an additional local persistence layer such as IndexedDB-backed Yjs storage and a more explicit reconnect recovery policy.

### Improvement or compromise

Compromise. The current behavior degrades reasonably during transient disconnects, but it is not a full offline-first implementation.

## 9. Snapshot persistence remains manual rather than fully autosaved collaborative checkpointing

### What changed

The current collaboration branch exposes live shared editing through Yjs, but persisted document snapshots are still created when the user explicitly saves through the existing REST update route. There is no finalized collaborative autosave pipeline on this branch.

### Why

The core-app teammate owns the final autosave behavior and editor shell policy. Keeping persistence manual here avoided overlapping ownership while still preserving a stable collaboration adapter and backend contract.

### Improvement or compromise

Compromise. Manual save is reliable enough for the branch, but it is weaker than the intended final collaborative editing experience.

## 10. Sharing remains email-based, not share-by-link

### What changed

The current implementation preserves the Assignment 1 email-based share flow with role assignment and revocation. It does not generate shareable links with configurable permissions.

### Why

The collaboration slice prioritized websocket sync, presence, and permission-aware editing over expanding the access-control model. Share-by-link would require additional token/link issuance flows and a different revocation surface.

### Improvement or compromise

Compromise. Email-based sharing is functional and consistent with the earlier PoC, but it does not reach the stronger collaboration bonus tier.

## 11. AI suggestions are applied at document level, not partially accepted

### What changed

The current editor can apply AI suggestions through the collaboration-aware editor transaction path, but it does not support partial acceptance or rejection of individual suggested fragments.

### Why

The AI teammate owns the final AI suggestion workflow. The collaboration branch only guarantees that accepted AI content enters the shared editor through collaborative transactions instead of bypassing Yjs.

### Improvement or compromise

Compromise. This keeps the collaboration/AI contract clean, but it leaves a notable bonus-tier interaction unimplemented on this branch.

## 12. No browser end-to-end test suite is included yet

### What changed

This branch includes backend collaboration tests, but it does not yet include Playwright or Cypress end-to-end coverage for login, document editing, collaboration, and AI suggestion application.

### Why

The priority on this branch was to stand up the collaboration foundation and stabilize the runtime behavior before adding full browser automation on top of a still-moving multi-branch system.

### Improvement or compromise

Compromise. It keeps the branch focused, but test coverage is weaker than a final integrated delivery should be.
