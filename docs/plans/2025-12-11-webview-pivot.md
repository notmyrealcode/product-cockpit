# Webview UI Pivot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace TreeView with a React-based Webview UI featuring draggable task cards.

**Architecture:** React app bundled with esbuild runs in VS Code Webview panel. Extension hosts WebviewProvider that serves HTML and handles bidirectional message passing. TaskStore remains the source of truth, now communicating with webview via postMessage API.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui components, @dnd-kit for drag-drop, esbuild bundler

---

### Task 1: Add React/Webview Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install React and build dependencies**

Run:
```bash
npm install react react-dom
npm install -D @types/react @types/react-dom tailwindcss postcss autoprefixer esbuild
```

**Step 2: Install dnd-kit for drag-drop**

Run:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 3: Install shadcn/ui dependencies**

Run:
```bash
npm install class-variance-authority clsx tailwind-merge lucide-react
```

**Step 4: Verify package.json has all dependencies**

Run: `cat package.json | grep -A 30 dependencies`

Expected: All packages listed above present

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add React, Tailwind, dnd-kit, and shadcn dependencies"
```

---

### Task 2: Configure Tailwind and esbuild

**Files:**
- Create: `tailwind.config.js`
- Create: `src/webview/index.css`
- Create: `esbuild.js`
- Modify: `package.json` (add build scripts)

**Step 1: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/webview/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // VS Code theme-aware colors
        'vscode-bg': 'var(--vscode-editor-background)',
        'vscode-fg': 'var(--vscode-editor-foreground)',
        'vscode-border': 'var(--vscode-panel-border)',
        'vscode-button-bg': 'var(--vscode-button-background)',
        'vscode-button-fg': 'var(--vscode-button-foreground)',
        'vscode-input-bg': 'var(--vscode-input-background)',
        'vscode-input-fg': 'var(--vscode-input-foreground)',
        'vscode-input-border': 'var(--vscode-input-border)',
      },
    },
  },
  plugins: [],
};
```

**Step 2: Create src/webview/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  padding: 0;
  margin: 0;
}
```

**Step 3: Create esbuild.js**

```javascript
const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Build Tailwind CSS
function buildTailwind() {
  execSync('npx tailwindcss -i ./src/webview/index.css -o ./out/webview/index.css' + (production ? ' --minify' : ''), {
    stdio: 'inherit',
  });
}

