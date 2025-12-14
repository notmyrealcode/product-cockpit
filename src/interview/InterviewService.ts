import { spawn, ChildProcess } from 'child_process';
import { v4 as uuid } from 'uuid';
import * as path from 'path';

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

const SYSTEM_PROMPT = `You are a requirements analyst helping a product manager define requirements for a software feature.

Your job is to:
1. Ask clarifying questions to understand what the user wants to build
2. Ask 2-3 questions at a time, not more
3. When you have enough information, propose a requirements document and suggest features/tasks

IMPORTANT: You must respond in valid JSON format. Each response should be ONE of these types:

For questions:
{"type":"questions","questions":[{"id":"q1","text":"What is the main goal?","type":"text"},{"id":"q2","text":"Who are the users?","type":"choice","options":["Internal team","External customers","Both"]}]}

For thinking/acknowledgment:
{"type":"thinking","text":"I understand. Let me ask a few more questions..."}

For final proposal:
{"type":"proposal","requirementDoc":"# Feature Name\\n\\n## Overview\\n...","requirementPath":"docs/requirements/feature-name.md","features":[{"title":"Feature 1","description":"..."}],"tasks":[{"title":"Task 1","description":"...","featureIndex":0}]}

Rules:
- Always respond with valid JSON
- Questions should have unique IDs
- type:"text" for open-ended, type:"choice" with options array for multiple choice
- featureIndex in tasks refers to the index in the features array (0-based), omit for standalone tasks
- requirementPath should be under docs/requirements/ with a descriptive filename`;

export class InterviewService {
    private process: ChildProcess | null = null;
    private sessionId: string | null = null;
    private scope: 'project' | 'new-feature' = 'new-feature';
    private messages: InterviewMessage[] = [];
    private callbacks: InterviewCallbacks | null = null;
    private buffer = '';

    constructor(private workspaceRoot: string) {}

    async start(
        scope: 'project' | 'new-feature',
        initialInput: string | undefined,
        callbacks: InterviewCallbacks
    ): Promise<string> {
        if (this.process) {
            this.stop();
        }

        this.sessionId = uuid();
        this.scope = scope;
        this.messages = [];
        this.callbacks = callbacks;
        this.buffer = '';

        // Remove VS Code Claude env vars that might interfere
        const env = { ...process.env };
        delete env.CLAUDE_CODE_SSE_PORT;
        delete env.ENABLE_IDE_INTEGRATION;

        // Start Claude process with streaming
        const args = [
            '-p',
            '--output-format', 'stream-json',
            '--strict-mcp-config',
            '--tools', '',
            '--system-prompt', SYSTEM_PROMPT,
            '-'
        ];

        this.process = spawn('claude', args, {
            cwd: this.workspaceRoot,
            env,
            shell: true
        });

        this.process.stdout?.on('data', (data) => this.handleStdout(data));
        this.process.stderr?.on('data', (data) => this.handleStderr(data));
        this.process.on('close', (code) => this.handleClose(code));
        this.process.on('error', (err) => this.handleError(err));

        // Send initial prompt
        const contextPrompt = scope === 'project'
            ? 'I want to define requirements for my project.'
            : 'I want to define requirements for a new feature.';

        const userInput = initialInput
            ? `${contextPrompt}\n\nHere's what I'm thinking:\n${initialInput}`
            : contextPrompt;

        this.sendMessage(userInput);

        return this.sessionId;
    }

    sendMessage(content: string): void {
        if (!this.process?.stdin) return;

        this.messages.push({ role: 'user', content });
        this.callbacks?.onMessage({ role: 'user', content });

        // Send to Claude
        this.process.stdin.write(content + '\n');
    }

    answerQuestion(questionId: string, answer: string): void {
        this.sendMessage(answer);
    }

    rejectProposal(feedback: string): void {
        this.sendMessage(`Please revise the proposal: ${feedback}`);
    }

    stop(): void {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.sessionId = null;
        this.callbacks = null;
    }

    private handleStdout(data: Buffer): void {
        this.buffer += data.toString();

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
            const event = JSON.parse(line);

            // Handle different stream-json event types
            if (event.type === 'content_block_delta' && event.delta?.text) {
                // Accumulate text and try to parse as our JSON format
                this.parseAssistantMessage(event.delta.text);
            } else if (event.type === 'message_stop') {
                // Message complete, flush any remaining buffer
                this.flushAssistantBuffer();
            } else if (event.type === 'error') {
                this.callbacks?.onError(event.error?.message || 'Unknown error');
            }
        } catch {
            // Not valid JSON, might be partial - ignore
        }
    }

    private assistantBuffer = '';

    private parseAssistantMessage(text: string): void {
        this.assistantBuffer += text;

        // Try to parse as complete JSON
        try {
            const parsed = JSON.parse(this.assistantBuffer);
            this.handleParsedResponse(parsed);
            this.assistantBuffer = '';
        } catch {
            // Not complete yet, keep accumulating
        }
    }

    private flushAssistantBuffer(): void {
        if (!this.assistantBuffer.trim()) return;

        // Try to parse the final buffer
        try {
            const parsed = JSON.parse(this.assistantBuffer);
            this.handleParsedResponse(parsed);
        } catch {
            // If it's not valid JSON, treat as plain text message
            this.callbacks?.onMessage({ role: 'assistant', content: this.assistantBuffer });
        }
        this.assistantBuffer = '';
    }

    private handleParsedResponse(response: Record<string, unknown>): void {
        const type = response.type as string;

        switch (type) {
            case 'questions': {
                const questions = response.questions as InterviewQuestion[];
                // Send each question
                for (const q of questions) {
                    this.callbacks?.onQuestion(q);
                    this.callbacks?.onMessage({ role: 'assistant', content: q.text });
                }
                break;
            }
            case 'thinking': {
                const text = response.text as string;
                this.callbacks?.onThinking();
                this.callbacks?.onMessage({ role: 'assistant', content: text });
                break;
            }
            case 'proposal': {
                const proposal: InterviewProposal = {
                    requirementDoc: response.requirementDoc as string,
                    requirementPath: response.requirementPath as string,
                    features: response.features as InterviewProposal['features'],
                    tasks: response.tasks as InterviewProposal['tasks'],
                };
                this.callbacks?.onProposal(proposal);
                break;
            }
            default:
                // Unknown type, just show as message
                this.callbacks?.onMessage({
                    role: 'assistant',
                    content: JSON.stringify(response, null, 2)
                });
        }
    }

    private handleStderr(data: Buffer): void {
        const text = data.toString();
        console.error('[InterviewService stderr]', text);
        // Don't treat all stderr as errors - Claude outputs progress info there
    }

    private handleClose(code: number | null): void {
        console.log('[InterviewService] Process closed with code:', code);
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
        return this.sessionId;
    }

    isActive(): boolean {
        return this.process !== null;
    }
}
