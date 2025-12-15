# SQLite, Features & Requirements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace JSON storage with sql.js, add Features hierarchy, and build Claude-powered requirements workflow.

**Architecture:** sql.js database stores all state. Features contain Tasks. Requirements workflow uses streaming Claude process for multi-turn Q&A in the webview.

**Tech Stack:** sql.js (WASM SQLite), React, TypeScript, Claude CLI with stream-json

---

## Phase 1: sql.js Foundation

### Task 1.1: Install sql.js

**Files:**
- Modify: `package.json`

**Step 1: Install sql.js**

Run:
```bash
cd /Users/justin/Documents/dev/product-cockpit-sqlite-features
npm install sql.js
```

**Step 2: Verify installation**

Run: `npm ls sql.js`
Expected: `sql.js@x.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add sql.js dependency"
```

---

### Task 1.2: Create Database Module

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/schema.ts`

**Step 1: Create schema file**

Create `src/db/schema.ts`:
```typescript
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
```

**Step 2: Create database module**

Create `src/db/database.ts`:
```typescript
import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { SCHEMA } from './schema';

let db: Database | null = null;
let dbPath: string | null = null;

export async function initDatabase(workspaceRoot: string): Promise<Database> {
    const SQL = await initSqlJs();

    const pmcockpitDir = path.join(workspaceRoot, '.pmcockpit');
    if (!fs.existsSync(pmcockpitDir)) {
        fs.mkdirSync(pmcockpitDir, { recursive: true });
    }

    dbPath = path.join(pmcockpitDir, 'cockpit.db');

    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
        db.run(SCHEMA);
        saveDatabase();
    }

    return db;
}

export function getDatabase(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase first.');
    }
    return db;
}

export function saveDatabase(): void {
    if (!db || !dbPath) {
        throw new Error('Database not initialized');
    }
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
}

export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        dbPath = null;
    }
}
```

**Step 3: Create index export**

Create `src/db/index.ts`:
```typescript
export { initDatabase, getDatabase, saveDatabase, closeDatabase } from './database';
```

**Step 4: Verify TypeScript compiles**

Run: `npm run compile`
Expected: No errors

**Step 5: Commit**

```bash
git add src/db/
git commit -m "feat: add sql.js database module with schema"
```

---

## Phase 2: Data Repositories

### Task 2.1: Create Type Definitions

**Files:**
- Create: `src/db/types.ts`

**Step 1: Create types file**

Create `src/db/types.ts`:
```typescript
export type TaskType = 'task' | 'bug';
export type TaskStatus = 'todo' | 'in-progress' | 'ready-for-signoff' | 'done' | 'rework';
export type SessionStatus = 'drafting' | 'clarifying' | 'reviewing' | 'complete';

export interface Project {
    id: string;
    title: string | null;
    description: string | null;
    requirement_path: string | null;
    created_at: string;
    updated_at: string;
}

export interface Feature {
    id: string;
    title: string;
    description: string | null;
    requirement_path: string | null;
    priority: number;
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: string;
    feature_id: string | null;
    type: TaskType;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: number;
    created_at: string;
    updated_at: string;
}

export interface TaskWithFeature extends Task {
    feature?: {
        id: string;
        title: string;
    } | null;
}

export interface RequirementSession {
    id: string;
    scope: string;
    raw_input: string | null;
    status: SessionStatus;
    conversation: string | null;
    proposed_output: string | null;
    created_at: string;
    updated_at: string;
}

export interface NewFeature {
    title: string;
    description?: string;
    requirement_path?: string;
}

export interface NewTask {
    feature_id?: string;
    type?: TaskType;
    title: string;
    description?: string;
}
```

**Step 2: Update index export**

Modify `src/db/index.ts`:
```typescript
export { initDatabase, getDatabase, saveDatabase, closeDatabase } from './database';
export * from './types';
```

**Step 3: Commit**

```bash
git add src/db/types.ts src/db/index.ts
git commit -m "feat: add database type definitions"
```

---

### Task 2.2: Create Project Repository

**Files:**
- Create: `src/db/repositories/projectRepo.ts`

**Step 1: Create project repository**

Create `src/db/repositories/projectRepo.ts`:
```typescript
import { getDatabase, saveDatabase } from '../database';
import { Project } from '../types';

