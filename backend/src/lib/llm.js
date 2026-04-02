'use strict';

/**
 * llm_client — LLM Client
 * HTTP integration layer for the external LLM provider (e.g. Anthropic Claude API).
 *
 * Status: stub — real API calls are deferred to a later milestone.
 * `complete()` always resolves with a placeholder string so the rest of the
 * stack (ai_service, ai_api, integration tests) can run without a live key.
 */

/**
 * Send a prompt to the LLM and return the completion text.
 *
 * @param {string} prompt        - The full prompt string.
 * @param {object} [opts]        - Optional parameters (model, maxTokens, etc.)
 * @returns {Promise<string>}    - The model's response text.
 */
async function complete(prompt /*, opts = {} */) {
  // TODO: replace with real Anthropic / OpenAI SDK call
  void prompt;
  return '[AI stub] LLM integration coming soon.';
}

module.exports = { complete };
