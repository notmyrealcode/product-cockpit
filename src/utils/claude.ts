import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Finds the Claude CLI binary path.
 * On Windows, checks common installation locations since PATH may not be available in spawned shells.
 * On Unix, relies on PATH resolution.
 */
export async function findClaudeBinary(): Promise<string> {
    if (process.platform !== 'win32') {
        // On Unix, just use 'claude' and let shell resolve from PATH
        return 'claude';
    }

    // Windows: Check common installation paths
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

    const windowsPaths = [
        // PowerShell installer location
        path.join(home, '.local', 'bin', 'claude.exe'),
        // Alternative installer locations
        path.join(localAppData, 'Programs', 'claude-code', 'claude.exe'),
        path.join(localAppData, 'Microsoft', 'WindowsApps', 'claude.exe'),
        // npm global (common locations)
        path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        path.join(home, 'npm-global', 'claude.cmd'),
    ];

    for (const p of windowsPaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    // Try 'where' command to find in PATH
    const wherePath = await findInPath('claude');
    if (wherePath) {
        return wherePath;
    }

    // Fall back to 'claude' and hope it's in PATH
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