function rowToProject(row: any[]): Project {
    return {
        id: row[0],
        title: row[1],
        description: row[2],
        requirement_path: row[3],
        created_at: row[4],
        updated_at: row[5],
    };
}

export const ProjectRepo = {
    get(): Project | null {
        const db = getDatabase();
        const result = db.exec("SELECT * FROM project WHERE id = 'main'");
        if (result.length === 0 || result[0].values.length === 0) {
            return null;
        }
        return rowToProject(result[0].values[0]);
    },

    update(data: Partial<Omit<Project, 'id' | 'created_at'>>): Project {
        const db = getDatabase();
        const sets: string[] = [];
        const values: any[] = [];

        if (data.title !== undefined) {
            sets.push('title = ?');
            values.push(data.title);
        }
        if (data.description !== undefined) {
            sets.push('description = ?');
            values.push(data.description);
        }
        if (data.requirement_path !== undefined) {
            sets.push('requirement_path = ?');
            values.push(data.requirement_path);
        }

        sets.push("updated_at = datetime('now')");

        db.run(`UPDATE project SET ${sets.join(', ')} WHERE id = 'main'`, values);
        saveDatabase();

        return this.get()!;
    },
};
```

**Step 2: Commit**

```bash
git add src/db/repositories/
git commit -m "feat: add project repository"
```

---

### Task 2.3: Create Feature Repository

**Files:**
- Create: `src/db/repositories/featureRepo.ts`

**Step 1: Create feature repository**

Create `src/db/repositories/featureRepo.ts`:
```typescript
import { v4 as uuid } from 'uuid';
import { getDatabase, saveDatabase } from '../database';
import { Feature, NewFeature } from '../types';

function rowToFeature(row: any[]): Feature {
    return {
        id: row[0],
        title: row[1],
        description: row[2],
        requirement_path: row[3],
        priority: row[4],
        created_at: row[5],
        updated_at: row[6],
    };
}

