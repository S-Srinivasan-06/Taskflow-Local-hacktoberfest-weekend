import { getDb } from '../db/database.ts';
import type { SqlValue } from '../db/database.ts';
import { normalizeUtcDateTime } from './dates.ts';
import { TASK_STATUSES } from './task.ts';
import type { TaskCommand } from './actions.ts';

function validateTitle(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a task title');
  return value.trim();
}

function validateDuration(value: number | null): number | null {
  if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('Duration must be a positive whole number of minutes');
  }
  return value;
}

export async function executeTaskCommand(command: TaskCommand): Promise<string> {
  const now = new Date().toISOString();
  if (command.type === 'create') {
    const title = validateTitle(command.payload.title);
    const scheduledAt = normalizeUtcDateTime(command.payload.scheduledAtUtc);
    const duration = validateDuration(command.payload.durationMinutes ?? null);
    const id = crypto.randomUUID();
    const db = await getDb();
    await db.execute(`INSERT INTO tasks (
      id, title, scheduled_at_utc, duration_minutes, status, is_read,
      reminder_at_utc, created_at_utc, updated_at_utc, deleted_at_utc
    ) VALUES (?, ?, ?, ?, 'todo', 0, NULL, ?, ?, NULL)`,
    [id, title, scheduledAt, duration, now, now]);
    return id;
  }

  if (!('taskId' in command) || typeof command.taskId !== 'string' || !command.taskId) {
    throw new Error('Task not found');
  }
  const values: SqlValue[] = [];
  const assignments: string[] = [];

  switch (command.type) {
    case 'update': {
      const patch = command.payload;
      // Static column names only; user input is always bound as a value.
      if (patch.title !== undefined) {
        assignments.push('title = ?');
        values.push(validateTitle(patch.title));
      }
      if (patch.scheduledAtUtc !== undefined) {
        assignments.push('scheduled_at_utc = ?');
        values.push(normalizeUtcDateTime(patch.scheduledAtUtc));
      }
      if (patch.durationMinutes !== undefined) {
        assignments.push('duration_minutes = ?');
        values.push(validateDuration(patch.durationMinutes));
      }
      if (!assignments.length) throw new Error('No task changes provided');
      break;
    }
    case 'set_status':
      if (!TASK_STATUSES.includes(command.status)) throw new Error('Invalid task status');
      assignments.push('status = ?');
      values.push(command.status);
      break;
    case 'set_read':
      if (typeof command.isRead !== 'boolean') throw new Error('Invalid read state');
      assignments.push('is_read = ?');
      values.push(command.isRead ? 1 : 0);
      break;
    case 'delete':
      assignments.push('deleted_at_utc = ?');
      values.push(now);
      break;
    default:
      throw new Error('Unknown task command');
  }

  assignments.push('updated_at_utc = ?');
  values.push(now, command.taskId);
  const db = await getDb();
  // The active-row condition is atomic: stale controls cannot alter a deleted task.
  const result = await db.execute(`UPDATE tasks SET ${assignments.join(', ')}
    WHERE id = ? AND deleted_at_utc IS NULL`, values);
  if (result.rowsAffected !== 1) throw new Error('Task not found');
  return command.taskId;
}
