# M1 + M2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a VS Code extension with TreeView task management and MCP server for Claude Code integration.

**Architecture:** TaskStore is the single source of truth, read by both TreeView (UI) and MCP server (via HTTP bridge). Extension hosts HTTP server on random port; standalone MCP server proxies Claude Code tool calls to it.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js HTTP, MCP SDK (@modelcontextprotocol/sdk)

---

### Task 1: Scaffold VS Code Extension

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/extension.ts`
- Create: `.vscodeignore`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "product-cockpit",
  "displayName": "Product Cockpit",
  "description": "Task management for AI coding agents",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "pmcockpit",
          "title": "Product Cockpit",
          "icon": "$(tasklist)"
        }
      ]
    },
    "views": {
      "pmcockpit": [
        {
          "id": "pmcockpit.tasks",
          "name": "Tasks",
          "when": "pmcockpit.initialized"
        }
      ]
    },
    "commands": [
      {
        "command": "pmcockpit.initialize",
        "title": "Product Cockpit: Initialize"
      },
      {
        "command": "pmcockpit.addTask",
        "title": "Add Task",
        "icon": "$(add)"
      },
      {
        "command": "pmcockpit.editTask",
        "title": "Edit Task"
      },
      {
        "command": "pmcockpit.setStatus",
        "title": "Set Status"
      },
      {
        "command": "pmcockpit.deleteTask",
        "title": "Delete Task"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "pmcockpit.addTask",
          "when": "view == pmcockpit.tasks",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "pmcockpit.editTask",
          "when": "viewItem == task"
        },
        {
          "command": "pmcockpit.setStatus",
          "when": "viewItem == task"
        },
        {
          "command": "pmcockpit.deleteTask",
          "when": "viewItem == task"
        }
      ]
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src --ext ts"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/vscode": "^1.85.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "eslint": "^8.54.0",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "uuid": "^9.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "out",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}
```

**Step 3: Create src/extension.ts**

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Product Cockpit is now active');
}

