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