export const FeatureRepo = {
    list(): Feature[] {
        const db = getDatabase();
        const result = db.exec('SELECT * FROM features ORDER BY priority ASC');
        if (result.length === 0) return [];
        return result[0].values.map(rowToFeature);
    },

    get(id: string): Feature | null {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM features WHERE id = ?');
        stmt.bind([id]);
        if (stmt.step()) {
            const row = stmt.get();
            stmt.free();
            return rowToFeature(row);
        }
        stmt.free();
        return null;
    },

    create(data: NewFeature): Feature {
        const db = getDatabase();
        const id = uuid();
        const now = new Date().toISOString();

        // Get max priority
        const maxResult = db.exec('SELECT MAX(priority) FROM features');
        const maxPriority = maxResult.length > 0 && maxResult[0].values[0][0] !== null
            ? (maxResult[0].values[0][0] as number) + 1
            : 0;

        db.run(
            `INSERT INTO features (id, title, description, requirement_path, priority, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, data.title, data.description || null, data.requirement_path || null, maxPriority, now, now]
        );
        saveDatabase();

        return this.get(id)!;
    },

    update(id: string, data: Partial<Omit<Feature, 'id' | 'created_at'>>): Feature | null {
        const db = getDatabase();
        const sets: string[] = [];
        const values: any[] = [];

        if (data.title !== undefined) {
            sets.push('title = ?');
            values.push(data.title);
        }
        if (data.description !== undefined) {
            sets.push('description = ?');
            values.push(data.description);
        }
        if (data.requirement_path !== undefined) {
            sets.push('requirement_path = ?');
            values.push(data.requirement_path);
        }
        if (data.priority !== undefined) {
            sets.push('priority = ?');
            values.push(data.priority);
        }

        if (sets.length === 0) return this.get(id);

        sets.push("updated_at = datetime('now')");
        values.push(id);

        db.run(`UPDATE features SET ${sets.join(', ')} WHERE id = ?`, values);
        saveDatabase();

        return this.get(id);
    },

    delete(id: string): void {
        const db = getDatabase();
        // Tasks with this feature_id will have it set to NULL (ON DELETE SET NULL)
        db.run('DELETE FROM features WHERE id = ?', [id]);
        saveDatabase();
    },

    reorder(ids: string[]): void {
        const db = getDatabase();
        ids.forEach((id, index) => {
            db.run('UPDATE features SET priority = ? WHERE id = ?', [index, id]);
        });
        saveDatabase();
    },
};
```

**Step 2: Commit**

```bash
git add src/db/repositories/featureRepo.ts
git commit -m "feat: add feature repository"
```

---

### Task 2.4: Create Task Repository

**Files:**
- Create: `src/db/repositories/taskRepo.ts`

**Step 1: Create task repository**

Create `src/db/repositories/taskRepo.ts`:
```typescript
import { v4 as uuid } from 'uuid';
import { getDatabase, saveDatabase } from '../database';
import { Task, TaskWithFeature, NewTask, TaskStatus, TaskType } from '../types';

function rowToTask(row: any[]): Task {
    return {
        id: row[0],
        feature_id: row[1],
        type: row[2] as TaskType,
        title: row[3],
        description: row[4],
        status: row[5] as TaskStatus,
        priority: row[6],
        created_at: row[7],
        updated_at: row[8],
    };
}

export const TaskRepo = {
    list(options?: { feature_id?: string | null; status?: TaskStatus }): Task[] {
        const db = getDatabase();
        let sql = 'SELECT * FROM tasks';
        const conditions: string[] = [];
        const values: any[] = [];

        if (options?.feature_id !== undefined) {
            if (options.feature_id === null) {
                conditions.push('feature_id IS NULL');
            } else {
                conditions.push('feature_id = ?');
                values.push(options.feature_id);
            }
        }
        if (options?.status) {
            conditions.push('status = ?');
            values.push(options.status);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY priority ASC';

        const result = db.exec(sql, values);
        if (result.length === 0) return [];
        return result[0].values.map(rowToTask);
    },

    listWithFeatures(options?: { status?: TaskStatus }): TaskWithFeature[] {
        const db = getDatabase();
        let sql = `
            SELECT t.*, f.id as f_id, f.title as f_title
            FROM tasks t
            LEFT JOIN features f ON t.feature_id = f.id
        `;
        const values: any[] = [];

        if (options?.status) {
            sql += ' WHERE t.status = ?';
            values.push(options.status);
        }
        sql += ' ORDER BY t.priority ASC';

        const result = db.exec(sql, values);
        if (result.length === 0) return [];

        return result[0].values.map((row: any[]) => ({
            ...rowToTask(row.slice(0, 9)),
            feature: row[9] ? { id: row[9], title: row[10] } : null,
        }));
    },

    get(id: string): Task | null {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
        stmt.bind([id]);
        if (stmt.step()) {
            const row = stmt.get();
            stmt.free();
            return rowToTask(row);
        }
        stmt.free();
        return null;
    },

    getWithFeature(id: string): TaskWithFeature | null {
        const db = getDatabase();
        const result = db.exec(`
            SELECT t.*, f.id as f_id, f.title as f_title
            FROM tasks t
            LEFT JOIN features f ON t.feature_id = f.id
            WHERE t.id = ?
        `, [id]);

        if (result.length === 0 || result[0].values.length === 0) return null;

        const row = result[0].values[0];
        return {
            ...rowToTask(row.slice(0, 9) as any[]),
            feature: row[9] ? { id: row[9] as string, title: row[10] as string } : null,
        };
    },

    create(data: NewTask): Task {
        const db = getDatabase();
        const id = uuid();
        const now = new Date().toISOString();

        // Get max priority within feature (or globally for ungrouped)
        let maxResult;
        if (data.feature_id) {
            maxResult = db.exec('SELECT MAX(priority) FROM tasks WHERE feature_id = ?', [data.feature_id]);
        } else {
            maxResult = db.exec('SELECT MAX(priority) FROM tasks WHERE feature_id IS NULL');
        }
        const maxPriority = maxResult.length > 0 && maxResult[0].values[0][0] !== null
            ? (maxResult[0].values[0][0] as number) + 1
            : 0;

        db.run(
            `INSERT INTO tasks (id, feature_id, type, title, description, status, priority, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?)`,
            [id, data.feature_id || null, data.type || 'task', data.title, data.description || null, maxPriority, now, now]
        );
        saveDatabase();

        return this.get(id)!;
    },

    update(id: string, data: Partial<Omit<Task, 'id' | 'created_at'>>): Task | null {
        const db = getDatabase();
        const sets: string[] = [];
        const values: any[] = [];

        if (data.feature_id !== undefined) {
            sets.push('feature_id = ?');
            values.push(data.feature_id);
        }
        if (data.type !== undefined) {
            sets.push('type = ?');
            values.push(data.type);
        }
        if (data.title !== undefined) {
            sets.push('title = ?');
            values.push(data.title);
        }
        if (data.description !== undefined) {
            sets.push('description = ?');
            values.push(data.description);
        }
        if (data.status !== undefined) {
            sets.push('status = ?');
            values.push(data.status);
        }
        if (data.priority !== undefined) {
            sets.push('priority = ?');
            values.push(data.priority);
        }

        if (sets.length === 0) return this.get(id);

        sets.push("updated_at = datetime('now')");
        values.push(id);

        db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, values);
        saveDatabase();

        return this.get(id);
    },

    updateStatus(id: string, status: TaskStatus): Task | null {
        return this.update(id, { status });
    },

    delete(id: string): void {
        const db = getDatabase();
        db.run('DELETE FROM tasks WHERE id = ?', [id]);
        saveDatabase();
    },

    moveToFeature(taskId: string, featureId: string | null): Task | null {
        const db = getDatabase();

        // Get max priority in target
        let maxResult;
        if (featureId) {
            maxResult = db.exec('SELECT MAX(priority) FROM tasks WHERE feature_id = ?', [featureId]);
        } else {
            maxResult = db.exec('SELECT MAX(priority) FROM tasks WHERE feature_id IS NULL');
        }
        const maxPriority = maxResult.length > 0 && maxResult[0].values[0][0] !== null
            ? (maxResult[0].values[0][0] as number) + 1
            : 0;

        db.run(
            "UPDATE tasks SET feature_id = ?, priority = ?, updated_at = datetime('now') WHERE id = ?",
            [featureId, maxPriority, taskId]
        );
        saveDatabase();

        return this.get(taskId);
    },

    reorder(ids: string[]): void {
        const db = getDatabase();
        ids.forEach((id, index) => {
            db.run('UPDATE tasks SET priority = ? WHERE id = ?', [index, id]);
        });
        saveDatabase();
    },

    countByStatus(): Record<TaskStatus, number> {
        const db = getDatabase();
        const result = db.exec('SELECT status, COUNT(*) FROM tasks GROUP BY status');
        const counts: Record<TaskStatus, number> = {
            'todo': 0,
            'in-progress': 0,
            'ready-for-signoff': 0,
            'done': 0,
            'rework': 0,
        };
        if (result.length > 0) {
            result[0].values.forEach((row: any[]) => {
                counts[row[0] as TaskStatus] = row[1] as number;
            });
        }
        return counts;
    },
};
```

**Step 2: Commit**

```bash
git add src/db/repositories/taskRepo.ts
git commit -m "feat: add task repository"
```

---

### Task 2.5: Create Session Repository and Export All

**Files:**
- Create: `src/db/repositories/sessionRepo.ts`
- Create: `src/db/repositories/index.ts`
- Modify: `src/db/index.ts`

**Step 1: Create session repository**

Create `src/db/repositories/sessionRepo.ts`:
```typescript
import { v4 as uuid } from 'uuid';
import { getDatabase, saveDatabase } from '../database';
import { RequirementSession, SessionStatus } from '../types';

function rowToSession(row: any[]): RequirementSession {
    return {
        id: row[0],
        scope: row[1],
        raw_input: row[2],
        status: row[3] as SessionStatus,
        conversation: row[4],
        proposed_output: row[5],
        created_at: row[6],
        updated_at: row[7],
    };
}

export const SessionRepo = {
    get(id: string): RequirementSession | null {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM requirement_sessions WHERE id = ?');
        stmt.bind([id]);
        if (stmt.step()) {
            const row = stmt.get();
            stmt.free();
            return rowToSession(row);
        }
        stmt.free();
        return null;
    },

    getActive(): RequirementSession[] {
        const db = getDatabase();
        const result = db.exec("SELECT * FROM requirement_sessions WHERE status != 'complete' ORDER BY updated_at DESC");
        if (result.length === 0) return [];
        return result[0].values.map(rowToSession);
    },

    create(scope: string, rawInput: string): RequirementSession {
        const db = getDatabase();
        const id = uuid();
        const now = new Date().toISOString();

        db.run(
            `INSERT INTO requirement_sessions (id, scope, raw_input, status, conversation, proposed_output, created_at, updated_at)
             VALUES (?, ?, ?, 'drafting', NULL, NULL, ?, ?)`,
            [id, scope, rawInput, now, now]
        );
        saveDatabase();

        return this.get(id)!;
    },

    update(id: string, data: Partial<Omit<RequirementSession, 'id' | 'created_at'>>): RequirementSession | null {
        const db = getDatabase();
        const sets: string[] = [];
        const values: any[] = [];

        if (data.status !== undefined) {
            sets.push('status = ?');
            values.push(data.status);
        }
        if (data.conversation !== undefined) {
            sets.push('conversation = ?');
            values.push(data.conversation);
        }
        if (data.proposed_output !== undefined) {
            sets.push('proposed_output = ?');
            values.push(data.proposed_output);
        }

        if (sets.length === 0) return this.get(id);

        sets.push("updated_at = datetime('now')");
        values.push(id);

        db.run(`UPDATE requirement_sessions SET ${sets.join(', ')} WHERE id = ?`, values);
        saveDatabase();

        return this.get(id);
    },

    delete(id: string): void {
        const db = getDatabase();
        db.run('DELETE FROM requirement_sessions WHERE id = ?', [id]);
        saveDatabase();
    },
};
```

**Step 2: Create repositories index**

Create `src/db/repositories/index.ts`:
```typescript
export { ProjectRepo } from './projectRepo';
export { FeatureRepo } from './featureRepo';
export { TaskRepo } from './taskRepo';
export { SessionRepo } from './sessionRepo';
```

**Step 3: Update main db index**

Modify `src/db/index.ts`:
```typescript
export { initDatabase, getDatabase, saveDatabase, closeDatabase } from './database';
export * from './types';
export * from './repositories';
```

**Step 4: Verify compilation**

Run: `npm run compile`
Expected: No errors

**Step 5: Commit**

```bash
git add src/db/
git commit -m "feat: add session repository and export all db modules"
```

---

## Phase 3: Integration

### Task 3.1: Update Extension to Use Database

**Files:**
- Modify: `src/extension.ts`

**Step 1: Import and initialize database**

Add to `src/extension.ts` at the top:
```typescript
import { initDatabase, closeDatabase } from './db';
```

**Step 2: Initialize database in activate function**

In the `activate` function, before creating WebviewProvider:
```typescript
// Initialize database
const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
if (workspaceRoot) {
    await initDatabase(workspaceRoot);
}
```

**Step 3: Close database in deactivate**

Add to deactivate function:
```typescript
export function deactivate() {
    closeDatabase();
}
```

**Step 4: Verify compilation**

Run: `npm run compile`
Expected: No errors

**Step 5: Commit**

```bash
git add src/extension.ts
git commit -m "feat: initialize database in extension activation"
```

---

### Task 3.2: Remove Old TaskStore JSON Logic

**Files:**
- Modify: `src/tasks/TaskStore.ts`

**Step 1: Replace TaskStore with database calls**

This is a significant refactor. Replace the entire TaskStore to use the database repositories instead of JSON files. The TaskStore becomes a thin wrapper that emits events.

Create new `src/tasks/TaskStore.ts`:
```typescript
import * as vscode from 'vscode';
import { TaskRepo, FeatureRepo, ProjectRepo } from '../db';
import { Task, Feature, Project, TaskStatus, NewTask, NewFeature } from '../db/types';

export class TaskStore {
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    // Project
    getProject(): Project | null {
        return ProjectRepo.get();
    }

    updateProject(data: Partial<Project>): Project {
        const result = ProjectRepo.update(data);
        this._onDidChange.fire();
        return result;
    }

    // Features
    getFeatures(): Feature[] {
        return FeatureRepo.list();
    }

    getFeature(id: string): Feature | null {
        return FeatureRepo.get(id);
    }

    createFeature(data: NewFeature): Feature {
        const result = FeatureRepo.create(data);
        this._onDidChange.fire();
        return result;
    }

    updateFeature(id: string, data: Partial<Feature>): Feature | null {
        const result = FeatureRepo.update(id, data);
        this._onDidChange.fire();
        return result;
    }

    deleteFeature(id: string): void {
        FeatureRepo.delete(id);
        this._onDidChange.fire();
    }

    reorderFeatures(ids: string[]): void {
        FeatureRepo.reorder(ids);
        this._onDidChange.fire();
    }

    // Tasks
    getTasks(options?: { feature_id?: string | null; status?: TaskStatus }): Task[] {
        return TaskRepo.list(options);
    }

    getTask(id: string): Task | null {
        return TaskRepo.get(id);
    }

    getTaskWithFeature(id: string) {
        return TaskRepo.getWithFeature(id);
    }

    createTask(data: NewTask): Task {
        const result = TaskRepo.create(data);
        this._onDidChange.fire();
        return result;
    }

    updateTask(id: string, data: Partial<Task>): Task | null {
        const result = TaskRepo.update(id, data);
        this._onDidChange.fire();
        return result;
    }

    updateTaskStatus(id: string, status: TaskStatus): Task | null {
        const result = TaskRepo.updateStatus(id, status);
        this._onDidChange.fire();
        return result;
    }

    deleteTask(id: string): void {
        TaskRepo.delete(id);
        this._onDidChange.fire();
    }

    moveTaskToFeature(taskId: string, featureId: string | null): Task | null {
        const result = TaskRepo.moveToFeature(taskId, featureId);
        this._onDidChange.fire();
        return result;
    }

    reorderTasks(ids: string[]): void {
        TaskRepo.reorder(ids);
        this._onDidChange.fire();
    }

    // Stats
    getTaskCounts(): Record<TaskStatus, number> {
        return TaskRepo.countByStatus();
    }

    // Cleanup - archive done tasks (delete from db)
    archiveDoneTasks(): number {
        const doneTasks = TaskRepo.list({ status: 'done' });
        doneTasks.forEach(t => TaskRepo.delete(t.id));
        this._onDidChange.fire();
        return doneTasks.length;
    }
}
```

**Step 2: Verify compilation**

Run: `npm run compile`
Expected: Errors in WebviewProvider (will fix next)

**Step 3: Commit**

```bash
git add src/tasks/TaskStore.ts
git commit -m "refactor: TaskStore to use database repositories"
```

---

## Phase 4-7: UI, Requirements Flow, MCP Updates

Due to length, the remaining phases are outlined:

### Phase 4: Update Webview Types
- Add Feature type to webview types
- Add new message types for features and requirements flow

### Phase 5: Update WebviewProvider
- Handle new feature messages (create, update, delete, reorder)
- Update HTTP bridge routes for features
- Update MCP tools to minimal set

### Phase 6: Update React UI
- Add feature sections with collapsing
- Add dropdown menu with quick add / requirements options
- Add drag-and-drop between features
- Add bug icon for task type

### Phase 7: Requirements Workflow
- Create RequirementsSession class with streaming Claude
- Add requirements wizard UI (input → questions → review)
- Handle session persistence and resumability

---

## Execution Notes

This plan covers the foundational database work. Phases 4-7 require more detailed breakdown once Phase 1-3 are complete and the data layer is stable.

Run `npm run compile` after each task to catch errors early.
Run the extension (`F5`) periodically to verify functionality.
