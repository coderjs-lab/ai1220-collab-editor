# Architecture Deviations

This document records the intentional differences between the Assignment 1 design package and the final Assignment 2 implementation.

## 1. Backend runtime migrated from Express to FastAPI

- **Changed:** The original PoC backend was Node.js + Express. The implementation now uses Python + FastAPI in `backend/app`.
- **Why:** Assignment 2 explicitly requires a FastAPI backend. Migrating early keeps the actual implementation aligned with the rubric instead of documenting a silent exception.
- **Outcome:** Improvement for assignment compliance. The API route shapes were preserved under `/api/...` so the React frontend and teammate-owned AI/collaboration entry points did not need a full contract rewrite.

## 2. Auth moved from long-lived JWTs to access-token plus refresh-cookie flow

- **Changed:** The PoC used a single 7-day JWT stored in local storage. The implementation now uses short-lived access tokens and rotating refresh tokens stored in an HTTP-only cookie.
- **Why:** Assignment 2 requires JWT access tokens with silent re-authentication and graceful expiry handling during editing.
- **Outcome:** Improvement for security and UX. The frontend refreshes transparently and retries one protected request after a 401 before signing the user out.

## 3. Plain textarea editing became Tiptap rich-text editing

- **Changed:** The PoC editor was a plain `<textarea>` with manual save. The implementation now uses Tiptap StarterKit and stores serialized HTML in `document.content`.
- **Why:** Assignment 2 requires rich-text editing with headings, bold, italic, lists, and code blocks, plus autosave.
- **Outcome:** Improvement for feature completeness. The API contract still exposes `content` as a string, but that string is now HTML instead of plain text.

## 4. Version history now supports restore

- **Changed:** The PoC only listed previous versions. The implementation adds `POST /api/documents/{id}/versions/{version_id}/restore`.
- **Why:** Version restore is a core Assignment 2 expectation for Luka's ownership slice.
- **Outcome:** Improvement for document lifecycle support. Restoring snapshots the current draft first, so restores remain reversible.

## 5. Collaboration session endpoint stays stubbed

- **Changed:** The implementation still returns a stub collaboration session token instead of a live WebSocket handoff.
- **Why:** Real-time collaboration transport remains outside Luka's ownership slice for this phase, and the existing frontend already treats the session endpoint as readiness-only.
- **Outcome:** Acceptable compromise. Auth and access control for the route are enforced server-side, but the actual sync transport is still teammate-owned work.
