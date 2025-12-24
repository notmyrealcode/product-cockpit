import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { findRuntime } from '../utils/runtime';

const MCP_SERVER_TEMPLATE = `#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const portFile = path.join(__dirname, '.port');
let port;

function waitForPort() {
    return new Promise((resolve, reject) => {
        const check = () => {
            try {
                port = parseInt(fs.readFileSync(portFile, 'utf-8').trim());
                resolve(port);
            } catch {
                setTimeout(check, 100);
            }
        };
        check();
        setTimeout(() => reject(new Error('Timeout waiting for port')), 30000);
    });
}

async function callBridge(method, endpoint, body) {
    await waitForPort();
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port,
            path: endpoint,
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const tools = {
    list_tasks: async ({ limit, status, feature_id }) => {
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        if (status) params.set('status', status);
        if (feature_id) params.set('feature_id', feature_id);
        const query = params.toString();
        return callBridge('GET', '/tasks' + (query ? '?' + query : ''));
    },
    get_task: async ({ task_id }) => callBridge('GET', \`/tasks/\${task_id}\`),
    update_task_status: async ({ task_id, status }) => callBridge('PATCH', \`/tasks/\${task_id}/status\`, { status }),
    create_task: async ({ title, description, feature_id, type }) => callBridge('POST', '/tasks', { title, description, feature_id, type }),
    list_features: async () => callBridge('GET', '/features'),
    get_feature: async ({ feature_id }) => callBridge('GET', \`/features/\${feature_id}\`),
    create_feature: async ({ title, description }) => callBridge('POST', '/features', { title, description }),
    list_requirements: async () => callBridge('GET', '/requirements'),
    get_requirements_path: async () => callBridge('GET', '/requirements/path'),
    get_task_requirement: async ({ task_id }) => callBridge('GET', \`/tasks/\${task_id}/requirement\`),
    create_requirement: async ({ path: reqPath, content }) => callBridge('POST', '/requirements', { path: reqPath, content }),
    complete_interview: async ({ requirement_path, task_ids }) => callBridge('POST', '/interview/complete', { requirement_path, task_ids })
};

const toolDefinitions = [
    { name: 'list_tasks', description: 'List tasks sorted by priority. Use limit=1 and status=todo to get the next task to work on.', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Max number of tasks to return' }, status: { type: 'string', enum: ['todo', 'in-progress', 'ready-for-signoff', 'done', 'rework'], description: 'Filter by status' }, feature_id: { type: 'string', description: 'Filter by feature ID' } } } },
    { name: 'get_task', description: 'Get a task by ID', inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
    { name: 'update_task_status', description: 'Update task status. Use ready-for-signoff when work is complete (PM will review and mark done).', inputSchema: { type: 'object', properties: { task_id: { type: 'string' }, status: { type: 'string', enum: ['todo', 'in-progress', 'ready-for-signoff', 'done', 'rework'], description: 'todo=not started, in-progress=working, ready-for-signoff=complete awaiting review, done=approved, rework=needs changes' } }, required: ['task_id', 'status'] } },
    { name: 'create_task', description: 'Create a new task', inputSchema: { type: 'object', properties: { title: { type: 'string', description: 'Short task title' }, description: { type: 'string', description: 'Detailed task description' }, feature_id: { type: 'string', description: 'Feature ID to attach task to' }, type: { type: 'string', enum: ['task', 'bug'], description: 'Task type' } }, required: ['title'] } },
    { name: 'list_features', description: 'List all features sorted by priority', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_feature', description: 'Get a feature by ID', inputSchema: { type: 'object', properties: { feature_id: { type: 'string' } }, required: ['feature_id'] } },
    { name: 'create_feature', description: 'Create a new feature to group related tasks', inputSchema: { type: 'object', properties: { title: { type: 'string', description: 'Feature title' }, description: { type: 'string', description: 'Feature description' } }, required: ['title'] } },
    { name: 'list_requirements', description: 'List all requirement files', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_requirements_path', description: 'Get the requirements folder path', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_task_requirement', description: 'Get the requirement path for a task (via its feature)', inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
    { name: 'create_requirement', description: 'Create a requirement file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
    { name: 'complete_interview', description: 'Signal interview completion', inputSchema: { type: 'object', properties: { requirement_path: { type: 'string' }, task_ids: { type: 'array', items: { type: 'string' } } } } }
];

process.stdin.setEncoding('utf-8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const msg = JSON.parse(line);
            let response;

            if (msg.method === 'initialize') {
                response = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'shepherd', version: '0.0.1' } } };
            } else if (msg.method === 'tools/list') {
                response = { jsonrpc: '2.0', id: msg.id, result: { tools: toolDefinitions } };
            } else if (msg.method === 'tools/call') {
                const { name, arguments: args } = msg.params;
                const result = await tools[name](args || {});
                response = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } };
            } else if (msg.method === 'notifications/initialized') {
                continue;
            } else {
                response = { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } };
            }

            process.stdout.write(JSON.stringify(response) + '\\n');
        } catch (e) {
            process.stderr.write('Error: ' + e.message + '\\n');
        }
    }
});
`;

