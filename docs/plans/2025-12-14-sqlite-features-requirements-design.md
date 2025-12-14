# SQLite, Features & Requirements Workflow Design

## Overview

Migrate from JSON file storage to sql.js, add task hierarchy (Features), and build out Claude-powered requirements workflow with in-webview Q&A.

## Data Model

### SQLite Schema

```sql
-- Project metadata (singleton per workspace)
CREATE TABLE project (
  id TEXT PRIMARY KEY DEFAULT 'main',
  title TEXT,
  description TEXT,
  requirement_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Features (containers for tasks)
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  requirement_path TEXT,
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tasks (belong to a feature, or standalone)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  feature_id TEXT,
  type TEXT NOT NULL DEFAULT 'task',  -- 'task' | 'bug'
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (feature_id) REFERENCES features(id)
);

-- Requirements session (resumable interview state)
CREATE TABLE requirement_sessions (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,  -- 'project' or feature_id
  raw_input TEXT,
  status TEXT NOT NULL,  -- drafting | clarifying | reviewing | complete
  conversation TEXT,  -- JSON array of messages
  proposed_output TEXT,  -- JSON with requirement doc + suggested features/tasks
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### File Location

- Database: `.pmcockpit/cockpit.db`
- Requirements: `docs/requirements/*.md`

## Hierarchy

```
Project (1 per workspace)
├── requirement: docs/requirements/project.md
│
├── Feature: "Login Flow"
│   ├── requirement: docs/requirements/login-flow.md
│   ├── Task: "Create login form"
│   └── Task: "Add validation"
│
├── Feature: "OAuth Integration"
│   └── Task: "Set up Google OAuth"
│
└── Ungrouped Tasks
    └── Task: "Update README"
```

## UI Layout

```
┌─────────────────────────────────────────┐
│ Product Cockpit              [⚙️] [+▼]  │
├─────────────────────────────────────────┤
│ Project: My App                    [📝] │
│ 2 features • 8 tasks                    │
├─────────────────────────────────────────┤
│ ▼ Login Flow                    [▶][📝]│
│   ☐ Create login form              [▶] │
│   ☐ 🐛 Fix password visibility     [▶] │
├─────────────────────────────────────────┤
│ ▶ OAuth Integration (3)         [▶][📝]│
├─────────────────────────────────────────┤
│ Ungrouped                               │
│   ☐ Update README                  [▶] │
├─────────────────────────────────────────┤
│ ▼ Done (5)                              │
└─────────────────────────────────────────┘
```

### Add Menu Options

```
[+▼]
├── Add Task              → Quick form
├── Add Feature           → Quick form
├── ─────────────────
├── New Feature (with Requirements)    → Claude interview
├── Add Project Requirements           → Claude interview
```

## Requirements Workflow

### Flow Steps

1. **Input** - User enters text or records voice
2. **Clarifying Questions** - Claude asks 2-3 questions at a time (hybrid approach)
3. **Review** - User reviews requirement doc + proposed features/tasks
4. **Create** - Save doc, create features and tasks

### Claude Integration

Uses streaming process for entire interview:

```typescript
const proc = spawn('claude', [
  '-p',
  '--model', model,
  '--input-format', 'stream-json',
  '--output-format', 'stream-json',
  '--strict-mcp-config',
  '--tools', '',
  '--system-prompt', requirementsAnalystPrompt
]);
```

### Question Types

- **Multiple choice** - Radio buttons with options
- **Text** - Free-form input field

### Resumability

- Session state stored in `requirement_sessions` table
- If process dies, resume by replaying conversation history
- Active sessions shown in UI for continuation

## sql.js Integration

```typescript
import initSqlJs, { Database } from 'sql.js';

export async function initDatabase(dbPath: string): Promise<Database> {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    return new SQL.Database(buffer);
  } else {
    const db = new SQL.Database();
    runMigrations(db);
    return db;
  }
}

export function saveDatabase(db: Database, dbPath: string): void {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}
```

### Auto-save Strategy

- Save after every mutation
- Debounce rapid changes during drag operations

## MCP Tools (Minimal)

| Tool | Description |
|------|-------------|
| `list_tasks` | List tasks by status, includes feature context |
| `get_task` | Get task by ID with parent feature and requirement path |
| `update_task_status` | Update status (use ready-for-signoff when complete) |
| `get_requirement` | Read requirement doc content by path |

### Response Format

```json
{
  "id": "task-123",
  "title": "Create login form",
  "type": "task",
  "status": "todo",
  "feature": {
    "id": "feat-1",
    "title": "Login Flow"
  },
  "requirement_path": "docs/requirements/login-flow.md"
}
```

## Key Interactions

- Drag tasks between features or to/from ungrouped
- Drag features to reorder
- Collapse/expand features
- Click feature header to select all tasks
- Bug icon shown for `type: 'bug'`
- Build button on features builds all tasks in order

## Migration

Clean slate - no migration from JSON needed. Fresh start with SQLite.
