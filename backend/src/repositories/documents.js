'use strict';

/**
 * doc_repo — Document Repository
 * All DB access for documents, versions, and AI interaction records.
 */

const db = require('../db');

function findById(id) {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

function findByOwner(ownerId) {
  return db.prepare('SELECT * FROM documents WHERE owner_id = ?').all(ownerId);
}

function findByCollaborator(userId) {
  return db.prepare(`
    SELECT d.* FROM documents d
    JOIN permissions p ON p.document_id = d.id
    WHERE p.user_id = ?
  `).all(userId);
}

function create(title, content, ownerId) {
  const result = db
    .prepare('INSERT INTO documents (title, content, owner_id) VALUES (?, ?, ?)')
    .run(title, content, ownerId);
  return findById(result.lastInsertRowid);
}

function update(id, fields) {
  // fields: { title?, content? }
  const parts = [];
  const params = [];
  if (fields.title !== undefined) { parts.push('title = ?'); params.push(fields.title); }
  if (fields.content !== undefined) { parts.push('content = ?'); params.push(fields.content); }
  parts.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  db.prepare(`UPDATE documents SET ${parts.join(', ')} WHERE id = ?`).run(...params);
  return findById(id);
}

function remove(id) {
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

function insertVersion(docId, content, userId) {
  db.prepare('INSERT INTO versions (document_id, content, created_by) VALUES (?, ?, ?)')
    .run(docId, content, userId);
}

function findVersions(docId, includeFull = false) {
  return db.prepare(`
    SELECT v.id, v.document_id, v.created_by, v.created_at
      ${includeFull ? ', v.content' : ''}
      , u.username AS created_by_username
    FROM versions v JOIN users u ON u.id = v.created_by
    WHERE v.document_id = ?
    ORDER BY v.created_at DESC
  `).all(docId);
}

// AI interaction records

function insertAiInteraction(docId, userId, prompt) {
  const result = db.prepare(
    'INSERT INTO ai_interactions (document_id, user_id, prompt) VALUES (?, ?, ?)'
  ).run(docId, userId, prompt);
  return result.lastInsertRowid;
}

function updateAiResponse(id, response) {
  db.prepare('UPDATE ai_interactions SET response = ? WHERE id = ?').run(response, id);
}

function findAiHistory(docId) {
  return db.prepare(`
    SELECT ai.id, ai.prompt, ai.response, ai.created_at, u.username
    FROM ai_interactions ai JOIN users u ON u.id = ai.user_id
    WHERE ai.document_id = ?
    ORDER BY ai.created_at DESC
  `).all(docId);
}

module.exports = {
  findById, findByOwner, findByCollaborator,
  create, update, remove,
  insertVersion, findVersions,
  insertAiInteraction, updateAiResponse, findAiHistory,
};
