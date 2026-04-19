# Traceability Matrix

This matrix maps the final integrated Assignment 2 implementation to the delivered user stories, functional requirements, primary implementation artifacts, and verification coverage.

It supersedes the earlier Express-era traceability notes. The current system is the integrated `main` branch implementation built on FastAPI, React, websocket collaboration, and the AI assistant flow documented in [DEVIATIONS.md](../DEVIATIONS.md).

## User Stories -> Functional Requirements -> Implementation

| ID | Functional Requirement | User Story | Primary Implementation | Verification |
|----|------------------------|------------|------------------------|--------------|
| FR-AUTH-01 | The system shall allow users to register and log in with email/password credentials. | As a user, I want to register and log in so that my documents are private to me. | `backend/app/routers/auth.py`, `backend/app/security.py`, `frontend/src/features/auth/AuthPage.tsx` | `backend/tests/test_api.py`, `backend/tests/test_security.py`, `frontend/src/features/auth/AuthPage.test.tsx` |
| FR-AUTH-02 | The system shall recover user sessions without forcing repeated login during normal use. | As a user, I want my session to persist across reloads while keeping auth scoped to me. | `backend/app/routers/auth.py`, `frontend/src/app/AuthProvider.tsx`, `frontend/src/services/api.ts` | `backend/tests/test_api.py`, `frontend/src/features/editor/EditorPage.test.tsx` |
| FR-DOC-01 | The system shall let authenticated users create, list, open, update, and delete documents they can access. | As a user, I want to create and manage my documents in one workspace. | `backend/app/routers/documents.py`, `backend/app/repository.py`, `frontend/src/features/documents/DocumentsPage.tsx`, `frontend/src/features/editor/EditorPage.tsx` | `backend/tests/test_api.py`, `frontend/src/features/editor/EditorPage.test.tsx`, `frontend/e2e/core-realtime.spec.ts` |
| FR-DOC-02 | The system shall provide a rich-text editor with autosave and a manual save override. | As a user, I want to edit a document naturally and keep changes persisted. | `frontend/src/features/editor/CollaborativeEditorAdapter.tsx`, `frontend/src/features/editor/useCollaborativeEditor.ts`, `backend/app/routers/documents.py` | `frontend/src/features/editor/EditorPage.test.tsx`, `frontend/e2e/core-realtime.spec.ts` |
| FR-DOC-03 | The system shall record document versions and allow users to browse and restore earlier snapshots. | As a user, I want to inspect version history and restore an earlier state. | `backend/app/routers/documents.py`, `backend/app/repository.py`, `frontend/src/features/editor/EditorPage.tsx` | `backend/tests/test_api.py`, `frontend/src/features/editor/EditorPage.test.tsx`, `frontend/e2e/core-realtime.spec.ts` |
| FR-ACL-01 | The system shall support owner-managed direct sharing with `owner`, `editor`, and `viewer` roles. | As a document owner, I want to invite collaborators and control whether they can edit. | `backend/app/routers/access.py`, `backend/app/repository.py`, `frontend/src/features/editor/EditorPage.tsx` | `backend/tests/test_api.py`, `backend/tests/test_permissions.py`, `frontend/e2e/core-realtime.spec.ts` |
| FR-ACL-02 | The system shall support share-by-link creation, acceptance, and revocation with role control. | As a document owner, I want to share by link and revoke that link later. | `backend/app/routers/share_links.py`, `frontend/src/features/documents/AcceptShareLinkPage.tsx`, `frontend/src/features/editor/EditorPage.tsx` | `backend/tests/test_api.py`, `frontend/e2e/core-realtime.spec.ts` |
| FR-COL-01 | The system shall issue a document-scoped collaboration session and authenticate websocket connections. | As a collaborator, I want the editor to join the shared session securely before syncing. | `backend/app/routers/sessions.py`, `backend/app/main.py`, `frontend/src/features/editor/useCollaborationSession.ts` | `backend/tests/test_api.py`, `backend/tests/test_realtime_foundation.py` |
| FR-COL-02 | The system shall expose presence and awareness information for active collaborators. | As a user, I want to see who is present and who is actively typing in the shared document. | `frontend/src/features/editor/CollaborationPanel.tsx`, `frontend/src/features/editor/useCollaborativeEditor.ts`, `backend/app/realtime.py` | `backend/tests/test_api.py`, `frontend/e2e/core-realtime.spec.ts` |
| FR-COL-03 | The system shall support concurrent collaborative editing without silent data loss. | As a user, I want multiple editors to update the same document simultaneously without conflicts. | `backend/app/realtime.py`, `frontend/src/features/editor/useCollaborativeEditor.ts`, `frontend/src/features/editor/CollaborativeEditorAdapter.tsx` | `backend/tests/test_realtime_foundation.py`, `frontend/e2e/core-realtime.spec.ts` |
| FR-COL-04 | The system shall degrade gracefully offline and resynchronize changes after reconnect. | As a user, I want to keep editing through a connection drop and recover cleanly on reconnect. | `frontend/src/features/editor/useCollaborativeEditor.ts` with IndexedDB-backed Yjs persistence, `backend/app/realtime.py` | `backend/tests/test_realtime_foundation.py`, `frontend/e2e/core-realtime.spec.ts` |
| FR-AI-01 | The system shall generate AI suggestions for rewrite, summarize, expand, grammar-fix, and custom-prompt flows, including streaming responses. | As a user, I want the assistant to help me rewrite or generate text inside the editor workflow. | `backend/app/routers/ai.py`, `backend/app/ai_service.py`, `backend/app/ai_provider.py`, `frontend/src/features/ai/useDocumentAi.ts`, `frontend/src/features/ai/AIAssistantPanel.tsx` | `backend/tests/test_api.py`, `frontend/src/features/ai/AIAssistantPanel.test.tsx`, `frontend/e2e/ai-assistant.spec.ts` |
| FR-AI-02 | The system shall let users compare, edit, accept, reject, undo, and partially apply AI output through the collaborative editor path. | As a user, I want AI output to be reviewable before it changes the shared document. | `frontend/src/features/ai/AIAssistantPanel.tsx`, `frontend/src/features/editor/EditorPage.tsx`, `frontend/src/features/editor/useCollaborativeEditor.ts` | `frontend/src/features/ai/AIAssistantPanel.test.tsx`, `frontend/src/features/editor/EditorPage.test.tsx`, `frontend/e2e/ai-assistant.spec.ts` |
| FR-AI-03 | The system shall persist AI interaction history and the user's decision on that interaction. | As a user, I want to see prior AI suggestions and whether I accepted, rejected, or partially used them. | `backend/app/repository.py`, `backend/app/routers/ai.py`, `frontend/src/features/ai/AIAssistantPanel.tsx` | `backend/tests/test_api.py`, `frontend/src/features/ai/AIAssistantPanel.test.tsx` |
| FR-AI-04 | The system shall scope AI context to the relevant selection/section/document and isolate provider-specific logic behind a backend abstraction. | As a team, we want AI integration to remain configurable without rewriting the editor or route contracts. | `backend/app/ai_prompts.py`, `backend/app/ai_provider.py`, `backend/app/ai_service.py`, `frontend/src/features/ai/useDocumentAi.ts` | `backend/tests/test_ai_prompts.py`, `backend/tests/test_api.py` |
| FR-QA-01 | The backend shall be covered by unit tests, API integration tests, and websocket tests. | As a maintainer, I want backend behavior verified before merging changes. | `backend/tests/test_security.py`, `backend/tests/test_permissions.py`, `backend/tests/test_api.py`, `backend/tests/test_realtime_foundation.py` | `backend/.venv/bin/python -m pytest` |
| FR-QA-02 | The frontend shall be covered by component tests, and browser E2E tests shall exercise the main editor workflows. | As a maintainer, I want UI regressions caught in both isolated and end-to-end flows. | `frontend/src/features/auth/AuthPage.test.tsx`, `frontend/src/features/editor/EditorPage.test.tsx`, `frontend/src/features/ai/AIAssistantPanel.test.tsx`, `frontend/e2e/*.spec.ts` | `npm --prefix frontend test`, `npm --prefix frontend run test:e2e` |
| FR-QA-03 | The repository shall provide a one-command local run path, example env files, API docs, and explicit architecture-deviation documentation. | As a reviewer, I want to run, inspect, and understand the project without reverse-engineering the setup. | `run.sh`, `backend/.env.example`, `frontend/.env.example`, `backend/app/main.py`, `backend/app/schemas.py`, `README.md`, `DEVIATIONS.md` | `./run.sh`, FastAPI `/docs` and `/redoc`, README setup instructions |

