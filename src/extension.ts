import * as vscode from 'vscode';
import { TaskStore } from './tasks/TaskStore';
import { TaskProvider } from './tasks/TaskProvider';
import { HttpBridge } from './http/bridge';
import { initialize, isInitialized } from './init/initialize';
import { TaskStatus } from './tasks/types';

let taskStore: TaskStore | undefined;
let taskProvider: TaskProvider | undefined;
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

    // Initialize HTTP bridge
    httpBridge = new HttpBridge(taskStore, workspaceRoot, () => {
        taskProvider?.refresh();
        vscode.window.showInformationMessage('Interview completed! Tasks and requirements refreshed.');
    });
    await httpBridge.start();

    // Initialize TreeView
    taskProvider = new TaskProvider(taskStore);
    const treeView = vscode.window.createTreeView('pmcockpit.tasks', {
        treeDataProvider: taskProvider,
        dragAndDropController: taskProvider
    });

    // Register commands
    context.subscriptions.push(
        treeView,
        taskStore,
        { dispose: () => httpBridge?.stop() },

        vscode.commands.registerCommand('pmcockpit.addTask', async () => {
            const description = await vscode.window.showInputBox({
                prompt: 'Enter task description',
                placeHolder: 'What needs to be done?'
            });
            if (description) {
                await taskStore!.addTask(description);
            }
        }),

        vscode.commands.registerCommand('pmcockpit.editTask', async (item) => {
            if (!item?.task) return;
            const description = await vscode.window.showInputBox({
                prompt: 'Edit task description',
                value: item.task.description
            });
            if (description !== undefined) {
                await taskStore!.updateTask(item.task.id, { description });
            }
        }),

        vscode.commands.registerCommand('pmcockpit.setStatus', async (item) => {
            if (!item?.task) return;
            const statuses: TaskStatus[] = ['todo', 'in-progress', 'ready-for-signoff', 'done', 'rework'];
            const status = await vscode.window.showQuickPick(statuses, {
                placeHolder: 'Select status'
            });
            if (status) {
                await taskStore!.updateTask(item.task.id, { status: status as TaskStatus });
            }
        }),

        vscode.commands.registerCommand('pmcockpit.deleteTask', async (item) => {
            if (!item?.task) return;
            const confirm = await vscode.window.showWarningMessage(
                `Delete task "${item.task.description}"?`,
                { modal: true },
                'Delete'
            );
            if (confirm === 'Delete') {
                await taskStore!.deleteTask(item.task.id);
            }
        })
    );
}

export function deactivate() {
    httpBridge?.stop();
}
