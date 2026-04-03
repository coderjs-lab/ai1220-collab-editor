# ADR-003: Monorepo Over Multi-Repository Organisation

## Status

Accepted

## Context

The system is built by a three-person team: Harmanjot (frontend SPA), Zhengxi (backend REST API), and Luka (architecture, documentation). The highest-risk integration boundary in the entire codebase is the contract between the React SPA and the Express REST API — the set of request/response shapes that both sides must agree on exactly.

The assignment rubric explicitly penalises discrepancies between the written API contract and running code. Any strategy that makes it easy for the frontend and backend to drift apart is directly correlated with a mark penalty, making contract alignment a first-class architectural concern for this project.

**Forces at play:**

- **Integration risk.** The `frontend/src/types/api.ts` file must mirror every backend response shape exactly. In separate repositories, a backend route change could ship without the corresponding frontend type update ever being caught — only discovered at demo time.
- **Cross-layer change visibility.** The assignment rewards consistency between code, documentation, and diagrams. A change to the API contract touches: the backend route, the frontend type, the README API table, the traceability matrix, and potentially the C4 component diagram. In a monorepo, all of these are in one pull request and one review.
- **Coordination overhead.** Separate repositories require coordinated releases, cross-repo pull request references, duplicate CI pipeline setup, and synchronised `npm install` onboarding steps. For a three-person team on a one-week sprint, this overhead is unjustifiable.
- **Documentation co-location.** The `docs/` directory contains architecture documents, ADRs, ERDs, and NFRs that describe behaviour implemented in both `frontend/` and `backend/`. Co-locating documentation with code ensures that the "docs drift" failure mode (where code is updated but docs are not) is visible in the same diff.
- **PoC simplicity.** The PoC does not yet have separate deployment pipelines for the frontend SPA (static hosting) and backend API (Node.js server). There is no operational reason to maintain separate repos at this stage.

## Decision

We use a **single monorepo** (`editor/`) containing `backend/`, `frontend/`, and `docs/` as first-class sibling directories. The directory layout is:

```
editor/
├── backend/    Node.js + Express REST API (owned by Zhengxi)
├── frontend/   Vite + React + TypeScript SPA (owned by Harmanjot)
└── docs/       Architecture docs, ADRs, ERD, NFRs (owned by Luka)
```

The API contract boundary is enforced through three synchronised artefacts rather than a shared runtime package:

1. **Backend route payloads** — `backend/src/routes/*.js` define the actual JSON shapes emitted.
2. **Frontend type definitions** — `frontend/src/types/api.ts` mirrors every response shape; TypeScript enforces alignment at compile time (`tsc --noEmit` in the build step).
3. **Documented contract** — the README API table and this report serve as the human-readable source of truth reviewed during QA.

No shared npm package is maintained for types in the PoC. This is a deliberate choice: premature abstraction into a `@draftboard/types` workspace package adds a build pipeline step (package publish or `npm link`) before any productive coding. The two-file synchronisation approach achieves the same contract enforcement with less friction at this team size and timeline.

## Consequences

### Positive

- **API contract drift is caught in review.** A backend route payload change and the corresponding frontend type update appear in the same pull request diff. A reviewer who approves the PR without updating both is explicitly accepting the drift — it cannot happen silently.
- **Report, diagrams, and code are co-located.** The final QA pass (run by Luka on the final day) can verify cross-section consistency — C4 component names matching route file names, traceability matrix IDs matching FR table IDs — in a single repository checkout.
- **Single CI pipeline.** The root-level workflow runs `npm --prefix backend test` (23/23 integration tests), `npm --prefix frontend run build` (TypeScript type-check + Vite production build), and lint in one pass. A single green badge confirms the full stack is coherent.
- **Zero coordination overhead for PoC.** There are no cross-repository pull request references, no separate release tags to coordinate, and no divergent `node_modules` setups to maintain across multiple repos.
- **Branching strategy stays simple.** Feature branches (`feat/`, `fix/`, `docs/`) work across all three directories without repo-specific conventions.

### Negative

- **Monorepo tooling debt at scale.** As the system grows and the frontend SPA, backend API, and Collaboration Server acquire separate deployment lifecycles, the monorepo will require workspace tooling (Turborepo, Nx, or pnpm workspaces) to manage independent build caches and deployment pipelines. This is a documented post-PoC concern.
- **No access control between owners.** All three team members can see and modify all branches across all concerns. Acceptable for a three-person academic team; undesirable in a larger organisation with stricter separation of responsibilities.
- **Long-term pressure to split.** When the Collaboration Server (planned in C4 Level 2) is built as a separately deployable Socket.IO container, it will have its own operational lifecycle and may warrant its own repository. The monorepo structure does not prevent this future split — the directory boundaries are clean — but it means the split will require explicit effort rather than being the default.

## Alternatives Considered

### Multi-repo (frontend + backend + docs in separate repositories)

**Rejected because:**
- API contract changes require coordinated pull requests across two repositories. For a three-person, one-week sprint where contract drift is a direct rubric penalty, this coordination overhead adds risk to the primary integration concern without any offsetting benefit.
- Cross-layer documentation consistency (report + code + diagrams) is harder to enforce when documentation lives in a separate repository from the code it describes.
- Separate CI pipelines must be set up and maintained independently; a breaking backend change may not immediately surface as a failing frontend CI run.

### Shared npm package for API types (`@draftboard/types`)

**Rejected for the PoC because:**
- Creates a build pipeline dependency: the types package must be published (or linked via npm workspaces) before the frontend or backend can install it. This adds a bootstrapping step before any productive coding.
- For a PoC with a small, stable API surface, the overhead of publishing and versioning a package is not justified. The `types/api.ts` ↔ `routes/*.js` two-file approach achieves the same contract enforcement.
- Documented as the natural next step if the API surface grows significantly across multiple milestones and the shared type definitions become too large to maintain as a single file.
