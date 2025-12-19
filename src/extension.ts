import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TaskStore } from './tasks/TaskStore';
import { TaskWebviewProvider } from './webview/WebviewProvider';
import { HttpBridge } from './http/bridge';
import { initialize, isInitialized, updateMcpServer } from './init/initialize';
import { initDatabase, closeDatabase } from './db';

const execAsync = promisify(exec);

let taskStore: TaskStore | undefined;
let webviewProvider: TaskWebviewProvider | undefined;
let httpBridge: HttpBridge | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }

    // Reset walkthrough contexts on startup (VS Code persists them between sessions)
    await vscode.commands.executeCommand('setContext', 'shepherd.walkthrough.initDone', false);
    await vscode.commands.executeCommand('setContext', 'shepherd.walkthrough.voiceDone', false);
    await vscode.commands.executeCommand('setContext', 'shepherd.walkthrough.taskCreated', false);

    // Register initialize command (always available)
    context.subscriptions.push(
        vscode.commands.registerCommand('shepherd.initialize', async () => {
            console.log('[Shepherd] Initialize command called');
            const success = await initialize(workspaceRoot);
            console.log('[Shepherd] Initialize result:', success);
            if (success) {
                await activateExtension(context, workspaceRoot);
                console.log('[Shepherd] activateExtension complete');

                // Set walkthrough-specific context to mark step 1 complete
                await vscode.commands.executeCommand('setContext', 'shepherd.walkthrough.initDone', true);
                console.log('[Shepherd] Set walkthrough.initDone context');

                // Re-open walkthrough after a delay to show updated progress
                setTimeout(() => {
                    vscode.commands.executeCommand(
                        'workbench.action.openWalkthrough',
                        'justineckhouse.shepherd#shepherd.welcome',
                        false
                    );
                }, 300);
            }
        })
    );

    // Register command to open walkthrough
    context.subscriptions.push(
        vscode.commands.registerCommand('shepherd.openWalkthrough', () => {
            vscode.commands.executeCommand(
                'workbench.action.openWalkthrough',
                'justineckhouse.shepherd#shepherd.welcome',
                false
            );
        })
    );

    // Register command to trigger voice setup (must be registered before init so walkthrough button works)
    context.subscriptions.push(
        vscode.commands.registerCommand('shepherd.setupVoice', async () => {
            console.log('[Shepherd] setupVoice command called');
            if (!webviewProvider) {
                vscode.window.showWarningMessage('Please complete initialization first.');
                return;
            }
            await vscode.commands.executeCommand('shepherd.taskView.focus');
            await webviewProvider.triggerVoiceSetup();
        })
    );

    // Register command to skip voice setup
    context.subscriptions.push(
        vscode.commands.registerCommand('shepherd.skipVoiceSetup', async () => {
            console.log('[Shepherd] skipVoiceSetup command called');
            await vscode.commands.executeCommand('setContext', 'shepherd.walkthrough.voiceDone', true);

            // Re-open walkthrough to show next step
            setTimeout(() => {
                vscode.commands.executeCommand(
                    'workbench.action.openWalkthrough',
                    'justineckhouse.shepherd#shepherd.welcome',
                    false
                );
            }, 300);
        })
    );

    // Register command to open sidebar
    context.subscriptions.push(
        vscode.commands.registerCommand('shepherd.openSidebar', async () => {
            await vscode.commands.executeCommand('shepherd.taskView.focus');
        })
    );

    // Check if already initialized
    if (isInitialized(workspaceRoot)) {
        await activateExtension(context, workspaceRoot);
    } else {
        // Open walkthrough for new users
        vscode.commands.executeCommand(
            'workbench.action.openWalkthrough',
            'justineckhouse.shepherd#shepherd.welcome',
            false
        );
    }
}

async function activateExtension(context: vscode.ExtensionContext, workspaceRoot: string): Promise<void> {
    // Set context for UI visibility
    console.log('[Shepherd] Setting context shepherd.initialized = true');
    await vscode.commands.executeCommand('setContext', 'shepherd.initialized', true);
    console.log('[Shepherd] Context set');

    // Check for Claude Code CLI
    const hasClaudeCode = await checkClaudeCodeInstalled();
    if (!hasClaudeCode) {
        const action = await vscode.window.showWarningMessage(
            'Claude Code CLI not found. Some Shepherd features require it.',
            'Install Claude Code',
            'Dismiss'
        );
        if (action === 'Install Claude Code') {
            vscode.env.openExternal(vscode.Uri.parse('https://claude.ai/code'));
        }
    }

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
        vscode.commands.executeCommand('shepherd.taskView.focus');
    }, 100);

    // Create a tree view for the shortcut that auto-opens the main view
    const shortcutTreeView = vscode.window.createTreeView('shepherd.shortcutView', {
        treeDataProvider: {
            getTreeItem: () => new vscode.TreeItem(''),
            getChildren: () => []
        }
    });

    shortcutTreeView.onDidChangeVisibility(e => {
        if (e.visible) {
            // Immediately focus the real view in secondary sidebar
            vscode.commands.executeCommand('shepherd.taskView.focus');
        }
    });

    context.subscriptions.push(shortcutTreeView);
}

export function deactivate() {
    httpBridge?.stop();
    closeDatabase();
}

async function checkClaudeCodeInstalled(): Promise<boolean> {
    try {
        await execAsync('claude --version');
        return true;
    } catch {
        return false;
    }
}
