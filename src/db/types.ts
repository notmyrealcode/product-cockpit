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
