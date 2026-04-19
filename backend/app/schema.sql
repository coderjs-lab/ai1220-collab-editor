PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    UNIQUE NOT NULL,
  email         TEXT    UNIQUE NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL DEFAULT 'Untitled',
  content    TEXT    NOT NULL DEFAULT '<p></p>',
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT    NOT NULL CHECK(role IN ('viewer', 'editor')),
  created_at  TEXT    NOT NULL,
  UNIQUE(document_id, user_id)
);

CREATE TABLE IF NOT EXISTS versions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT    NOT NULL,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_interactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  prompt      TEXT    NOT NULL,
  response    TEXT,
  model       TEXT,
  status      TEXT    NOT NULL DEFAULT 'generated',
  feature     TEXT,
  context_scope TEXT,
  context_preview TEXT,
  resolved_prompt TEXT,
  error_message TEXT,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  TEXT    NOT NULL,
  revoked_at  TEXT,
  created_at  TEXT    NOT NULL
);
