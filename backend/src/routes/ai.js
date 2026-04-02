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
// Body: { prompt, context? }
router.post('/suggest', async (req, res) => {
  const { doc, error, status } = docService.resolveDoc(req.params.id, req.user.id, 'viewer');
  if (error) return res.status(status).json({ error });

  const { prompt, context } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const result = await aiService.suggest(doc.id, req.user.id, prompt, context);
  res.json(result);
});

// GET /api/documents/:id/ai/history
router.get('/history', (req, res) => {
  const { doc, error, status } = docService.resolveDoc(req.params.id, req.user.id, 'viewer');
  if (error) return res.status(status).json({ error });

  res.json(aiService.getHistory(doc.id));
});

module.exports = router;
