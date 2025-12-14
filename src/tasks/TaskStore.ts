import * as vscode from 'vscode';
import { TaskRepo, FeatureRepo, ProjectRepo } from '../db';
import type { Task, Feature, Project, TaskStatus, NewTask, NewFeature } from '../db/types';

export class TaskStore {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
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

    getNextTodo(): Task | null {
        const tasks = TaskRepo.list({ status: 'todo', limit: 1 });
        return tasks[0] || null;
    }

    createTask(data: NewTask): Task {
        const result = TaskRepo.create(data);
        this._onDidChange.fire();
        return result;
    }

    addTask(title: string, description: string = '', featureId?: string, taskType: 'task' | 'bug' = 'task'): Task {
        return this.createTask({
            title,
            description,
            feature_id: featureId || null,
            type: taskType
        });
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

    // Legacy compatibility method
    async reorderTask(id: string, newIndex: number): Promise<boolean> {
        const tasks = this.getTasks();
        const oldIndex = tasks.findIndex(t => t.id === id);
        if (oldIndex === -1) return false;

        // Reorder the tasks array
        const reordered = [...tasks];
        const [task] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, task);

        // Save new order
        this.reorderTasks(reordered.map(t => t.id));
        return true;
    }

    // Stats
    getTaskCounts(): Record<TaskStatus, number> {
        return TaskRepo.countByStatus();
    }

    getDoneCount(): number {
        const counts = this.getTaskCounts();
        return counts.done;
    }

    // Cleanup - archive done tasks (delete from db)
    archiveDoneTasks(): number {
        const doneTasks = TaskRepo.list({ status: 'done' });
        doneTasks.forEach(t => TaskRepo.delete(t.id));
        this._onDidChange.fire();
        return doneTasks.length;
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}
