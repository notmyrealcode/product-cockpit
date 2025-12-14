import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { SCHEMA } from './schema';

let db: Database | null = null;
let dbPath: string | null = null;

export async function initDatabase(workspaceRoot: string): Promise<Database> {
    const SQL = await initSqlJs();

    const pmcockpitDir = path.join(workspaceRoot, '.pmcockpit');
    if (!fs.existsSync(pmcockpitDir)) {
        fs.mkdirSync(pmcockpitDir, { recursive: true });
    }

    dbPath = path.join(pmcockpitDir, 'cockpit.db');

    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
        db.run(SCHEMA);
        saveDatabase();
    }

    return db;
}

export function getDatabase(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase first.');
    }
    return db;
}

export function saveDatabase(): void {
    if (!db || !dbPath) {
        throw new Error('Database not initialized');
    }
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
}

export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        dbPath = null;
    }
}
