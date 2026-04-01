'use strict';

/**
 * access_api — Access Controller
 * Routes: share document, revoke access
 * Manages permissions and collaborator relationships.
 */

const express = require('express');
const docRepo = require('../repositories/documents');
const userRepo = require('../repositories/users');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// POST /api/documents/:id/share
// Body: { email, role }  role ∈ 'viewer' | 'editor'
router.post('/', (req, res) => {
  const doc = docRepo.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can share' });

  const { email, role } = req.body;
  if (!email || !['viewer', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'email and role (viewer|editor) are required' });
  }

  const target = userRepo.findByEmail(email);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot share with yourself' });

  userRepo.upsertPermission(doc.id, target.id, role);

  res.status(201).json({
    permission: {
      user: { id: target.id, username: target.username, email: target.email },
      role,
    },
  });
});

// DELETE /api/documents/:id/share/:userId
router.delete('/:userId', (req, res) => {
  const doc = docRepo.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can revoke access' });

  userRepo.deletePermission(doc.id, req.params.userId);
  res.json({ message: 'Access revoked' });
});

module.exports = router;
