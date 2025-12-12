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
