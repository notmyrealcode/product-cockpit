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
    private saveQueue: Promise<void> = Promise.resolve();

    constructor(private workspaceRoot: string) {}

    get tasksFilePath(): string {
        return path.join(this.workspaceRoot, '.pmcockpit', 'tasks.json');
    }

    get archiveFilePath(): string {
        return path.join(this.workspaceRoot, '.pmcockpit', 'tasks-archive.json');
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

    private save(): Promise<void> {
        // Queue saves to prevent race conditions
        this.saveQueue = this.saveQueue.then(() => this.doSave()).catch(() => this.doSave());
        return this.saveQueue;
    }

    private async doSave(): Promise<void> {
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

    async addTask(title: string, description: string = '', requirementPath?: string): Promise<Task> {
        const now = new Date().toISOString();
        const task: Task = {
            id: uuidv4(),
            title,
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

    async updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'requirementPath'>>): Promise<Task | null> {
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

    public async reorderTasks(taskIds: string[]): Promise<void> {
        const taskMap = new Map(this.tasks.map(t => [t.id, t]));
        const reordered: Task[] = [];

        for (let i = 0; i < taskIds.length; i++) {
            const task = taskMap.get(taskIds[i]);
            if (task) {
                task.priority = i;
                task.updatedAt = new Date().toISOString();
                reordered.push(task);
                taskMap.delete(taskIds[i]);
            }
        }

        // Add any remaining tasks not in the reorder list
        for (const task of taskMap.values()) {
            reordered.push(task);
        }

        this.tasks = reordered;
        this.recalculatePriorities();
        await this.save();
        this._onDidChange.fire();
    }

    private recalculatePriorities(): void {
        this.tasks.forEach((task, index) => {
            task.priority = index;
        });
    }

    async archiveDoneTasks(): Promise<number> {
        const doneTasks = this.tasks.filter(t => t.status === 'done');
        if (doneTasks.length === 0) return 0;

        // Load existing archive
        let archive: TasksFile = { version: 1, tasks: [] };
        try {
            const content = await fs.promises.readFile(this.archiveFilePath, 'utf-8');
            archive = JSON.parse(content);
        } catch {
            // Archive doesn't exist yet
        }

        // Add done tasks to archive (prepend so newest are first)
        archive.tasks = [...doneTasks, ...archive.tasks];

        // Save archive
        await fs.promises.writeFile(this.archiveFilePath, JSON.stringify(archive, null, 2));

        // Remove done tasks from active list
        this.tasks = this.tasks.filter(t => t.status !== 'done');
        this.recalculatePriorities();
        await this.save();
        this._onDidChange.fire();

        return doneTasks.length;
    }

    getDoneCount(): number {
        return this.tasks.filter(t => t.status === 'done').length;
    }

    dispose(): void {
        this.watcher?.dispose();
        this._onDidChange.dispose();
    }
}
