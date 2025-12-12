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