export function deactivate() {}
```

**Step 4: Create .vscodeignore**

```
.vscode/**
.vscode-test/**
src/**
.gitignore
tsconfig.json
**/*.map
node_modules/**
```

**Step 5: Create .gitignore**

```
out/
node_modules/
*.vsix
.vscode-test/
```

**Step 6: Install dependencies and compile**

Run: `npm install && npm run compile`
Expected: Compiles without errors, creates `out/extension.js`

**Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold VS Code extension"
```

---

### Task 2: Task Types and Store

**Files:**
- Create: `src/tasks/types.ts`
- Create: `src/tasks/TaskStore.ts`

**Step 1: Create src/tasks/types.ts**

```typescript
export type TaskStatus = 'todo' | 'in-progress' | 'ready-for-signoff' | 'done' | 'rework';

export interface Task {
    id: string;
    description: string;
    status: TaskStatus;
    priority: number;
    requirementPath?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TasksFile {
    version: number;
    tasks: Task[];
}
```

**Step 2: Create src/tasks/TaskStore.ts**

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Task, TasksFile, TaskStatus } from './types';
import { v4 as uuidv4 } from 'uuid';

export class TaskStore {
    private tasks: Task[] = [];
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private watcher: vscode.FileSystemWatcher | undefined;
    private saving = false;

    constructor(private workspaceRoot: string) {}

    get tasksFilePath(): string {
        return path.join(this.workspaceRoot, '.pmcockpit', 'tasks.json');
    }

    async load(): Promise<void> {
        try {
            const content = await fs.promises.readFile(this.tasksFilePath, 'utf-8');
            const data: TasksFile = JSON.parse(content);
            this.tasks = data.tasks;
            this.startWatching();
        } catch {
            this.tasks = [];
        }
    }

    private startWatching(): void {
        if (this.watcher) return;
        this.watcher = vscode.workspace.createFileSystemWatcher(this.tasksFilePath);
        this.watcher.onDidChange(async () => {
            if (this.saving) return;
            await this.load();
            this._onDidChange.fire();
        });
    }

    private async save(): Promise<void> {
        this.saving = true;
        try {
            const data: TasksFile = { version: 1, tasks: this.tasks };
            const dir = path.dirname(this.tasksFilePath);
            await fs.promises.mkdir(dir, { recursive: true });
            const tempPath = this.tasksFilePath + '.tmp';
            await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2));
            await fs.promises.rename(tempPath, this.tasksFilePath);
        } finally {
            this.saving = false;
        }
    }

    getTasks(): Task[] {
        return [...this.tasks];
    }

    getNextTodo(): Task | null {
        return this.tasks.find(t => t.status === 'todo') || null;
    }

    getTask(id: string): Task | null {
        return this.tasks.find(t => t.id === id) || null;
    }

    async addTask(description: string, requirementPath?: string): Promise<Task> {
        const now = new Date().toISOString();
        const task: Task = {
            id: uuidv4(),
            description,
            status: 'todo',
            priority: this.tasks.length,
            requirementPath,
            createdAt: now,
            updatedAt: now
        };
        this.tasks.push(task);
        await this.save();
        this._onDidChange.fire();
        return task;
    }

    async updateTask(id: string, updates: Partial<Pick<Task, 'description' | 'status' | 'requirementPath'>>): Promise<Task | null> {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return null;
        Object.assign(task, updates, { updatedAt: new Date().toISOString() });
        await this.save();
        this._onDidChange.fire();
        return task;
    }

    async deleteTask(id: string): Promise<boolean> {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index === -1) return false;
        this.tasks.splice(index, 1);
        this.recalculatePriorities();
        await this.save();
        this._onDidChange.fire();
        return true;
    }

    async reorderTask(id: string, newIndex: number): Promise<boolean> {
        const oldIndex = this.tasks.findIndex(t => t.id === id);
        if (oldIndex === -1) return false;
        const [task] = this.tasks.splice(oldIndex, 1);
        this.tasks.splice(newIndex, 0, task);
        this.recalculatePriorities();
        await this.save();
        this._onDidChange.fire();
        return true;
    }

    private recalculatePriorities(): void {
        this.tasks.forEach((task, index) => {
            task.priority = index;
        });
    }

    dispose(): void {
        this.watcher?.dispose();
        this._onDidChange.dispose();
    }
}
```

**Step 3: Add @types/uuid**

Run: `npm install --save-dev @types/uuid`

**Step 4: Compile and verify**

Run: `npm run compile`
Expected: Compiles without errors

**Step 5: Commit**

```bash
git add -A
git commit -m "Add Task types and TaskStore"
```

---

### Task 3: TreeView Provider

**Files:**
- Create: `src/tasks/TaskItem.ts`
- Create: `src/tasks/TaskProvider.ts`

**Step 1: Create src/tasks/TaskItem.ts**

```typescript
import * as vscode from 'vscode';
import { Task, TaskStatus } from './types';

const STATUS_ICONS: Record<TaskStatus, string> = {
    'todo': '$(circle-outline)',
    'in-progress': '$(sync~spin)',
    'ready-for-signoff': '$(eye)',
    'done': '$(check)',
    'rework': '$(issues)'
};

export class TaskItem extends vscode.TreeItem {
    constructor(public readonly task: Task) {
        super(task.description, vscode.TreeItemCollapsibleState.None);
        this.id = task.id;
        this.description = task.status;
        this.iconPath = new vscode.ThemeIcon(this.getIconId(task.status));
        this.contextValue = 'task';
        this.tooltip = `${task.description}\nStatus: ${task.status}\nPriority: ${task.priority + 1}`;
    }

    private getIconId(status: TaskStatus): string {
        const icons: Record<TaskStatus, string> = {
            'todo': 'circle-outline',
            'in-progress': 'sync',
            'ready-for-signoff': 'eye',
            'done': 'check',
            'rework': 'issues'
        };
        return icons[status];
    }
}
```

**Step 2: Create src/tasks/TaskProvider.ts**

```typescript
import * as vscode from 'vscode';
import { TaskStore } from './TaskStore';
import { TaskItem } from './TaskItem';
import { Task } from './types';

const MIME_TYPE = 'application/vnd.code.tree.pmcockpit.tasks';

export class TaskProvider implements vscode.TreeDataProvider<TaskItem>, vscode.TreeDragAndDropController<TaskItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TaskItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    readonly dropMimeTypes = [MIME_TYPE];
    readonly dragMimeTypes = [MIME_TYPE];

    constructor(private taskStore: TaskStore) {
        taskStore.onDidChange(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TaskItem): vscode.TreeItem {
        return element;
    }

    getChildren(): TaskItem[] {
        return this.taskStore.getTasks().map(task => new TaskItem(task));
    }

    handleDrag(source: readonly TaskItem[], dataTransfer: vscode.DataTransfer): void {
        dataTransfer.set(MIME_TYPE, new vscode.DataTransferItem(source.map(s => s.task.id)));
    }

    async handleDrop(target: TaskItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
        const transferItem = dataTransfer.get(MIME_TYPE);
        if (!transferItem) return;

        const draggedIds: string[] = transferItem.value;
        if (draggedIds.length === 0) return;

        const tasks = this.taskStore.getTasks();
        const targetIndex = target ? tasks.findIndex(t => t.id === target.task.id) : tasks.length;

        for (const id of draggedIds) {
            await this.taskStore.reorderTask(id, targetIndex);
        }
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
```

**Step 3: Compile and verify**

Run: `npm run compile`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add -A
git commit -m "Add TaskItem and TaskProvider for TreeView"
```

---

### Task 4: Initialization Flow

**Files:**
- Create: `src/init/initialize.ts`

**Step 1: Create src/init/initialize.ts**

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const MCP_SERVER_TEMPLATE = `#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const portFile = path.join(__dirname, '.port');
let port;

function waitForPort() {
    return new Promise((resolve, reject) => {
        const check = () => {
            try {
                port = parseInt(fs.readFileSync(portFile, 'utf-8').trim());
                resolve(port);
            } catch {
                setTimeout(check, 100);
            }
        };
        check();
        setTimeout(() => reject(new Error('Timeout waiting for port')), 30000);
    });
}

async function callBridge(method, endpoint, body) {
    await waitForPort();
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port,
            path: endpoint,
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const tools = {
    get_next_task: async () => callBridge('GET', '/tasks/next'),
    get_task: async ({ task_id }) => callBridge('GET', \`/tasks/\${task_id}\`),
    update_task_status: async ({ task_id, status }) => callBridge('PATCH', \`/tasks/\${task_id}/status\`, { status }),
    create_task: async ({ description, requirementPath }) => callBridge('POST', '/tasks', { description, requirementPath }),
    list_requirements: async () => callBridge('GET', '/requirements'),
    get_requirements_path: async () => callBridge('GET', '/requirements/path'),
    get_task_requirement: async ({ task_id }) => callBridge('GET', \`/tasks/\${task_id}/requirement\`),
    create_requirement: async ({ path: reqPath, content }) => callBridge('POST', '/requirements', { path: reqPath, content }),
    complete_interview: async ({ requirement_path, task_ids }) => callBridge('POST', '/interview/complete', { requirement_path, task_ids })
};

const toolDefinitions = [
    { name: 'get_next_task', description: 'Get the highest-priority todo task', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_task', description: 'Get a task by ID', inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
    { name: 'update_task_status', description: 'Update task status', inputSchema: { type: 'object', properties: { task_id: { type: 'string' }, status: { type: 'string', enum: ['todo', 'in-progress', 'ready-for-signoff', 'done', 'rework'] } }, required: ['task_id', 'status'] } },
    { name: 'create_task', description: 'Create a new task', inputSchema: { type: 'object', properties: { description: { type: 'string' }, requirementPath: { type: 'string' } }, required: ['description'] } },
    { name: 'list_requirements', description: 'List all requirement files', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_requirements_path', description: 'Get the requirements folder path', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_task_requirement', description: 'Get the requirement path for a task', inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
    { name: 'create_requirement', description: 'Create a requirement file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
    { name: 'complete_interview', description: 'Signal interview completion', inputSchema: { type: 'object', properties: { requirement_path: { type: 'string' }, task_ids: { type: 'array', items: { type: 'string' } } } } }
];

process.stdin.setEncoding('utf-8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const msg = JSON.parse(line);
            let response;

            if (msg.method === 'initialize') {
                response = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'pmcockpit', version: '0.0.1' } } };
            } else if (msg.method === 'tools/list') {
                response = { jsonrpc: '2.0', id: msg.id, result: { tools: toolDefinitions } };
            } else if (msg.method === 'tools/call') {
                const { name, arguments: args } = msg.params;
                const result = await tools[name](args || {});
                response = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } };
            } else if (msg.method === 'notifications/initialized') {
                continue;
            } else {
                response = { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } };
            }

            process.stdout.write(JSON.stringify(response) + '\\n');
        } catch (e) {
            process.stderr.write('Error: ' + e.message + '\\n');
        }
    }
});
`;

export async function initialize(workspaceRoot: string): Promise<boolean> {
    const choice = await vscode.window.showInformationMessage(
        'Product Cockpit needs to set up files in your project:\\n\\n' +
        '• .pmcockpit/tasks.json — Task queue storage\\n' +
        '• .pmcockpit/mcp-server.js — MCP server for Claude Code\\n' +
        '• docs/requirements/ — Requirements documents folder\\n' +
        '• .claude/settings.json — Tool permissions (merged)\\n' +
        '• .claude/mcp.json — MCP config (merged)',
        { modal: true },
        'Initialize',
        'Cancel'
    );

    if (choice !== 'Initialize') {
        return false;
    }

    const pmcockpitDir = path.join(workspaceRoot, '.pmcockpit');
    const requirementsDir = path.join(workspaceRoot, 'docs', 'requirements');
    const claudeDir = path.join(workspaceRoot, '.claude');

    // Create directories
    await fs.promises.mkdir(pmcockpitDir, { recursive: true });
    await fs.promises.mkdir(requirementsDir, { recursive: true });
    await fs.promises.mkdir(claudeDir, { recursive: true });

    // Create tasks.json
    const tasksFile = path.join(pmcockpitDir, 'tasks.json');
    await fs.promises.writeFile(tasksFile, JSON.stringify({ version: 1, tasks: [] }, null, 2));

    // Create MCP server
    const mcpServerFile = path.join(pmcockpitDir, 'mcp-server.js');
    await fs.promises.writeFile(mcpServerFile, MCP_SERVER_TEMPLATE);

    // Merge .claude/settings.json
    await mergeClaudeSettings(claudeDir);

    // Merge .claude/mcp.json
    await mergeClaudeMcp(claudeDir);

    vscode.window.showInformationMessage('Product Cockpit initialized successfully!');
    return true;
}

async function mergeClaudeSettings(claudeDir: string): Promise<void> {
    const settingsFile = path.join(claudeDir, 'settings.json');
    let settings: Record<string, unknown> = {};

    try {
        const content = await fs.promises.readFile(settingsFile, 'utf-8');
        settings = JSON.parse(content);
    } catch {
        // File doesn't exist
    }

    const allowedTools = (settings.allowedTools as string[]) || [];
    const mcpTools = [
        'mcp__pmcockpit__get_next_task',
        'mcp__pmcockpit__get_task',
        'mcp__pmcockpit__update_task_status',
        'mcp__pmcockpit__create_task',
        'mcp__pmcockpit__create_requirement',
        'mcp__pmcockpit__complete_interview',
        'mcp__pmcockpit__list_requirements',
        'mcp__pmcockpit__get_requirements_path',
        'mcp__pmcockpit__get_task_requirement'
    ];

    for (const tool of mcpTools) {
        if (!allowedTools.includes(tool)) {
            allowedTools.push(tool);
        }
    }

    settings.allowedTools = allowedTools;
    await fs.promises.writeFile(settingsFile, JSON.stringify(settings, null, 2));
}

async function mergeClaudeMcp(claudeDir: string): Promise<void> {
    const mcpFile = path.join(claudeDir, 'mcp.json');
    let mcp: Record<string, unknown> = {};

    try {
        const content = await fs.promises.readFile(mcpFile, 'utf-8');
        mcp = JSON.parse(content);
    } catch {
        // File doesn't exist
    }

    const mcpServers = (mcp.mcpServers as Record<string, unknown>) || {};
    mcpServers.pmcockpit = {
        command: 'node',
        args: ['.pmcockpit/mcp-server.js']
    };

    mcp.mcpServers = mcpServers;
    await fs.promises.writeFile(mcpFile, JSON.stringify(mcp, null, 2));
}

export function isInitialized(workspaceRoot: string): boolean {
    const tasksFile = path.join(workspaceRoot, '.pmcockpit', 'tasks.json');
    return fs.existsSync(tasksFile);
}
```

**Step 2: Compile and verify**

Run: `npm run compile`
Expected: Compiles without errors

**Step 3: Commit**

```bash
git add -A
git commit -m "Add initialization flow with MCP server template"
```

---

### Task 5: HTTP Bridge Server

**Files:**
- Create: `src/http/bridge.ts`

**Step 1: Create src/http/bridge.ts**

```typescript
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { TaskStore } from '../tasks/TaskStore';
import { TaskStatus } from '../tasks/types';

export class HttpBridge {
    private server: http.Server | undefined;
    private port: number = 0;

    constructor(
        private taskStore: TaskStore,
        private workspaceRoot: string,
        private onInterviewComplete: () => void
    ) {}

    async start(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(async (req, res) => {
                await this.handleRequest(req, res);
            });

            this.server.listen(0, '127.0.0.1', () => {
                const addr = this.server!.address();
                if (typeof addr === 'object' && addr) {
                    this.port = addr.port;
                    this.writePortFile();
                    resolve(this.port);
                } else {
                    reject(new Error('Failed to get server address'));
                }
            });

            this.server.on('error', reject);
        });
    }

    private writePortFile(): void {
        const portFile = path.join(this.workspaceRoot, '.pmcockpit', '.port');
        fs.writeFileSync(portFile, String(this.port));
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
        const pathname = url.pathname;
        const method = req.method || 'GET';

        res.setHeader('Content-Type', 'application/json');

        try {
            const body = await this.readBody(req);
            const result = await this.route(method, pathname, body);
            res.writeHead(200);
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: (err as Error).message }));
        }
    }

    private async readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
        return new Promise((resolve) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : {});
                } catch {
                    resolve({});
                }
            });
        });
    }

    private async route(method: string, pathname: string, body: Record<string, unknown>): Promise<unknown> {
        // GET /tasks/next
        if (method === 'GET' && pathname === '/tasks/next') {
            return this.taskStore.getNextTodo();
        }

        // GET /tasks/:id
        const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
        if (method === 'GET' && taskMatch) {
            return this.taskStore.getTask(taskMatch[1]);
        }

        // PATCH /tasks/:id/status
        const statusMatch = pathname.match(/^\/tasks\/([^/]+)\/status$/);
        if (method === 'PATCH' && statusMatch) {
            const status = body.status as TaskStatus;
            return this.taskStore.updateTask(statusMatch[1], { status });
        }

        // POST /tasks
        if (method === 'POST' && pathname === '/tasks') {
            const description = body.description as string;
            const requirementPath = body.requirementPath as string | undefined;
            return this.taskStore.addTask(description, requirementPath);
        }

        // GET /requirements
        if (method === 'GET' && pathname === '/requirements') {
            return this.listRequirements();
        }

        // GET /requirements/path
        if (method === 'GET' && pathname === '/requirements/path') {
            return { path: path.join(this.workspaceRoot, 'docs', 'requirements') };
        }

        // GET /tasks/:id/requirement
        const reqMatch = pathname.match(/^\/tasks\/([^/]+)\/requirement$/);
        if (method === 'GET' && reqMatch) {
            const task = this.taskStore.getTask(reqMatch[1]);
            return { path: task?.requirementPath || null };
        }

        // POST /requirements
        if (method === 'POST' && pathname === '/requirements') {
            const reqPath = body.path as string;
            const content = body.content as string;
            return this.createRequirement(reqPath, content);
        }

        // POST /interview/complete
        if (method === 'POST' && pathname === '/interview/complete') {
            this.onInterviewComplete();
            return { success: true };
        }

        return { error: 'Not found' };
    }

    private async listRequirements(): Promise<{ files: Array<{ path: string; title: string }> }> {
        const requirementsDir = path.join(this.workspaceRoot, 'docs', 'requirements');
        try {
            const files = await fs.promises.readdir(requirementsDir);
            const mdFiles = files.filter(f => f.endsWith('.md'));
            const result = await Promise.all(mdFiles.map(async (file) => {
                const filePath = path.join(requirementsDir, file);
                const content = await fs.promises.readFile(filePath, 'utf-8');
                const titleMatch = content.match(/^#\s+(.+)$/m);
                return {
                    path: path.join('docs', 'requirements', file),
                    title: titleMatch ? titleMatch[1] : file.replace('.md', '')
                };
            }));
            return { files: result };
        } catch {
            return { files: [] };
        }
    }

    private async createRequirement(reqPath: string, content: string): Promise<{ path: string; title: string }> {
        const fullPath = path.join(this.workspaceRoot, reqPath);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, content);
        const titleMatch = content.match(/^#\s+(.+)$/m);
        return {
            path: reqPath,
            title: titleMatch ? titleMatch[1] : path.basename(reqPath, '.md')
        };
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            const portFile = path.join(this.workspaceRoot, '.pmcockpit', '.port');
            try {
                fs.unlinkSync(portFile);
            } catch {
                // Ignore
            }
        }
    }
}
```

**Step 2: Compile and verify**

Run: `npm run compile`
Expected: Compiles without errors

**Step 3: Commit**

```bash
git add -A
git commit -m "Add HTTP bridge for MCP server communication"
```

---

### Task 6: Wire Up Extension

**Files:**
- Modify: `src/extension.ts`

**Step 1: Update src/extension.ts**

```typescript
import * as vscode from 'vscode';
import { TaskStore } from './tasks/TaskStore';
import { TaskProvider } from './tasks/TaskProvider';
import { HttpBridge } from './http/bridge';
import { initialize, isInitialized } from './init/initialize';
import { TaskStatus } from './tasks/types';

let taskStore: TaskStore | undefined;
let taskProvider: TaskProvider | undefined;
let httpBridge: HttpBridge | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }

    // Register initialize command (always available)
    context.subscriptions.push(
        vscode.commands.registerCommand('pmcockpit.initialize', async () => {
            const success = await initialize(workspaceRoot);
            if (success) {
                await activateExtension(context, workspaceRoot);
            }
        })
    );

    // Check if already initialized
    if (isInitialized(workspaceRoot)) {
        await activateExtension(context, workspaceRoot);
    }
}

async function activateExtension(context: vscode.ExtensionContext, workspaceRoot: string): Promise<void> {
    // Set context for UI visibility
    vscode.commands.executeCommand('setContext', 'pmcockpit.initialized', true);

    // Initialize TaskStore
    taskStore = new TaskStore(workspaceRoot);
    await taskStore.load();

    // Initialize HTTP bridge
    httpBridge = new HttpBridge(taskStore, workspaceRoot, () => {
        taskProvider?.refresh();
        vscode.window.showInformationMessage('Interview completed! Tasks and requirements refreshed.');
    });
    await httpBridge.start();

    // Initialize TreeView
    taskProvider = new TaskProvider(taskStore);
    const treeView = vscode.window.createTreeView('pmcockpit.tasks', {
        treeDataProvider: taskProvider,
        dragAndDropController: taskProvider
    });

    // Register commands
    context.subscriptions.push(
        treeView,
        taskStore,
        { dispose: () => httpBridge?.stop() },

        vscode.commands.registerCommand('pmcockpit.addTask', async () => {
            const description = await vscode.window.showInputBox({
                prompt: 'Enter task description',
                placeHolder: 'What needs to be done?'
            });
            if (description) {
                await taskStore!.addTask(description);
            }
        }),

        vscode.commands.registerCommand('pmcockpit.editTask', async (item) => {
            if (!item?.task) return;
            const description = await vscode.window.showInputBox({
                prompt: 'Edit task description',
                value: item.task.description
            });
            if (description !== undefined) {
                await taskStore!.updateTask(item.task.id, { description });
            }
        }),

        vscode.commands.registerCommand('pmcockpit.setStatus', async (item) => {
            if (!item?.task) return;
            const statuses: TaskStatus[] = ['todo', 'in-progress', 'ready-for-signoff', 'done', 'rework'];
            const status = await vscode.window.showQuickPick(statuses, {
                placeHolder: 'Select status'
            });
            if (status) {
                await taskStore!.updateTask(item.task.id, { status: status as TaskStatus });
            }
        }),

        vscode.commands.registerCommand('pmcockpit.deleteTask', async (item) => {
            if (!item?.task) return;
            const confirm = await vscode.window.showWarningMessage(
                `Delete task "${item.task.description}"?`,
                { modal: true },
                'Delete'
            );
            if (confirm === 'Delete') {
                await taskStore!.deleteTask(item.task.id);
            }
        })
    );
}

export function deactivate() {
    httpBridge?.stop();
}
```

**Step 2: Compile and verify**

Run: `npm run compile`
Expected: Compiles without errors

**Step 3: Commit**

```bash
git add -A
git commit -m "Wire up extension with commands and TreeView"
```

---

### Task 7: Test Extension Manually

**Step 1: Launch extension in debug mode**

Press `F5` in VS Code (or Run > Start Debugging). This opens an Extension Development Host window.

**Step 2: Initialize Product Cockpit**

1. Open Command Palette (`Cmd+Shift+P`)
2. Run "Product Cockpit: Initialize"
3. Click "Initialize" in dialog
4. Verify files created in `.pmcockpit/` and `.claude/`

**Step 3: Test task operations**

1. Click the Product Cockpit icon in activity bar
2. Click "+" to add a task
3. Right-click task → Set Status → "in-progress"
4. Drag task to reorder (if you have multiple)
5. Right-click → Delete

**Step 4: Test MCP server**

1. In terminal, run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node .pmcockpit/mcp-server.js`
2. Should see JSON response with server info

**Step 5: Commit if all works**

```bash
git add -A
git commit -m "Tested M1+M2 implementation"
```

---

### Task 8: Create TECH.md

**Files:**
- Create: `docs/TECH.md`

**Step 1: Create docs/TECH.md**

```markdown
# Product Cockpit Technical Architecture

## Overview

VS Code extension with TreeView UI and MCP server for Claude Code task management.

## Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TreeView UI   │────▶│   TaskStore     │◀────│   MCP Server    │
│  (TaskProvider) │     │  (single source │     │  (via HTTP)     │
└─────────────────┘     │   of truth)     │     └─────────────────┘
                        └────────┬────────┘
                                 │
                                 ▼
                        .pmcockpit/tasks.json
```

### TaskStore (`src/tasks/TaskStore.ts`)
Single source of truth for tasks. Emits `onDidChange` event on mutations. Watches file for external changes.

### TaskProvider (`src/tasks/TaskProvider.ts`)
TreeDataProvider + TreeDragAndDropController for VS Code sidebar. Subscribes to TaskStore changes.

### HttpBridge (`src/http/bridge.ts`)
Localhost HTTP server on random port. Writes port to `.pmcockpit/.port`. Routes MCP tool calls to TaskStore.

### MCP Server (`.pmcockpit/mcp-server.js`)
Standalone stdio server. Reads port file, proxies JSON-RPC to HTTP bridge.

## Data Flow

1. User/Claude Code initiates action
2. TreeView command or MCP tool call
3. TaskStore mutates state and saves
4. `onDidChange` fires
5. TreeView refreshes

## File Locations

| File | Purpose |
|------|---------|
| `.pmcockpit/tasks.json` | Task data |
| `.pmcockpit/mcp-server.js` | MCP server |
| `.pmcockpit/.port` | HTTP bridge port |
| `docs/requirements/*.md` | Requirement docs |
| `.claude/mcp.json` | MCP config |
| `.claude/settings.json` | Tool permissions |
```

**Step 2: Commit**

```bash
git add -A
git commit -m "Add TECH.md documentation"
```

---

## Summary

8 tasks total:
1. Scaffold extension
2. Task types and store
3. TreeView provider
4. Initialization flow
5. HTTP bridge
6. Wire up extension
7. Manual testing
8. Documentation

After completing all tasks, you'll have M1 (Core Task Management) and M2 (MCP Integration) fully working.
