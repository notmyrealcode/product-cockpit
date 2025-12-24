import * as vscode from 'vscode';
import { spawn } from 'child_process';

export interface RuntimeInfo {
    command: string;
    found: boolean;
}

/**
 * Finds an available JavaScript runtime (Node.js or Bun).
 * Prefers Node.js if both are available.
 */
export async function findRuntime(): Promise<RuntimeInfo> {
    if (await commandExists('node')) {
        return { command: 'node', found: true };
    }
    if (await commandExists('bun')) {
        return { command: 'bun', found: true };
    }
    return { command: 'node', found: false };
}

/**
 * Prompts the user to install a JavaScript runtime if none is found.
 * Returns true if user initiated an install, false if cancelled.
 */
export async function promptInstallRuntime(): Promise<boolean> {
    const platform = process.platform;
    const hasHomebrew = platform === 'darwin' && await commandExists('brew');

    // Build button options based on platform
    const installBunLabel = 'Install Bun';
    const installNodeLabel = hasHomebrew ? 'Install Node.js (Homebrew)' : 'Install Node.js';

    const choice = await vscode.window.showWarningMessage(
        'Shepherd requires Node.js or Bun to run the MCP server for Claude Code integration.',
        { modal: true },
        installBunLabel,
        installNodeLabel,
        'Cancel'
    );

    if (!choice || choice === 'Cancel') {
        vscode.window.showWarningMessage(
            'MCP server disabled. Claude Code integration will not work until Node.js or Bun is installed.'
        );
        return false;
    }

    if (choice === installBunLabel) {
        await installBun(platform);
        return true;
    }

    if (choice === installNodeLabel) {
        if (hasHomebrew) {
            await installNodeWithHomebrew();
        } else {
            // Open Node.js download page
            vscode.env.openExternal(vscode.Uri.parse('https://nodejs.org'));
            vscode.window.showInformationMessage(
                'Please install Node.js from the opened page, then reload VS Code.'
            );
        }
        return true;
    }

    return false;
}

/**
 * Installs Bun using the official install script.
 */
async function installBun(platform: NodeJS.Platform): Promise<void> {
    const terminal = vscode.window.createTerminal('Install Bun');
    terminal.show();

    if (platform === 'win32') {
        // Windows PowerShell
        terminal.sendText('irm bun.sh/install.ps1 | iex');
    } else {
        // macOS / Linux
        terminal.sendText('curl -fsSL https://bun.sh/install | bash');
    }

    terminal.sendText('echo ""');
    terminal.sendText('echo "✅ Bun installation complete. Please reload VS Code."');

    vscode.window.showInformationMessage(
        'Bun is being installed. Please reload VS Code after installation completes.',
        'Reload'
    ).then(choice => {
        if (choice === 'Reload') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    });
}

/**
 * Installs Node.js using Homebrew (macOS only).
 */
async function installNodeWithHomebrew(): Promise<void> {
    const terminal = vscode.window.createTerminal('Install Node.js');
    terminal.show();

    terminal.sendText('brew install node');
    terminal.sendText('echo ""');
    terminal.sendText('echo "✅ Node.js installation complete. Please reload VS Code."');

    vscode.window.showInformationMessage(
        'Node.js is being installed via Homebrew. Please reload VS Code after installation completes.',
        'Reload'
    ).then(choice => {
        if (choice === 'Reload') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    });
}

/**
 * Checks if a command exists in PATH.
 */
async function commandExists(command: string): Promise<boolean> {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';

    return new Promise((resolve) => {
        const proc = spawn(checkCmd, [command], { shell: process.platform === 'win32' });

        proc.on('close', (code) => {
            resolve(code === 0);
        });

        proc.on('error', () => {
            resolve(false);
        });
    });
}