// Build React webview
async function buildWebview() {
  const ctx = await esbuild.context({
    entryPoints: ['src/webview/index.tsx'],
    bundle: true,
    outfile: 'out/webview/webview.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: production,
    sourcemap: !production,
    define: {
      'process.env.NODE_ENV': production ? '"production"' : '"development"',
    },
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching webview...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

async function main() {
  fs.mkdirSync('out/webview', { recursive: true });
  buildTailwind();
  await buildWebview();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Step 4: Update package.json scripts**

Add to scripts section in package.json:
```json
{
  "scripts": {
    "build:webview": "node esbuild.js",
    "build:webview:prod": "node esbuild.js --production",
    "watch:webview": "node esbuild.js --watch",
    "compile": "tsc -p ./ && npm run build:webview",
    "watch": "concurrently \"tsc -watch -p ./\" \"npm run watch:webview\""
  }
}
```

**Step 5: Install concurrently**

Run: `npm install -D concurrently`

**Step 6: Test build**

Run: `npm run build:webview`

Expected: Creates `out/webview/webview.js` and `out/webview/index.css`

**Step 7: Commit**

```bash
git add -A
git commit -m "Configure Tailwind and esbuild for webview"
```

---

### Task 3: Create Webview Entry Point and VS Code API Wrapper

**Files:**
- Create: `src/webview/index.tsx`
- Create: `src/webview/lib/vscode.ts`
- Create: `src/webview/types.ts`

**Step 1: Create src/webview/types.ts**

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

// Messages from extension to webview
export type ExtensionMessage =
  | { type: 'tasksUpdated'; tasks: Task[] }
  | { type: 'initialized'; tasks: Task[] };

// Messages from webview to extension
export type WebviewMessage =
  | { type: 'addTask'; description: string }
  | { type: 'updateTask'; id: string; updates: Partial<Task> }
  | { type: 'deleteTask'; id: string }
  | { type: 'reorderTasks'; taskIds: string[] }
  | { type: 'ready' };
```

**Step 2: Create src/webview/lib/vscode.ts**

```typescript
import type { WebviewMessage } from '../types';

interface VSCodeAPI {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

class VSCodeWrapper {
  private readonly vscodeApi: VSCodeAPI;

  constructor() {
    this.vscodeApi = acquireVsCodeApi();
  }

  public postMessage(message: WebviewMessage): void {
    this.vscodeApi.postMessage(message);
  }

  public getState<T>(): T | undefined {
    return this.vscodeApi.getState() as T | undefined;
  }

  public setState<T>(state: T): void {
    this.vscodeApi.setState(state);
  }
}

export const vscode = new VSCodeWrapper();
```

**Step 3: Create src/webview/index.tsx**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

**Step 4: Create placeholder src/webview/App.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { vscode } from './lib/vscode';
import type { Task, ExtensionMessage } from './types';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'initialized':
        case 'tasksUpdated':
          setTasks(message.tasks);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">Tasks ({tasks.length})</h1>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="p-3 rounded border border-vscode-border bg-vscode-input-bg"
          >
            <div className="font-medium">{task.description}</div>
            <div className="text-sm opacity-70">{task.status}</div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center opacity-50 py-8">No tasks yet</div>
        )}
      </div>
    </div>
  );
}
```

**Step 5: Build and verify**

Run: `npm run compile`

Expected: Compiles without errors, creates `out/webview/webview.js`

**Step 6: Commit**

```bash
git add -A
git commit -m "Add webview entry point and VS Code API wrapper"
```

---

### Task 4: Create WebviewProvider

**Files:**
- Create: `src/webview/WebviewProvider.ts`
- Modify: `src/extension.ts`

**Step 1: Create src/webview/WebviewProvider.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TaskStore } from '../tasks/TaskStore';
import type { WebviewMessage } from './types';

export class TaskWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'pmcockpit.taskView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly taskStore: TaskStore
  ) {
    // Listen to task changes and update webview
    taskStore.onDidChange(() => {
      this.sendTasksToWebview();
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      switch (message.type) {
        case 'ready':
          this.sendTasksToWebview();
          break;
        case 'addTask':
          await this.taskStore.addTask(message.description);
          break;
        case 'updateTask':
          await this.taskStore.updateTask(message.id, message.updates);
          break;
        case 'deleteTask':
          await this.taskStore.deleteTask(message.id);
          break;
        case 'reorderTasks':
          await this.reorderTasks(message.taskIds);
          break;
      }
    });
  }

  private async reorderTasks(taskIds: string[]): Promise<void> {
    // Reorder tasks based on new order of IDs
    for (let i = 0; i < taskIds.length; i++) {
      await this.taskStore.reorderTask(taskIds[i], i);
    }
  }

  private sendTasksToWebview(): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'tasksUpdated',
        tasks: this.taskStore.getTasks(),
      });
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'index.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>Product Cockpit</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

**Step 2: Update package.json to use webview instead of treeview**

Replace the views section:
```json
{
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
          "type": "webview",
          "id": "pmcockpit.taskView",
          "name": "Tasks",
          "when": "pmcockpit.initialized"
        }
      ]
    }
  }
}
```

**Step 3: Update src/extension.ts to use WebviewProvider**

```typescript
import * as vscode from 'vscode';
import { TaskStore } from './tasks/TaskStore';
import { TaskWebviewProvider } from './webview/WebviewProvider';
import { HttpBridge } from './http/bridge';
import { initialize, isInitialized } from './init/initialize';

let taskStore: TaskStore | undefined;
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

    // Initialize HTTP bridge for MCP
    httpBridge = new HttpBridge(taskStore, workspaceRoot, () => {
        vscode.window.showInformationMessage('Interview completed! Tasks and requirements refreshed.');
    });
    await httpBridge.start();

    // Initialize Webview Provider
    const webviewProvider = new TaskWebviewProvider(context.extensionUri, taskStore);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(TaskWebviewProvider.viewType, webviewProvider),
        taskStore,
        { dispose: () => httpBridge?.stop() }
    );
}

export function deactivate() {
    httpBridge?.stop();
}
```

**Step 4: Remove old TreeView files (optional cleanup)**

```bash
rm src/tasks/TaskProvider.ts src/tasks/TaskItem.ts
```

**Step 5: Build and verify**

Run: `npm run compile`

Expected: Compiles without errors

**Step 6: Commit**

```bash
git add -A
git commit -m "Add WebviewProvider, replace TreeView with Webview"
```

---

### Task 5: Add shadcn/ui Card and Badge Components

**Files:**
- Create: `src/webview/lib/utils.ts`
- Create: `src/webview/components/ui/card.tsx`
- Create: `src/webview/components/ui/badge.tsx`
- Create: `src/webview/components/ui/button.tsx`

**Step 1: Create src/webview/lib/utils.ts**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 2: Create src/webview/components/ui/card.tsx**

```tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-vscode-border bg-vscode-input-bg shadow-sm',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
```

**Step 3: Create src/webview/components/ui/badge.tsx**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        todo: 'bg-gray-500/20 text-gray-300',
        'in-progress': 'bg-blue-500/20 text-blue-300',
        'ready-for-signoff': 'bg-yellow-500/20 text-yellow-300',
        done: 'bg-green-500/20 text-green-300',
        rework: 'bg-red-500/20 text-red-300',
      },
    },
    defaultVariants: {
      variant: 'todo',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

**Step 4: Create src/webview/components/ui/button.tsx**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-vscode-button-bg text-vscode-button-fg hover:opacity-90',
        outline: 'border border-vscode-border bg-transparent hover:bg-vscode-input-bg',
        ghost: 'hover:bg-vscode-input-bg',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-8',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

**Step 5: Build and verify**

Run: `npm run compile`

Expected: Compiles without errors

**Step 6: Commit**

```bash
git add -A
git commit -m "Add shadcn/ui Card, Badge, and Button components"
```

---

### Task 6: Create TaskCard Component with Drag-and-Drop

**Files:**
- Create: `src/webview/components/TaskCard.tsx`
- Create: `src/webview/components/TaskList.tsx`
- Modify: `src/webview/App.tsx`

**Step 1: Create src/webview/components/TaskCard.tsx**

```tsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { Task, TaskStatus } from '../types';
import { vscode } from '../lib/vscode';
import { cn } from '../lib/utils';

interface TaskCardProps {
  task: Task;
}

const statusLabels: Record<TaskStatus, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'ready-for-signoff': 'Ready for Signoff',
  'done': 'Done',
  'rework': 'Rework',
};

export function TaskCard({ task }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleStatusChange = () => {
    const statuses: TaskStatus[] = ['todo', 'in-progress', 'ready-for-signoff', 'done', 'rework'];
    const currentIndex = statuses.indexOf(task.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    vscode.postMessage({ type: 'updateTask', id: task.id, updates: { status: nextStatus } });
  };

  const handleDelete = () => {
    vscode.postMessage({ type: 'deleteTask', id: task.id });
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'mb-2 transition-shadow',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <button
            className="mt-1 cursor-grab opacity-50 hover:opacity-100 touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-tight mb-2">{task.description}</p>
            <div className="flex items-center gap-2">
              <Badge
                variant={task.status}
                className="cursor-pointer"
                onClick={handleStatusChange}
              >
                {statusLabels[task.status]}
              </Badge>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-50 hover:opacity-100 hover:text-red-400"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create src/webview/components/TaskList.tsx**

```tsx
import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import type { Task } from '../types';
import { vscode } from '../lib/vscode';

interface TaskListProps {
  tasks: Task[];
  onReorder: (tasks: Task[]) => void;
}

export function TaskList({ tasks, onReorder }: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      const newTasks = arrayMove(tasks, oldIndex, newIndex);
      onReorder(newTasks);

      // Send new order to extension
      vscode.postMessage({
        type: 'reorderTasks',
        taskIds: newTasks.map((t) => t.id),
      });
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 opacity-50">
        <p>No tasks yet</p>
        <p className="text-sm mt-1">Add a task to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

**Step 3: Update src/webview/App.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { vscode } from './lib/vscode';
import { TaskList } from './components/TaskList';
import { Button } from './components/ui/button';
import type { Task, ExtensionMessage } from './types';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState('');

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'initialized':
        case 'tasksUpdated':
          setTasks(message.tasks);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleAddTask = () => {
    if (newTaskDescription.trim()) {
      vscode.postMessage({ type: 'addTask', description: newTaskDescription.trim() });
      setNewTaskDescription('');
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTaskDescription('');
    }
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-semibold uppercase tracking-wide opacity-70">
          Tasks ({tasks.length})
        </h1>
        <Button size="sm" variant="ghost" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isAdding && (
        <div className="mb-3">
          <input
            type="text"
            className="w-full px-3 py-2 text-sm rounded border border-vscode-input-border bg-vscode-input-bg text-vscode-input-fg focus:outline-none focus:border-vscode-button-bg"
            placeholder="Task description..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleAddTask}>
              Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <TaskList tasks={tasks} onReorder={setTasks} />
    </div>
  );
}
```

**Step 4: Build and verify**

Run: `npm run compile`

Expected: Compiles without errors

**Step 5: Commit**

```bash
git add -A
git commit -m "Add TaskCard and TaskList with drag-and-drop"
```

---

### Task 7: Update Commands and Cleanup

**Files:**
- Modify: `package.json` (remove old commands)
- Modify: `.vscodeignore`

**Step 1: Update package.json commands**

Remove the old task commands that are now handled by webview. Keep only initialize:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "pmcockpit.initialize",
        "title": "Product Cockpit: Initialize"
      }
    ],
    "menus": {}
  }
}
```

**Step 2: Update .vscodeignore**

Add webview source files to ignore:

```
.vscode/**
.vscode-test/**
src/**
.gitignore
tsconfig.json
tailwind.config.js
esbuild.js
**/*.map
node_modules/**
test-workspace/**
```

**Step 3: Build and verify**

Run: `npm run compile`

Expected: Compiles without errors

**Step 4: Commit**

```bash
git add -A
git commit -m "Cleanup: remove old TreeView commands, update vscodeignore"
```

---

### Task 8: Test Webview UI

**Step 1: Launch extension**

Press F5 to launch Extension Development Host

**Step 2: Initialize Product Cockpit**

1. Open Command Palette (Cmd+Shift+P)
2. Run "Product Cockpit: Initialize"
3. Click Initialize

**Step 3: Test task operations**

1. Click Product Cockpit icon in activity bar
2. Click "+" to add a task
3. Type description and press Enter
4. Add more tasks
5. Click status badge to cycle through statuses
6. Drag tasks to reorder
7. Click trash icon to delete

**Step 4: Verify MCP still works**

Run in terminal:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node .pmcockpit/mcp-server.js
```

Expected: JSON response with tool definitions

**Step 5: Commit if all works**

```bash
git add -A
git commit -m "Tested webview UI implementation"
```

---

### Task 9: Update TECH.md

**Files:**
- Modify: `docs/TECH.md`

**Step 1: Update docs/TECH.md**

```markdown
# Product Cockpit Technical Architecture

## Overview

VS Code extension with React Webview UI and MCP server for Claude Code task management.

## Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Webview UI     │────▶│   TaskStore     │◀────│   MCP Server    │
│  (React)        │     │  (single source │     │  (via HTTP)     │
└─────────────────┘     │   of truth)     │     └─────────────────┘
        │               └────────┬────────┘
        │ postMessage            │
        ▼                        ▼
  WebviewProvider        .pmcockpit/tasks.json
```

### TaskStore (`src/tasks/TaskStore.ts`)
Single source of truth for tasks. Emits `onDidChange` event on mutations. Watches file for external changes.

### WebviewProvider (`src/webview/WebviewProvider.ts`)
Hosts React webview, handles postMessage communication with UI. Translates UI actions to TaskStore operations.

### React UI (`src/webview/`)
- **App.tsx** - Main component, manages state
- **TaskList.tsx** - Sortable list with @dnd-kit
- **TaskCard.tsx** - Individual task card with status badge

### HttpBridge (`src/http/bridge.ts`)
Localhost HTTP server on random port. Writes port to `.pmcockpit/.port`. Routes MCP tool calls to TaskStore.

### MCP Server (`.pmcockpit/mcp-server.js`)
Standalone stdio server spawned by Claude Code. Reads port file, proxies JSON-RPC to HTTP bridge.

## Data Flow

**UI → Extension:**
1. User interacts with React UI
2. UI calls `vscode.postMessage({ type, ...data })`
3. WebviewProvider receives message
4. WebviewProvider calls TaskStore method
5. TaskStore saves and emits `onDidChange`
6. WebviewProvider sends updated tasks to webview

**MCP → Extension:**
1. Claude Code calls MCP tool
2. MCP server proxies to HTTP bridge
3. HttpBridge calls TaskStore method
4. TaskStore saves and emits `onDidChange`
5. WebviewProvider sends updated tasks to webview

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React 18 |
| Components | shadcn/ui (Card, Badge, Button) |
| Drag-and-Drop | @dnd-kit |
| Styling | Tailwind CSS |
| Build | esbuild + tsc |

## File Locations

| File | Purpose |
|------|---------|
| `.pmcockpit/tasks.json` | Task data |
| `.pmcockpit/mcp-server.js` | MCP server |
| `.pmcockpit/.port` | HTTP bridge port |
| `docs/requirements/*.md` | Requirement docs |
| `.claude/mcp.json` | MCP config |
| `.claude/settings.json` | Tool permissions |
| `out/webview/webview.js` | Bundled React app |
| `out/webview/index.css` | Bundled Tailwind CSS |

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_next_task` | Returns highest-priority todo task |
| `get_task` | Returns task by ID |
| `update_task_status` | Updates task status |
| `create_task` | Creates new task |
| `list_requirements` | Lists requirement files |
| `get_requirements_path` | Returns requirements folder path |
| `get_task_requirement` | Returns requirement path for task |
| `create_requirement` | Creates requirement file |
| `complete_interview` | Signals interview completion |
```

**Step 2: Commit**

```bash
git add -A
git commit -m "Update TECH.md for webview architecture"
```

---

## Summary

9 tasks total:
1. Add React/webview dependencies
2. Configure Tailwind and esbuild
3. Create webview entry point and VS Code API wrapper
4. Create WebviewProvider
5. Add shadcn/ui components
6. Create TaskCard with drag-and-drop
7. Update commands and cleanup
8. Test webview UI
9. Update TECH.md

After completing all tasks, you'll have a React-based card UI replacing the TreeView.
