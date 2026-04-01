# AGENTS.md — Harman Frontend Coding Instructions

This file is for **Harman's frontend work only** in the `coderjs-lab/ai1220-collab-editor` repository.

It defines how coding agents should behave **before writing code, making commits, or opening pull requests** for Harman's part of the project.

It does **not** define backend implementation policy for Zhengxi or Luka.

---

## 1. Scope

You are assisting **Harman** with the **frontend implementation** for the AI1220 collaborative editor project.

Primary scope:
- frontend app setup and structure
- authentication UI and token handling
- document list / create / open flows
- editor page UI
- frontend integration with existing backend API
- loading, error, and permission-aware states
- minimal PoC-friendly UI for demo and report alignment

Out of scope unless explicitly requested by Harman:
- changing backend API behavior
- refactoring Zhengxi's backend without necessity
- inventing new backend contracts
- building real-time collaboration infrastructure
- integrating a real LLM provider
- doing broad repo-wide cleanup unrelated to frontend delivery

---

## 2. Primary objective

Optimize for the assignment rubric, not for product completeness.

The frontend should:
1. prove that the architecture is buildable,
2. communicate correctly with the backend,
3. stay consistent with the written report,
4. remain small, clear, and demoable.

Prefer a minimal, correct implementation over an ambitious but unstable one.

---

## 3. Core operating rules

### 3.1 Contract-first frontend work

Before implementing any frontend API integration:
- inspect the existing backend route and response shape,
- use the existing contract exactly,
- do not guess field names,
- do not silently rename request/response properties unless the mapping is isolated and intentional.

If the backend returns snake_case, the frontend may either:
- use snake_case directly, or
- map to camelCase in one dedicated adapter layer.

Do **not** mix both styles unpredictably across components.

### 3.2 Do not expand scope casually

Do not add major frontend features unless Harman explicitly asks for them.

Avoid adding:
- advanced rich-text frameworks unless needed,
- speculative real-time UI,
- fake collaboration behavior that the backend does not support,
- large state-management libraries without a clear need,
- heavy UI polish that does not improve the PoC or report.

For the PoC, a simple text editor interface is acceptable.

### 3.3 Frontend changes must stay explainable in the report

Any frontend behavior added should be easy to map to:
- requirements,
- architecture,
- API design,
- repository structure,
- proof-of-concept behavior.

Do not implement UI behavior that contradicts the report plan or backend capabilities.

---

## 4. Working assumptions about the repo

Assume:
- backend already exists and is the source of truth for API behavior,
- Harman owns frontend work,
- frontend should live under `frontend/`,
- repo organization should remain clean and submission-friendly,
- the assignment values consistency between code and documentation.

When unsure, prefer preserving compatibility with the current backend rather than redesigning interfaces.

---

## 5. Recommended frontend structure

Unless the repo already has a better structure, prefer something close to:

```text
frontend/
  src/
    components/
    pages/
    features/
      auth/
      documents/
      editor/
      ai/
    services/
    hooks/
    types/
    utils/
```

Guidance:
- `components/`: reusable UI elements
- `pages/`: route-level screens
- `features/auth/`: login, register, current-user handling
- `features/documents/`: list, create, open, delete, share UI if implemented
- `features/editor/`: document editing screen and save interactions
- `features/ai/`: stub UI only if Harman asks for it
- `services/`: API client, token handling, request wrappers
- `types/`: API and UI model types
- `utils/`: transformations, helpers, formatting

Do not put all logic in a single component file.

---

## 6. API integration rules

### 6.1 Single API layer

Create one clear API client layer instead of scattering raw fetch calls across the app.

The API layer should handle:
- base URL
- JSON serialization/deserialization
- Authorization header injection
- consistent error parsing
- optional request/response adapters

### 6.2 Error handling

Frontend must visibly distinguish among:
- loading
- success
- validation / bad request
- unauthorized
- forbidden
- not found
- server failure

Do not swallow backend error messages.

### 6.3 Auth handling

If JWT auth is required:
- store token in one clear place,
- attach it consistently,
- handle expired/invalid auth cleanly,
- avoid duplicating auth logic across pages.

