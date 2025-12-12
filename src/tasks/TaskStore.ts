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
