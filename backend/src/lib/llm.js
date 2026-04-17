'use strict';

/**
 * llm_client — LLM Client
 * HTTP integration layer for the external AI service.
 */

/**
 * Error carrying an HTTP status for upstream forwarding.
 */
class AiServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
  }
}

/**
 * Send a prompt to the AI service and return the completion text.
 *
 * @param {string} prompt        - The full prompt string.
 * @param {object} [opts]        - Optional context payload.
 * @returns {Promise<string>}    - The model's response text.
 */
async function complete(prompt, opts = {}) {
  const url = `${process.env.AI_SERVICE_URL ?? 'http://localhost:8000'}/complete`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        document_context: opts.documentContext ?? null,
        scope: opts.scope ?? 'document',
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message = error?.name === 'TimeoutError'
      ? 'AI service request timed out'
      : 'AI service is unreachable';
    throw new AiServiceError(502, message);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    // The AI service should return JSON for both success and errors.
    data = null;
  }

  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : `AI service error: ${response.status}`;
    throw new AiServiceError(response.status, detail);
  }

  if (typeof data?.suggestion !== 'string') {
    throw new AiServiceError(502, 'AI service returned an invalid response payload');
  }

  return data.suggestion;
}

module.exports = { complete, AiServiceError };