## Requirement Coverage Summary

| Requirement ID | Area | Status | Notes |
|----------------|------|--------|-------|
| FR-AUTH-01 | Authentication | Implemented | Register, login, logout, and current-user lookup are live on FastAPI routes. |
| FR-AUTH-02 | Session recovery | Implemented | Short-lived access token plus refresh-cookie flow is integrated with the React auth provider. |
| FR-DOC-01 | Document CRUD | Implemented | Documents can be created, listed, opened, edited, and deleted subject to access control. |
| FR-DOC-02 | Rich-text editing and autosave | Implemented | Tiptap-based editor, autosave, and explicit save action coexist. |
| FR-DOC-03 | Version history and restore | Implemented | Snapshot history is exposed and restore updates the live collaborative editor state. |
| FR-ACL-01 | Direct sharing and roles | Implemented | Owner/editor/viewer permissions are enforced on both REST and collaboration paths. |
| FR-ACL-02 | Share-by-link | Implemented | Link generation, acceptance, and revocation are part of the delivered access model. |
| FR-COL-01 | Collaboration handshake | Implemented | REST-issued session token gates websocket entry per document. |
| FR-COL-02 | Presence and awareness | Implemented | Presence list, typing/activity indicators, and remote cursor metadata are surfaced in the editor UI. |
| FR-COL-03 | Conflict-free realtime editing | Implemented | Yjs plus `ypy-websocket` provides CRDT-based sync instead of ad hoc last-write-wins patches. |
| FR-COL-04 | Offline editing and reconnect | Implemented | IndexedDB-backed local Yjs state survives reload and synchronizes on reconnect. |
| FR-AI-01 | AI generation and streaming | Implemented | Stub and live-provider paths exist behind the same FastAPI AI surface. |
| FR-AI-02 | AI review/apply workflow | Implemented | Full apply, fragment apply, reject, undo, and partial acceptance are supported. |
| FR-AI-03 | AI history and decisions | Implemented | Each interaction records source context, prompt, response, model, and final decision state. |
| FR-AI-04 | AI context strategy and provider abstraction | Implemented | Prompt construction and provider calls are separated from route handlers and UI components. |
| FR-QA-01 | Backend testing | Implemented | Unit, API, and websocket coverage are part of the repo test suite. |
| FR-QA-02 | Frontend testing | Implemented | Component tests and Playwright E2E coverage exist for the core editor and AI workflows. |
| FR-QA-03 | Setup and documentation | Implemented | Run script, env examples, API docs, README, and deviations are all present. |

