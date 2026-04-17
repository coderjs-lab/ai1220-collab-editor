'use strict';

/**
 * ai_api — AI Controller
 * Routes: suggest, history
 */

const express = require('express');
const aiService = require('../services/ai');
const docService = require('../services/documents');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// POST /api/documents/:id/ai/suggest
// Body: { prompt, context?, context_text? }
router.post('/suggest', async (req, res) => {
  const { doc, error, status } = docService.resolveDoc(req.params.id, req.user.id, 'viewer');
  if (error) return res.status(status).json({ error });

  const { prompt, context: scope, context_text: selectionText } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  try {
    const result = await aiService.suggest(
      doc.id,
      req.user.id,
      prompt,
      scope ?? 'document',
      selectionText,
    );
    res.json(result);
  } catch (serviceError) {
    const serviceStatus = Number(serviceError?.status);
    const errorStatus = Number.isFinite(serviceStatus) ? serviceStatus : 502;
    const errorMessage = serviceError?.message || 'Failed to generate AI suggestion';
    res.status(errorStatus).json({ error: errorMessage });
  }
});

// GET /api/documents/:id/ai/history
router.get('/history', (req, res) => {
  const { doc, error, status } = docService.resolveDoc(req.params.id, req.user.id, 'viewer');
  if (error) return res.status(status).json({ error });

  res.json(aiService.getHistory(doc.id));
});

module.exports = router;
