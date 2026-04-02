'use strict';

/**
 * ai_service — AI Service
 * Prompt construction, quota checks, and LLM dispatch.
 * LLM integration is deferred; llm_client.complete() currently returns a stub.
 */

const docRepo = require('../repositories/documents');
const llmClient = require('../lib/llm');

async function suggest(docId, userId, prompt /*, context */) {
  const interactionId = docRepo.insertAiInteraction(docId, userId, prompt);

  // TODO: build prompt with document context before dispatching
  const suggestion = await llmClient.complete(prompt);

  docRepo.updateAiResponse(interactionId, suggestion);
  return { suggestion };
}

function getHistory(docId) {
  return { history: docRepo.findAiHistory(docId) };
}

module.exports = { suggest, getHistory };
