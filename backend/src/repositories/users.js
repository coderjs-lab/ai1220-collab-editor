'use strict';

/**
 * user_repo — User Repository
 * All DB access for users, memberships, and permissions.
 */

const db = require('../db');

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function create(username, email, passwordHash) {
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email, passwordHash);
  return findById(result.lastInsertRowid);
}

function findPermission(docId, userId) {
  return db
    .prepare('SELECT role FROM permissions WHERE document_id = ? AND user_id = ?')
    .get(docId, userId);
}

function upsertPermission(docId, userId, role) {
  db.prepare(`
    INSERT INTO permissions (document_id, user_id, role)
    VALUES (?, ?, ?)
    ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role
  `).run(docId, userId, role);
}

function deletePermission(docId, userId) {
  db.prepare('DELETE FROM permissions WHERE document_id = ? AND user_id = ?').run(docId, userId);
}

function findCollaborators(docId) {
  return db.prepare(`
    SELECT u.id, u.username, u.email, p.role
    FROM permissions p JOIN users u ON u.id = p.user_id
    WHERE p.document_id = ?
  `).all(docId);
}

module.exports = { findById, findByEmail, create, findPermission, upsertPermission, deletePermission, findCollaborators };
