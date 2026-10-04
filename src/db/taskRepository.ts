import { getDb } from './database.ts';
import type { Task, TaskStatus } from '../domain/task.ts';

interface TaskRow {
  id: string;
  title: string;
  scheduled_at_utc: string;
  duration_minutes: number | null;
  status: TaskStatus;
  is_read: number;
  reminder_at_utc: string | null;
  created_at_utc: string;
  updated_at_utc: string;
  deleted_at_utc: string | null;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    scheduledAtUtc: row.scheduled_at_utc,
    durationMinutes: row.duration_minutes,
    status: row.status,
    isRead: row.is_read === 1,
    reminderAtUtc: row.reminder_at_utc,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    deletedAtUtc: row.deleted_at_utc,
  };
}

export async function listTimelineTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(`SELECT * FROM tasks
    WHERE deleted_at_utc IS NULL
    ORDER BY scheduled_at_utc ASC, created_at_utc ASC, id ASC`);
  return rows.map(mapTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(`SELECT * FROM tasks
    WHERE id = ? AND deleted_at_utc IS NULL LIMIT 1`, [id]);
  return rows[0] ? mapTask(rows[0]) : null;
}

export interface TaskQuery {
  kind: 'range' | 'open' | 'unread' | 'done' | 'next';
  fromUtc?: string;
  toUtc?: string;
  nowUtc: string;
}

export async function queryTasks(query: TaskQuery): Promise<Task[]> {
  const db = await getDb();
  const conditions = ['deleted_at_utc IS NULL'];
  const values: string[] = [];
  switch (query.kind) {
    case 'range':
      if (!query.fromUtc || !query.toUtc) throw new Error('A time range is required');
      conditions.push('scheduled_at_utc >= ? AND scheduled_at_utc < ?');
      values.push(query.fromUtc, query.toUtc);
      break;
    case 'open': conditions.push("status != 'done'"); break;
    case 'unread': conditions.push('is_read = 0'); break;
    case 'done': conditions.push("status = 'done'"); break;
    case 'next':
      conditions.push("status != 'done' AND scheduled_at_utc >= ?");
      values.push(query.nowUtc);
      break;
    default: throw new Error('Unknown task query');
  }
  const rows = await db.select<TaskRow[]>(`SELECT * FROM tasks
    WHERE ${conditions.join(' AND ')}
    ORDER BY scheduled_at_utc ASC, created_at_utc ASC, id ASC${query.kind === 'next' ? ' LIMIT 1' : ''}`, values);
  return rows.map(mapTask);
}
