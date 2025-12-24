import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as vscode from 'vscode';

/**
 * Finds the Claude CLI binary path.
 * First checks VS Code setting, then common installation locations.
 * On Windows, checks common installation locations since PATH may not be available in spawned shells.
 * On Unix, relies on PATH resolution.
 */
export async function findClaudeBinary(): Promise<string> {
    // Check if user has configured a custom path
    const configuredPath = vscode.workspace.getConfiguration('shepherd').get<string>('claudePath');
    if (configuredPath && configuredPath.trim()) {
        if (fs.existsSync(configuredPath)) {
            console.log('[Claude] Using configured path:', configuredPath);
            return configuredPath;
        } else {
            console.warn('[Claude] Configured path does not exist:', configuredPath);
        }
    }

    if (process.platform !== 'win32') {
        // On Unix, just use 'claude' and let shell resolve from PATH
        return 'claude';
    }

    // Windows: Check common installation paths
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const windowsPaths = [
        // PowerShell installer location (most common)
        path.join(home, '.local', 'bin', 'claude.exe'),
        // Claude Code installer locations
        path.join(localAppData, 'Programs', 'claude-code', 'claude.exe'),
        path.join(localAppData, 'Programs', 'claude', 'claude.exe'),
        path.join(localAppData, 'Claude', 'claude.exe'),
        // WindowsApps (Microsoft Store style)
        path.join(localAppData, 'Microsoft', 'WindowsApps', 'claude.exe'),
        // npm global installations
        path.join(appData, 'npm', 'claude.cmd'),
        path.join(appData, 'npm', 'claude'),
        path.join(home, 'npm-global', 'claude.cmd'),
        path.join(programFiles, 'nodejs', 'claude.cmd'),
        path.join(programFilesX86, 'nodejs', 'claude.cmd'),
        // Scoop
        path.join(home, 'scoop', 'shims', 'claude.exe'),
        path.join(home, 'scoop', 'shims', 'claude.cmd'),
        // Chocolatey
        path.join('C:', 'ProgramData', 'chocolatey', 'bin', 'claude.exe'),
        // Program Files
        path.join(programFiles, 'Claude', 'claude.exe'),
        path.join(programFiles, 'claude-code', 'claude.exe'),
    ];

    console.log('[Claude] Searching for Claude CLI in common Windows paths...');
    for (const p of windowsPaths) {
        if (fs.existsSync(p)) {
            console.log('[Claude] Found at:', p);
            return p;
        }
    }

    // Try 'where' command to find in PATH
    console.log('[Claude] Not found in common paths, trying PATH via "where" command...');
    const wherePath = await findInPath('claude');
    if (wherePath) {
        console.log('[Claude] Found via where:', wherePath);
        return wherePath;
    }

    // Log paths checked for debugging
    console.error('[Claude] Claude CLI not found. Checked paths:', windowsPaths.join(', '));
    console.error('[Claude] To fix: Run "where claude" in PowerShell to find installation path');

    // Fall back to 'claude' - will likely fail but gives a clear error
    return 'claude';
}

/**
 * Uses 'where' (Windows) or 'which' (Unix) to find a command in PATH.
 */
async function findInPath(command: string): Promise<string | null> {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';

    return new Promise((resolve) => {
        const proc = spawn(checkCmd, [command], { shell: true });
        let stdout = '';

        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0 && stdout.trim()) {
                // 'where' on Windows can return multiple paths, take the first
                const firstPath = stdout.trim().split('\n')[0].trim();
                resolve(firstPath);
            } else {
                resolve(null);
            }
        });

        proc.on('error', () => resolve(null));
    });
}
