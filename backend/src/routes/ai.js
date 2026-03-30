const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// POST /api/documents/:id/ai/suggest
// Body: { prompt, context? }
// Returns: { suggestion }
//
// Stub — real LLM integration added in a later day.
router.post('/suggest', (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { prompt, context } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // Log the interaction
  db.prepare(
    'INSERT INTO ai_interactions (document_id, user_id, prompt, response) VALUES (?, ?, ?, ?)'
  ).run(doc.id, req.user.id, prompt, null);

  // TODO: call LLM API and update response row
  res.json({ suggestion: '[AI stub] Integration coming soon.' });
});

// GET /api/documents/:id/ai/history
// Returns: list of AI interactions for this document
router.get('/history', (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const rows = db.prepare(`
    SELECT ai.id, ai.prompt, ai.response, ai.created_at, u.username
    FROM ai_interactions ai JOIN users u ON u.id = ai.user_id
    WHERE ai.document_id = ?
    ORDER BY ai.created_at DESC
  `).all(doc.id);

  res.json({ history: rows });
});

module.exports = router;
