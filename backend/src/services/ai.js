'use strict';

/**
 * ai_service — AI Service
 * Prompt construction, quota checks, and LLM dispatch.
 * LLM integration is deferred; this module currently stubs the response.
 */

const docRepo = require('../repositories/documents');

async function suggest(docId, userId, prompt /*, context */) {
  const interactionId = docRepo.insertAiInteraction(docId, userId, prompt);

  // TODO: build prompt with document context, call LLM provider, update response row
  const suggestion = '[AI stub] LLM integration coming soon.';

  docRepo.updateAiResponse(interactionId, suggestion);
  return { suggestion };
}

function getHistory(docId) {
  return { history: docRepo.findAiHistory(docId) };
}

module.exports = { suggest, getHistory };
