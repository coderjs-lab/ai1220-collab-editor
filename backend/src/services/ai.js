'use strict';

/**
 * ai_service — AI Service
 * Prompt construction, context loading, and LLM dispatch.
 */

const docRepo = require('../repositories/documents');
const llmClient = require('../lib/llm');

async function suggest(docId, userId, prompt, contextScope = 'document', selectionText = null) {
  const interactionId = docRepo.insertAiInteraction(docId, userId, prompt);

  let documentContext = null;

  if (contextScope === 'selection' && selectionText) {
    documentContext = selectionText;
  } else {
    const doc = docRepo.findById(docId);
    documentContext = doc?.content ?? null;
  }

  const suggestion = await llmClient.complete(prompt, {
    documentContext,
    scope: contextScope,
  });

  docRepo.updateAiResponse(interactionId, suggestion);
  return { suggestion };
}

function getHistory(docId) {
  return { history: docRepo.findAiHistory(docId) };
}

module.exports = { suggest, getHistory };
