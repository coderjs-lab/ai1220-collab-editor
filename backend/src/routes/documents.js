const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Resolve a document and verify the caller has at least the required role.
// Owners always pass. Collaborators need a matching permissions row.
// Returns the document row, or sends an error response and returns null.
function resolveDoc(req, res, minRole = 'viewer') {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return null;
  }

  if (doc.owner_id === req.user.id) return doc;

  const perm = db
    .prepare('SELECT role FROM permissions WHERE document_id = ? AND user_id = ?')
    .get(doc.id, req.user.id);

  const roles = ['viewer', 'editor'];
  if (!perm || roles.indexOf(perm.role) < roles.indexOf(minRole)) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }

  return doc;
}

function publicDoc(doc) {
  const { id, title, content, owner_id, created_at, updated_at } = doc;
  return { id, title, content, owner_id, created_at, updated_at };
}

// GET /api/documents
// Returns all documents the caller owns or has permission to access.
router.get('/', (req, res) => {
  const owned = db
    .prepare('SELECT * FROM documents WHERE owner_id = ?')
    .all(req.user.id);

  const shared = db
    .prepare(`
      SELECT d.* FROM documents d
      JOIN permissions p ON p.document_id = d.id
      WHERE p.user_id = ?
    `)
    .all(req.user.id);

  const docs = [...owned, ...shared].map(publicDoc);
  res.json({ documents: docs });
});

// POST /api/documents
// Body: { title?, content? }
// Returns: { document }
router.post('/', (req, res) => {
  const { title = 'Untitled', content = '' } = req.body;
  const result = db
    .prepare('INSERT INTO documents (title, content, owner_id) VALUES (?, ?, ?)')
    .run(title, content, req.user.id);
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ document: publicDoc(doc) });
});

// GET /api/documents/:id
// Returns: { document, collaborators }
router.get('/:id', (req, res) => {
  const doc = resolveDoc(req, res, 'viewer');
  if (!doc) return;

  const collaborators = db
    .prepare(`
      SELECT u.id, u.username, u.email, p.role
      FROM permissions p JOIN users u ON u.id = p.user_id
      WHERE p.document_id = ?
    `)
    .all(doc.id);

  res.json({ document: publicDoc(doc), collaborators });
});

// PUT /api/documents/:id
// Body: { title?, content? }
// Returns: { document }
// Also snapshots the previous content as a version.
router.put('/:id', (req, res) => {
  const doc = resolveDoc(req, res, 'editor');
  if (!doc) return;

  const { title, content } = req.body;
  const updates = [];
  const params = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (content !== undefined) { updates.push('content = ?'); params.push(content); }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  // Snapshot current content before overwriting
  if (content !== undefined && content !== doc.content) {
    db.prepare('INSERT INTO versions (document_id, content, created_by) VALUES (?, ?, ?)')
      .run(doc.id, doc.content, req.user.id);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(doc.id);
  db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(doc.id);
  res.json({ document: publicDoc(updated) });
});

// DELETE /api/documents/:id
router.delete('/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can delete' });

  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  res.json({ message: 'Document deleted' });
});

// POST /api/documents/:id/share
// Body: { email, role }  role ∈ 'viewer' | 'editor'
// Returns: { permission: { user, role } }
router.post('/:id/share', (req, res) => {
  const doc = resolveDoc(req, res, 'editor');
  if (!doc) return;
  if (doc.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can share' });

  const { email, role } = req.body;
  if (!email || !['viewer', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'email and role (viewer|editor) are required' });
  }

  const target = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot share with yourself' });

  db.prepare(`
    INSERT INTO permissions (document_id, user_id, role)
    VALUES (?, ?, ?)
    ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role
  `).run(doc.id, target.id, role);

  res.status(201).json({ permission: { user: { id: target.id, username: target.username, email: target.email }, role } });
});

// DELETE /api/documents/:id/share/:userId
router.delete('/:id/share/:userId', (req, res) => {
  const doc = resolveDoc(req, res, 'editor');
  if (!doc) return;
  if (doc.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can revoke access' });

  db.prepare('DELETE FROM permissions WHERE document_id = ? AND user_id = ?')
    .run(doc.id, req.params.userId);
  res.json({ message: 'Access revoked' });
});

// GET /api/documents/:id/versions
// Returns version history (content excluded for brevity; add ?full=1 to include content).
router.get('/:id/versions', (req, res) => {
  const doc = resolveDoc(req, res, 'viewer');
  if (!doc) return;

  const includeFull = req.query.full === '1';
  const rows = db.prepare(`
    SELECT v.id, v.document_id, v.created_by, v.created_at
      ${includeFull ? ', v.content' : ''}
      , u.username as created_by_username
    FROM versions v JOIN users u ON u.id = v.created_by
    WHERE v.document_id = ?
    ORDER BY v.created_at DESC
  `).all(doc.id);

  res.json({ versions: rows });
});

module.exports = router;
