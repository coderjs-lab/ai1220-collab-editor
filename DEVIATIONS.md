# Architecture Deviations

This file records the explicit differences between the Assignment 1 design package and the current integrated Assignment 2 implementation branch.

The point is traceability, not pretending the design never changed. Each deviation records:

- what changed
- why it changed
- whether it was an improvement or a compromise

## 1. Express backend replaced with FastAPI

- **Changed:** The Assignment 1 PoC backend under `backend/src` was replaced by a FastAPI backend under `backend/app`.
- **Why:** Assignment 2 constrains the stack to React + FastAPI, and realtime websocket support is cleaner on the required backend framework.
- **Outcome:** Improvement. The implementation now matches the assignment technology constraints instead of documenting a silent exception.

## 2. Monolithic core-app backend and realtime backend were merged into one FastAPI app

- **Changed:** The core-app branch and the realtime branch evolved separate FastAPI backends. The final integrated branch keeps one FastAPI application with the richer core-app auth/document lifecycle plus the websocket collaboration path.
- **Why:** Keeping two backend entrypoints would have created contract drift and a broken integration surface for the frontend.
- **Outcome:** Improvement. It reduces duplication, though it required manual integration work where both branches touched the same files.

## 3. Planned Socket.IO + Redis collaboration server replaced with FastAPI websocket + `ypy-websocket`

- **Changed:** The Assignment 1 C4 and ADR direction discussed a future Socket.IO + Redis collaboration server. The implementation uses FastAPI websockets with `ypy-websocket`, Yjs sync semantics, and a single-node SQLite-backed Y update store.
- **Why:** The assignment environment favors a working local proof-of-concept over distributed deployment. `ypy-websocket` already provides the CRDT sync behavior needed here.
- **Outcome:** Mixed. Improvement for delivery speed and assignment fit; compromise because there is no Redis fan-out or multi-instance scaling.

## 4. Plain-text / HTML document content was replaced by structured rich-text JSON

- **Changed:** Earlier PoC flows treated `document.content` as plain text or serialized HTML. The integrated realtime implementation stores structured Tiptap/ProseMirror-style JSON.
- **Why:** Collaborative editing, remote selections, and CRDT synchronization are materially stronger with a structured editor model than with a raw textarea or HTML string.
- **Outcome:** Improvement. It is a more realistic editor model, but it required migrating earlier frontend/backend assumptions.

## 5. Session stub replaced by a real document-scoped websocket handshake

- **Changed:** The earlier PoC exposed a placeholder collaboration-session endpoint. The integrated branch now issues a real short-lived document-scoped session token and websocket URL.
- **Why:** The frontend needs a secure bridge from authenticated REST routes to the collaboration websocket without sending the long-lived access token directly over the socket query.
- **Outcome:** Improvement. The collaboration boundary is now explicit and enforceable.

## 6. Auth moved from a simple long-lived JWT flow to access token plus refresh cookie

- **Changed:** The earlier PoC used a simple bearer-token-only session model. The integrated branch now uses short-lived access tokens and a refresh cookie with silent re-authentication.
- **Why:** The core-app implementation introduced stronger session recovery, and that contract was already present in the integrated frontend auth layer.
- **Outcome:** Improvement. It gives a better user session lifecycle, especially when long-running editor sessions hit token expiry.

## 7. Collaboration persistence is hybrid: live Yjs state plus manual REST snapshot saves

- **Changed:** Live editing is synchronized through Yjs/websockets, but durable document snapshots and version history are still persisted through the REST document update / restore path instead of a fully separate collaborative checkpointing service.
- **Why:** This preserved compatibility with the existing document/version model and avoided duplicating the core-app ownership slice around version lifecycle.
- **Outcome:** Compromise. The branch is usable, but it is not yet the ideal fully integrated persistence architecture for a production collaborative editor.

## 8. Version history now supports restore, but autosave is not finalized around collaboration

- **Changed:** Core-app version restore is integrated, but the final autosave policy around collaborative sessions is not yet fully settled in this branch.
- **Why:** Core-app and realtime evolved separately. Restore was important to preserve; collaborative autosave still needs a cleaner final reconciliation.
- **Outcome:** Mixed. Restore is an improvement; autosave behavior remains a compromise until the final editor flow is locked.

## 9. Direct SQLite repository helpers are used instead of a fuller ORM-backed data layer

- **Changed:** The implementation uses direct `sqlite3` repository helpers rather than a fully realized SQLAlchemy domain model.
- **Why:** This kept both the core-app and realtime integration small enough to finish within assignment scope.
- **Outcome:** Compromise. It is fast to understand and works well for the proof of concept, but it is less extensible than a more formal data layer.

## 10. Durable offline-first editing across refresh / restart is still not implemented

- **Changed:** The branch reconnects gracefully during transient socket loss while the page remains open, but unsynced collaborative state is not persisted locally across browser refresh, tab close, or machine restart.
- **Why:** The integration prioritized working realtime collaboration, presence, and cursor sync first. Durable offline-first support would require a separate local persistence layer, such as IndexedDB-backed Yjs storage.
- **Outcome:** Compromise. Temporary disconnect recovery works; full offline-first behavior does not.

## 11. Sharing remains email-based rather than share-by-link

- **Changed:** Sharing is still managed by owner-invited users with `viewer` / `editor` roles. There is no link generation and no link revocation model.
- **Why:** The integration focused on document permissions and collaboration behavior before broadening the access-control model.
- **Outcome:** Compromise. The feature is functional, but it does not satisfy the stronger bonus-tier sharing behavior.

## 12. AI suggestions still lack partial acceptance and the final AI branch

- **Changed:** The integrated branch keeps AI compatibility routes and editor-side suggestion application, but the teammate-owned final AI workflow has not landed yet, and partial acceptance of suggestion fragments is not implemented.
- **Why:** The AI branch is still pending final push / merge.
- **Outcome:** Compromise. The collaboration/editor contract is preserved, but AI is not final on this branch.

## 13. Browser end-to-end coverage is still absent

- **Changed:** The branch has backend collaboration tests and frontend unit/integration coverage, but no Playwright/Cypress end-to-end suite.
- **Why:** The integration effort prioritized making the combined app run and sync correctly before adding full browser automation on top of a moving multi-branch codebase.
- **Outcome:** Compromise. Test coverage is meaningful, but not yet complete for the full assignment bonus path.
