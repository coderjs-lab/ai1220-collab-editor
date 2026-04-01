'use strict';

/**
 * session_api — Session Controller
 * Issues short-lived collaboration session tokens consumed by the Collab Server
 * (Socket.IO container). The token authorises a WebSocket room join without
 * requiring the full JWT to be sent over the WebSocket handshake.
 *
 * Status: stub — Collab Server not yet implemented.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const docRepo = require('../repositories/documents');
const userRepo = require('../repositories/users');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// POST /api/documents/:id/session
// Returns a short-lived token the frontend passes to the Collab Server on connect.
// Response: { sessionToken, expiresIn }
router.post('/', (req, res) => {
  const doc = docRepo.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Verify caller has at least viewer access
  const isOwner = doc.owner_id === req.user.id;
  if (!isOwner) {
    const perm = userRepo.findPermission(doc.id, req.user.id);
    if (!perm) return res.status(403).json({ error: 'Access denied' });
  }

  // TODO: sign a short-lived JWT scoped to this document + user for the Collab Server
  res.json({
    sessionToken: '[stub] collab-server not yet implemented',
    expiresIn: 3600,
  });
});

module.exports = router;
