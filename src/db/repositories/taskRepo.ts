import type { SqlValue } from 'sql.js';
import { v4 as uuid } from 'uuid';
import { getDatabase, saveDatabase } from '../database';
import { Task, TaskWithFeature, NewTask, TaskStatus, TaskType } from '../types';

function rowToTask(row: SqlValue[]): Task {
    return {
        id: row[0] as string,
        feature_id: row[1] as string | null,
        type: row[2] as TaskType,
        title: row[3] as string,
        description: row[4] as string | null,
        status: row[5] as TaskStatus,
        priority: row[6] as number,
        created_at: row[7] as string,
        updated_at: row[8] as string,
    };
}

export const TaskRepo = {
    list(options?: { feature_id?: string | null; status?: TaskStatus; limit?: number }): Task[] {
        const db = getDatabase();
        let sql = 'SELECT * FROM tasks';
        const conditions: string[] = [];
        const values: SqlValue[] = [];

        if (options?.feature_id !== undefined) {
            if (options.feature_id === null) {
                conditions.push('feature_id IS NULL');
            } else {
                conditions.push('feature_id = ?');
                values.push(options.feature_id);
            }
        }
        if (options?.status) {
            conditions.push('status = ?');
            values.push(options.status);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY priority ASC';

        if (options?.limit) {
            sql += ' LIMIT ?';
            values.push(options.limit);
        }

        const result = db.exec(sql, values);
        if (result.length === 0) return [];
        return result[0].values.map(rowToTask);
    },

    listWithFeatures(options?: { status?: TaskStatus; limit?: number }): TaskWithFeature[] {
        const db = getDatabase();
        let sql = `
            SELECT t.*, f.id as f_id, f.title as f_title
            FROM tasks t
            LEFT JOIN features f ON t.feature_id = f.id
        `;
        const values: SqlValue[] = [];

        if (options?.status) {
            sql += ' WHERE t.status = ?';
            values.push(options.status);
        }
        sql += ' ORDER BY t.priority ASC';

        if (options?.limit) {
            sql += ' LIMIT ?';
            values.push(options.limit);
        }

        const result = db.exec(sql, values);
        if (result.length === 0) return [];

        return result[0].values.map((row: SqlValue[]) => ({
            ...rowToTask(row.slice(0, 9)),
            feature: row[9] ? { id: row[9] as string, title: row[10] as string } : null,
        }));
    },

    get(id: string): Task | null {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
        stmt.bind([id]);
        if (stmt.step()) {
            const row = stmt.get();
            stmt.free();
            return rowToTask(row);
        }
        stmt.free();
        return null;
    },

    getWithFeature(id: string): TaskWithFeature | null {
        const db = getDatabase();
        const result = db.exec(`
            SELECT t.*, f.id as f_id, f.title as f_title
            FROM tasks t
            LEFT JOIN features f ON t.feature_id = f.id
            WHERE t.id = ?
        `, [id]);

        if (result.length === 0 || result[0].values.length === 0) return null;

        const row = result[0].values[0];
        return {
            ...rowToTask(row.slice(0, 9)),
            feature: row[9] ? { id: row[9] as string, title: row[10] as string } : null,
        };
    },

    create(data: NewTask): Task {
        const db = getDatabase();
        const id = uuid();
        const now = new Date().toISOString();

        // Get max priority within feature (or globally for ungrouped)
        let maxResult;
        if (data.feature_id) {
            maxResult = db.exec('SELECT MAX(priority) FROM tasks WHERE feature_id = ?', [data.feature_id]);
        } else {
            maxResult = db.exec('SELECT MAX(priority) FROM tasks WHERE feature_id IS NULL');
        }
        const maxPriority = maxResult.length > 0 && maxResult[0].values[0][0] !== null
            ? (maxResult[0].values[0][0] as number) + 1
            : 0;

        db.run(
            `INSERT INTO tasks (id, feature_id, type, title, description, status, priority, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?)`,
            [id, data.feature_id || null, data.type || 'task', data.title, data.description || null, maxPriority, now, now]
        );
        saveDatabase();

        return this.get(id)!;
    },

    update(id: string, data: Partial<Omit<Task, 'id' | 'created_at'>>): Task | null {
        const db = getDatabase();
        const sets: string[] = [];
        const values: SqlValue[] = [];

        if (data.feature_id !== undefined) {
            sets.push('feature_id = ?');
            values.push(data.feature_id);
        }
        if (data.type !== undefined) {
            sets.push('type = ?');
            values.push(data.type);
        }
        if (data.title !== undefined) {
            sets.push('title = ?');
            values.push(data.title);
        }
        if (data.description !== undefined) {
            sets.push('description = ?');
            values.push(data.description);
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

        db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, values);
        saveDatabase();

        return this.get(id);
    },

    updateStatus(id: string, status: TaskStatus): Task | null {
        return this.update(id, { status });
    },

    delete(id: string): void {
        const db = getDatabase();
        db.run('DELETE FROM tasks WHERE id = ?', [id]);
        saveDatabase();
    },

    moveToFeature(taskId: string, featureId: string | null): Task | null {
        const db = getDatabase();

        // Get max priority in target
        let maxResult;
        if (featureId) {
            maxResult = db.exec('SELECT MAX(priority) FROM tasks WHERE feature_id = ?', [featureId]);
        } else {
            maxResult = db.exec('SELECT MAX(priority) FROM tasks WHERE feature_id IS NULL');
        }
        const maxPriority = maxResult.length > 0 && maxResult[0].values[0][0] !== null
            ? (maxResult[0].values[0][0] as number) + 1
            : 0;

        db.run(
            "UPDATE tasks SET feature_id = ?, priority = ?, updated_at = datetime('now') WHERE id = ?",
            [featureId, maxPriority, taskId]
        );
        saveDatabase();

        return this.get(taskId);
    },

    reorder(ids: string[]): void {
        const db = getDatabase();
        ids.forEach((id, index) => {
            db.run('UPDATE tasks SET priority = ? WHERE id = ?', [index, id]);
        });
        saveDatabase();
    },

    countByStatus(): Record<TaskStatus, number> {
        const db = getDatabase();
        const result = db.exec('SELECT status, COUNT(*) FROM tasks GROUP BY status');
        const counts: Record<TaskStatus, number> = {
            'todo': 0,
            'in-progress': 0,
            'ready-for-signoff': 0,
            'done': 0,
            'rework': 0,
        };
        if (result.length > 0) {
            result[0].values.forEach((row: SqlValue[]) => {
                counts[row[0] as TaskStatus] = row[1] as number;
            });
        }
        return counts;
    },
};
