import type { SqlValue } from 'sql.js';
import { v4 as uuid } from 'uuid';
import { getDatabase, saveDatabase } from '../database';
import { RequirementSession, SessionStatus } from '../types';

function rowToSession(row: SqlValue[]): RequirementSession {
    return {
        id: row[0] as string,
        scope: row[1] as string,
        raw_input: row[2] as string | null,
        status: row[3] as SessionStatus,
        conversation: row[4] as string | null,
        proposed_output: row[5] as string | null,
        created_at: row[6] as string,
        updated_at: row[7] as string,
    };
}

export const SessionRepo = {
    get(id: string): RequirementSession | null {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM requirement_sessions WHERE id = ?');
        stmt.bind([id]);
        if (stmt.step()) {
            const row = stmt.get();
            stmt.free();
            return rowToSession(row);
        }
        stmt.free();
        return null;
    },

    getActive(): RequirementSession[] {
        const db = getDatabase();
        const result = db.exec("SELECT * FROM requirement_sessions WHERE status != 'complete' ORDER BY updated_at DESC");
        if (result.length === 0) return [];
        return result[0].values.map(rowToSession);
    },

    create(scope: string, rawInput: string): RequirementSession {
        const db = getDatabase();
        const id = uuid();
        const now = new Date().toISOString();

        db.run(
            `INSERT INTO requirement_sessions (id, scope, raw_input, status, conversation, proposed_output, created_at, updated_at)
             VALUES (?, ?, ?, 'drafting', NULL, NULL, ?, ?)`,
            [id, scope, rawInput, now, now]
        );
        saveDatabase();

        return this.get(id)!;
    },

    update(id: string, data: Partial<Omit<RequirementSession, 'id' | 'created_at'>>): RequirementSession | null {
        const db = getDatabase();
        const sets: string[] = [];
        const values: SqlValue[] = [];

        if (data.status !== undefined) {
            sets.push('status = ?');
            values.push(data.status);
        }
        if (data.conversation !== undefined) {
            sets.push('conversation = ?');
            values.push(data.conversation);
        }
        if (data.proposed_output !== undefined) {
            sets.push('proposed_output = ?');
            values.push(data.proposed_output);
        }

        if (sets.length === 0) return this.get(id);

        sets.push("updated_at = datetime('now')");
        values.push(id);

        db.run(`UPDATE requirement_sessions SET ${sets.join(', ')} WHERE id = ?`, values);
        saveDatabase();

        return this.get(id);
    },

    delete(id: string): void {
        const db = getDatabase();
        db.run('DELETE FROM requirement_sessions WHERE id = ?', [id]);
        saveDatabase();
    },
};
