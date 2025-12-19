import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { SCHEMA } from './schema';
import { runMigrations } from './migrations';

let db: Database | null = null;
let dbPath: string | null = null;

export async function initDatabase(workspaceRoot: string): Promise<Database> {
    // Locate WASM file - when bundled it's in the same directory as the extension
    const wasmPath = path.join(__dirname, 'sql-wasm.wasm');
    const SQL = await initSqlJs({
        locateFile: (file: string) => {
            if (file === 'sql-wasm.wasm' && fs.existsSync(wasmPath)) {
                return wasmPath;
            }
            return file;
        }
    });

    const shepherdDir = path.join(workspaceRoot, '.shepherd');
    if (!fs.existsSync(shepherdDir)) {
        fs.mkdirSync(shepherdDir, { recursive: true });
    }

    dbPath = path.join(shepherdDir, 'cockpit.db');

    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
        db.run(SCHEMA);
    }

    // Run any pending migrations (works for both new and existing databases)
    const applied = runMigrations(db);
    if (applied.length > 0 || !fs.existsSync(dbPath)) {
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
