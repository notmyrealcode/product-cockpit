import * as vscode from 'vscode';
import { TaskStore } from './tasks/TaskStore';
import { TaskWebviewProvider } from './webview/WebviewProvider';
import { HttpBridge } from './http/bridge';
import { initialize, isInitialized, updateMcpServer } from './init/initialize';
import { initDatabase, closeDatabase } from './db';

let taskStore: TaskStore | undefined;
let webviewProvider: TaskWebviewProvider | undefined;
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
    } else {
        // Prompt user to initialize
        const choice = await vscode.window.showInformationMessage(
            'Product Cockpit is not initialized in this workspace.',
            'Initialize Now'
        );
        if (choice === 'Initialize Now') {
            vscode.commands.executeCommand('pmcockpit.initialize');
        }
    }
}

async function activateExtension(context: vscode.ExtensionContext, workspaceRoot: string): Promise<void> {
    // Set context for UI visibility
    vscode.commands.executeCommand('setContext', 'pmcockpit.initialized', true);

    // Update MCP server to latest version (safe - it's stateless)
    await updateMcpServer(workspaceRoot);

    // Initialize database
    await initDatabase(workspaceRoot);

    // Initialize TaskStore
    taskStore = new TaskStore();

    // Initialize HTTP bridge
    httpBridge = new HttpBridge(taskStore, workspaceRoot, () => {
        vscode.window.showInformationMessage('Interview completed! Tasks and requirements refreshed.');
    });
    await httpBridge.start();

    // Initialize Webview Provider
    webviewProvider = new TaskWebviewProvider(context.extensionUri, taskStore, workspaceRoot);

    // Register webview provider and cleanup
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TaskWebviewProvider.viewType,
            webviewProvider,
            {
                // Force webview to be created immediately when view becomes visible
                webviewOptions: { retainContextWhenHidden: true }
            }
        ),
        webviewProvider,
        taskStore,
        { dispose: () => httpBridge?.stop() }
    );

    // Force the webview to be created by focusing the view
    // Small delay to ensure VS Code UI is ready
    setTimeout(() => {
        vscode.commands.executeCommand('pmcockpit.taskView.focus');
    }, 100);

    // Register command to open sidebar (view is already in auxiliary bar via package.json)
    context.subscriptions.push(
        vscode.commands.registerCommand('pmcockpit.openSidebar', async () => {
            await vscode.commands.executeCommand('pmcockpit.taskView.focus');
        })
    );

    // Create a tree view for the shortcut that auto-opens the main view
    const shortcutTreeView = vscode.window.createTreeView('pmcockpit.shortcutView', {
        treeDataProvider: {
            getTreeItem: () => new vscode.TreeItem(''),
            getChildren: () => []
        }
    });

    shortcutTreeView.onDidChangeVisibility(e => {
        if (e.visible) {
            // Immediately focus the real view in secondary sidebar
            vscode.commands.executeCommand('pmcockpit.taskView.focus');
        }
    });

    context.subscriptions.push(shortcutTreeView);
}

export function deactivate() {
    httpBridge?.stop();
    closeDatabase();
}
