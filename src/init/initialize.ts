import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
    get_next_task: async () => callBridge('GET', '/tasks/next'),
    get_task: async ({ task_id }) => callBridge('GET', \`/tasks/\${task_id}\`),
    update_task_status: async ({ task_id, status }) => callBridge('PATCH', \`/tasks/\${task_id}/status\`, { status }),
    create_task: async ({ description, requirementPath }) => callBridge('POST', '/tasks', { description, requirementPath }),
    list_requirements: async () => callBridge('GET', '/requirements'),
    get_requirements_path: async () => callBridge('GET', '/requirements/path'),
    get_task_requirement: async ({ task_id }) => callBridge('GET', \`/tasks/\${task_id}/requirement\`),
    create_requirement: async ({ path: reqPath, content }) => callBridge('POST', '/requirements', { path: reqPath, content }),
    complete_interview: async ({ requirement_path, task_ids }) => callBridge('POST', '/interview/complete', { requirement_path, task_ids })
};

const toolDefinitions = [
    { name: 'get_next_task', description: 'Get the highest-priority todo task', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_task', description: 'Get a task by ID', inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
    { name: 'update_task_status', description: 'Update task status', inputSchema: { type: 'object', properties: { task_id: { type: 'string' }, status: { type: 'string', enum: ['todo', 'in-progress', 'ready-for-signoff', 'done', 'rework'] } }, required: ['task_id', 'status'] } },
    { name: 'create_task', description: 'Create a new task', inputSchema: { type: 'object', properties: { description: { type: 'string' }, requirementPath: { type: 'string' } }, required: ['description'] } },
    { name: 'list_requirements', description: 'List all requirement files', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_requirements_path', description: 'Get the requirements folder path', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_task_requirement', description: 'Get the requirement path for a task', inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
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
                response = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'pmcockpit', version: '0.0.1' } } };
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
    const choice = await vscode.window.showInformationMessage(
        'Product Cockpit will create task storage (.pmcockpit/), requirements folder (docs/requirements/), and Claude Code configuration (.claude/). Continue?',
        { modal: true },
        'Initialize'
    );

    if (choice !== 'Initialize') {
        return false;
    }

    const pmcockpitDir = path.join(workspaceRoot, '.pmcockpit');
    const requirementsDir = path.join(workspaceRoot, 'docs', 'requirements');
    const claudeDir = path.join(workspaceRoot, '.claude');

    // Create directories
    await fs.promises.mkdir(pmcockpitDir, { recursive: true });
    await fs.promises.mkdir(requirementsDir, { recursive: true });
    await fs.promises.mkdir(claudeDir, { recursive: true });

    // Create tasks.json
    const tasksFile = path.join(pmcockpitDir, 'tasks.json');
    await fs.promises.writeFile(tasksFile, JSON.stringify({ version: 1, tasks: [] }, null, 2));

    // Create MCP server
    const mcpServerFile = path.join(pmcockpitDir, 'mcp-server.js');
    await fs.promises.writeFile(mcpServerFile, MCP_SERVER_TEMPLATE);

    // Merge .claude/settings.json
    await mergeClaudeSettings(claudeDir);

    // Merge .claude/mcp.json
    await mergeClaudeMcp(claudeDir);

    vscode.window.showInformationMessage('Product Cockpit initialized successfully!');
    return true;
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

    const allowedTools = (settings.allowedTools as string[]) || [];
    const mcpTools = [
        'mcp__pmcockpit__get_next_task',
        'mcp__pmcockpit__get_task',
        'mcp__pmcockpit__update_task_status',
        'mcp__pmcockpit__create_task',
        'mcp__pmcockpit__create_requirement',
        'mcp__pmcockpit__complete_interview',
        'mcp__pmcockpit__list_requirements',
        'mcp__pmcockpit__get_requirements_path',
        'mcp__pmcockpit__get_task_requirement'
    ];

    for (const tool of mcpTools) {
        if (!allowedTools.includes(tool)) {
            allowedTools.push(tool);
        }
    }

    settings.allowedTools = allowedTools;
    await fs.promises.writeFile(settingsFile, JSON.stringify(settings, null, 2));
}

async function mergeClaudeMcp(claudeDir: string): Promise<void> {
    const mcpFile = path.join(claudeDir, 'mcp.json');
    let mcp: Record<string, unknown> = {};

    try {
        const content = await fs.promises.readFile(mcpFile, 'utf-8');
        mcp = JSON.parse(content);
    } catch {
        // File doesn't exist
    }

    const mcpServers = (mcp.mcpServers as Record<string, unknown>) || {};
    mcpServers.pmcockpit = {
        command: 'node',
        args: ['.pmcockpit/mcp-server.js']
    };

    mcp.mcpServers = mcpServers;
    await fs.promises.writeFile(mcpFile, JSON.stringify(mcp, null, 2));
}

export function isInitialized(workspaceRoot: string): boolean {
    const tasksFile = path.join(workspaceRoot, '.pmcockpit', 'tasks.json');
    return fs.existsSync(tasksFile);
}
