# AI Integration Design

The AI writing assistant is a core product feature, not an afterthought. This document addresses how AI capabilities are woven into the collaborative editing experience.

---

## Context and Scope

### What the AI sees

When a user invokes the AI assistant, the system constructs a prompt from three layers of context:

| Layer | Content | When included |
|-------|---------|---------------|
| **Selection** | The exact text the user highlighted | Always — this is the primary input |
| **Surrounding context** | ~500 tokens before and after the selection | Always — provides semantic continuity |
| **Document summary** | A compressed representation of the full document (title, headings, first paragraph) | Only for restructure and summarize actions on long documents (> 4 000 tokens) |

**Trade-off rationale.** Sending the full document on every AI call would maximize relevance but introduces three problems: (1) cost scales linearly with document length, (2) latency increases with token count, and (3) privacy exposure is maximized. The tiered approach balances relevance against cost and latency. For a 10-page document, sending only the selection + surrounding context reduces the prompt to ~1 200 tokens versus ~8 000 for the full document — a ~6× cost reduction per invocation.

### Handling very long documents

Documents exceeding 8 000 tokens (roughly 6 000 words) trigger a "chunked context" strategy: the system extracts the selection's section (detected by heading boundaries) plus the document's structural outline (headings only). This keeps prompt size bounded at ~2 000 tokens regardless of document length, at the cost of potentially missing distant context.

---

## Suggestion UX

### How suggestions are presented

AI suggestions are displayed as **tracked-change-style inline proposals**:

1. The selected text is dimmed and marked with a strikethrough style.
2. The AI-generated replacement appears immediately below/after, highlighted in a distinct color (green for additions).
3. A floating toolbar appears with three actions:
   - **Accept** — replaces the original text with the suggestion and commits the change as a normal edit operation.
   - **Reject** — discards the suggestion and restores the original text.
   - **Edit** — opens the suggestion in an editable state so the user can partially modify it before accepting.

This approach was chosen over a side-panel design because inline display preserves reading context — the user sees the suggestion exactly where it will appear in the document. Side panels force the user to mentally map between two locations.

### Partial acceptance

Users can accept a suggestion and then immediately edit it further. The accepted text enters the normal editing flow, so standard undo (`Ctrl+Z`) reverts the acceptance. This avoids the need for a separate "partial accept" mechanism while still letting users cherry-pick parts of a suggestion.

### Undo

An accepted AI suggestion is recorded as a single operation in the undo stack. One `Ctrl+Z` reverts the entire acceptance, restoring the original text. The version history also captures a snapshot before the AI change is applied, so users can revert via the version panel even after saving.

---

## AI During Collaboration

### The problem

When User A selects a paragraph and requests an AI rewrite, User B may simultaneously be editing words within that same paragraph. Applying the AI suggestion naively would overwrite User B's changes.

### The approach: pending-suggestion state

1. **Request phase.** When User A invokes the AI, the selected text range is marked as "AI pending" in the sync layer. All collaborators see a subtle visual indicator (a pulsing border or shaded background) on that region, along with a label: "AI suggestion in progress (requested by User A)."

2. **Concurrent edits.** Other users *can* continue editing the pending region — their edits are not blocked. However, the system tracks that the region has been modified since the AI request was issued.

3. **Response phase.** When the AI response arrives:
   - If the region was **not modified** by others: the suggestion is shown inline to User A with accept/reject controls. Other collaborators see the suggestion as a pending proposal.
   - If the region **was modified** by others: User A is notified that the context has changed. The suggestion is still shown, but with a warning: "The text was edited while the AI was processing. Review the suggestion carefully." The user can still accept, reject, or edit.

4. **Accept/Reject.** When User A accepts, the suggestion is applied as a normal CRDT operation that propagates to all collaborators. If User A rejects, the pending indicator is simply removed.

**Why not lock the region?** Locking would force User B to wait for the AI response (potentially several seconds). In a real-time collaborative editor, blocking is a poor UX choice. The "warn but don't block" approach respects both users' workflows.

---

## Prompt Design

### Template-based construction

Prompts are constructed from templates, not hardcoded strings. Each AI action type has a corresponding template:

```
templates/
├── rewrite.txt
├── summarize.txt
├── translate.txt
└── restructure.txt
```

A template receives variables: `{{selection}}`, `{{before_context}}`, `{{after_context}}`, `{{target_language}}` (for translate), and `{{document_outline}}` (for restructure). Example for **rewrite**:

```
You are an AI writing assistant embedded in a collaborative document editor.
The user has selected the following text and asked you to rewrite it.

Context before the selection:
{{before_context}}

Selected text to rewrite:
{{selection}}

Context after the selection:
{{after_context}}

Rewrite the selected text to improve clarity, flow, and readability.
Preserve the original meaning and tone. Return only the rewritten text,
without explanations or preamble.
```

### Why templates over hardcoded prompts

Templates can be updated, A/B tested, and versioned without redeploying the application. A product manager or prompt engineer can iterate on prompt quality by editing template files. The application code only needs to know which template to select and which variables to inject.

### Future extensibility

The template system supports adding new AI actions (e.g., "expand", "make formal", "simplify") by adding a new template file and registering it in a configuration map — no code changes to the AI controller.

---

## Model and Cost Strategy

### Model selection per action

Not all AI actions require the same model capability:

| Action | Recommended model tier | Reasoning |
|--------|----------------------|-----------|
| Rewrite | Standard (e.g., GPT-4o-mini) | Requires good writing quality; standard models are sufficient |
| Summarize | Standard | Compression is a well-understood task |
| Translate | Standard | Translation quality is adequate at the standard tier for common languages |
| Restructure | Advanced (e.g., GPT-4o) | Requires understanding document-level structure; benefits from stronger reasoning |

This dual-model approach reduces average cost per AI invocation by routing simpler tasks to cheaper models.

### Cost controls

| Mechanism | Description |
|-----------|-------------|
| **Per-user daily quota** | Each user gets N AI invocations per 24-hour period (configurable per organization). Default: 50 invocations/day. |
| **Token budget per request** | Maximum output tokens are capped per action type (e.g., rewrite: 1 000 tokens, summarize: 500 tokens). |
| **Organization-level budget** | Monthly spending cap; when reached, AI features degrade gracefully to "quota exceeded" messages. |

### Quota exceeded behavior

When a user exceeds their limit, the AI button remains visible but triggers a clear message: "You've used your AI quota for today. Your quota resets at midnight UTC." The editor remains fully functional — only AI features are restricted. The API returns HTTP 429 with `{ error: "AI quota exceeded", resets_at: "..." }`.

### Graceful degradation when the LLM is unavailable

If the external LLM API returns an error or times out (> 30 s):

1. The user sees: "The AI assistant is temporarily unavailable. Your document is unaffected."
2. The pending-suggestion indicator is removed.
3. The failed interaction is logged with a null response for monitoring.
4. A retry button appears so the user can try again when the service recovers.

The editor and collaboration features continue working normally — AI unavailability never disrupts editing.
