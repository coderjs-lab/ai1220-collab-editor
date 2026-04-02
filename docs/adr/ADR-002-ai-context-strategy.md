# ADR-002: Tiered AI Context Strategy Over Full-Document Prompts

## Status

Accepted

## Context

When a user invokes the AI assistant (rewrite, summarize, translate, restructure), the system must decide how much document content to include in the LLM prompt. The trade-offs are:

- **Relevance vs. cost.** More context gives the LLM better understanding, but LLM pricing is per-token. Sending a full 10-page document for a single-paragraph rewrite wastes tokens and money.
- **Relevance vs. latency.** Larger prompts take longer to process. Time-to-first-token increases linearly with input size.
- **Privacy exposure.** Every token sent to the external LLM is data leaving the system boundary. Minimizing context minimizes the privacy surface.
- **Quality.** Too little context causes the LLM to produce suggestions that are tonally or semantically disconnected from the surrounding document.

The forces at play:
- Average AI invocation should cost < $0.01 to sustain a daily quota of 50 invocations per user at reasonable unit economics.
- P95 time-to-first-token should be < 2 seconds (NFR-L2).
- The system must handle documents ranging from a single paragraph to 50 000+ words.

## Decision

We adopt a **tiered context strategy** with three levels, selected automatically based on the AI action type and document size:

| Tier | Content included | Token budget | Used for |
|------|-----------------|-------------|----------|
| **Selection only** | Selected text | ~500 tokens | Short rewrites, translations of sentences |
| **Selection + surrounding** | Selected text + ~500 tokens before and after | ~1 500 tokens | Standard rewrites, summarize a paragraph |
| **Selection + section outline** | Selected text + section heading hierarchy + document title | ~2 000 tokens | Restructure, summarize a long document |

The tier is determined by a simple rule: if the selected text is < 200 tokens, use Tier 1; if the action is restructure or the document exceeds 4 000 tokens, use Tier 3; otherwise use Tier 2.

## Consequences

### Positive

- **Cost-efficient.** Average prompt size is ~1 200 tokens instead of ~5 000–8 000 for full-document inclusion. At GPT-4o-mini pricing ($0.15/1M input tokens), this keeps per-invocation cost well below $0.01.
- **Faster responses.** Smaller prompts reduce inference time. The P95 time-to-first-token target of 2 seconds is achievable for Tier 1 and Tier 2 prompts.
- **Minimized privacy surface.** Only the relevant portion of the document is sent to the external API, not the entire document.
- **Bounded prompt size.** Regardless of document length, prompts stay within ~2 000 tokens, preventing unexpected cost spikes on large documents.

### Negative

- **Potential quality loss for long-range references.** If the user rewrites a paragraph that references content far earlier in the document, the LLM may miss the reference. Mitigation: the user can manually copy relevant context into the AI prompt field.
- **Tier selection heuristic may be imperfect.** A simple token-count rule may not always choose the optimal context level. Future iterations could use semantic analysis to include the most relevant context.
- **Section detection requires document structure.** Tier 3 assumes the document has headings. For unstructured documents, it falls back to Tier 2.

## Alternatives Considered

### Always send the full document

Rejected because:
- Prohibitively expensive for long documents (a 20 000-word document is ~25 000 tokens; at GPT-4o pricing, each invocation would cost ~$0.25).
- Violates the latency target: 25 000-token prompts take 5–15 seconds for first-token.
- Unnecessarily exposes the entire document to the third-party LLM.

### Always send only the selection

Rejected because:
- Without surrounding context, the LLM produces rewrites that don't match the document's tone, tense, or subject. In testing, selection-only prompts produced noticeably worse quality for multi-sentence rewrites.

### Let the user manually choose context

Rejected as the primary mechanism because:
- Adds friction to every AI invocation. Users should not need to think about prompt engineering to use the assistant.
- Retained as an advanced option: the API accepts an optional `context` field that the user can fill in to override the automatic context.
