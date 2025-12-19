import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TaskStore } from '../tasks/TaskStore';
import { WhisperService } from '../voice/WhisperService';
import { AudioRecorder } from '../voice/AudioRecorder';
import { InterviewService, InterviewProposal, InterviewQuestion, InterviewMessage, InterviewScope, InterviewContext } from '../interview/InterviewService';
import { ProjectContext } from '../context/ProjectContext';
import { TASK_PARSER_PROMPT, TASK_PARSER_SCHEMA } from '../prompts';
import type { Task } from '../tasks/types';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Output channel for debugging
const outputChannel = vscode.window.createOutputChannel('Shepherd');

function log(message: string): void {
    const timestamp = new Date().toISOString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
    console.log(`[Shepherd] ${message}`);
}

interface Requirement {
    path: string;
    title: string;
}

interface RequirementIndex {
    [path: string]: {
        title: string;
        summary: string;
        updatedAt: string;
    };
}

export class TaskWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'shepherd.taskView';
    private _view?: vscode.WebviewView;
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly requirementsDir: string;
    private readonly requirementsIndexPath: string;
    private readonly whisperService: WhisperService;
    private readonly audioRecorder: AudioRecorder;
    private readonly interviewService: InterviewService;
    private readonly projectContext: ProjectContext;
    private buildTerminal?: vscode.Terminal;
    private buildTaskIds?: Set<string>;
    private buildStatusListener?: vscode.Disposable;
    private currentProposal?: InterviewProposal;
    private currentDesignMd?: string;
    private interviewScope?: InterviewScope;
    private recordingRawMode = false;
    private proposalPanel?: vscode.WebviewPanel;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly taskStore: TaskStore,
        private readonly workspaceRoot: string
    ) {
        log('WebviewProvider constructor called');

        this.requirementsDir = path.join(workspaceRoot, 'docs', 'requirements');
        this.requirementsIndexPath = path.join(this.requirementsDir, '.index.json');
        this.whisperService = new WhisperService(workspaceRoot);
        this.audioRecorder = new AudioRecorder(workspaceRoot);
        this.interviewService = new InterviewService(workspaceRoot);
        this.projectContext = new ProjectContext(workspaceRoot);

        // Initialize project context (creates COPILOT.md, design.md, etc.)
        this.projectContext.initialize();

        // Subscribe to task changes
        this._disposables.push(
            this.taskStore.onDidChange(() => {
                this.sendTasks();
                // Update COPILOT.md with current features
                this.projectContext.updateCopilotMd(this.taskStore.getFeatures());
            })
        );

        // Watch requirements folder for changes
        this.watchRequirements();
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    /**
     * Triggers the voice setup flow - checks dependencies and shows setup modal if needed.
     * Called from shepherd.setupVoice command.
     */
    public async triggerVoiceSetup(): Promise<void> {
        log('triggerVoiceSetup called, _view exists: ' + !!this._view);

        // Wait for view to be ready if it isn't yet
        if (!this._view) {
            // View not ready - wait a bit for it to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!this._view) {
            vscode.window.showWarningMessage('Please open the Shepherd sidebar first, then try again.');
            return;
        }

        // Ensure view is visible
        this._view.show(true);

        // Check voice dependencies and show setup modal
        const audioCheck = await this.audioRecorder.isAvailable();
        const whisperBinary = await this.whisperService.getBinaryPath();
        const whisperModel = await this.whisperService.getModelPath();

        log('Voice setup check - sox: ' + audioCheck.available + ', whisper: ' + !!whisperBinary + ', model: ' + !!whisperModel);

        if (audioCheck.available && whisperBinary && whisperModel) {
            // Already set up - set walkthrough context
            await vscode.commands.executeCommand('setContext', 'shepherd.walkthrough.voiceDone', true);
            vscode.window.showInformationMessage('Voice capture is ready to use! Click the microphone button to record.');
        } else {
            // Show setup modal
            this._view.webview.postMessage({
                type: 'showSetup',
                needsSox: !audioCheck.available,
                needsWhisperBinary: !whisperBinary,
                needsWhisperModel: !whisperModel,
                platform: process.platform
            });
        }
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

        log('resolveWebviewView called, visible: ' + webviewView.visible);
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        log('HTML set for webview');

        // Track if webview is ready (has sent 'ready' message)
        let webviewReady = false;

        // Resend initialization when view becomes visible
        webviewView.onDidChangeVisibility(() => {
            log('onDidChangeVisibility, visible: ' + webviewView.visible + ', webviewReady: ' + webviewReady);
            if (webviewView.visible && webviewReady) {
                log('Resending initialization on visibility change');
                this.sendInitialized();
            }
        });

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            log('Received message: ' + message.type);
            try {
                switch (message.type) {
                    case 'ready':
                        log('Received ready, view visible: ' + webviewView.visible);
                        webviewReady = true;
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
                        // Mark walkthrough step as complete
                        vscode.commands.executeCommand('setContext', 'shepherd.walkthrough.taskCreated', true);
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
                    case 'updateProject':
                        const updatedProject = this.taskStore.updateProject(message.updates);
                        this._view?.webview.postMessage({ type: 'projectUpdated', project: updatedProject });
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
                        this.handleApproveProposal(
                            message.editedRequirementDoc,
                            message.editedDesignChanges,
                            message.removedFeatureIndices,
                            message.removedTaskIndices
                        );
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
                    case 'openDesignGuide':
                        this.projectContext.openDesignGuide();
                        break;
                    case 'deleteRequirement':
                        this.deleteRequirement(message.path);
                        break;
                    case 'startRecording':
                        this.handleStartRecording(message.rawMode);
                        break;
                    case 'stopRecording':
                        this.handleStopRecording(this.recordingRawMode);
                        break;
                    case 'processText':
                        this.handleProcessText(message.text);
                        break;
                    case 'installVoiceDeps':
                        await this.handleInstallVoiceDeps();
                        break;
                    case 'checkSetup':
                        await this.handleCheckSetup();
                        break;
                    case 'downloadModel':
                        await this.handleDownloadModel();
                        break;
                    case 'openProposalPanel':
                        this.openProposalPanel();
                        break;
                    case 'cancelProposal':
                        this.handleCancelProposal();
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
        log('sendInitialized called, _view exists: ' + !!this._view);
        if (this._view) {
            const project = this.taskStore.getProject();
            const features = this.taskStore.getFeatures();
            const tasks = this.taskStore.getTasks();
            const requirements = await this.getRequirements();
            const parserModel = vscode.workspace.getConfiguration('shepherd').get<string>('parserModel', 'haiku');
            log('Sending initialized with ' + tasks.length + ' tasks, ' + features.length + ' features');
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
        await vscode.workspace.getConfiguration('shepherd').update('parserModel', model, vscode.ConfigurationTarget.Global);
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
            // Also remove from index
            await this.removeFromRequirementsIndex(reqPath);
            vscode.window.showInformationMessage(`Deleted ${path.basename(reqPath)}`);
            // File watcher will trigger sendRequirements automatically
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete requirement: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async readRequirementsIndex(): Promise<RequirementIndex> {
        try {
            const content = await fs.promises.readFile(this.requirementsIndexPath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return {};
        }
    }

    private async writeRequirementsIndex(index: RequirementIndex): Promise<void> {
        await fs.promises.writeFile(
            this.requirementsIndexPath,
            JSON.stringify(index, null, 2),
            'utf-8'
        );
    }

    private async removeFromRequirementsIndex(reqPath: string): Promise<void> {
        const index = await this.readRequirementsIndex();
        delete index[reqPath];
        await this.writeRequirementsIndex(index);
    }

    private async generateRequirementSummary(content: string): Promise<string> {
        try {
            // Use Claude to generate a 1-line summary
            const prompt = `Summarize this requirement document in exactly one sentence (max 100 chars). Output ONLY the summary, nothing else:\n\n${content.slice(0, 2000)}`;

            const { stdout } = await execAsync(
                `echo ${JSON.stringify(prompt)} | claude -p --model claude-3-5-haiku-latest`,
                { cwd: this.workspaceRoot, timeout: 30000 }
            );

            return stdout.trim().slice(0, 150);  // Ensure it's not too long
        } catch (error) {
            console.error('[WebviewProvider] Failed to generate summary:', error);
            // Fallback: extract first sentence
            const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'));
            return firstLine?.slice(0, 100) || 'No description available';
        }
    }

    private async updateRequirementInIndex(reqPath: string, content: string): Promise<void> {
        const index = await this.readRequirementsIndex();

        // Extract title from content
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : path.basename(reqPath, '.md');

        // Generate summary
        const summary = await this.generateRequirementSummary(content);

        index[reqPath] = {
            title,
            summary,
            updatedAt: new Date().toISOString()
        };

        await this.writeRequirementsIndex(index);
    }

    private async handleStartInterview(scope: InterviewScope, initialInput?: string): Promise<void> {
        this.interviewScope = scope;
        this.currentProposal = undefined;

        try {
            // Gather context about existing app
            const context = await this.gatherInterviewContext();

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
                onProposal: async (proposal: InterviewProposal) => {
                    this.currentProposal = proposal;

                    // For simple task scope (single task, no features, no design changes),
                    // auto-approve without showing the review panel
                    const isSimpleTask = this.interviewScope === 'task' &&
                        proposal.features.length === 0 &&
                        proposal.tasks.length === 1 &&
                        !proposal.proposedDesignMd;

                    if (isSimpleTask) {
                        // Auto-approve the simple task
                        await this.handleApproveProposal();
                        return;
                    }

                    // Read current design.md for diff view
                    if (proposal.proposedDesignMd) {
                        const designPath = path.join(this.workspaceRoot, 'docs', 'requirements', 'design.md');
                        try {
                            this.currentDesignMd = await fs.promises.readFile(designPath, 'utf-8');
                        } catch {
                            this.currentDesignMd = undefined;
                        }
                    }

                    // Notify sidebar that proposal is being reviewed in panel
                    if (this._view) {
                        this._view.webview.postMessage({
                            type: 'interviewProposal',
                            proposal,
                            currentDesignMd: this.currentDesignMd
                        });
                    }

                    // Open the proposal panel in editor area for review
                    this.openProposalPanel();
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
            }, context);

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

    private async handleApproveProposal(
        editedRequirementDoc?: string,
        editedDesignChanges?: string,
        removedFeatureIndices?: number[],
        removedTaskIndices?: number[]
    ): Promise<void> {
        if (!this.currentProposal) {
            return;
        }

        try {
            const isTaskScope = this.interviewScope === 'task';
            let savedReqPath: string | undefined;
            const removedFeatures = new Set(removedFeatureIndices || []);
            const removedTasks = new Set(removedTaskIndices || []);

            // 1. Save requirement document (only for project/feature scope)
            const docContent = editedRequirementDoc || this.currentProposal.requirementDoc;
            if (!isTaskScope && docContent && docContent.trim()) {
                // Generate a default path if not provided or if it conflicts with design.md
                let requirementPath = this.currentProposal.requirementPath;
                if (!requirementPath || requirementPath.endsWith('design.md')) {
                    // Extract title from first heading or use timestamp
                    const titleMatch = docContent.match(/^#\s+(.+)$/m);
                    const baseSlug = titleMatch
                        ? titleMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                        : `requirement`;

                    // Find unique filename (append -2, -3, etc. if exists)
                    let slug = baseSlug;
                    let counter = 1;
                    while (fs.existsSync(path.join(this.workspaceRoot, `docs/requirements/${slug}.md`))) {
                        counter++;
                        slug = `${baseSlug}-${counter}`;
                    }
                    requirementPath = `docs/requirements/${slug}.md`;
                }
                const reqPath = path.resolve(this.workspaceRoot, requirementPath);

                // Security: Validate path is within workspace (prevent path traversal)
                if (!reqPath.startsWith(this.workspaceRoot + path.sep)) {
                    throw new Error('Invalid requirement path: must be within workspace');
                }

                const reqDir = path.dirname(reqPath);
                await fs.promises.mkdir(reqDir, { recursive: true });
                await fs.promises.writeFile(reqPath, docContent, 'utf-8');
                savedReqPath = requirementPath;

                // Update requirements index with summary (async, don't block)
                this.updateRequirementInIndex(requirementPath, docContent).catch(err => {
                    console.error('[WebviewProvider] Failed to update requirements index:', err);
                });
            }

            // 2. Save design.md (full replacement)
            const proposedDesign = editedDesignChanges !== undefined
                ? editedDesignChanges
                : this.currentProposal.proposedDesignMd;

            if (proposedDesign && proposedDesign.trim()) {
                const designPath = path.resolve(this.workspaceRoot, 'docs/requirements/design.md');

                // Security: Validate path
                if (designPath.startsWith(this.workspaceRoot + path.sep)) {
                    const designDir = path.dirname(designPath);
                    await fs.promises.mkdir(designDir, { recursive: true });

                    // REPLACE entire file content (not append)
                    await fs.promises.writeFile(designPath, proposedDesign.trim() + '\n', 'utf-8');
                }
            }

            // 3. Create features and tasks (filtering out removed ones)
            const featureIdMap: Map<number, string> = new Map();

            // Create features first (only for non-task scope)
            if (!isTaskScope) {
                for (let i = 0; i < this.currentProposal.features.length; i++) {
                    if (removedFeatures.has(i)) continue;  // Skip removed features

                    const feat = this.currentProposal.features[i];
                    const feature = this.taskStore.createFeature({
                        title: feat.title,
                        description: feat.description,
                        requirement_path: savedReqPath
                    });
                    featureIdMap.set(i, feature.id);
                }
            }

            // Create tasks (filtering out removed ones and tasks belonging to removed features)
            let taskCount = 0;
            for (let i = 0; i < this.currentProposal.tasks.length; i++) {
                if (removedTasks.has(i)) continue;  // Skip removed tasks

                const task = this.currentProposal.tasks[i];

                // Skip tasks belonging to removed features
                if (task.featureIndex !== undefined && removedFeatures.has(task.featureIndex)) {
                    continue;
                }

                const featureId = task.featureIndex !== undefined
                    ? featureIdMap.get(task.featureIndex)
                    : undefined;
                this.taskStore.createTask({
                    title: task.title,
                    description: task.description,
                    feature_id: featureId || null
                });
                taskCount++;
            }

            // Save counts
            const featureCount = featureIdMap.size;

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

            // Always refresh requirements list after approval
            this.sendRequirements();

            // Show appropriate toast message in webview
            if (this._view) {
                const message = isTaskScope
                    ? `Created ${taskCount} task(s)`
                    : `Created ${featureCount} feature(s) and ${taskCount} task(s)`;
                this._view.webview.postMessage({
                    type: 'showToast',
                    message,
                    toastType: 'success'
                });
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

    private handleCancelProposal(): void {
        // Close the panel and notify sidebar
        this.proposalPanel?.dispose();
        this.proposalPanel = undefined;
        this.currentProposal = undefined;
        this.currentDesignMd = undefined;

        if (this._view) {
            this._view.webview.postMessage({ type: 'interviewCancelled' });
        }
    }

    private async gatherInterviewContext(): Promise<InterviewContext> {
        const context: InterviewContext = {};

        // Get project info
        const project = this.taskStore.getProject();
        if (project) {
            if (project.title) context.projectTitle = project.title;
            if (project.description) context.projectDescription = project.description;
        }

        // Get existing features
        const features = this.taskStore.getFeatures();
        if (features.length > 0) {
            context.existingFeatures = features.map(f => ({
                title: f.title,
                description: f.description
            }));
        }

        // Get existing requirements with summaries from index
        const requirements = await this.getRequirements();
        const index = await this.readRequirementsIndex();
        if (requirements.length > 0) {
            context.existingRequirements = requirements.map(r => {
                const indexed = index[r.path];
                return {
                    path: r.path,
                    title: indexed?.title || r.title,
                    summary: indexed?.summary || 'No summary available'
                };
            });
        }

        // Read current design.md - always include (empty string if doesn't exist)
        const designPath = path.join(this.workspaceRoot, 'docs', 'requirements', 'design.md');
        try {
            context.currentDesignMd = await fs.promises.readFile(designPath, 'utf-8');
        } catch {
            context.currentDesignMd = '';  // File doesn't exist
        }

        return context;
    }

    private async handleStartRecording(rawMode = false): Promise<void> {
        try {
            // Store raw mode for when recording stops
            this.recordingRawMode = rawMode;

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

    private async handleInstallVoiceDeps(): Promise<void> {
        // Check what's needed
        const audioCheck = await this.audioRecorder.isAvailable();
        const whisperBinary = await this.whisperService.getBinaryPath();

        const packages: string[] = [];
        if (!audioCheck.available) packages.push('sox');
        if (!whisperBinary) packages.push('whisper-cpp');

        if (packages.length === 0) {
            // Nothing to install, just check setup
            await this.handleCheckSetup();
            return;
        }

        const terminal = vscode.window.createTerminal('Shepherd Setup');

        // Listen for terminal close to auto-check setup
        const disposable = vscode.window.onDidCloseTerminal(async (closedTerminal) => {
            if (closedTerminal === terminal) {
                disposable.dispose();
                // Wait a moment for brew to finish writing
                await new Promise(resolve => setTimeout(resolve, 500));
                await this.handleCheckSetup();
            }
        });

        // Install and exit on success
        const installCmd = `brew install ${packages.join(' ')} && exit`;
        terminal.sendText(installCmd);
        terminal.show();
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
            // All good - set walkthrough context and notify webview
            await vscode.commands.executeCommand('setContext', 'shepherd.walkthrough.voiceDone', true);
            if (this._view) {
                this._view.webview.postMessage({ type: 'setupComplete' });
            }
            vscode.window.showInformationMessage('Voice capture is ready!');

            // Re-open walkthrough to show next step
            setTimeout(() => {
                vscode.commands.executeCommand(
                    'workbench.action.openWalkthrough',
                    'JustinEckhouse.shepherd#shepherd.welcome',
                    false
                );
            }, 300);
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
        console.log('[WebviewProvider] handleDownloadModel called');
        try {
            const success = await this.whisperService.promptModelSelection();
            console.log('[WebviewProvider] promptModelSelection result:', success);
            if (success) {
                // Re-check setup after model download
                await this.handleCheckSetup();
            }
        } catch (error) {
            console.error('[WebviewProvider] handleDownloadModel error:', error);
            throw error;
        }
    }

    private openProposalPanel(): void {
        // Reveal existing panel if we have one
        if (this.proposalPanel) {
            this.proposalPanel.reveal(vscode.ViewColumn.One);
            this.sendProposalDataToPanel();
            return;
        }

        // Create new panel
        this.proposalPanel = vscode.window.createWebviewPanel(
            'shepherd.proposalView',
            'Review Proposal',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')
                ],
                retainContextWhenHidden: true
            }
        );

        // Set HTML content
        this.proposalPanel.webview.html = this.getProposalPanelHtml(this.proposalPanel.webview);

        // Handle messages from panel
        this.proposalPanel.webview.onDidReceiveMessage(async (message) => {
            log('Panel message: ' + message.type);
            switch (message.type) {
                case 'requestProposalData':
                    this.sendProposalDataToPanel();
                    break;
                case 'approveProposal':
                    await this.handleApproveProposal(
                        message.editedRequirementDoc,
                        message.editedDesignChanges,
                        message.removedFeatureIndices,
                        message.removedTaskIndices
                    );
                    // Close panel after successful approval
                    this.proposalPanel?.dispose();
                    this.proposalPanel = undefined;
                    break;
                case 'rejectProposal':
                    this.interviewService.rejectProposal(message.feedback);
                    // Clear proposal and notify sidebar to continue interview
                    this.currentProposal = undefined;
                    this.currentDesignMd = undefined;
                    if (this._view) {
                        this._view.webview.postMessage({ type: 'proposalRejected' });
                    }
                    // Close panel
                    this.proposalPanel?.dispose();
                    this.proposalPanel = undefined;
                    break;
                case 'cancelProposal':
                    this.handleCancelProposal();
                    break;
            }
        });

        // Clean up reference when panel is closed
        this.proposalPanel.onDidDispose(() => {
            this.proposalPanel = undefined;
        });

        // Send initial data
        this.sendProposalDataToPanel();
    }

    private sendProposalDataToPanel(): void {
        if (!this.proposalPanel || !this.currentProposal) {
            return;
        }

        this.proposalPanel.webview.postMessage({
            type: 'proposalData',
            proposal: this.currentProposal,
            currentDesignMd: this.currentDesignMd || null,
            scope: this.interviewScope || 'new-feature'
        });
    }

    private getProposalPanelHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'proposal-panel.js')
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:; media-src blob:;">
    <link href="${styleUri}" rel="stylesheet">
    <title>Review Proposal</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
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
            ? `Build task ${ids}. Use shepherd MCP tools to get details. Set status to ready-for-signoff when complete.`
            : `Build these tasks in order: ${ids}. Use shepherd MCP tools to get details. Set each task to ready-for-signoff when complete.`;

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

    private async handleStopRecording(rawMode = false): Promise<void> {
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

            // Raw mode: return transcript directly without parsing
            if (rawMode) {
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'voiceRawTranscript',
                        transcript: transcript.trim()
                    });
                }
                return;
            }

            // Step 2: Parse into tasks (normal mode)
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
            const tmpFile = path.join(os.tmpdir(), `shepherd-prompt-${Date.now()}.txt`);
            await fs.promises.writeFile(tmpFile, prompt);
            console.log(`[PMCockpit] +${Date.now() - startTime}ms - Wrote temp file`);

            // Remove VS Code Claude env vars that might interfere
            const env = { ...process.env };
            delete env.CLAUDE_CODE_SSE_PORT;
            delete env.ENABLE_IDE_INTEGRATION;

            // Get configured model for parsing (default to Haiku for speed)
            const parserModel = vscode.workspace.getConfiguration('shepherd').get<string>('parserModel', 'haiku');
            console.log('[PMCockpit] Using parser model:', parserModel);

            // Use spawn with login shell to get proper PATH
            const stdout = await new Promise<string>((resolve, reject) => {
                // --output-format json for structured output, --strict-mcp-config to skip MCP loading
                // --tools "" to disable tools, --system-prompt to override default behavior
                // --json-schema to enforce output structure (prompts from centralized file)
                const taskSchema = JSON.stringify(TASK_PARSER_SCHEMA);
                const cmd = `cat "${tmpFile}" | claude -p --model ${parserModel} --output-format json --strict-mcp-config --tools "" --system-prompt "${TASK_PARSER_PROMPT}" --json-schema '${taskSchema}' -`;
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:; media-src blob:; connect-src https://hacker-news.firebaseio.com;">
    <link href="${styleUri}" rel="stylesheet">
    <title>Shepherd</title>
    <style>
        #loading-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: system-ui, sans-serif;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div id="root">
        <div id="loading-indicator">Loading Shepherd...</div>
    </div>
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
