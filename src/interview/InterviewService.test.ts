import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'child_process';

// Extract the schema from InterviewService for testing
// In a real setup, we'd export this from the module
const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['questions', 'proposal'] },
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    questionType: { type: 'string', enum: ['choice', 'text'] },
                    options: { type: 'array', items: { type: 'string' } }
                },
                required: ['id', 'text', 'questionType']
            }
        },
        requirementDoc: { type: 'string' },
        requirementPath: { type: 'string' },
        features: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' }
                },
                required: ['title', 'description']
            }
        },
        tasks: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    featureIndex: { type: 'number' }
                },
                required: ['title', 'description']
            }
        }
    },
    required: ['type']
};

describe('InterviewService Schema', () => {
    it('schema has type: object at root (required by Claude CLI)', () => {
        expect(RESPONSE_SCHEMA.type).toBe('object');
    });

    it('schema has required type field', () => {
        expect(RESPONSE_SCHEMA.required).toContain('type');
    });

    it('type enum includes questions and proposal', () => {
        expect(RESPONSE_SCHEMA.properties.type.enum).toContain('questions');
        expect(RESPONSE_SCHEMA.properties.type.enum).toContain('proposal');
    });
});

describe('Claude CLI Integration', () => {
    const escapedSchema = JSON.stringify(RESPONSE_SCHEMA).replace(/'/g, "'\\''");

    it('CLI accepts the schema without error', () => {
        // Quick test that schema is valid - ask Claude to return questions type
        const prompt = 'Return a questions response with one question asking about color preference';
        const cmd = `echo "${prompt}" | claude -p --output-format json --json-schema '${escapedSchema}' --tools "" -`;

        try {
            const result = execSync(cmd, {
                encoding: 'utf-8',
                timeout: 60000,
                env: { ...process.env, CLAUDE_CODE_SSE_PORT: '', ENABLE_IDE_INTEGRATION: '' }
            });

            const parsed = JSON.parse(result);
            console.log('CLI Response:', JSON.stringify(parsed, null, 2));

            expect(parsed.type).toBe('result');
            expect(parsed.is_error).toBe(false);
            expect(parsed.structured_output).toBeDefined();
            expect(parsed.structured_output.type).toBe('questions');
        } catch (error: unknown) {
            const err = error as { stdout?: string; stderr?: string; message?: string };
            console.error('CLI Error:', err.stdout || err.stderr || err.message);
            throw error;
        }
    });

    it('CLI can return proposal type', () => {
        const prompt = 'Return a proposal response with one task titled "Add button"';
        const cmd = `echo "${prompt}" | claude -p --output-format json --json-schema '${escapedSchema}' --tools "" -`;

        try {
            const result = execSync(cmd, {
                encoding: 'utf-8',
                timeout: 60000,
                env: { ...process.env, CLAUDE_CODE_SSE_PORT: '', ENABLE_IDE_INTEGRATION: '' }
            });

            const parsed = JSON.parse(result);
            console.log('CLI Response:', JSON.stringify(parsed, null, 2));

            expect(parsed.type).toBe('result');
            expect(parsed.is_error).toBe(false);
            expect(parsed.structured_output).toBeDefined();
            expect(parsed.structured_output.type).toBe('proposal');
            expect(parsed.structured_output.tasks).toBeDefined();
            expect(Array.isArray(parsed.structured_output.tasks)).toBe(true);
        } catch (error: unknown) {
            const err = error as { stdout?: string; stderr?: string; message?: string };
            console.error('CLI Error:', err.stdout || err.stderr || err.message);
            throw error;
        }
    });
});

describe('Response Parsing', () => {
    // Test parsing logic without calling CLI
    function parseResponse(line: string) {
        const parsed = JSON.parse(line);

        if (parsed.type === 'result') {
            if (parsed.is_error) {
                return { error: parsed.result };
            }
            if (parsed.structured_output) {
                return { response: parsed.structured_output };
            }
        }

        if (parsed.type === 'questions' || parsed.type === 'proposal') {
            return { response: parsed };
        }

        return { unknown: true };
    }

    it('parses CLI result wrapper with structured_output', () => {
        const cliOutput = JSON.stringify({
            type: 'result',
            is_error: false,
            structured_output: {
                type: 'questions',
                questions: [{ id: 'q1', text: 'Test?', questionType: 'text' }]
            }
        });

        const result = parseResponse(cliOutput);
        expect(result.response).toBeDefined();
        expect(result.response.type).toBe('questions');
        expect(result.response.questions).toHaveLength(1);
    });

    it('parses CLI error response', () => {
        const cliOutput = JSON.stringify({
            type: 'result',
            is_error: true,
            result: 'API Error: 400 invalid_request'
        });

        const result = parseResponse(cliOutput);
        expect(result.error).toBe('API Error: 400 invalid_request');
    });

    it('parses direct questions response (fallback)', () => {
        const directOutput = JSON.stringify({
            type: 'questions',
            questions: [{ id: 'q1', text: 'Direct?', questionType: 'choice', options: ['A', 'B'] }]
        });

        const result = parseResponse(directOutput);
        expect(result.response).toBeDefined();
        expect(result.response.type).toBe('questions');
    });
});
