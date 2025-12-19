export const SCHEMA = `
CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY DEFAULT 'main',
  title TEXT,
  description TEXT,
  requirement_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  requirement_path TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  feature_id TEXT,
  type TEXT NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS requirement_sessions (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  raw_input TEXT,
  status TEXT NOT NULL,
  conversation TEXT,
  proposed_output TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Initialize singleton project row
INSERT OR IGNORE INTO project (id, title, created_at, updated_at)
VALUES ('main', NULL, datetime('now'), datetime('now'));
`;
