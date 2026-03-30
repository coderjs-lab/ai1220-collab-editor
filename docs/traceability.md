# Traceability Matrix

Maps every user story to its functional requirement(s) and the backend component(s) that implement it.

## User Stories → Functional Requirements → Components

| ID | User Story | Functional Requirement | Backend Component |
|----|------------|------------------------|-------------------|
| US-01 | As a user, I want to register and log in so that my documents are private to me. | FR-01: The system shall authenticate users with email and password. | `routes/auth.js` → `POST /api/auth/register`, `POST /api/auth/login` |
| US-02 | As a user, I want my session to persist across page reloads without re-entering my password. | FR-02: The system shall issue a JWT valid for 7 days on successful authentication. | `routes/auth.js` → `makeToken()`, JWT middleware |
| US-03 | As a user, I want to create a new document and give it a title. | FR-03: The system shall allow authenticated users to create documents. | `routes/documents.js` → `POST /api/documents` |
| US-04 | As a user, I want to open and read any document I own or have been invited to. | FR-04: The system shall return document content only to authorized users. | `routes/documents.js` → `GET /api/documents/:id`, `resolveDoc()` |
| US-05 | As a user, I want to edit a document and have my changes saved. | FR-05: The system shall allow editors to update document content. | `routes/documents.js` → `PUT /api/documents/:id` |
| US-06 | As a user, I want to see a list of all documents I have access to. | FR-06: The system shall return all documents owned by or shared with the caller. | `routes/documents.js` → `GET /api/documents` |
| US-07 | As a document owner, I want to invite another user by email and assign them a role (viewer or editor). | FR-07: The system shall allow owners to grant per-document access with a role. | `routes/documents.js` → `POST /api/documents/:id/share` |
| US-08 | As a document owner, I want to revoke a collaborator's access at any time. | FR-08: The system shall allow owners to delete a permission entry. | `routes/documents.js` → `DELETE /api/documents/:id/share/:userId` |
| US-09 | As a viewer, I should be able to read but not edit a shared document. | FR-09: The system shall enforce role-based write protection. | `resolveDoc(req, res, 'editor')` in update/delete handlers |
| US-10 | As a user, I want to browse the version history of a document and restore an older snapshot. | FR-10: The system shall record a content snapshot on every save and expose the history via API. | `routes/documents.js` → `GET /api/documents/:id/versions`, version insert in `PUT` |
| US-11 | As a user, I want to ask the AI assistant to rewrite, summarize, or continue my text. | FR-11: The system shall accept a natural-language prompt in the context of a document and return an AI-generated suggestion. | `routes/ai.js` → `POST /api/documents/:id/ai/suggest` *(LLM call deferred)* |
| US-12 | As a user, I want to see a log of past AI interactions on a document. | FR-12: The system shall persist every AI prompt and response and return them on request. | `routes/ai.js` → `GET /api/documents/:id/ai/history`, `ai_interactions` table |
| US-13 | As a user, I want multiple people to edit the same document simultaneously without conflicts. | FR-13: The system shall support real-time concurrent editing via WebSocket and CRDT-based conflict resolution. | *(Planned: WebSocket layer + CRDT — deferred to later milestone)* |

## Requirement Coverage Summary

| Functional Requirement | Status |
|------------------------|--------|
| FR-01 Auth — register/login | Implemented |
| FR-02 Auth — JWT session | Implemented |
| FR-03 Document create | Implemented |
| FR-04 Document read with auth | Implemented |
| FR-05 Document update (editors only) | Implemented |
| FR-06 Document list | Implemented |
| FR-07 Sharing — grant access | Implemented |
| FR-08 Sharing — revoke access | Implemented |
| FR-09 Role-based write protection | Implemented |
| FR-10 Version history | Implemented |
| FR-11 AI suggest | Stub (LLM deferred) |
| FR-12 AI history log | Implemented |
| FR-13 Real-time collaboration | Deferred |
