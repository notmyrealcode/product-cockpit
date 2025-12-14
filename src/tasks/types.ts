// Re-export types from db module for backward compatibility
export type { TaskStatus, TaskType, Task, TaskWithFeature, Feature, Project, NewTask, NewFeature } from '../db/types';

import type { Task } from '../db/types';

export interface TasksFile {
    version: number;
    tasks: Task[];
}

// Legacy Task type alias for webview - maps db Task to webview format
import type { Task as DbTask } from '../db/types';
export type WebviewTask = DbTask;
