'use strict';

/**
 * doc_api — Document Controller
 * Routes: list, create, get, update, delete, versions
 * Sharing/permissions are handled by access_api (routes/access.js).
 */

const express = require('express');
const docService = require('../services/documents');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/documents
router.get('/', (req, res) => {
  res.json({ documents: docService.listDocuments(req.user.id) });
});

// POST /api/documents
// Body: { title?, content? }
router.post('/', (req, res) => {
  const { title, content } = req.body;
  const document = docService.createDocument(title, content, req.user.id);
  res.status(201).json({ document });
});

// GET /api/documents/:id
router.get('/:id', (req, res) => {
  const result = docService.getDocument(req.params.id, req.user.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// PUT /api/documents/:id
// Body: { title?, content? }
router.put('/:id', (req, res) => {
  const { title, content } = req.body;
  if (title === undefined && content === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  const result = docService.updateDocument(req.params.id, req.user.id, { title, content });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// DELETE /api/documents/:id
router.delete('/:id', (req, res) => {
  const result = docService.deleteDocument(req.params.id, req.user.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// GET /api/documents/:id/versions
router.get('/:id/versions', (req, res) => {
  const result = docService.getVersions(req.params.id, req.user.id, req.query.full === '1');
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

module.exports = router;
