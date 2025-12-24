import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Records audio using system tools (sox on macOS/Windows, arecord on Linux).
 * Based on approach from node-mic and node-audiorecorder packages.
 */
export class AudioRecorder {
    private process: ChildProcess | null = null;
    private outputPath: string | null = null;

    constructor(private readonly workspaceRoot: string) {}

    async isAvailable(): Promise<{ available: boolean; tool: string | null; error?: string }> {
        const platform = process.platform;

        if (platform === 'darwin' || platform === 'win32') {
            // Check for sox
            const hasSox = await this.commandExists('sox');
            if (hasSox) {
                return { available: true, tool: 'sox' };
            }
            return {
                available: false,
                tool: null,
                error: platform === 'darwin'
                    ? 'Sox is required for audio recording. Install with: brew install sox'
                    : 'Sox is required for audio recording. Download from: https://sox.sourceforge.net/'
            };
        } else if (platform === 'linux') {
            // Check for arecord first (ALSA), then sox
            const hasArecord = await this.commandExists('arecord');
            if (hasArecord) {
                return { available: true, tool: 'arecord' };
            }
            const hasSox = await this.commandExists('sox');
            if (hasSox) {
                return { available: true, tool: 'sox' };
            }
            return {
                available: false,
                tool: null,
                error: 'Audio recording requires arecord (alsa-utils) or sox. Install with: sudo apt install alsa-utils'
            };
        }

        return { available: false, tool: null, error: 'Unsupported platform' };
    }

    async startRecording(): Promise<string> {
        const check = await this.isAvailable();
        if (!check.available) {
            throw new Error(check.error || 'Audio recording not available');
        }

        // Create output directory
        const audioDir = path.join(this.workspaceRoot, '.shepherd', 'audio');
        await fs.promises.mkdir(audioDir, { recursive: true });

        this.outputPath = path.join(audioDir, `recording-${Date.now()}.wav`);

        return new Promise((resolve, reject) => {
            const platform = process.platform;

            if (check.tool === 'sox') {
                // Sox recording command
                // -d = default audio device
                // -c 1 = mono
                // -r 16000 = 16kHz sample rate (good for speech)
                // -b 16 = 16-bit
                // -e signed-integer = signed integer encoding
                const outputFile = this.outputPath!;
                const args = platform === 'darwin'
                    ? ['-d', '-c', '1', '-r', '16000', '-b', '16', '-e', 'signed-integer', outputFile]
                    : ['-t', 'waveaudio', '-d', '-c', '1', '-r', '16000', '-b', '16', '-e', 'signed-integer', outputFile];

                this.process = spawn('sox', args);
            } else if (check.tool === 'arecord') {
                // arecord for Linux
                // -f cd = CD quality (16-bit, stereo, 44100Hz) - we'll use custom
                // -c 1 = mono
                // -r 16000 = 16kHz
                // -t wav = WAV format
                const outputFile = this.outputPath!;
                this.process = spawn('arecord', [
                    '-c', '1',
                    '-r', '16000',
                    '-f', 'S16_LE',
                    '-t', 'wav',
                    outputFile
                ]);
            }

            if (!this.process) {
                reject(new Error('Failed to start recording process'));
                return;
            }

            let stderr = '';

            this.process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            this.process.on('error', (err) => {
                this.process = null;
                reject(new Error(`Recording failed: ${err.message}`));
            });

            // Give it a moment to start, then resolve
            setTimeout(() => {
                if (this.process) {
                    resolve(this.outputPath!);
                } else {
                    reject(new Error(`Recording failed to start: ${stderr}`));
                }
            }, 200);
        });
    }

    async stopRecording(): Promise<string | null> {
        if (!this.process || !this.outputPath) {
            return null;
        }

        return new Promise((resolve) => {
            const outputPath = this.outputPath;

            this.process!.on('close', () => {
                this.process = null;
                this.outputPath = null;

                // Verify the file was created
                if (outputPath && fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath);
                    if (stats.size > 44) { // WAV header is 44 bytes
                        resolve(outputPath);
                    } else {
                        resolve(null); // Empty recording
                    }
                } else {
                    resolve(null);
                }
            });

            // Send signal to gracefully stop recording
            // On Windows, SIGINT isn't fully supported, but kill() works
            if (process.platform === 'win32') {
                this.process!.kill();
            } else {
                this.process!.kill('SIGINT');
            }
        });
    }

    isRecording(): boolean {
        return this.process !== null;
    }

    private async commandExists(command: string): Promise<boolean> {
        const checkCmd = process.platform === 'win32' ? 'where' : 'which';
        return new Promise((resolve) => {
            const proc = spawn(checkCmd, [command], { shell: true });
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
        });
    }
}
