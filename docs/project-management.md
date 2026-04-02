# Project Management & Team Collaboration

---

## 3.1 Team Structure & Ownership

### Team Members and Roles

| Member | Primary role | Ownership area |
|--------|-------------|----------------|
| **Harmanjot Singh** | Frontend and requirements lead | Frontend SPA (React, editor UI, auth pages, documents dashboard), functional requirements, user stories, traceability draft |
| **Zhengxi** | Backend core, API, and data lead | Backend API (Express, routes, middleware), database schema, auth/authorization design, integration tests, README |
| **Luka** | Architecture, AI design, and documentation integration lead | C4 diagrams, architectural drivers, AI integration design, communication model, NFRs, ADRs, project management sections, final QA |

### Code Ownership Map

| Directory / File | Primary owner | Reviewer |
|-----------------|---------------|----------|
| `frontend/src/` | Harmanjot | Zhengxi |
| `frontend/src/types/api.ts` | Harmanjot (structure), Zhengxi (contract alignment) | Luka |
| `backend/src/` | Zhengxi | Harmanjot |
| `backend/test/` | Zhengxi | Luka |
| `docs/traceability.md` | Harmanjot | Luka |
| `docs/auth-design.md` | Zhengxi | Luka |
| `docs/architectural-drivers.md` | Luka | Harmanjot |
| `docs/c4-diagrams.md` | Luka | Zhengxi |
| `docs/ai-integration-design.md` | Luka | Zhengxi |
| `docs/communication-model.md` | Luka | Harmanjot |
| `docs/nfr.md` | Luka | Zhengxi |
| `docs/feature-decomposition.md` | Luka | All |
| `docs/adr/` | Luka | Zhengxi + Harmanjot |
| `docs/project-management.md` | Luka | All |
| `README.md` | Zhengxi | All |

### Handling Cross-Cutting Features

The AI assistant is the primary cross-cutting feature: it touches the frontend (suggestion UI), the backend (API route, LLM gateway), and the architecture (prompt design, cost strategy, privacy). Ownership is split:

- **Luka** owns the design (AI integration design document, ADR-002 on context strategy, communication model for AI during collaboration).
- **Zhengxi** owns the implementation (API route `routes/ai.js`, database schema for `ai_interactions`, future LLM integration).
- **Harmanjot** owns the frontend UX (AI suggestion display, accept/reject flow, quota-exceeded UI).

Changes to the AI feature require a pull request that is reviewed by at least two of the three owners.

### Decision-Making Process

When team members disagree on a technical choice:

1. **Document the options.** The proposer writes a brief comparison (2–3 paragraphs) in a GitHub issue or in the `docs/adr/` folder as a draft ADR.
2. **Time-boxed discussion.** The team discusses for at most 15 minutes in the next sync meeting. Each member states their preference and reasoning.
3. **Default to the primary owner.** If no consensus is reached, the primary owner of the affected component makes the final call. The decision is recorded as an ADR or a comment in the relevant issue.
4. **Revisit clause.** Any decision can be revisited if new evidence emerges, but the burden of proof is on the person requesting the change.

---

## 3.2 Development Workflow

### Branching Strategy

We use **feature branches** off `main`:

| Branch type | Naming convention | Example |
|------------|-------------------|---------|
| Feature | `feat/<area>-<short-description>` | `feat/frontend-editor-shell` |
| Documentation | `docs/<topic>` | `docs/c4-architecture` |
| Bug fix | `fix/<area>-<short-description>` | `fix/api-share-validation` |
| Traceability / contract | `docs/traceability`, `fix/api-contract` | — |

**Merge policy:**
- All branches merge into `main` via pull request.
- No direct pushes to `main`.
- Squash merge is preferred for feature branches to keep `main` history clean.
- No PoC branch may be merged unless the request and response schema match the written contract in the report.

### Code Review Process

| Criterion | Requirement |
|-----------|-------------|
| **Who reviews** | At least one team member who is *not* the primary owner of the changed code |
| **Turnaround** | Reviews should be completed within 12 hours during active development days |
| **Approval criteria** | Code compiles/lints, tests pass, API contracts match documentation, no unintended scope creep |
| **PR description** | Must mention: what changed, what part of the rubric it supports, any screenshots or sample JSON, and what still remains |

### Commit Message Convention

