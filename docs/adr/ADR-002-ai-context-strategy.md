# ADR-002: Tiered AI Context Strategy Over Full-Document Prompts

## Status

Accepted

## Context

The AI writing assistant is a first-class product feature, not an afterthought. When a user invokes an AI action — rewrite, summarise, translate, or restructure — the backend `ai_service` must construct a prompt and forward it to the LLM Provider (shown as an external system in the C4 Level 1 diagram). The `llm_client` library module (`backend/src/lib/llm.js`) is the sole integration point: no prompt or document content ever reaches the browser or any other consumer.

The central question is how much document content to include in each prompt. This decision has simultaneous consequences for cost, latency, suggestion quality, and user privacy.

**Forces at play:**

- **Cost.** LLM pricing is per-token. Sending a full 10-page document for a single-paragraph rewrite wastes tokens and money. The target is < $0.01 per invocation to sustain a default quota of 50 invocations per user per day at reasonable unit economics (FR-AI-04).
- **Latency.** Larger prompts increase time-to-first-token linearly with input size. The system must display a processing indicator within 1 second and return a result within 3 seconds for 90 % of requests (NFR-LAT-02).
- **Privacy.** Every token sent to the external LLM Provider is data leaving the system boundary (visible in the C4 Level 1 diagram). Minimising context minimises the privacy surface. Only selected document text — never user identity (name, email, user ID) — may cross this boundary (NFR-SEC-04).
- **Suggestion quality.** Too little context causes the LLM to produce rewrites that are tonally or semantically disconnected from the surrounding document, undermining the feature's utility.
- **Document scale.** The system must handle documents ranging from a single paragraph to 50,000+ words. A single fixed context window cannot serve both ends of this range efficiently.

## Decision

We adopt a **three-tier context strategy**. The tier is selected automatically based on the action type and document characteristics. Users can override the automatic tier via the optional `context` field in the `POST /api/documents/:id/ai/suggest` request body — this field is already wired through `ai_api` → `ai_service` in the PoC.

| Tier | Name | Content transmitted to LLM Provider | Token budget | When applied |
|------|------|--------------------------------------|--------------|--------------|
| 1 | `selection` | Selected text only | ~500 tokens | Selected text < 200 tokens |
| 2 | `section` | Selection + ~500 tokens before and after | ~1,500 tokens | Default for most actions |
| 3 | `document` | Selection + section heading hierarchy + document title | ~2,000 tokens | Action is `restructure` or document > 4,000 tokens |

**Tier selection rule:** if the selected text is < 200 tokens → Tier 1; if the action is `restructure` or the document exceeds 4,000 tokens → Tier 3; otherwise → Tier 2.

**Privacy guarantee (all tiers):** No user identity (name, email, user ID) is ever included in any prompt, regardless of tier. The LLM Provider receives only document text and a task instruction.

**Graceful degradation for very long documents:** Documents exceeding the provider's context window under Tier 3 trigger sliding-window summarisation — the document is chunked, each chunk summarised, and the summary chain forwarded with the selection — rather than failing with a token-limit error.

**Audit trail:** Every invocation inserts an `ai_interactions` row with the prompt *before* dispatching to the LLM Provider (`ai_service` audit-first pattern). The row is updated with the response on completion. This means every AI request is logged regardless of whether the LLM call succeeds or fails (FR-AI-03, `GET /api/documents/:id/ai/history`).

## Consequences

### Positive

- **Cost-efficient.** Average prompt size is ~1,200 tokens instead of ~5,000–8,000 for full-document inclusion. At `claude-haiku-4-5` pricing, this keeps per-invocation cost well below $0.01 and makes the 50-invocations/day/user quota economically sustainable.
- **Faster responses.** Smaller prompts reduce LLM inference time. The NFR-LAT-02 P90 latency target of 3 seconds is achievable for Tier 1 and Tier 2 prompts under normal LLM provider load.
- **Minimised privacy surface.** The default tier (Tier 1 for short selections, Tier 2 otherwise) means most users transmit only the text they are actively editing to the external provider — directly satisfying NFR-SEC-04.
- **Bounded prompt size.** Regardless of document length, prompts stay within ~2,000 tokens, preventing unexpected cost spikes on large documents and making quota enforcement predictable.
- **User override preserved.** The `context` parameter in the API request body allows power users to supply additional context or restrict it further, without changing the default experience for everyone else.

### Negative

- **Potential quality loss for long-range references.** If the user rewrites a paragraph referencing content far earlier in the document, the LLM may miss the reference under Tier 1 or Tier 2. Mitigation: the user can paste additional context into the prompt field, or explicitly select a wider passage before invoking the assistant.
- **Tier selection heuristic may be imperfect.** A simple token-count rule cannot always choose the optimal context level. Future iterations could use semantic similarity to select the most relevant surrounding paragraphs rather than the nearest N tokens.
- **Section detection requires document structure.** Tier 3 extracts section headings, which assumes the document uses headings. For unstructured plain-text documents, Tier 3 falls back to Tier 2 behaviour — the outline contribution is empty but the selection and surrounding context are still sent.

## Alternatives Considered

### Always send the full document

**Rejected because:**
- Prohibitively expensive for long documents. A 20,000-word document is ~25,000 tokens. At GPT-4o pricing (~$0.01/1K input tokens), each invocation costs ~$0.25 — 25× over budget. The 50-invocations/day/user quota would cost ~$12.50/user/day, making the feature economically unviable.
- Violates NFR-LAT-02: 25,000-token prompts take 5–15 seconds for first-token under typical LLM provider load, far exceeding the 3-second P90 target.
- Unnecessarily exposes the entire document — including sections the user did not select — to the external LLM Provider, violating NFR-SEC-04 (minimum necessary document context).

### Always send only the selection

**Rejected because:**
- Without surrounding context, the LLM produces rewrites that do not match the document's tone, tense, or subject. A selection-only prompt for a paragraph in the middle of a technical report may produce casual, tonally mismatched output because the model has no visibility into the document's register.
- For multi-sentence rewrites, the lack of context about what comes before and after the selection frequently produces suggestions that cut off abruptly or repeat information from adjacent paragraphs.

### Let the user manually choose the context tier every time

**Rejected as the primary mechanism because:**
- Adds a configuration decision to every AI invocation. Users invoking AI assistance want to describe *what they want done*, not configure *how much context to send*. Prompt engineering should be hidden behind sensible defaults.
- Retained as an advanced override (the `context` parameter in the API) so power users who want finer control are not blocked.
