import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { spawn } from 'child_process';

export interface WhisperModel {
    id: string;
    name: string;
    size: string;
    description: string;
    url: string;
}

export const WHISPER_MODELS: WhisperModel[] = [
    {
        id: 'tiny',
        name: 'Tiny',
        size: '75 MB',
        description: 'Fastest, lower accuracy. Good for quick notes.',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin'
    },
    {
        id: 'base',
        name: 'Base',
        size: '142 MB',
        description: 'Balanced speed and accuracy. Recommended for most users.',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
    },
    {
        id: 'small',
        name: 'Small',
        size: '466 MB',
        description: 'Better accuracy, slower. Good for detailed transcription.',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin'
    },
    {
        id: 'medium',
        name: 'Medium',
        size: '1.5 GB',
        description: 'High accuracy, requires patience. Best for important recordings.',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin'
    }
];

const WHISPER_VERSION = 'v1.7.2';
const WINDOWS_BINARY_URL = `https://github.com/ggerganov/whisper.cpp/releases/download/${WHISPER_VERSION}/whisper-bin-x64.zip`;

export class WhisperService {
    private readonly binDir: string;
    private readonly modelsDir: string;
    private readonly configPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.binDir = path.join(workspaceRoot, '.pmcockpit', 'whisper', 'bin');
        this.modelsDir = path.join(workspaceRoot, '.pmcockpit', 'whisper', 'models');
        this.configPath = path.join(workspaceRoot, '.pmcockpit', 'whisper', 'config.json');
    }

    async isReady(): Promise<boolean> {
        const binaryPath = await this.getBinaryPath();
        const modelPath = await this.getModelPath();
        return binaryPath !== null && modelPath !== null;
    }

    async setup(): Promise<boolean> {
        // Check if already set up
        if (await this.isReady()) {
            return true;
        }

        // Ensure whisper binary is available
        const binaryPath = await this.ensureBinary();
        if (!binaryPath) {
            return false;
        }

        // Prompt for model selection if no model downloaded
        const modelPath = await this.getModelPath();
        if (!modelPath) {
            const selected = await this.promptModelSelection();
            if (!selected) {
                return false;
            }
        }

        return true;
    }

    async getBinaryPath(): Promise<string | null> {
        const platform = process.platform;

        // 1. Check if whisper is in PATH
        const systemBinary = await this.findInPath();
        if (systemBinary) {
            return systemBinary;
        }

        // 2. Check local build directory
        const localBinary = platform === 'win32'
            ? path.join(this.binDir, 'whisper.exe')
            : path.join(this.binDir, 'whisper');

        if (fs.existsSync(localBinary)) {
            return localBinary;
        }

        // 3. Check common installation locations (not always in PATH)
        const commonPaths = this.getCommonBinaryPaths();
        for (const p of commonPaths) {
            if (fs.existsSync(p)) {
                // Verify it's executable
                try {
                    const result = await this.exec(p, ['--help']);
                    if (result.code === 0 || result.stdout.includes('whisper') || result.stderr.includes('whisper')) {
                        return p;
                    }
                } catch {
                    // Not a valid binary, continue
                }
            }
        }

        return null;
    }

    private getCommonBinaryPaths(): string[] {
        const platform = process.platform;
        const home = process.env.HOME || '';

        if (platform === 'darwin') {
            return [
                // Homebrew (Apple Silicon)
                '/opt/homebrew/bin/whisper-cli',
                '/opt/homebrew/bin/whisper-cpp',
                '/opt/homebrew/bin/whisper',
                // Homebrew (Intel)
                '/usr/local/bin/whisper-cli',
                '/usr/local/bin/whisper-cpp',
                '/usr/local/bin/whisper',
                // MacPorts
                '/opt/local/bin/whisper-cli',
                '/opt/local/bin/whisper-cpp',
                '/opt/local/bin/whisper',
                // User-local builds
                `${home}/.local/bin/whisper`,
                `${home}/bin/whisper`,
            ];
        } else if (platform === 'linux') {
            return [
                '/usr/bin/whisper-cli',
                '/usr/bin/whisper',
                '/usr/local/bin/whisper-cli',
                '/usr/local/bin/whisper',
                `${home}/.local/bin/whisper-cli`,
                `${home}/.local/bin/whisper`,
                `${home}/bin/whisper`,
                // Snap
                '/snap/bin/whisper',
            ];
        } else if (platform === 'win32') {
            const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
            const localAppData = process.env['LOCALAPPDATA'] || '';
            return [
                `${programFiles}\\whisper\\whisper.exe`,
                `${localAppData}\\whisper\\whisper.exe`,
            ];
        }

        return [];
    }

    private async findInPath(): Promise<string | null> {
        const command = process.platform === 'win32' ? 'where' : 'which';
        const binaryNames = ['whisper-cli', 'whisper', 'whisper-cpp', 'main', 'whisper.cpp'];

        for (const name of binaryNames) {
            try {
                const result = await this.exec(command, [name]);
                if (result.code === 0 && result.stdout.trim()) {
                    return result.stdout.trim().split('\n')[0];
                }
            } catch {
                // Not found, continue
            }
        }
        return null;
    }

    private async ensureBinary(): Promise<string | null> {
        const existing = await this.getBinaryPath();
        if (existing) {
            return existing;
        }

        const platform = process.platform;

        if (platform === 'win32') {
            return this.downloadWindowsBinary();
        } else if (platform === 'darwin') {
            return this.setupMacOS();
        } else {
            return this.setupLinux();
        }
    }

    private async setupMacOS(): Promise<string | null> {
        // Detect available installation methods
        const hasBrew = await this.commandExists('brew');
        const hasMacPorts = await this.commandExists('port');
        const hasXcode = await this.commandExists('xcode-select');
        const hasGit = await this.commandExists('git');
        const hasMake = await this.commandExists('make');
        const canBuildFromSource = hasGit && hasMake;

        // Build options based on what's available
        const options: string[] = [];

        if (hasBrew) {
            options.push('Install with Homebrew');
        }
        if (hasMacPorts) {
            options.push('Install with MacPorts');
        }
        if (canBuildFromSource) {
            options.push('Build from source');
        }
        options.push('Show manual instructions');

        if (options.length === 1) {
            // Only manual option available
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggerganov/whisper.cpp#quick-start'));
            return null;
        }

        const choice = await vscode.window.showInformationMessage(
            'whisper.cpp is required for voice transcription.',
            ...options
        );

        if (!choice) {
            return null;
        }

        switch (choice) {
            case 'Install with Homebrew':
                return this.installWithHomebrew();
            case 'Install with MacPorts':
                return this.installWithMacPorts();
            case 'Build from source':
                return this.buildFromSource();
            case 'Show manual instructions':
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggerganov/whisper.cpp#quick-start'));
                return null;
            default:
                return null;
        }
    }

    private async setupLinux(): Promise<string | null> {
        // Detect available installation methods
        const hasApt = await this.commandExists('apt');
        const hasDnf = await this.commandExists('dnf');
        const hasPacman = await this.commandExists('pacman');
        const hasGit = await this.commandExists('git');
        const hasMake = await this.commandExists('make');
        const canBuildFromSource = hasGit && hasMake;

        const options: string[] = [];

        // Note: whisper.cpp may not be in all distro repos, but build from source works everywhere
        if (canBuildFromSource) {
            options.push('Build from source');
        }
        options.push('Show manual instructions');

        if (options.length === 1) {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggerganov/whisper.cpp#quick-start'));
            return null;
        }

        const choice = await vscode.window.showInformationMessage(
            'whisper.cpp is required for voice transcription.',
            ...options
        );

        if (choice === 'Build from source') {
            return this.buildFromSource();
        } else if (choice === 'Show manual instructions') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggerganov/whisper.cpp#quick-start'));
        }

        return null;
    }

    private async commandExists(command: string): Promise<boolean> {
        const result = await this.exec('which', [command]);
        return result.code === 0 && result.stdout.trim().length > 0;
    }

    private async installWithHomebrew(): Promise<string | null> {
        const terminal = vscode.window.createTerminal('Install whisper.cpp');
        terminal.sendText('brew install whisper-cpp && echo "\\n✅ Installation complete. You can close this terminal."');
        terminal.show();

        const result = await vscode.window.showInformationMessage(
            'Installing whisper-cpp via Homebrew. Click "Done" when installation completes.',
            'Done',
            'Cancel'
        );

        if (result === 'Done') {
            const binaryPath = await this.findInPath();
            if (binaryPath) {
                vscode.window.showInformationMessage('whisper.cpp installed successfully!');
                return binaryPath;
            } else {
                vscode.window.showErrorMessage('whisper.cpp not found. Please check the terminal for errors.');
            }
        }
        return null;
    }

    private async installWithMacPorts(): Promise<string | null> {
        const terminal = vscode.window.createTerminal('Install whisper.cpp');
        terminal.sendText('sudo port install whisper-cpp && echo "\\n✅ Installation complete. You can close this terminal."');
        terminal.show();

        const result = await vscode.window.showInformationMessage(
            'Installing whisper-cpp via MacPorts (may require password). Click "Done" when installation completes.',
            'Done',
            'Cancel'
        );

        if (result === 'Done') {
            const binaryPath = await this.findInPath();
            if (binaryPath) {
                vscode.window.showInformationMessage('whisper.cpp installed successfully!');
                return binaryPath;
            } else {
                vscode.window.showErrorMessage('whisper.cpp not found. Please check the terminal for errors.');
            }
        }
        return null;
    }

    private async buildFromSource(): Promise<string | null> {
        const srcDir = path.join(this.workspaceRoot, '.pmcockpit', 'whisper', 'src');
        const localBinDir = path.join(this.workspaceRoot, '.pmcockpit', 'whisper', 'bin');
        const binaryDest = path.join(localBinDir, 'whisper');

        // Check if already built
        if (fs.existsSync(binaryDest)) {
            return binaryDest;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Building whisper.cpp from source...',
                cancellable: false
            }, async (progress) => {
                // Create directories
                await fs.promises.mkdir(srcDir, { recursive: true });
                await fs.promises.mkdir(localBinDir, { recursive: true });

                // Clone if not exists
                const repoDir = path.join(srcDir, 'whisper.cpp');
                if (!fs.existsSync(repoDir)) {
                    progress.report({ message: 'Cloning repository...' });
                    const cloneResult = await this.exec('git', [
                        'clone',
                        '--depth', '1',
                        'https://github.com/ggerganov/whisper.cpp.git',
                        repoDir
                    ]);
                    if (cloneResult.code !== 0) {
                        throw new Error(`Git clone failed: ${cloneResult.stderr}`);
                    }
                }

                // Build
                progress.report({ message: 'Compiling (this may take a minute)...' });
                const makeResult = await this.exec('make', ['-C', repoDir, '-j4']);
                if (makeResult.code !== 0) {
                    throw new Error(`Build failed: ${makeResult.stderr}`);
                }

                // Copy binary
                const builtBinary = path.join(repoDir, 'main');
                if (!fs.existsSync(builtBinary)) {
                    throw new Error('Build completed but binary not found');
                }

                await fs.promises.copyFile(builtBinary, binaryDest);
                await fs.promises.chmod(binaryDest, 0o755);
            });

            vscode.window.showInformationMessage('whisper.cpp built successfully!');
            return binaryDest;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to build whisper.cpp: ${error}`);
            return null;
        }
    }

    private async downloadWindowsBinary(): Promise<string | null> {
        await fs.promises.mkdir(this.binDir, { recursive: true });

        const zipPath = path.join(this.binDir, 'whisper.zip');
        const binaryPath = path.join(this.binDir, 'whisper.exe');

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Downloading whisper.cpp...',
                cancellable: false
            }, async (progress) => {
                await this.downloadFile(WINDOWS_BINARY_URL, zipPath, (percent) => {
                    progress.report({ increment: percent });
                });

                // Extract zip
                const AdmZip = require('adm-zip');
                const zip = new AdmZip(zipPath);
                zip.extractAllTo(this.binDir, true);

                // Clean up zip
                await fs.promises.unlink(zipPath);
            });

            if (fs.existsSync(binaryPath)) {
                return binaryPath;
            }

            // Try to find the binary in extracted files
            const files = await fs.promises.readdir(this.binDir);
            const whisperExe = files.find(f => f === 'main.exe' || f === 'whisper.exe');
            if (whisperExe) {
                const foundPath = path.join(this.binDir, whisperExe);
                if (whisperExe === 'main.exe') {
                    await fs.promises.rename(foundPath, binaryPath);
                }
                return binaryPath;
            }

            return null;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to download whisper.cpp: ${error}`);
            return null;
        }
    }

    async promptModelSelection(): Promise<boolean> {
        const items = WHISPER_MODELS.map(model => ({
            label: `${model.name} (${model.size})`,
            description: model.description,
            model
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select transcription model (larger = more accurate but slower)',
            title: 'Voice Transcription Model'
        });

        if (!selected) {
            return false;
        }

        return this.downloadModel(selected.model);
    }

    private async downloadModel(model: WhisperModel): Promise<boolean> {
        await fs.promises.mkdir(this.modelsDir, { recursive: true });

        const modelPath = path.join(this.modelsDir, `ggml-${model.id}.bin`);

        if (fs.existsSync(modelPath)) {
            await this.saveConfig({ selectedModel: model.id });
            return true;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Downloading ${model.name} model (${model.size})...`,
                cancellable: true
            }, async (progress, token) => {
                await this.downloadFile(model.url, modelPath, (percent) => {
                    progress.report({ message: `${Math.round(percent)}%` });
                }, token);
            });

            await this.saveConfig({ selectedModel: model.id });
            vscode.window.showInformationMessage(`${model.name} model downloaded successfully!`);
            return true;
        } catch (error) {
            if (fs.existsSync(modelPath)) {
                await fs.promises.unlink(modelPath).catch(() => {});
            }
            vscode.window.showErrorMessage(`Failed to download model: ${error}`);
            return false;
        }
    }

    async getModelPath(): Promise<string | null> {
        const config = await this.loadConfig();
        if (!config?.selectedModel) {
            return null;
        }

        const modelPath = path.join(this.modelsDir, `ggml-${config.selectedModel}.bin`);
        if (fs.existsSync(modelPath)) {
            return modelPath;
        }

        return null;
    }

    async transcribe(audioPath: string): Promise<string> {
        const binaryPath = await this.getBinaryPath();
        const modelPath = await this.getModelPath();

        if (!binaryPath || !modelPath) {
            throw new Error('Whisper not configured. Please run setup first.');
        }

        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        // Convert webm to wav if needed (whisper.cpp prefers wav)
        const wavPath = audioPath.replace(/\.[^.]+$/, '.wav');
        if (audioPath !== wavPath) {
            await this.convertToWav(audioPath, wavPath);
        }

        const args = ['-m', modelPath, '-np', '-nt', wavPath];
        const result = await this.execWithTimeout(binaryPath, args, 120000);

        // Clean up wav file
        if (audioPath !== wavPath) {
            await fs.promises.unlink(wavPath).catch(() => {});
        }

        if (result.code !== 0) {
            throw new Error(result.stderr || 'Transcription failed');
        }

        // Clean up whisper.cpp output artifacts
        let transcript = result.stdout.trim();

        // Remove [blank audio], [BLANK_AUDIO], and similar markers that whisper outputs for silence
        transcript = transcript.replace(/\[blank[_ ]?audio\]/gi, '');
        transcript = transcript.replace(/\[silence\]/gi, '');
        transcript = transcript.replace(/\[inaudible\]/gi, '');

        // Clean up extra whitespace from removed markers
        transcript = transcript.replace(/\s+/g, ' ').trim();

        return transcript;
    }

    private async convertToWav(inputPath: string, outputPath: string): Promise<void> {
        // Try ffmpeg first
        const ffmpegResult = await this.exec('ffmpeg', [
            '-i', inputPath,
            '-ar', '16000',
            '-ac', '1',
            '-y',
            outputPath
        ]).catch(() => null);

        if (ffmpegResult?.code === 0) {
            return;
        }

        // Try sox
        const soxResult = await this.exec('sox', [
            inputPath,
            '-r', '16000',
            '-c', '1',
            outputPath
        ]).catch(() => null);

        if (soxResult?.code === 0) {
            return;
        }

        // If no converter available, try using the original file
        // whisper.cpp might handle it
        await fs.promises.copyFile(inputPath, outputPath);
    }

    private async loadConfig(): Promise<{ selectedModel?: string } | null> {
        try {
            const content = await fs.promises.readFile(this.configPath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    private async saveConfig(config: { selectedModel: string }): Promise<void> {
        const dir = path.dirname(this.configPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(this.configPath, JSON.stringify(config, null, 2));
    }

    private downloadFile(
        url: string,
        destPath: string,
        onProgress?: (percent: number) => void,
        cancellation?: vscode.CancellationToken
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            let receivedBytes = 0;
            let totalBytes = 0;

            const request = https.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    file.close();
                    fs.unlinkSync(destPath);
                    this.downloadFile(response.headers.location!, destPath, onProgress, cancellation)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                totalBytes = parseInt(response.headers['content-length'] || '0', 10);

                response.pipe(file);

                response.on('data', (chunk) => {
                    receivedBytes += chunk.length;
                    if (onProgress && totalBytes > 0) {
                        onProgress((receivedBytes / totalBytes) * 100);
                    }
                });

                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            });

            request.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });

            if (cancellation) {
                cancellation.onCancellationRequested(() => {
                    request.destroy();
                    fs.unlink(destPath, () => {});
                    reject(new Error('Cancelled'));
                });
            }
        });
    }

    private exec(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
        return new Promise((resolve) => {
            const proc = spawn(command, args, { shell: process.platform === 'win32' });
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                resolve({ code: code || 0, stdout, stderr });
            });

            proc.on('error', () => {
                resolve({ code: 1, stdout, stderr: 'Command not found' });
            });
        });
    }

    private execWithTimeout(command: string, args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
        return new Promise((resolve) => {
            const proc = spawn(command, args, { shell: process.platform === 'win32' });
            let stdout = '';
            let stderr = '';
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    proc.kill();
                    resolve({ code: 1, stdout, stderr: 'Process timed out' });
                }
            }, timeoutMs);

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve({ code: code || 0, stdout, stderr });
                }
            });

            proc.on('error', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve({ code: 1, stdout, stderr: 'Command not found' });
                }
            });
        });
    }
}
