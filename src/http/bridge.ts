import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { TaskStore } from '../tasks/TaskStore';
import { TaskStatus } from '../tasks/types';

export class HttpBridge {
    private server: http.Server | undefined;
    private port: number = 0;

    constructor(
        private taskStore: TaskStore,
        private workspaceRoot: string,
        private onInterviewComplete: () => void
    ) {}

    async start(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(async (req, res) => {
                await this.handleRequest(req, res);
            });

            this.server.listen(0, '127.0.0.1', () => {
                const addr = this.server!.address();
                if (typeof addr === 'object' && addr) {
                    this.port = addr.port;
                    this.writePortFile();
                    resolve(this.port);
                } else {
                    reject(new Error('Failed to get server address'));
                }
            });

            this.server.on('error', reject);
        });
    }

    private writePortFile(): void {
        const portFile = path.join(this.workspaceRoot, '.pmcockpit', '.port');
        fs.writeFileSync(portFile, String(this.port));
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
        const pathname = url.pathname;
        const method = req.method || 'GET';

        res.setHeader('Content-Type', 'application/json');

        try {
            const body = await this.readBody(req);
            const result = await this.route(method, pathname, body, url.searchParams);
            res.writeHead(200);
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: (err as Error).message }));
        }
    }

    private async readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
        return new Promise((resolve) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : {});
                } catch {
                    resolve({});
                }
            });
        });
    }

    private async route(method: string, pathname: string, body: Record<string, unknown>, searchParams: URLSearchParams): Promise<unknown> {
        // GET /tasks - list tasks with optional filters
        if (method === 'GET' && pathname === '/tasks') {
            let tasks = this.taskStore.getTasks();

            const status = searchParams.get('status');
            if (status) {
                tasks = tasks.filter(t => t.status === status);
            }

            const limit = searchParams.get('limit');
            if (limit) {
                tasks = tasks.slice(0, parseInt(limit, 10));
            }

            return { tasks };
        }

        // GET /tasks/next
        if (method === 'GET' && pathname === '/tasks/next') {
            return this.taskStore.getNextTodo();
        }

        // GET /tasks/:id
        const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
        if (method === 'GET' && taskMatch) {
            return this.taskStore.getTask(taskMatch[1]);
        }

        // PATCH /tasks/:id/status
        const statusMatch = pathname.match(/^\/tasks\/([^/]+)\/status$/);
        if (method === 'PATCH' && statusMatch) {
            const status = body.status as TaskStatus;
            return this.taskStore.updateTask(statusMatch[1], { status });
        }

        // POST /tasks
        if (method === 'POST' && pathname === '/tasks') {
            const title = body.title as string;
            const description = (body.description as string) || '';
            const requirementPath = body.requirementPath as string | undefined;
            return this.taskStore.addTask(title, description, requirementPath);
        }

        // GET /requirements
        if (method === 'GET' && pathname === '/requirements') {
            return this.listRequirements();
        }

        // GET /requirements/path
        if (method === 'GET' && pathname === '/requirements/path') {
            return { path: path.join(this.workspaceRoot, 'docs', 'requirements') };
        }

        // GET /tasks/:id/requirement
        const reqMatch = pathname.match(/^\/tasks\/([^/]+)\/requirement$/);
        if (method === 'GET' && reqMatch) {
            const task = this.taskStore.getTask(reqMatch[1]);
            return { path: task?.requirementPath || null };
        }

        // POST /requirements
        if (method === 'POST' && pathname === '/requirements') {
            const reqPath = body.path as string;
            const content = body.content as string;
            return this.createRequirement(reqPath, content);
        }

        // POST /interview/complete
        if (method === 'POST' && pathname === '/interview/complete') {
            this.onInterviewComplete();
            return { success: true };
        }

        return { error: 'Not found' };
    }

    private async listRequirements(): Promise<{ files: Array<{ path: string; title: string }> }> {
        const requirementsDir = path.join(this.workspaceRoot, 'docs', 'requirements');
        try {
            const files = await fs.promises.readdir(requirementsDir);
            const mdFiles = files.filter(f => f.endsWith('.md'));
            const result = await Promise.all(mdFiles.map(async (file) => {
                const filePath = path.join(requirementsDir, file);
                const content = await fs.promises.readFile(filePath, 'utf-8');
                const titleMatch = content.match(/^#\s+(.+)$/m);
                return {
                    path: path.join('docs', 'requirements', file),
                    title: titleMatch ? titleMatch[1] : file.replace('.md', '')
                };
            }));
            return { files: result };
        } catch {
            return { files: [] };
        }
    }

    private async createRequirement(reqPath: string, content: string): Promise<{ path: string; title: string }> {
        const fullPath = path.join(this.workspaceRoot, reqPath);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, content);
        const titleMatch = content.match(/^#\s+(.+)$/m);
        return {
            path: reqPath,
            title: titleMatch ? titleMatch[1] : path.basename(reqPath, '.md')
        };
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            const portFile = path.join(this.workspaceRoot, '.pmcockpit', '.port');
            try {
                fs.unlinkSync(portFile);
            } catch {
                // Ignore
            }
        }
    }
}