Following the existing convention established in `AGENTS.harman.md`:

```
<type>(<scope>): <short summary>

<optional body>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
Scopes: `frontend`, `backend`, `docs`, `shared`.

Examples:
- `feat(backend): add version snapshot on document update`
- `docs(architecture): add C4 Level 2 container diagram`
- `fix(frontend): handle 403 on shared document access`

### Issue Tracking and Task Assignment

- **GitHub Issues** are used for task tracking. Each issue is labeled with the rubric section it addresses (e.g., `part-1`, `part-2-architecture`, `part-3-pm`, `part-4-poc`).
- Issues are assigned to the primary owner from the ownership table above.
- A GitHub Project board with three columns (To Do, In Progress, Done) tracks progress.
- Each team member moves their own issues through the board during daily syncs.

### Communication

| Tool | Purpose |
|------|---------|
| **Discord** | Real-time chat, quick questions, daily sync meetings |
| **GitHub Issues + PRs** | All technical decisions, code review, task tracking |
| **Google Drive** | Shared report document, diagram source files, meeting notes |
| `docs/adr/` folder | Persistent record of architectural decisions (not lost in chat) |

Two short syncs run each day until submission: a 10–15 minute morning plan sync and a 10–15 minute evening merge/blocker sync.

---

## 3.3 Development Methodology

### Chosen Methodology: Kanban with Time-Boxed Milestones

We use **Kanban** rather than Scrum because:
- The team has 3 members and a fixed 5-day timeline — formal sprints with retrospectives would consume more time than they save.
- Work items vary in size (a 30-minute documentation update vs. a full-day PoC implementation). Kanban's pull-based flow handles this naturally.
- The assignment has a hard deadline with clear rubric sections, which map directly to Kanban columns.

### Iteration Structure

The project runs as a single iteration with daily milestones (see Section 3.5). Each day has a defined "done" state that the team verifies in the evening sync.

### Backlog Prioritization

Priority is determined by two factors:
1. **Rubric weight.** System Architecture (45%) items are prioritized over Requirements Engineering (30%), which is prioritized over Project Management (15%) and PoC (10%).
2. **Dependency chain.** Items that block other team members are prioritized over independent work. For example, the API contract freeze (blocking frontend integration) is prioritized over documentation that only Luka depends on.

### Handling Non-User-Visible Work

Architecture documentation, ADRs, and risk assessments are treated as first-class deliverables with their own issues and milestones, not as "overhead" to be done after coding. This reflects the assignment's weighting: documentation and architecture are 75% of the grade.

---

## 3.4 Risk Assessment

### Risk 1: AI Integration Cost Overrun

| Aspect | Detail |
|--------|--------|
| **Description** | If the AI assistant is used heavily, LLM API costs could exceed the budget, especially during development and testing when prompts are being iterated. |
| **Likelihood** | Medium |
| **Impact** | Development costs increase unexpectedly. In production, the feature becomes unsustainable without usage controls. |
| **Mitigation** | Implement per-user daily quotas (50 invocations/day default). Use GPT-4o-mini for standard tasks and reserve GPT-4o for restructure only. Cap output tokens per action type. Monitor cost dashboards daily. |
| **Contingency** | If cost exceeds 2× the projected budget: reduce the default quota, switch all actions to the cheaper model, and add a "cost estimate" confirmation dialog before each AI invocation. |

### Risk 2: CRDT Library Compatibility with Existing Editor

| Aspect | Detail |
|--------|--------|
| **Description** | Integrating a CRDT library (e.g., Yjs) with the chosen text editor component may require significant adapter code, or the library may not support features the editor needs. |
| **Likelihood** | Medium |
| **Impact** | Real-time sync is the highest-ranked architectural driver. If the CRDT library doesn't integrate cleanly, the sync feature is delayed, and the demo shows only manual-save collaboration. |
| **Mitigation** | For the PoC, the sync layer is deferred — the current architecture validates all other components (auth, CRUD, sharing, AI stub) without CRDT. The CRDT integration will be prototyped in isolation before being wired into the main editor. |
| **Contingency** | If the chosen CRDT library proves incompatible: switch to an alternative (e.g., from Yjs to Automerge, or vice versa). If no CRDT library works: fall back to OT using a simpler last-writer-wins merge at the paragraph level. |

### Risk 3: API Contract Drift Between Frontend and Backend

| Aspect | Detail |
|--------|--------|
| **Description** | The frontend type definitions (`types/api.ts`) may diverge from the actual backend response shapes, causing runtime errors that are invisible at compile time. |
| **Likelihood** | High (this is a common monorepo issue) |
| **Impact** | Frontend displays incorrect data, crashes on unexpected fields, or silently drops data. Integration bugs surface late and are hard to trace. |
| **Mitigation** | The backend integration test (`test/integration.test.js`) validates the full API contract. Any PR that changes a response shape must update both the backend test and the frontend type definition. PR reviews explicitly check for contract alignment. |
| **Contingency** | If drift is detected late: add a shared JSON schema (e.g., Zod schemas) that both frontend and backend validate against. This was deferred for the PoC to avoid adding a build-time dependency between the two packages. |

### Risk 4: Team Coordination Failure Under Tight Timeline

| Aspect | Detail |
|--------|--------|
| **Description** | With three members working in parallel on a 5-day timeline, miscommunication or blocked handoffs could waste entire days. Key dependencies: API contract freeze (Zhengxi → Harmanjot), architecture component naming (Luka → all). |
| **Likelihood** | Medium |
| **Impact** | Deliverables are incomplete or internally inconsistent at submission. The report's traceability matrix references component names that don't match the actual code. |
| **Mitigation** | Mandatory cross-owner handoffs with deadlines (see the planner). Daily sync meetings (morning + evening). Naming freeze by end of day 2 so all documentation and code use the same terms. |
| **Contingency** | If a team member is blocked for > 4 hours: the blocker is escalated in the Discord channel and the blocked member switches to an independent task. If a deliverable is at risk of missing the deadline: the support owner (per the ownership table) takes over. |

### Risk 5: LLM API Latency or Unavailability During Demo

| Aspect | Detail |
|--------|--------|
| **Description** | The demo depends on the AI feature working. If the LLM API is slow or down during the recording, the AI part of the demo fails. |
| **Likelihood** | Low–Medium (LLM APIs have documented outages) |
| **Impact** | The demo fails to show the AI feature, which is a core product differentiator. |
| **Mitigation** | The AI endpoint supports a stub mode (already implemented in `routes/ai.js`) that returns a hardcoded response. The demo can be recorded with the stub if the real API is unavailable. The README documents this. |
| **Contingency** | Record the demo in two takes: one showing the real AI response (if available) and one with the stub. Use whichever is more reliable. The report documents that real LLM integration is production-ready but the demo may use the stub for reliability. |

### Risk 6: SQLite Concurrency Limitations Under Real-Time Load

| Aspect | Detail |
|--------|--------|
| **Description** | SQLite supports only one writer at a time (even in WAL mode). Under real-time collaboration load, write contention on the document table could become a bottleneck. |
| **Likelihood** | Low (for PoC scale) |
| **Impact** | Write latency increases under concurrent saves, potentially violating the 200 ms sync propagation target. |
| **Mitigation** | For the PoC, SQLite is sufficient — concurrent write load is minimal with manual saves. The data access layer is abstracted behind simple functions, making a future migration to PostgreSQL straightforward. |
| **Contingency** | If SQLite becomes a bottleneck during scaling: migrate to PostgreSQL. The schema is standard SQL; the migration requires changing the connection layer (`db/index.js`) and updating prepared statement syntax. |

---

## 3.5 Timeline and Milestones

### Day-by-Day Schedule (29 March – 3 April 2026)

#### Day 1 — Saturday, 29 March: Scope, Stack, and Skeleton

**Team milestone:** Repository structure, document skeleton, and naming conventions frozen.

| Member | Tasks | Acceptance criteria |
|--------|-------|-------------------|
| Harmanjot | Create report headings, start FR structure and user stories, sketch frontend editor shell | Report document exists with all Part 1–4 headings. At least 3 FRs drafted. Frontend project initializes and renders a placeholder page. |
| Zhengxi | Set repo layout, decide backend stack, draft API objects and data entities | `backend/` and `frontend/` directories exist with `package.json`. Initial `schema.sql` drafted. API endpoint list documented. |
| Luka | Draft architectural drivers, stakeholder categories, and C4 diagram skeletons | `docs/architectural-drivers.md` exists with ranked driver list. C4 Level 1 Mermaid source drafted. Component naming convention documented. |

#### Day 2 — Sunday, 30 March: Part 1 First Draft + Architecture Backbone

**Team milestone:** First draft of all Part 1 sections. Architecture naming frozen.

| Member | Tasks | Acceptance criteria |
|--------|-------|-------------------|
| Harmanjot | Finish FR tables and most user stories; define traceability IDs; start UI integration stubs | FR table covers all 4 capability areas with ≥ 3 sub-requirements each. ≥ 8 user stories written. FR IDs (FR-01 through FR-13) assigned. |
| Zhengxi | Draft API contracts, auth section, repo structure, and ERD first pass; scaffold backend endpoint | `docs/auth-design.md` exists. API contract table in README matches `schema.sql`. At least `POST /register`, `POST /login`, `GET /documents` return valid JSON. |
| Luka | Finish NFRs, C4 L1/L2, communication model, and AI design outline; freeze component names | `docs/nfr.md` with all 5 quality attributes. C4 Level 1 and Level 2 Mermaid sources complete. Component names frozen and communicated to team. |

#### Day 3 — Monday, 31 March: Working PoC Path + Architecture Near-Final

**Team milestone:** Frontend-to-backend communication working for at least one major flow.

| Member | Tasks | Acceptance criteria |
|--------|-------|-------------------|
| Harmanjot | Connect frontend to backend for the chosen flow; polish traceability draft | Frontend successfully calls `POST /auth/login` and `GET /documents` and renders results. Traceability matrix links ≥ 10 user stories to FRs. |
| Zhengxi | Finish endpoint implementation, response validation, and one integration test; draft README | All documented API endpoints return correct response shapes. `npm test` passes with ≥ 5 test cases. README has setup instructions. |
| Luka | Complete C4 L3, ADRs, risk table, timeline, and architecture prose; review API/data consistency | `docs/c4-diagrams.md` has all three levels. All 4 ADRs written. `docs/project-management.md` has risks (≥ 5) and timeline. |

#### Day 4 — Tuesday, 1 April: All Major Content Complete; Final QA; Demo Ready

**Team milestone:** Report and PoC are submission-ready pending final review.

| Member | Tasks | Acceptance criteria |
|--------|-------|-------------------|
| Harmanjot | UI polish for demo, screenshot support, final wording fixes in FR/user stories | Demo can be recorded end-to-end (register → create doc → edit → share → version history). All FRs have acceptance criteria. ≥ 10 user stories. |
| Zhengxi | Final README pass, backend cleanup, error response confirmation, merge assistance | README accurately describes setup, run, and test. Error responses match `{ error: string }` convention. All PRs merged to main. |
| Luka | Lead consistency pass, final assembly checklist, figure labels, demo script alignment, document QA | All `docs/` files use consistent component names matching the code. Traceability matrix references match FR IDs and file paths. C4 diagram labels match code structure. |

#### Days 5–6 — Wednesday–Thursday, 2–3 April: Buffer and Submission

**Team milestone:** Final export and submission.

| Member | Tasks |
|--------|-------|
| Harmanjot | Only fix bugs or wording defects discovered in QA |
| Zhengxi | Only fix mismatches between code and document |
| Luka | Export final PDF, verify diagram sources, verify repo/demo links, and package submission artifacts |

### Milestone Verification Criteria

| Milestone | Verified by | Acceptance criteria |
|-----------|-------------|-------------------|
| M1: Repo skeleton | Luka | `git clone` + `npm install` succeeds in both `backend/` and `frontend/` |
| M2: API contract freeze | Zhengxi + Harmanjot | All endpoints in README return documented shapes; frontend `types/api.ts` matches |
| M3: Frontend-to-backend flow | Harmanjot | A screen recording shows register → login → create document → view document list |
| M4: Architecture docs complete | Luka | All files in `docs/` exist, render correctly in GitHub markdown, and pass a cross-reference check |
| M5: Integration test suite | Zhengxi | `npm test` passes with ≥ 10 assertions covering auth, documents, sharing, versions, AI |
| M6: Demo recorded | Harmanjot + Luka | 3-minute video shows frontend communicating with backend for at least one complete flow |
| M7: Final PDF | Luka | Single PDF with all Part 1–4 sections, embedded diagrams, and no broken cross-references |
