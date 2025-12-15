import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TaskStore } from '../tasks/TaskStore';
import { WhisperService } from '../voice/WhisperService';
import { AudioRecorder } from '../voice/AudioRecorder';
import { InterviewService, InterviewProposal, InterviewQuestion, InterviewMessage, InterviewScope } from '../interview/InterviewService';
import type { Task } from '../tasks/types';

interface Requirement {
    path: string;
    title: string;
}

export class TaskWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'pmcockpit.taskView';
    private _view?: vscode.WebviewView;
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly requirementsDir: string;
    private readonly whisperService: WhisperService;
    private readonly audioRecorder: AudioRecorder;
    private readonly interviewService: InterviewService;
    private buildTerminal?: vscode.Terminal;
    private buildTaskIds?: Set<string>;
    private buildStatusListener?: vscode.Disposable;
    private currentProposal?: InterviewProposal;
    private interviewScope?: InterviewScope;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly taskStore: TaskStore,
        private readonly workspaceRoot: string
    ) {
        this.requirementsDir = path.join(workspaceRoot, 'docs', 'requirements');
        this.whisperService = new WhisperService(workspaceRoot);
        this.audioRecorder = new AudioRecorder(workspaceRoot);
        this.interviewService = new InterviewService(workspaceRoot);

        // Subscribe to task changes
        this._disposables.push(
            this.taskStore.onDidChange(() => this.sendTasks())
        );

        // Watch requirements folder for changes
        this.watchRequirements();
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')
            ]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            console.log('[WebviewProvider] Received message:', message.type);
            try {
                switch (message.type) {
                    case 'ready':
                        this.sendInitialized();
                        break;
                    // Feature handlers
                    case 'addFeature':
                        this.taskStore.createFeature({ title: message.title, description: message.description });
                        break;
                    case 'updateFeature':
                        this.taskStore.updateFeature(message.id, message.updates);
                        break;
                    case 'deleteFeature':
                        this.taskStore.deleteFeature(message.id);
                        break;
                    case 'reorderFeatures':
                        this.taskStore.reorderFeatures(message.featureIds);
                        break;
                    // Task handlers
                    case 'addTask':
                        this.taskStore.createTask({
                            title: message.title,
                            description: message.description,
                            feature_id: message.featureId,
                            type: message.taskType
                        });
                        break;
                    case 'updateTask':
                        this.taskStore.updateTask(message.id, message.updates);
                        break;
                    case 'deleteTask':
                        this.taskStore.deleteTask(message.id);
                        break;
                    case 'reorderTasks':
                        this.taskStore.reorderTasks(message.taskIds);
                        break;
                    case 'moveTask':
                        this.taskStore.moveTaskToFeature(message.taskId, message.featureId);
                        break;
                    case 'archiveDone':
                        const count = await this.taskStore.archiveDoneTasks();
                        if (count > 0) {
                            vscode.window.showInformationMessage(`Archived ${count} completed task${count === 1 ? '' : 's'}`);
                        }
                        break;
                    case 'startInterview':
                        this.handleStartInterview(message.scope, message.initialInput);
                        break;
                    case 'answerQuestion':
                        this.interviewService.answerQuestion(message.questionId, message.answer);
                        break;
                    case 'approveProposal':
                        this.handleApproveProposal(message.editedRequirementDoc);
                        break;
                    case 'rejectProposal':
                        this.interviewService.rejectProposal(message.feedback);
                        break;
                    case 'cancelInterview':
                        this.handleCancelInterview();
                        break;
                    case 'openRequirement':
                        this.openRequirement(message.path);
                        break;
                    case 'deleteRequirement':
                        this.deleteRequirement(message.path);
                        break;
                    case 'startRecording':
                        this.handleStartRecording();
                        break;
                    case 'stopRecording':
                        this.handleStopRecording();
                        break;
                    case 'processText':
                        this.handleProcessText(message.text);
                        break;
                    case 'installSox':
                        this.handleInstallSox();
                        break;
                    case 'installWhisper':
                        this.handleInstallWhisper(message.method);
                        break;
                    case 'checkSetup':
                        await this.handleCheckSetup();
                        break;
                    case 'downloadModel':
                        await this.handleDownloadModel();
                        break;
                    case 'buildTasks':
                        await this.handleBuildTasks(message.taskIds);
                        break;
                    case 'resetBuild':
                        this.handleBuildComplete(); // Clears build state
                        break;
                    case 'setParserModel':
                        await this.setParserModel(message.model);
                        break;
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }

    private sendTasks(): void {
        if (this._view) {
            const tasks = this.taskStore.getTasks();
            const features = this.taskStore.getFeatures();
            this._view.webview.postMessage({
                type: 'tasksUpdated',
                tasks
            });
            this._view.webview.postMessage({
                type: 'featuresUpdated',
                features
            });
        }
    }

    private async sendInitialized(): Promise<void> {
        if (this._view) {
            const project = this.taskStore.getProject();
            const features = this.taskStore.getFeatures();
            const tasks = this.taskStore.getTasks();
            const requirements = await this.getRequirements();
            const parserModel = vscode.workspace.getConfiguration('pmcockpit').get<string>('parserModel', 'haiku');
            this._view.webview.postMessage({
                type: 'initialized',
                project,
                features,
                tasks,
                requirements
            });
            this._view.webview.postMessage({
                type: 'settingsLoaded',
                parserModel
            });
        }
    }

    private async setParserModel(model: string): Promise<void> {
        await vscode.workspace.getConfiguration('pmcockpit').update('parserModel', model, vscode.ConfigurationTarget.Global);
    }

    private async sendRequirements(): Promise<void> {
        if (this._view) {
            const requirements = await this.getRequirements();
            this._view.webview.postMessage({
                type: 'requirementsUpdated',
                requirements
            });
        }
    }

    private async getRequirements(): Promise<Requirement[]> {
        try {
            const files = await fs.promises.readdir(this.requirementsDir);
            const mdFiles = files.filter(f => f.endsWith('.md'));
            const requirements = await Promise.all(mdFiles.map(async (file) => {
                const filePath = path.join(this.requirementsDir, file);
                const content = await fs.promises.readFile(filePath, 'utf-8');
                const titleMatch = content.match(/^#\s+(.+)$/m);
                return {
                    path: path.join('docs', 'requirements', file),
                    title: titleMatch ? titleMatch[1] : file.replace('.md', '')
                };
            }));
            return requirements;
        } catch {
            return [];
        }
    }

    private watchRequirements(): void {
        // Watch for changes in requirements directory
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.requirementsDir, '**/*.md')
        );
        watcher.onDidCreate(() => this.sendRequirements());
        watcher.onDidChange(() => this.sendRequirements());
        watcher.onDidDelete(() => this.sendRequirements());
        this._disposables.push(watcher);
    }

    private openRequirement(reqPath: string): void {
        const fullPath = path.join(this.workspaceRoot, reqPath);
        vscode.workspace.openTextDocument(fullPath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }

    private async deleteRequirement(reqPath: string): Promise<void> {
        const fullPath = path.join(this.workspaceRoot, reqPath);
        try {
            await fs.promises.unlink(fullPath);
            vscode.window.showInformationMessage(`Deleted ${path.basename(reqPath)}`);
            // File watcher will trigger sendRequirements automatically
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete requirement: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleStartInterview(scope: InterviewScope, initialInput?: string): Promise<void> {
        this.interviewScope = scope;
        this.currentProposal = undefined;

        try {
            const sessionId = await this.interviewService.start(scope, initialInput, {
                onMessage: (message: InterviewMessage) => {
                    if (this._view) {
                        this._view.webview.postMessage({
                            type: 'interviewMessage',
                            message
                        });
                    }
                },
                onQuestion: (question: InterviewQuestion) => {
                    if (this._view) {
                        this._view.webview.postMessage({
                            type: 'interviewQuestion',
                            question
                        });
                    }
                },
                onThinking: () => {
                    if (this._view) {
                        this._view.webview.postMessage({ type: 'interviewThinking' });
                    }
                },
                onProposal: (proposal: InterviewProposal) => {
                    this.currentProposal = proposal;
                    if (this._view) {
                        this._view.webview.postMessage({
                            type: 'interviewProposal',
                            proposal
                        });
                    }
                },
                onComplete: (requirementPath: string) => {
                    if (this._view) {
                        this._view.webview.postMessage({
                            type: 'interviewComplete',
                            requirementPath
                        });
                    }
                },
                onError: (error: string) => {
                    if (this._view) {
                        this._view.webview.postMessage({
                            type: 'interviewError',
                            error
                        });
                    }
                }
            });

            // Notify webview that interview started
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'interviewStarted',
                    sessionId,
                    scope
                });
            }
        } catch (error) {
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'interviewError',
                    error: error instanceof Error ? error.message : 'Failed to start interview'
                });
            }
        }
    }

    private async handleApproveProposal(editedRequirementDoc?: string): Promise<void> {
        if (!this.currentProposal) {
            return;
        }

        try {
            const isTaskScope = this.interviewScope === 'task';
            let savedReqPath: string | undefined;

            // 1. Save requirement document (only for project/feature scope)
            if (!isTaskScope && this.currentProposal.requirementPath) {
                const docContent = editedRequirementDoc || this.currentProposal.requirementDoc;
                const reqPath = path.join(this.workspaceRoot, this.currentProposal.requirementPath);
                const reqDir = path.dirname(reqPath);
                await fs.promises.mkdir(reqDir, { recursive: true });
                await fs.promises.writeFile(reqPath, docContent, 'utf-8');
                savedReqPath = this.currentProposal.requirementPath;
            }

            // 2. Create features and tasks
            const featureIdMap: Map<number, string> = new Map();

            // Create features first (only for non-task scope)
            if (!isTaskScope) {
                for (let i = 0; i < this.currentProposal.features.length; i++) {
                    const feat = this.currentProposal.features[i];
                    const feature = this.taskStore.createFeature({
                        title: feat.title,
                        description: feat.description,
                        requirement_path: this.currentProposal.requirementPath
                    });
                    featureIdMap.set(i, feature.id);
                }
            }

            // Create tasks
            for (const task of this.currentProposal.tasks) {
                const featureId = task.featureIndex !== undefined
                    ? featureIdMap.get(task.featureIndex)
                    : undefined;
                this.taskStore.createTask({
                    title: task.title,
                    description: task.description,
                    feature_id: featureId || null
                });
            }

            // Save counts before clearing
            const featureCount = featureIdMap.size;
            const taskCount = this.currentProposal.tasks.length;

            // Mark interview complete
            this.interviewService.complete();
            this.currentProposal = undefined;

            // Notify webview
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'interviewComplete',
                    requirementPath: savedReqPath || ''
                });
            }

            // Refresh requirements list
            if (savedReqPath) {
                this.sendRequirements();
            }

            // Show appropriate message
            if (isTaskScope) {
                vscode.window.showInformationMessage(`Created ${taskCount} task(s)`);
            } else {
                vscode.window.showInformationMessage(
                    `Created ${featureCount} feature(s) and ${taskCount} task(s)`
                );
            }
        } catch (error) {
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'interviewError',
                    error: error instanceof Error ? error.message : 'Failed to save proposal'
                });
            }
        }
    }

    private handleCancelInterview(): void {
        this.interviewService.cancel();
        this.currentProposal = undefined;
        this.interviewScope = undefined;

        if (this._view) {
            this._view.webview.postMessage({ type: 'interviewCancelled' });
        }
    }

    private async handleStartRecording(): Promise<void> {
        try {
            // Check if audio recording (sox) and transcription (whisper) are available
            const audioCheck = await this.audioRecorder.isAvailable();
            const whisperBinary = await this.whisperService.getBinaryPath();
            const whisperModel = await this.whisperService.getModelPath();

            console.log('[WebviewProvider] handleStartRecording - sox:', audioCheck.available, 'whisperBinary:', whisperBinary, 'whisperModel:', whisperModel);

            // If either is missing, show setup modal in webview
            if (!audioCheck.available || !whisperBinary || !whisperModel) {
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'showSetup',
                        needsSox: !audioCheck.available,
                        needsWhisperBinary: !whisperBinary,
                        needsWhisperModel: !whisperModel,
                        platform: process.platform // 'darwin', 'win32', 'linux'
                    });
                }
                return;
            }

            // Start recording
            await this.audioRecorder.startRecording();

            // Notify webview that recording started
            if (this._view) {
                this._view.webview.postMessage({ type: 'recordingStarted' });
            }
        } catch (error) {
            console.error('Start recording error:', error);
            this.sendVoiceError(error instanceof Error ? error.message : 'Failed to start recording');
        }
    }

    private handleInstallSox(): void {
        const terminal = vscode.window.createTerminal('Install Sox');
        terminal.sendText('brew install sox && echo "\\n✅ Sox installed. You can close this terminal."');
        terminal.show();
    }

    private async handleInstallWhisper(method: 'homebrew' | 'source'): Promise<void> {
        if (method === 'homebrew') {
            const terminal = vscode.window.createTerminal('Install Whisper');
            terminal.sendText('brew install whisper-cpp && echo "\\n✅ whisper.cpp installed. You can close this terminal."');
            terminal.show();
        } else {
            // Use the existing setup method which handles source build
            await this.whisperService.setup();
        }
    }

    private async handleCheckSetup(): Promise<void> {
        console.log('[WebviewProvider] handleCheckSetup called');
        const audioCheck = await this.audioRecorder.isAvailable();

        // Check whisper binary and model separately for better diagnostics
        const whisperBinary = await this.whisperService.getBinaryPath();
        const whisperModel = await this.whisperService.getModelPath();
        const whisperReady = whisperBinary !== null && whisperModel !== null;

        console.log('[WebviewProvider] audioCheck:', audioCheck);
        console.log('[WebviewProvider] whisperBinary:', whisperBinary);
        console.log('[WebviewProvider] whisperModel:', whisperModel);
        console.log('[WebviewProvider] whisperReady:', whisperReady);

        if (audioCheck.available && whisperReady) {
            // All good - notify webview to close setup and optionally start recording
            if (this._view) {
                this._view.webview.postMessage({ type: 'setupComplete' });
            }
        } else {
            // Still missing something - update the setup modal
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'showSetup',
                    needsSox: !audioCheck.available,
                    needsWhisperBinary: !whisperBinary,
                    needsWhisperModel: !whisperModel,
                    platform: process.platform
                });
            }
        }
    }

    private async handleDownloadModel(): Promise<void> {
        const success = await this.whisperService.promptModelSelection();
        if (success) {
            // Re-check setup after model download
            await this.handleCheckSetup();
        }
    }

    private buildInProgress = false;

    private async handleBuildTasks(taskIds: string[]): Promise<void> {
        // Check if build already in progress
        if (this.buildInProgress) {
            vscode.window.showWarningMessage('A build is already in progress. Please wait for it to complete.');
            return;
        }

        if (taskIds.length === 0) {
            return;
        }

        // Track which tasks we're building
        this.buildTaskIds = new Set(taskIds);

        // Watch for task status changes to detect completion
        this.buildStatusListener?.dispose();
        this.buildStatusListener = this.taskStore.onDidChange(() => {
            this.checkBuildComplete();
        });

        // Reuse existing terminal or create new one
        if (!this.buildTerminal) {
            this.buildTerminal = vscode.window.createTerminal({
                name: 'Claude Build',
                cwd: this.workspaceRoot
            });

            // Watch for terminal close to clean up
            const closeListener = vscode.window.onDidCloseTerminal(terminal => {
                if (terminal === this.buildTerminal) {
                    this.cleanupBuild();
                    closeListener.dispose();
                }
            });
            this._disposables.push(closeListener);
        }

        // Mark build as started
        this.buildInProgress = true;
        if (this._view) {
            this._view.webview.postMessage({ type: 'buildStarted' });
        }

        // Simple prompt - Claude uses MCP tools to get details
        const ids = taskIds.join(', ');
        const prompt = taskIds.length === 1
            ? `Build task ${ids}. Use pmcockpit MCP tools to get details. Set status to ready-for-signoff when complete.`
            : `Build these tasks in order: ${ids}. Use pmcockpit MCP tools to get details. Set each task to ready-for-signoff when complete.`;

        this.buildTerminal.sendText(`claude "${prompt}"`, true); // true = add newline/enter
        this.buildTerminal.show();
    }

    private checkBuildComplete(): void {
        if (!this.buildTaskIds || this.buildTaskIds.size === 0) {
            return;
        }

        // Check if all build tasks have reached a "done" state
        const doneStatuses = new Set(['ready-for-signoff', 'done', 'rework']);
        const allDone = [...this.buildTaskIds].every(id => {
            const task = this.taskStore.getTask(id);
            return task && doneStatuses.has(task.status);
        });

        if (allDone) {
            console.log('[PMCockpit] All build tasks completed');
            this.handleBuildComplete();
        }
    }

    private handleBuildComplete(): void {
        this.buildInProgress = false;
        this.buildTaskIds = undefined;
        this.buildStatusListener?.dispose();
        this.buildStatusListener = undefined;

        // Notify webview
        if (this._view) {
            this._view.webview.postMessage({ type: 'buildEnded' });
        }
        // Keep terminal alive for next build
    }

    private cleanupBuild(): void {
        this.buildInProgress = false;
        this.buildTerminal = undefined;
        this.buildTaskIds = undefined;
        this.buildStatusListener?.dispose();
        this.buildStatusListener = undefined;

        // Notify webview
        if (this._view) {
            this._view.webview.postMessage({ type: 'buildEnded' });
        }
    }

    private sendProcessingStatus(status: string): void {
        if (this._view) {
            this._view.webview.postMessage({ type: 'processingStatus', status });
        }
    }

    private async handleStopRecording(): Promise<void> {
        try {
            // Stop recording and get the audio file path
            const audioPath = await this.audioRecorder.stopRecording();

            if (!audioPath) {
                this.sendVoiceError('No audio recorded. Please try again.');
                return;
            }

            // Notify webview that we're processing
            if (this._view) {
                this._view.webview.postMessage({ type: 'recordingStopped' });
            }

            // Step 1: Transcribe audio
            this.sendProcessingStatus('Transcribing audio...');
            const transcript = await this.whisperService.transcribe(audioPath);

            // Clean up audio file
            await fs.promises.unlink(audioPath).catch(() => { });

            if (!transcript || transcript.trim().length === 0) {
                this.sendVoiceError('Could not transcribe audio. Please try again.');
                return;
            }

            // Step 2: Parse into tasks
            this.sendProcessingStatus('Organizing into tasks...');
            const tasks = await this.parseTranscriptToTasks(transcript);

            // Send back to webview
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'voiceTranscribed',
                    tasks
                });
            }
        } catch (error) {
            console.error('Stop recording error:', error);
            this.sendVoiceError(error instanceof Error ? error.message : 'Failed to process recording');
        }
    }

    private async handleProcessText(text: string): Promise<void> {
        try {
            if (!text || text.trim().length === 0) {
                this.sendVoiceError('No text to process.');
                return;
            }

            // Parse text into tasks using Claude
            this.sendProcessingStatus('Organizing into tasks...');
            const tasks = await this.parseTranscriptToTasks(text);

            // Send back to webview
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'voiceTranscribed',
                    tasks
                });
            }
        } catch (error) {
            console.error('Process text error:', error);
            this.sendVoiceError(error instanceof Error ? error.message : 'Failed to process text');
        }
    }

    private async parseTranscriptToTasks(transcript: string): Promise<{ title: string; description: string }[]> {
        const { spawn } = await import('child_process');
        const fs = await import('fs');
        const os = await import('os');

        const startTime = Date.now();
        console.log('[PMCockpit] Parse started');

        const prompt = `Parse into tasks. Do NOT break down a single request into sub-steps.

"${transcript.replace(/"/g, "'").replace(/\n/g, ' ')}"`;

        try {
            // Write prompt to temp file to avoid shell escaping issues
            const tmpFile = path.join(os.tmpdir(), `pmcockpit-prompt-${Date.now()}.txt`);
            await fs.promises.writeFile(tmpFile, prompt);
            console.log(`[PMCockpit] +${Date.now() - startTime}ms - Wrote temp file`);

            // Remove VS Code Claude env vars that might interfere
            const env = { ...process.env };
            delete env.CLAUDE_CODE_SSE_PORT;
            delete env.ENABLE_IDE_INTEGRATION;

            // Get configured model for parsing (default to Haiku for speed)
            const parserModel = vscode.workspace.getConfiguration('pmcockpit').get<string>('parserModel', 'haiku');
            console.log('[PMCockpit] Using parser model:', parserModel);

            // Use spawn with login shell to get proper PATH
            const stdout = await new Promise<string>((resolve, reject) => {
                // --output-format json for structured output, --strict-mcp-config to skip MCP loading
                // --tools "" to disable tools, --system-prompt to override default behavior
                // --json-schema to enforce output structure
                const systemPrompt = 'You are a minimal task parser. One user request = one task. Never split into sub-tasks.';
                const taskSchema = JSON.stringify({
                    type: 'object',
                    properties: {
                        tasks: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' }
                                },
                                required: ['title', 'description']
                            }
                        }
                    },
                    required: ['tasks']
                });
                const cmd = `cat "${tmpFile}" | claude -p --model ${parserModel} --output-format json --strict-mcp-config --tools "" --system-prompt "${systemPrompt}" --json-schema '${taskSchema}' -`;
                console.log(`[PMCockpit] +${Date.now() - startTime}ms - Spawning: ${cmd}`);
                const proc = spawn('/bin/zsh', ['-l', '-c', cmd], {
                    cwd: this.workspaceRoot,
                    env
                });
                console.log(`[PMCockpit] +${Date.now() - startTime}ms - Process spawned`);

                let output = '';
                let errorOutput = '';
                let firstDataReceived = false;

                const timeout = setTimeout(() => {
                    proc.kill();
                    fs.promises.unlink(tmpFile).catch(() => {});
                    reject(new Error('Claude timed out'));
                }, 60000);

                proc.stdout.on('data', (data) => {
                    if (!firstDataReceived) {
                        firstDataReceived = true;
                        console.log(`[PMCockpit] +${Date.now() - startTime}ms - First output received`);
                    }
                    output += data.toString();
                });

                proc.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                proc.on('close', (code) => {
                    console.log(`[PMCockpit] +${Date.now() - startTime}ms - Process closed (code ${code})`);
                    clearTimeout(timeout);
                    fs.promises.unlink(tmpFile).catch(() => {});
                    if (code === 0) {
                        resolve(output);
                    } else {
                        // Check for terms acceptance required
                        if (errorOutput.includes('[ACTION REQUIRED]') && errorOutput.includes('Terms')) {
                            reject(new Error('Claude CLI requires you to accept updated terms. Please run "claude" in your terminal first.'));
                        } else {
                            reject(new Error(errorOutput || `Exit code ${code}`));
                        }
                    }
                });

                proc.on('error', (err) => {
                    clearTimeout(timeout);
                    fs.promises.unlink(tmpFile).catch(() => {});
                    reject(err);
                });
            });
            console.log(`[PMCockpit] +${Date.now() - startTime}ms - Starting JSON parse`);
            console.log('[PMCockpit] Claude raw output:', stdout);

            // With --output-format json + --json-schema, structured output is in:
            // {"type":"result","structured_output":{"tasks":[...]}}
            const wrapper = JSON.parse(stdout);
            if (wrapper.structured_output?.tasks) {
                console.log('[PMCockpit] Parsed tasks:', wrapper.structured_output.tasks);
                return wrapper.structured_output.tasks;
            }
        } catch (error) {
            console.error('Claude parsing error:', error);
        }

        // Fallback: create single task from transcript
        return [{
            title: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
            description: transcript.length > 100 ? transcript : ''
        }];
    }

    private sendVoiceError(error: string): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'voiceError',
                error
            });
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'webview.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'webview.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; media-src blob:;">
    <link href="${styleUri}" rel="stylesheet">
    <title>Product Cockpit</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
