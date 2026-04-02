# Repository Structure (Section 2.3 Support)

This document captures the concrete code organization used in the PoC and maps it to the architecture write-up.

## Monorepo Choice

We use a single repository (`editor/`) for frontend and backend.

Why this fits a 3-person team:

- Shared API contract updates are visible in one PR.
- Cross-layer changes (frontend + backend + docs) can be reviewed together.
- No extra release choreography between separate repos for the PoC.

## Top-Level Layout

```text
editor/
├── backend/
│   ├── src/
│   │   ├── app.js                 # router wiring + middleware
│   │   ├── server.js              # process entrypoint
│   │   ├── db/                    # sqlite init + schema
│   │   ├── middleware/            # authmw
│   │   ├── routes/                # doc_api, access_api, session_api, ai_api, auth_api
│   │   ├── services/              # doc_service, ai_service, auth_service
│   │   └── repositories/          # doc_repo, user_repo
│   └── test/
│       └── integration.test.js    # PoC end-to-end API verification
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   ├── components/
│   │   ├── services/              # API client and local storage
│   │   └── types/
│   └── index.html
└── docs/
    ├── traceability.md
    ├── auth-design.md
    ├── erd.mmd
    └── error-contract.md
```

## Shared Code and Contract Boundary

- Shared runtime package is intentionally avoided in the PoC to keep setup minimal.
- API request/response shape is synchronized through:
  - backend route payloads (`backend/src/routes/*.js`)
  - frontend API typings (`frontend/src/types/api.ts`)
  - README/API docs

## Configuration and Secrets

- Backend: `.env` (`JWT_SECRET`, optional `PORT`, optional `DB_PATH`)
- Frontend: `.env.local` (`VITE_API_BASE_URL`)
- Secrets policy:
  - no credentials in source files
  - `.env` excluded via `.gitignore`

## Testing Structure

- Backend integration tests: `backend/test/integration.test.js`
- Frontend verification for this milestone: type-check + production build (`npm run build`)
- Real external LLM API calls are deferred; AI tests run against stub behavior.

