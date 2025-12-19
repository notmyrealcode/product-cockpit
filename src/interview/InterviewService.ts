import { spawn, ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import { SessionRepo } from '../db/repositories/sessionRepo';
import type { RequirementSession } from '../db/types';
import { INTERVIEW_RESPONSE_SCHEMA, INTERVIEW_PROMPTS, INTENSITY_PROMPTS, type InterviewScope, type ThoughtPartnerIntensity } from '../prompts';

export type { InterviewScope };

export interface InterviewQuestion {
    id: string;
    text: string;
    type: 'text' | 'choice';
    options?: string[];
}

export interface InterviewProposal {
    requirementDoc: string;
    requirementPath: string;
    features: { title: string; description: string }[];
    tasks: { title: string; description: string; featureIndex?: number }[];
    proposedDesignMd?: string;  // Complete proposed design.md content (replaces existing)
}

export interface InterviewMessage {
    role: 'assistant' | 'user';
    content: string;
}

export interface InterviewCallbacks {
    onMessage: (message: InterviewMessage) => void;
    onQuestion: (question: InterviewQuestion) => void;
    onThinking: () => void;
    onProposal: (proposal: InterviewProposal) => void;
    onComplete: (requirementPath: string) => void;
    onError: (error: string) => void;
}

export interface InterviewContext {
    projectTitle?: string;
    projectDescription?: string;
    existingFeatures?: { title: string; description: string | null }[];
    existingRequirements?: { path: string; title: string; summary: string }[];
    currentDesignMd?: string;  // Empty string means file doesn't exist yet
}

export class InterviewService {
    private process: ChildProcess | null = null;
    private session: RequirementSession | null = null;
    private scope: InterviewScope = 'new-feature';
    private intensity: ThoughtPartnerIntensity = 'balanced';
    private messages: InterviewMessage[] = [];
    private callbacks: InterviewCallbacks | null = null;
    private buffer = '';
    private claudeSessionId: string | null = null;  // Claude CLI session ID for resume

    constructor(private workspaceRoot: string) {}

    async start(
        scope: InterviewScope,
        initialInput: string | undefined,
        callbacks: InterviewCallbacks,
        context?: InterviewContext,
        intensity: ThoughtPartnerIntensity = 'balanced'
    ): Promise<string> {
        if (this.process) {
            this.stop();
        }

        // Create session in database
        this.session = SessionRepo.create(scope, initialInput || '');
        this.scope = scope;
        this.intensity = intensity;
        this.messages = [];
        this.callbacks = callbacks;
        this.buffer = '';

        // Generate a new Claude session ID for this interview
        this.claudeSessionId = crypto.randomUUID();
        this.accumulatedRequirements = [];  // Clear any leftover requirements
        this.lastParsedResponse = null;
        this.pendingRetry = false;
        this.retryCount = 0;

        this.spawnClaudeProcess(false);  // false = new session, not resume

        // Build context section if we have existing app info
        const contextSection = this.buildContextSection(context);

        // Send initial prompt based on scope
        const scopeIntros: Record<InterviewScope, string> = {
            'project': 'I want to define requirements and a plan for my project.',
            'new-feature': 'I want to add a new feature to my existing app.',
            'task': 'I want to define a task clearly.'
        };
        const scopeIntro = scopeIntros[scope];

        // Build full message with context and user input
        let userMessage = scopeIntro;

        if (contextSection) {
            userMessage += `\n\n${contextSection}`;
        }

        if (initialInput) {
            userMessage += `\n\n## My Request\n${initialInput}`;
        }

        this.sendMessage(userMessage);

        return this.session.id;
    }

    private buildContextSection(context?: InterviewContext): string | null {
        if (!context) return null;

        const sections: string[] = [];

        // Project info
        if (context.projectTitle || context.projectDescription) {
            let projectInfo = '## Existing App';
            if (context.projectTitle) {
                projectInfo += `\nProject: ${context.projectTitle}`;
            }
            if (context.projectDescription) {
                projectInfo += `\nDescription: ${context.projectDescription}`;
            }
            sections.push(projectInfo);
        }

        // Existing features
        if (context.existingFeatures && context.existingFeatures.length > 0) {
            let featuresInfo = '## Existing Features';
            for (const feat of context.existingFeatures) {
                featuresInfo += `\n- ${feat.title}`;
                if (feat.description) {
                    featuresInfo += `: ${feat.description}`;
                }
            }
            sections.push(featuresInfo);
        }

        // Existing requirements - send summaries with file paths
        if (context.existingRequirements && context.existingRequirements.length > 0) {
            let reqsInfo = '## Existing Requirements\nThese requirement files exist in the project. Use the summaries to understand context:';
            for (const req of context.existingRequirements) {
                reqsInfo += `\n- **${req.title}** (${req.path}): ${req.summary}`;
            }
            sections.push(reqsInfo);
        }

        // Current design guide - always include so Claude knows about design.md
        if (context.currentDesignMd !== undefined) {
            if (context.currentDesignMd.trim()) {
                sections.push(`## Current design.md (docs/requirements/design.md)
\`\`\`markdown
${context.currentDesignMd}
\`\`\`

NOTE: If you propose visual/UI changes (colors, typography, spacing, UI patterns), include the COMPLETE file content in "proposedDesignMd" - this replaces the existing file.`);
            } else {
                sections.push(`## design.md (docs/requirements/design.md)
The design guide file is currently empty or doesn't exist.

NOTE: If you propose visual/UI changes (colors, typography, spacing, UI patterns), create a new design guide by including the full content in "proposedDesignMd".`);
            }
        }

        return sections.length > 0 ? sections.join('\n\n') : null;
    }

    
    async resume(
        sessionId: string,
        callbacks: InterviewCallbacks
    ): Promise<boolean> {
        const session = SessionRepo.get(sessionId);
        if (!session || session.status === 'complete') {
            return false;
        }

        if (this.process) {
            this.stop();
        }

        this.session = session;
        this.scope = session.scope as InterviewScope;
        this.callbacks = callbacks;
        this.buffer = '';

        // Generate new Claude session ID for resumed interview
        // (We can't restore the original Claude CLI session, so we replay history)
        this.claudeSessionId = crypto.randomUUID();
        this.accumulatedRequirements = [];
        this.lastParsedResponse = null;
        this.pendingRetry = false;
        this.retryCount = 0;

        // Restore messages from conversation
        if (session.conversation) {
            try {
                this.messages = JSON.parse(session.conversation);
                // Replay messages to UI
                for (const msg of this.messages) {
                    callbacks.onMessage(msg);
                }
            } catch {
                this.messages = [];
            }
        } else {
            this.messages = [];
        }

        // Restore proposal if available
        if (session.proposed_output) {
            try {
                const proposal = JSON.parse(session.proposed_output);
                callbacks.onProposal(proposal);
            } catch {
                // No valid proposal
            }
        }

        this.spawnClaudeProcess();

        // Re-send conversation history to Claude
        if (this.messages.length > 0 && this.process?.stdin) {
            const history = this.messages
                .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                .join('\n\n');
            this.process.stdin.write(`Continue this conversation:\n\n${history}\n\nPlease continue.\n`);
            this.process.stdin.end();  // Claude CLI -p mode needs EOF to process
        }

        return true;
    }

    private spawnClaudeProcess(isResume: boolean = false): void {
        // Remove VS Code Claude env vars that might interfere
        const env = { ...process.env };
        delete env.CLAUDE_CODE_SSE_PORT;
        delete env.ENABLE_IDE_INTEGRATION;

        // Get scope-specific system prompt from centralized prompts
        const basePrompt = INTERVIEW_PROMPTS[this.scope];
        const intensityAddition = INTENSITY_PROMPTS[this.intensity];
        const systemPrompt = intensityAddition ? `${basePrompt}\n\n${intensityAddition}` : basePrompt;

        // Escape for shell
        const escapedPrompt = systemPrompt.replace(/'/g, "'\\''");
        const escapedSchema = JSON.stringify(INTERVIEW_RESPONSE_SCHEMA).replace(/'/g, "'\\''");

        let cmd: string;
        if (isResume && this.claudeSessionId) {
            // Resume existing session with JSON schema for structured output
            cmd = `claude -p --resume ${this.claudeSessionId} --output-format json --json-schema '${escapedSchema}' --strict-mcp-config --tools "" -`;
            console.log('[InterviewService] Resuming Claude session:', this.claudeSessionId);
        } else {
            // New session with system prompt and JSON schema
            cmd = `claude -p --session-id ${this.claudeSessionId} --output-format json --json-schema '${escapedSchema}' --strict-mcp-config --tools "" --system-prompt '${escapedPrompt}' -`;
            console.log('[InterviewService] Starting new Claude session:', this.claudeSessionId);
        }

        this.process = spawn('/bin/zsh', ['-l', '-c', cmd], {
            cwd: this.workspaceRoot,
            env
        });

        this.process.stdout?.on('data', (data) => this.handleStdout(data));
        this.process.stderr?.on('data', (data) => this.handleStderr(data));
        this.process.on('close', (code) => this.handleClose(code));
        this.process.on('error', (err) => this.handleError(err));
    }

    sendMessage(content: string): void {
        if (!this.process?.stdin) {
            console.error('[InterviewService] No stdin available');
            return;
        }

        console.log('[InterviewService] Sending message:', content.slice(0, 100));
        this.messages.push({ role: 'user', content });
        this.callbacks?.onMessage({ role: 'user', content });
        this.persistConversation();

        // Send to Claude and close stdin (Claude -p mode needs EOF to process)
        this.process.stdin.write(content);
        this.process.stdin.end();
    }

    answerQuestion(questionId: string, answer: string): void {
        this.continueConversation(answer);
    }

    rejectProposal(feedback: string): void {
        this.continueConversation(`Please revise the proposal: ${feedback}`);
    }

    private continueConversation(userMessage: string): void {
        // Add user message to history and UI
        this.messages.push({ role: 'user', content: userMessage });
        this.callbacks?.onMessage({ role: 'user', content: userMessage });
        this.persistConversation();

        // Clear deduplication state for new conversation turn
        this.lastParsedResponse = null;
        this.buffer = '';

        // Kill existing process if any
        if (this.process) {
            this.process.kill();
            this.process = null;
        }

        // Resume the Claude session - it maintains conversation context
        this.spawnClaudeProcess(true);  // true = resume mode

        // Send message to Claude
        const stdin = this.process!.stdin;
        if (stdin) {
            console.log('[InterviewService] Resuming conversation, sending:', userMessage.slice(0, 80));
            stdin.write(userMessage);
            stdin.end();
        } else {
            console.error('[InterviewService] No stdin available after spawn');
            this.callbacks?.onError('Failed to send message to Claude');
        }
    }

    stop(): void {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.session = null;
        this.callbacks = null;
        this.claudeSessionId = null;
    }

    cancel(): void {
        if (this.session) {
            SessionRepo.update(this.session.id, { status: 'cancelled' });
        }
        this.stop();
    }

    complete(): void {
        if (this.session) {
            SessionRepo.update(this.session.id, { status: 'complete' });
        }
        this.stop();
    }

    private persistConversation(): void {
        if (this.session) {
            SessionRepo.update(this.session.id, {
                conversation: JSON.stringify(this.messages)
            });
        }
    }

    private persistProposal(proposal: InterviewProposal): void {
        if (this.session) {
            SessionRepo.update(this.session.id, {
                proposed_output: JSON.stringify(proposal),
                status: 'proposed'
            });
        }
    }

    getActiveSessions(): RequirementSession[] {
        return SessionRepo.getActive();
    }

    private handleStdout(data: Buffer): void {
        const chunk = data.toString();
        console.log('[InterviewService] stdout chunk:', chunk.slice(0, 200));
        this.buffer += chunk;

        // Process complete JSON objects from the buffer
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            this.processLine(line);
        }
    }

    private processLine(line: string): void {
        try {
            const parsed = JSON.parse(line);
            console.log('[InterviewService] Parsed:', parsed.type);

            // Handle CLI result wrapper (when using --output-format json)
            if (parsed.type === 'result') {
                if (parsed.is_error) {
                    console.error('[InterviewService] CLI error:', parsed.result);
                    this.callbacks?.onError(parsed.result || 'Claude CLI error');
                    return;
                }
                // Extract structured_output from the result wrapper
                if (parsed.structured_output) {
                    console.log('[InterviewService] Got structured_output:', parsed.structured_output.type);
                    this.handleParsedResponse(parsed.structured_output);
                }
                return;
            }

            // Deduplicate: skip if we just processed this exact response
            const responseKey = JSON.stringify(parsed);
            if (responseKey === this.lastParsedResponse) {
                console.log('[InterviewService] Skipping duplicate response');
                return;
            }
            this.lastParsedResponse = responseKey;

            // Handle our custom JSON format from Claude
            if (parsed.type === 'question' || parsed.type === 'questions' || parsed.type === 'proposal') {
                this.handleParsedResponse(parsed);
            } else if (parsed.type === 'error') {
                this.callbacks?.onError(parsed.error?.message || parsed.message || 'Unknown error');
            }
        } catch {
            // Not valid JSON - log for debugging
            console.log('[InterviewService] Non-JSON line:', line.slice(0, 100));
        }
    }

    private lastParsedResponse: string | null = null;  // Track last parsed response to avoid duplicates
    private accumulatedRequirements: { title: string; description: string }[] = [];  // Accumulate requirements for streaming format
    private pendingRetry = false;  // Flag to retry if Claude outputs unexpected format
    private retryCount = 0;  // Prevent infinite retry loops

    private handleParsedResponse(response: Record<string, unknown>): void {
        const type = response.type as string;

        switch (type) {
            case 'question': {
                // Single question format
                const question: InterviewQuestion = {
                    id: response.id as string,
                    text: response.text as string,
                    type: (response.questionType as string) === 'choice' ? 'choice' : 'text',
                    options: response.options as string[] | undefined,
                };
                this.retryCount = 0;  // Valid response, reset retry counter

                // Add assistant message to indicate Claude asked a question
                // This ensures hasAssistantMessages check works correctly
                this.addAssistantMessage(question.text);

                this.callbacks?.onQuestion(question);
                break;
            }
            case 'questions': {
                // Batch questions format - queue all questions at once
                const rawQuestions = (response.questions as Array<{
                    id: string;
                    text: string;
                    questionType?: string;
                    options?: string[];
                }>) || [];
                if (rawQuestions.length === 0) {
                    console.warn('[InterviewService] Received questions type but no questions array');
                    break;
                }
                this.retryCount = 0;  // Valid response, reset retry counter

                // Add assistant message to indicate Claude asked questions
                // This ensures hasAssistantMessages check works correctly
                const questionTexts = rawQuestions.map(q => q.text).join('\n\n');
                this.addAssistantMessage(questionTexts);

                for (const q of rawQuestions) {
                    const question: InterviewQuestion = {
                        id: q.id,
                        text: q.text,
                        type: q.questionType === 'choice' ? 'choice' : 'text',
                        options: q.options,
                    };
                    this.callbacks?.onQuestion(question);
                }
                break;
            }
            case 'proposal': {
                const proposal: InterviewProposal = {
                    requirementDoc: (response.requirementDoc as string) || '',
                    requirementPath: (response.requirementPath as string) || '',
                    features: (response.features as InterviewProposal['features']) || [],
                    tasks: (response.tasks as InterviewProposal['tasks']) || [],
                    proposedDesignMd: (response.proposedDesignMd as string) || undefined,
                };
                this.accumulatedRequirements = [];  // Clear accumulated
                this.retryCount = 0;  // Valid response, reset retry counter
                this.persistProposal(proposal);
                this.callbacks?.onProposal(proposal);
                break;
            }
            case 'requirement': {
                // Claude streaming requirements one at a time - accumulate them
                const req = {
                    title: (response.title as string) || '',
                    description: (response.description as string) || '',
                };
                if (req.title) {
                    this.accumulatedRequirements.push(req);
                    console.log('[InterviewService] Accumulated requirement:', req.title);
                }
                break;
            }
            case 'complete': {
                // Claude finished streaming requirements - build proposal from accumulated
                if (this.accumulatedRequirements.length > 0) {
                    const proposal: InterviewProposal = {
                        requirementDoc: '',
                        requirementPath: '',
                        features: [],
                        tasks: this.accumulatedRequirements.map(req => ({
                            title: req.title,
                            description: req.description,
                        })),
                    };
                    this.accumulatedRequirements = [];
                    this.persistProposal(proposal);
                    this.callbacks?.onProposal(proposal);
                }
                break;
            }
            default:
                // Unknown type - might be a tool call, try to recover
                console.log('[InterviewService] Unknown response type:', type, response);

                // Check if this looks like a tool call
                if (response.tool_name || response.tool || response.function) {
                    console.log('[InterviewService] Detected tool call, will retry with format reminder');
                    // Schedule a retry after this turn completes
                    this.pendingRetry = true;
                }
        }
    }

    private addAssistantMessage(content: string): void {
        // Deduplicate: skip if last message has same role and content
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === content) {
            console.log('[InterviewService] Skipping duplicate assistant message:', content.slice(0, 50));
            return;
        }

        this.messages.push({ role: 'assistant', content });
        this.callbacks?.onMessage({ role: 'assistant', content });
        this.persistConversation();
    }

    private handleStderr(data: Buffer): void {
        const text = data.toString();
        console.error('[InterviewService stderr]', text);

        // Check for terms acceptance required
        if (text.includes('[ACTION REQUIRED]') && text.includes('Terms')) {
            this.callbacks?.onError('Claude CLI requires you to accept updated terms. Please run "claude" in your terminal first.');
            return;
        }

        // Don't treat all stderr as errors - Claude outputs progress info there
    }

    private handleClose(code: number | null): void {
        console.log('[InterviewService] Process closed with code:', code);

        // Flush any remaining buffer content
        if (this.buffer.trim()) {
            console.log('[InterviewService] Flushing remaining buffer:', this.buffer.slice(0, 100));
            this.processLine(this.buffer);
            this.buffer = '';
        }

        // Check if we need to retry due to unexpected format (tool call)
        if (this.pendingRetry && this.retryCount < 2) {
            this.pendingRetry = false;
            this.retryCount++;
            console.log('[InterviewService] Retrying with format reminder, attempt:', this.retryCount);

            // Continue conversation with a format reminder
            setTimeout(() => {
                this.continueConversation(
                    'Please respond with ONLY a JSON object in the exact format specified. ' +
                    'Do not use tools or skills. Output only {"type":"question",...} or {"type":"proposal",...}'
                );
            }, 100);
            return;
        }

        if (code !== 0 && this.callbacks) {
            this.callbacks.onError(`Interview process exited with code ${code}`);
        }
        this.process = null;
    }

    private handleError(err: Error): void {
        console.error('[InterviewService] Process error:', err);
        this.callbacks?.onError(err.message);
        this.process = null;
    }

    getMessages(): InterviewMessage[] {
        return [...this.messages];
    }

    getSessionId(): string | null {
        return this.session?.id || null;
    }

    isActive(): boolean {
        return this.process !== null;
    }
}