export async function initialize(workspaceRoot: string): Promise<boolean> {
    const shepherdDir = path.join(workspaceRoot, '.shepherd');
    const requirementsDir = path.join(workspaceRoot, 'docs', 'requirements');
    const claudeDir = path.join(workspaceRoot, '.claude');

    // Create directories
    await fs.promises.mkdir(shepherdDir, { recursive: true });
    await fs.promises.mkdir(requirementsDir, { recursive: true });
    await fs.promises.mkdir(claudeDir, { recursive: true });

    // Database will be created by initDatabase() during extension activation
    // Just create a marker file to indicate initialization
    const markerFile = path.join(shepherdDir, '.initialized');
    await fs.promises.writeFile(markerFile, new Date().toISOString());

    // Create MCP server
    const mcpServerFile = path.join(shepherdDir, 'mcp-server.js');
    await fs.promises.writeFile(mcpServerFile, MCP_SERVER_TEMPLATE);

    // Merge .claude/settings.json
    await mergeClaudeSettings(claudeDir);

    // Create/merge .mcp.json at project root for Claude Code MCP integration
    await mergeClaudeMcp(workspaceRoot);

    // Prompt to add .shepherd/ to .gitignore
    await promptGitignore(workspaceRoot);

    vscode.window.showInformationMessage('Shepherd initialized successfully!');
    return true;
}

async function promptGitignore(workspaceRoot: string): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    const shepherdPattern = '.shepherd/';

    // Check if .gitignore exists and already has the pattern
    try {
        const content = await fs.promises.readFile(gitignorePath, 'utf-8');
        if (content.includes(shepherdPattern) || content.includes('.shepherd')) {
            return; // Already has the pattern
        }
    } catch {
        // File doesn't exist, will prompt to create
    }

    const choice = await vscode.window.showInformationMessage(
        'Should Shepherd files be added to .gitignore?',
        {
            modal: true,
            detail: 'Yes (Recommended): Each developer has their own task queue and database.\n\nNo: Share task state across the team (commits tasks to repo).'
        },
        'Yes (Recommended)',
        'No'
    );

    if (choice === 'Yes (Recommended)') {
        await addToGitignore(gitignorePath, shepherdPattern);
    }
}

async function addToGitignore(gitignorePath: string, pattern: string): Promise<void> {
    try {
        let content = '';
        try {
            content = await fs.promises.readFile(gitignorePath, 'utf-8');
        } catch {
            // File doesn't exist, will create
        }

        // Add pattern with a comment
        const addition = content.length > 0 && !content.endsWith('\n')
            ? `\n\n# Shepherd runtime data\n${pattern}\n`
            : `\n# Shepherd runtime data\n${pattern}\n`;

        await fs.promises.writeFile(gitignorePath, content + addition);
    } catch (err) {
        // Log but don't fail initialization
        console.error('Failed to update .gitignore:', err);
    }
}

