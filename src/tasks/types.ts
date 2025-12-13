export type TaskStatus = 'todo' | 'in-progress' | 'ready-for-signoff' | 'done' | 'rework';

export interface Task {
    id: string;
    title: string;
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
