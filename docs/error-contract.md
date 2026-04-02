# Backend Error Contract (1 Apr Confirmation)

This document confirms the PoC error shape and status mapping used by the backend.

## Error Shape

All current backend errors return:

```json
{ "error": "message text" }
```

This is intentionally minimal for the PoC and matches frontend parsing in `frontend/src/services/api.ts`.

## Status Mapping

### Authentication

- `400` missing required auth fields
- `401` invalid credentials or missing/invalid bearer token
- `404` authenticated user not found (`/api/auth/me`)
- `409` duplicate username/email on register

### Documents

- `400` invalid update payload (`Nothing to update`)
- `403` access denied or insufficient role
- `404` document not found

### Sharing / Access

- `400` invalid share payload or self-share attempt
- `403` caller is not document owner for share/revoke
- `404` document/user not found

### Session Token Stub

- `403` no permission to access document session
- `404` document not found

### AI Stub

- `400` missing prompt
- `404` document not found

## Known PoC Limitation

- Machine-readable `error.code` envelopes are not yet implemented.
- This is deferred to a later milestone to avoid breaking already integrated frontend flows.