async function mergeClaudeSettings(claudeDir: string): Promise<void> {
    const settingsFile = path.join(claudeDir, 'settings.json');
    let settings: Record<string, unknown> = {};

    try {
        const content = await fs.promises.readFile(settingsFile, 'utf-8');
        settings = JSON.parse(content);
    } catch {
        // File doesn't exist
    }

    // Claude Code uses permissions.allow format
    const permissions = (settings.permissions as Record<string, unknown>) || {};
    const allow = (permissions.allow as string[]) || [];
    const mcpPermission = 'mcp__shepherd';

    if (!allow.includes(mcpPermission)) {
        allow.push(mcpPermission);
    }

    permissions.allow = allow;
    settings.permissions = permissions;

    // Auto-enable the shepherd MCP server
    const enabledServers = (settings.enabledMcpjsonServers as string[]) || [];
    if (!enabledServers.includes('shepherd')) {
        enabledServers.push('shepherd');
    }
    settings.enabledMcpjsonServers = enabledServers;

    await fs.promises.writeFile(settingsFile, JSON.stringify(settings, null, 2));
}

async function mergeClaudeMcp(workspaceRoot: string): Promise<void> {
    // Claude Code expects .mcp.json at the project root (not .claude/mcp.json)
    const mcpFile = path.join(workspaceRoot, '.mcp.json');
    let mcp: Record<string, unknown> = {};

    try {
        const content = await fs.promises.readFile(mcpFile, 'utf-8');
        mcp = JSON.parse(content);
    } catch {
        // File doesn't exist
    }

    const mcpServers = (mcp.mcpServers as Record<string, unknown>) || {};

    // Use detected runtime (node preferred, falls back to bun)
    const { command: runtimeCommand } = await findRuntime();
    const expectedConfig = {
        command: runtimeCommand,
        args: ['.shepherd/mcp-server.js']
    };

    // Check if shepherd is already configured correctly
    const existing = mcpServers.shepherd as Record<string, unknown> | undefined;
    if (existing &&
        existing.command === expectedConfig.command &&
        JSON.stringify(existing.args) === JSON.stringify(expectedConfig.args)) {
        // Already configured correctly, no need to update
        return;
    }

    // Add or update shepherd config
    mcpServers.shepherd = expectedConfig;
    mcp.mcpServers = mcpServers;
    await fs.promises.writeFile(mcpFile, JSON.stringify(mcp, null, 2));
}

export function isInitialized(workspaceRoot: string): boolean {
    const shepherdDir = path.join(workspaceRoot, '.shepherd');
    // Check for marker file (new) or database file or legacy tasks.json
    const markerFile = path.join(shepherdDir, '.initialized');
    const dbFile = path.join(shepherdDir, 'data.db');
    const legacyTasksFile = path.join(shepherdDir, 'tasks.json');
    return fs.existsSync(markerFile) || fs.existsSync(dbFile) || fs.existsSync(legacyTasksFile);
}

/**
 * Updates the MCP server file to the latest version and ensures .mcp.json exists.
 * Called on every extension activation for initialized workspaces.
 * Safe to overwrite since the MCP server is stateless.
 */
export async function updateMcpServer(workspaceRoot: string): Promise<void> {
    try {
        // Update MCP server script
        const mcpServerFile = path.join(workspaceRoot, '.shepherd', 'mcp-server.js');
        await fs.promises.writeFile(mcpServerFile, MCP_SERVER_TEMPLATE);

        // Ensure .mcp.json exists at project root
        await mergeClaudeMcp(workspaceRoot);
    } catch (err) {
        // Log but don't fail - workspace might be read-only
        console.error('Failed to update MCP server:', err);
    }
}
