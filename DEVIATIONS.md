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

## 7. Collaboration persistence is hybrid: live Yjs state plus REST-backed autosave snapshots

- **Changed:** Live editing is synchronized through Yjs/websockets, while durable document snapshots and version history are persisted through autosaved REST document updates plus explicit restore operations.
- **Why:** This preserved compatibility with the core-app document/version model without introducing a second persistence subsystem just for collaborative checkpoints.
- **Outcome:** Mixed. It is an improvement over manual-save-only behavior and satisfies the assignment workflow, but it is still a hybrid persistence model rather than a fully CRDT-native storage stack.

## 8. Version history now coexists with autosave instead of manual-save-only editing

- **Changed:** The integrated editor now autosaves after a short debounce while still allowing an immediate manual save action for explicit checkpoints. Earlier branch states were manual-save-only.
- **Why:** Assignment 2 requires autosave, and the collaborative editor needed a save policy that works with realtime typing instead of relying on users to remember a save button.
- **Outcome:** Improvement. It gives a more credible editor workflow while preserving the existing restore-based version history.

## 9. Direct SQLite repository helpers are used instead of a fuller ORM-backed data layer

- **Changed:** The implementation uses direct `sqlite3` repository helpers rather than a fully realized SQLAlchemy domain model.
- **Why:** This kept both the core-app and realtime integration small enough to finish within assignment scope.
- **Outcome:** Compromise. It is fast to understand and works well for the proof of concept, but it is less extensible than a more formal data layer.

## 10. Offline editing now uses IndexedDB-backed Yjs persistence

- **Changed:** The earlier integrated branch only survived transient socket drops while the tab stayed open. The current implementation persists collaborative Yjs state locally with IndexedDB so edits survive reload and sync back after reconnection.
- **Why:** Graceful degradation with sync-on-reconnect is part of the Assignment 2 collaboration bonus path, and a purely in-memory reconnect story was not enough.
- **Outcome:** Improvement. The app now has a credible offline-first behavior for a single-device proof of concept, though it is still not a multi-device sync queue.

## 11. Sharing now supports both direct invites and share-by-link

- **Changed:** The integrated branch keeps owner-managed direct sharing by username/email and now also supports share-link generation, acceptance, and revocation with `viewer` / `editor` roles.
- **Why:** The assignment bonus path explicitly rewards link-based sharing with permission control and revocation.
- **Outcome:** Improvement. This broadens the access model without replacing the simpler direct-invite flow.

## 12. Planned Express plus sidecar AI service replaced with FastAPI-integrated provider abstraction

- **Changed:** The Assignment 1 direction and teammate AI branch both assumed an Express-facing AI route with a separate `ai-service`. The final integrated branch keeps AI inside the FastAPI backend and abstracts provider calls behind `backend/app/ai_provider.py`.
- **Why:** The assignment constrains the backend to FastAPI, and keeping the assistant inside the existing auth/document backend avoids a second app boundary during integration.
- **Outcome:** Improvement. The backend now satisfies the technology constraint directly, and provider swaps are isolated to one module.

## 13. AI suggestions now stream through SSE with explicit decision tracking

- **Changed:** Earlier branch states used blocking AI suggestion calls. The final integrated branch streams suggestion chunks with `text/event-stream`, supports cancellation, and records generated / accepted / edited / partial / rejected outcomes per interaction.
- **Why:** Assignment 2 makes streaming non-negotiable and requires accept/reject history instead of fire-and-forget replacement.
- **Outcome:** Improvement. The AI workflow is materially closer to a real editor and now matches the required UX contract.

## 14. Partial suggestion acceptance is implemented through selected-fragment review rather than inline tracked changes

- **Changed:** Instead of a tracked-changes diff model, the final branch lets users review pre-split suggestion parts and also highlight an exact substring inside the AI suggestion textarea, then accept / reject / reset that selected fragment before applying only the accepted output into the collaborative editor.
- **Why:** This satisfies the partial-acceptance bonus path without colliding with the realtime editor architecture already built around Tiptap + Yjs.
- **Outcome:** Mixed. Improvement because the bonus feature exists and works inside the shared editor path; compromise because the UI is simpler than a full tracked-changes model.

## 15. Browser end-to-end coverage now uses Playwright rather than remaining purely unit/integration level

- **Changed:** The branch now includes a Playwright E2E flow that exercises registration, document creation, share-by-link acceptance, realtime collaboration, and autosave persistence.
- **Why:** The bonus path explicitly rewards end-to-end coverage across the real browser workflow instead of relying only on backend and component tests.
- **Outcome:** Improvement. Verification is now materially stronger, though the current suite is intentionally focused on the highest-value core/realtime path rather than exhaustive UI permutations.
