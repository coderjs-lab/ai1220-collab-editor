'use strict';

/**
 * ai_api — AI Controller
 * Routes: suggest, history
 */

const express = require('express');
const aiService = require('../services/ai');
const docRepo = require('../repositories/documents');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// POST /api/documents/:id/ai/suggest
// Body: { prompt, context? }
router.post('/suggest', async (req, res) => {
  const doc = docRepo.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { prompt, context } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const result = await aiService.suggest(doc.id, req.user.id, prompt, context);
  res.json(result);
});

// GET /api/documents/:id/ai/history
router.get('/history', (req, res) => {
  const doc = docRepo.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  res.json(aiService.getHistory(doc.id));
});

module.exports = router;