---

## 7. UX rules for this project

Frontend UX should be:
- simple,
- readable,
- demoable,
- aligned with backend reality.

Required mindset:
- make the success path clear,
- make error states obvious,
- make permission limitations understandable,
- avoid UI that suggests unsupported features.

If a user lacks edit permission, prefer explicit read-only behavior over a confusing broken form.

---

## 8. Branch rules for Harman's work

This file applies only to Harman's branches.

Use feature-oriented branch names, such as:
- `feat/frontend-auth`
- `feat/frontend-documents`
- `feat/frontend-editor-shell`
- `feat/frontend-save-flow`
- `fix/frontend-auth-state`
- `docs/frontend-screenshots`

Avoid person-name branches like:
- `harman-work`
- `my-branch`
- `frontend-final-final`

Each branch should have one coherent purpose.

---

## 9. Commit rules

Write clean, specific commit messages.

Preferred style:
- `feat(frontend): add login and register screens`
- `feat(editor): load document by id and render content`
- `fix(auth): clear stale token on 401 response`
- `refactor(api): centralize authenticated request helper`
- `docs(frontend): add PoC screenshots to README`

Commit messages should say what changed, not just that work happened.

Avoid vague messages like:
- `update stuff`
- `changes`
- `frontend work`
- `fixed issue`

---

## 10. Pull request rules for Harman's work

Every frontend PR should include:
- what was implemented,
- which screens or flows changed,
- which backend endpoints are used,
- which rubric/report section this supports,
- screenshots or short UI evidence when relevant,
- known limitations,
- what remains unfinished.

If the PR changes API expectations, explicitly state whether:
- frontend was updated to match backend, or
- backend must also be changed.

Do not open a PR that hides contract mismatches.

---

## 11. Documentation discipline

For any substantial frontend addition, keep documentation aligned.

Update or prepare, when relevant:
- `README.md`
- frontend run instructions
- screenshots for the report/demo
- notes on routes/pages implemented
- any API usage notes needed by Harman for the report

The assignment rewards consistency. Do not let code drift away from the written architecture.

---

## 12. Testing expectations

For frontend work, prefer practical verification over unnecessary complexity.

Minimum expectation:
- verify the implemented flow works end-to-end against the backend,
- verify auth failures and bad states are handled visibly,
- verify the UI does not break on empty/loading/error states.

If tests are added, keep them focused and lightweight.

Do not spend large amounts of time building an elaborate test framework unless Harman explicitly asks for it.

---

## 13. Decision rules when choices are unclear

When several frontend options are possible, prefer the option that is:
1. most compatible with the current backend,
2. easiest to explain in the assignment report,
3. smallest in scope,
4. easiest to demo reliably,
5. easiest to maintain over the next milestones.

If a trade-off exists between elegance and assignment safety, prefer assignment safety.

---

## 14. Red flags — stop and reconsider if any of these happen

Pause before proceeding if you are about to:
- invent fields not present in the API,
- silently change request/response contract assumptions,
- add a major package for a small problem,
- build fake real-time or fake AI behavior that may mislead the report/demo,
- refactor backend logic that belongs to Zhengxi's ownership,
- merge code that has not been manually run through the PoC flow,
- create UI that contradicts documented permissions or architecture.

---

## 15. Preferred implementation order for Harman

Unless Harman specifies otherwise, prefer this order:
1. frontend app scaffold
2. API client setup
3. auth screens and token flow
4. document list/create flow
5. document editor load/save flow
6. permission-aware UI states
7. optional version history or AI stub UI
8. UI polish only after the core flow works

---

## 16. Output style for coding agents

When making code changes for Harman:
- keep changes focused,
- explain important decisions briefly,
- call out assumptions clearly,
- mention any contract dependency,
- mention any file that Harman should review manually.

Do not produce long generic essays when a concise engineering summary is enough.

---

## 17. Final standard

A frontend change is good only if it is:
- correct against the backend,
- small enough to trust,
- clear enough to demo,
- organized enough to defend in the report,
- narrow enough to stay within Harman's ownership.

When in doubt, choose the simpler implementation.
