import type { SqlValue } from 'sql.js';
import { getDatabase, saveDatabase } from '../database';
import { Project } from '../types';

function rowToProject(row: SqlValue[]): Project {
    return {
        id: row[0] as string,
        title: row[1] as string | null,
        description: row[2] as string | null,
        requirement_path: row[3] as string | null,
        created_at: row[4] as string,
        updated_at: row[5] as string,
    };
}

export const ProjectRepo = {
    get(): Project | null {
        const db = getDatabase();
        const result = db.exec("SELECT * FROM project WHERE id = 'main'");
        if (result.length === 0 || result[0].values.length === 0) {
            return null;
        }
        return rowToProject(result[0].values[0]);
    },

    update(data: Partial<Omit<Project, 'id' | 'created_at'>>): Project {
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

        sets.push("updated_at = datetime('now')");

        db.run(`UPDATE project SET ${sets.join(', ')} WHERE id = 'main'`, values);
        saveDatabase();

        return this.get()!;
    },
};
