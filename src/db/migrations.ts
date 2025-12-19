import type { Database } from 'sql.js';

/**
 * Migration definition
 */
interface Migration {
    version: number;
    name: string;
    up: (db: Database) => void;
}

/**
 * All migrations in order. Each migration should be idempotent where possible.
 * Version numbers must be sequential and never reused.
 */
export const MIGRATIONS: Migration[] = [
    {
        version: 1,
        name: 'add_feature_status',
        up: (db: Database) => {
            // Add status column to features table
            const result = db.exec("PRAGMA table_info(features)");
            if (result.length > 0) {
                const columns = result[0].values.map(row => row[1] as string);
                if (!columns.includes('status')) {
                    db.run("ALTER TABLE features ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
                }
            }
        }
    }
];

/**
 * Create the schema_migrations table if it doesn't exist
 */
function ensureMigrationsTable(db: Database): void {
    db.run(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )
    `);
}

/**
 * Get list of already applied migration versions
 */
function getAppliedVersions(db: Database): Set<number> {
    const result = db.exec('SELECT version FROM schema_migrations');
    if (result.length === 0) return new Set();
    return new Set(result[0].values.map(row => row[0] as number));
}

/**
 * Record that a migration has been applied
 */
function recordMigration(db: Database, migration: Migration): void {
    db.run(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, new Date().toISOString()]
    );
}

/**
 * Run all pending migrations in order
 * @returns Array of migration names that were applied
 */
export function runMigrations(db: Database): string[] {
    ensureMigrationsTable(db);

    const applied = getAppliedVersions(db);
    const pending = MIGRATIONS.filter(m => !applied.has(m.version));
    const appliedNames: string[] = [];

    // Sort by version to ensure order
    pending.sort((a, b) => a.version - b.version);

    for (const migration of pending) {
        console.log(`[Database] Running migration ${migration.version}: ${migration.name}`);
        try {
            migration.up(db);
            recordMigration(db, migration);
            appliedNames.push(migration.name);
            console.log(`[Database] Migration ${migration.version} complete`);
        } catch (error) {
            console.error(`[Database] Migration ${migration.version} failed:`, error);
            throw error;
        }
    }

    if (appliedNames.length > 0) {
        console.log(`[Database] Applied ${appliedNames.length} migration(s)`);
    }

    return appliedNames;
}

/**
 * Get current schema version (highest applied migration)
 */
export function getSchemaVersion(db: Database): number {
    ensureMigrationsTable(db);
    const result = db.exec('SELECT MAX(version) FROM schema_migrations');
    if (result.length === 0 || result[0].values[0][0] === null) return 0;
    return result[0].values[0][0] as number;
}
