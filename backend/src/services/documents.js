'use strict';

/**
 * doc_service — Document Service
 * Document rules, versioning logic, and ownership / access checks.
 */

const docRepo = require('../repositories/documents');
const userRepo = require('../repositories/users');

const ROLE_ORDER = ['viewer', 'editor'];

/**
 * Resolve a document and verify the caller has at least minRole.
 * Returns { doc } on success or { error, status } on failure.
 */
function resolveDoc(docId, userId, minRole = 'viewer') {
  const doc = docRepo.findById(docId);
  if (!doc) return { error: 'Document not found', status: 404 };

  if (doc.owner_id === userId) return { doc };

  const perm = userRepo.findPermission(doc.id, userId);
  if (!perm || ROLE_ORDER.indexOf(perm.role) < ROLE_ORDER.indexOf(minRole)) {
    return { error: 'Access denied', status: 403 };
  }

  return { doc };
}

function publicDoc(doc) {
  const { id, title, content, owner_id, created_at, updated_at } = doc;
  return { id, title, content, owner_id, created_at, updated_at };
}

function listDocuments(userId) {
  const owned = docRepo.findByOwner(userId);
  const shared = docRepo.findByCollaborator(userId);
  return [...owned, ...shared].map(publicDoc);
}

function createDocument(title = 'Untitled', content = '', ownerId) {
  const doc = docRepo.create(title, content, ownerId);
  return publicDoc(doc);
}

function getDocument(docId, userId) {
  const { doc, error, status } = resolveDoc(docId, userId, 'viewer');
  if (error) return { error, status };

  const collaborators = userRepo.findCollaborators(doc.id);
  return { document: publicDoc(doc), collaborators };
}

function updateDocument(docId, userId, fields) {
  const { doc, error, status } = resolveDoc(docId, userId, 'editor');
  if (error) return { error, status };

  // Snapshot previous content before overwriting
  if (fields.content !== undefined && fields.content !== doc.content) {
    docRepo.insertVersion(doc.id, doc.content, userId);
  }

  const updated = docRepo.update(doc.id, fields);
  return { document: publicDoc(updated) };
}

function deleteDocument(docId, userId) {
  const doc = docRepo.findById(docId);
  if (!doc) return { error: 'Document not found', status: 404 };
  if (doc.owner_id !== userId) return { error: 'Only the owner can delete', status: 403 };

  docRepo.remove(doc.id);
  return { message: 'Document deleted' };
}

function getVersions(docId, userId, includeFull = false) {
  const { doc, error, status } = resolveDoc(docId, userId, 'viewer');
  if (error) return { error, status };

  return { versions: docRepo.findVersions(doc.id, includeFull) };
}

module.exports = { resolveDoc, listDocuments, createDocument, getDocument, updateDocument, deleteDocument, getVersions };
