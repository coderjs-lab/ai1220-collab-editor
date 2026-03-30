# Authentication & Authorization Design

## Overview

The system uses **stateless JWT authentication**. No server-side session store is required, which keeps the backend horizontally scalable and simple to deploy.

## Auth Flow

```
Client                          Backend
  |                                |
  |-- POST /api/auth/register ---> |  bcrypt.hash(password) → INSERT users
  |<-- { user, token } ----------- |  jwt.sign({ id, email }, SECRET, 7d)
  |                                |
  |-- POST /api/auth/login ------> |  bcrypt.compare → jwt.sign
  |<-- { user, token } ----------- |
  |                                |
  |-- GET /api/... (Bearer token)->|  jwt.verify → req.user = { id, email }
  |<-- resource ------------------- |
```

## Token

| Field | Value |
|-------|-------|
| Algorithm | HS256 |
| Payload | `{ id, email, iat, exp }` |
| Expiry | 7 days |
| Transmission | `Authorization: Bearer <token>` header |

Tokens are **not** stored server-side. Revocation is handled by expiry; explicit logout is a client-side concern (discard the token).

## Password Storage

Passwords are hashed with **bcrypt** (salt rounds = 10) before storage. The plaintext password never leaves the `register`/`login` handlers.

## Authorization (Access Control)

Document access is resolved by `resolveDoc()` in `routes/documents.js`:

```
owner_id === req.user.id  →  full access (owner)
permissions row exists    →  access at the granted role
otherwise                 →  403 Forbidden
```

Role hierarchy: `viewer < editor`. Write operations (`PUT`, `DELETE /share`) require `editor` or above. Delete document requires `owner`.

### Permission Model

```
users ──< permissions >── documents
              role: viewer | editor
```

Owners are NOT stored in `permissions`; ownership is tracked on `documents.owner_id`. This avoids the need for a special "owner" role entry and keeps the permission check simple.

## Non-Functional Considerations

- **HTTPS**: JWT confidentiality depends on transport encryption. The backend must be served over HTTPS in production (handled by the deployment layer, not the app).
- **SECRET rotation**: If `JWT_SECRET` is rotated, all existing tokens become invalid — effectively a forced logout for all users.
- **Future: refresh tokens**: The current 7-day expiry is a trade-off between UX and security. If shorter lifetimes are required, a refresh-token endpoint can be added without changing the rest of the auth design.