## Bonus Coverage Summary

| Bonus Item | Status | Primary Implementation |
|------------|--------|------------------------|
| Character-level conflict resolution with CRDTs | Implemented | `backend/app/realtime.py`, `frontend/src/features/editor/useCollaborativeEditor.ts` |
| Remote cursor and selection rendering | Implemented | `frontend/src/features/editor/useCollaborativeEditor.ts`, `frontend/src/styles.css` |
| Share-by-link with permission control and revocation | Implemented | `backend/app/routers/share_links.py`, `frontend/src/features/editor/EditorPage.tsx`, `frontend/src/features/documents/AcceptShareLinkPage.tsx` |
| Partial acceptance of AI suggestions | Implemented | `frontend/src/features/ai/AIAssistantPanel.tsx`, `frontend/src/features/editor/EditorPage.tsx` |
| End-to-end browser coverage | Implemented | `frontend/e2e/core-realtime.spec.ts`, `frontend/e2e/ai-assistant.spec.ts` |

## Related Documents

- [README.md](../README.md)
- [DEVIATIONS.md](../DEVIATIONS.md)
- [docs/realtime-contract.md](./realtime-contract.md)
- `docs/adr/ADR-001-synchronization-strategy.md`
- `docs/adr/ADR-002-ai-context-strategy.md`
- `docs/adr/ADR-004-versioning-data-retention.md`
