import type { SqlValue } from 'sql.js';
import { v4 as uuid } from 'uuid';
import { getDatabase, saveDatabase } from '../database';
import { Feature, NewFeature, FeatureStatus } from '../types';

function rowToFeature(row: SqlValue[]): Feature {
    return {
        id: row[0] as string,
        title: row[1] as string,
        description: row[2] as string | null,
        requirement_path: row[3] as string | null,
        status: (row[4] as FeatureStatus) || 'active',
        priority: row[5] as number,
        created_at: row[6] as string,
        updated_at: row[7] as string,
    };
}

// Explicit column order to ensure correct mapping regardless of migration history
const FEATURE_COLUMNS = 'id, title, description, requirement_path, status, priority, created_at, updated_at';

export const FeatureRepo = {
    list(): Feature[] {
        const db = getDatabase();
        const result = db.exec(`SELECT ${FEATURE_COLUMNS} FROM features ORDER BY priority ASC`);
        if (result.length === 0) return [];
        return result[0].values.map(rowToFeature);
    },

    get(id: string): Feature | null {
        const db = getDatabase();
        const stmt = db.prepare(`SELECT ${FEATURE_COLUMNS} FROM features WHERE id = ?`);
        stmt.bind([id]);
        if (stmt.step()) {
            const row = stmt.get();
            stmt.free();
            return rowToFeature(row);
        }
        stmt.free();
        return null;
    },

    create(data: NewFeature): Feature {
        const db = getDatabase();
        const id = uuid();
        const now = new Date().toISOString();

        // Get max priority
        const maxResult = db.exec('SELECT MAX(priority) FROM features');
        const maxPriority = maxResult.length > 0 && maxResult[0].values[0][0] !== null
            ? (maxResult[0].values[0][0] as number) + 1
            : 0;

        db.run(
            `INSERT INTO features (id, title, description, requirement_path, status, priority, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, data.title, data.description || null, data.requirement_path || null, 'active', maxPriority, now, now]
        );
        saveDatabase();

        return this.get(id)!;
    },

    update(id: string, data: Partial<Omit<Feature, 'id' | 'created_at'>>): Feature | null {
        const db = getDatabase();
        const sets: string[] = [];
        const values: SqlValue[] = [];

        if (data.title !== undefined) {
            sets.push('title = ?');
            values.push(data.title);
        }
        if (data.description !== undefined) {
            sets.push('description = ?');
            values.push(data.description);
        }
        if (data.requirement_path !== undefined) {
            sets.push('requirement_path = ?');
            values.push(data.requirement_path);
        }
        if (data.status !== undefined) {
            sets.push('status = ?');
            values.push(data.status);
        }
        if (data.priority !== undefined) {
            sets.push('priority = ?');
            values.push(data.priority);
        }

        if (sets.length === 0) return this.get(id);

        sets.push("updated_at = datetime('now')");
        values.push(id);

        db.run(`UPDATE features SET ${sets.join(', ')} WHERE id = ?`, values);
        saveDatabase();

        return this.get(id);
    },

    delete(id: string): void {
        const db = getDatabase();
        // Tasks with this feature_id will have it set to NULL (ON DELETE SET NULL)
        db.run('DELETE FROM features WHERE id = ?', [id]);
        saveDatabase();
    },

    reorder(ids: string[]): void {
        const db = getDatabase();
        ids.forEach((id, index) => {
            db.run('UPDATE features SET priority = ? WHERE id = ?', [index, id]);
        });
        saveDatabase();
    },

    /**
     * Mark a feature as done and also mark all its tasks as done
     */
    markDone(id: string): Feature | null {
        const db = getDatabase();

        // Mark all tasks in this feature as done
        db.run(
            "UPDATE tasks SET status = 'done', updated_at = datetime('now') WHERE feature_id = ?",
            [id]
        );

        // Mark the feature as done
        db.run(
            "UPDATE features SET status = 'done', updated_at = datetime('now') WHERE id = ?",
            [id]
        );

        saveDatabase();
        return this.get(id);
    },
};
