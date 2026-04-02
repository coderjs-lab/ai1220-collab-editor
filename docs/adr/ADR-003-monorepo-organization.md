# ADR-003: Monorepo Organization Over Multi-Repo

## Status

Accepted

## Context

The codebase consists of three major parts: a React frontend, a Node.js backend, and shared documentation. The team has three members with distinct ownership areas. The question is whether to organize the code as a single repository (monorepo) or as separate repositories per component.

The forces at play:
- The team has three members. Cross-repo coordination (pull requests that span multiple repos, keeping versions in sync) adds overhead that is disproportionate for a small team.
- The frontend and backend share implicit contracts: the API response shapes in `frontend/src/types/api.ts` must match the backend's actual responses. Keeping them in the same repo makes contract drift visible in the same pull request.
- The assignment requires a single Git repository link for submission.
- CI/CD is minimal at this stage (no separate deployment pipelines per component).
- The backend and frontend use different runtimes (Node.js for both, but different `package.json` files and build tools), so they are not tightly coupled at the package level.

## Decision

We use a **monorepo** with the following top-level structure:

```
ai1220-collab-editor/
├── backend/      # Node.js + Express API (own package.json)
├── frontend/     # Vite + React SPA (own package.json)
└── docs/         # Architecture docs, ADRs, diagrams
```

Each component has its own `package.json` and can be installed, built, and tested independently. There is no monorepo build tool (Turborepo, Nx, Lerna) because the overhead is not justified for a three-person team with two components.

## Consequences

### Positive

- **Atomic changes.** A pull request that changes an API contract can update the backend route, the frontend type definition, and the integration test in a single commit. This eliminates the "forgot to update the other repo" class of bugs.
- **Shared visibility.** Every team member sees all changes in a single `git log`. Architecture decisions, code changes, and documentation updates are all visible together, which improves review quality.
- **Simple CI.** A single CI pipeline runs both backend tests and frontend lint/type-check. No cross-repo trigger configuration needed.
- **Assignment compliance.** The submission is a single repository link.
- **Simpler onboarding.** One `git clone` sets up the entire project.

### Negative

- **Larger clone size.** The repository includes both frontend and backend dependencies. The `.gitignore` excludes `node_modules/`, so the clone is dominated by source code and documentation, which is small.
- **Potential for unrelated changes in the same PR.** A frontend-only change and a documentation change could end up in the same PR. Mitigated by branch naming conventions (`feat/frontend-*`, `docs/<topic>`) and code ownership in reviews.
- **No independent deployment.** Both components share a single `main` branch. If independent deployment were needed, we would need to configure path-based CI triggers. This is acceptable for the PoC stage.

## Alternatives Considered

### Multi-repo (separate repos for frontend, backend, docs)

Rejected because:
- Cross-repo contract synchronization is the largest source of integration bugs in small teams.
- The team would need to manage three repositories, three sets of branch protections, and cross-repo pull request references.
- The assignment expects a single repository link.

### Monorepo with build orchestration (Turborepo / Nx)

Rejected because:
- With only two packages (frontend, backend) and no shared code package, the overhead of a monorepo tool exceeds the benefit.
- Adding Turborepo introduces configuration complexity (`turbo.json`, pipeline definitions) for marginal caching benefits on a small codebase.
- Can be revisited if the project grows to include additional packages (e.g., a shared types package, a mobile client).
