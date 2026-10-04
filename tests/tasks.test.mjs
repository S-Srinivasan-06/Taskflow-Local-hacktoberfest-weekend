import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { configureDatabase, getDb } from '../src/db/database.ts';
import { getTaskById, listTimelineTasks, queryTasks } from '../src/db/taskRepository.ts';
import { executeTaskCommand } from '../src/domain/taskService.ts';

function connect(sqlite) {
  return {
    async execute(sql, values = []) {
      const result = sqlite.prepare(sql).run(...values);
      return { rowsAffected: Number(result.changes) };
    },
    async select(sql, values = []) {
      return sqlite.prepare(sql).all(...values);
    },
  };
}

function freshDatabase(t) {
  const sqlite = new DatabaseSync(':memory:');
  configureDatabase(async () => connect(sqlite));
  t.after(() => sqlite.close());
  return sqlite;
}

function create(title = 'Gym', scheduledAtUtc = '2026-10-04T09:00:00Z', durationMinutes) {
  return executeTaskCommand({ type: 'create', payload: { title, scheduledAtUtc, durationMinutes } });
}

test('reminders persist, follow rescheduling, and stale delivery cannot clear a newer reminder', async t => {
  freshDatabase(t);
  const id = await executeTaskCommand({ type: 'create', payload: {
    title: 'Appointment', scheduledAtUtc: '2026-10-05T10:00:00Z', reminderAtUtc: '2026-10-05T09:45:00Z',
  } });
  assert.equal((await getTaskById(id)).reminderAtUtc, '2026-10-05T09:45:00.000Z');
  await executeTaskCommand({ type: 'update', taskId: id, payload: { scheduledAtUtc: '2026-10-05T12:00:00Z' } });
  assert.equal((await getTaskById(id)).reminderAtUtc, '2026-10-05T11:45:00.000Z');
  await executeTaskCommand({ type: 'acknowledge_reminder', taskId: id, reminderAtUtc: '2026-10-05T09:45:00Z' });
  assert.equal((await getTaskById(id)).reminderAtUtc, '2026-10-05T11:45:00.000Z');
  await executeTaskCommand({ type: 'acknowledge_reminder', taskId: id, reminderAtUtc: '2026-10-05T11:45:00Z' });
  assert.equal((await getTaskById(id)).reminderAtUtc, null);
  await executeTaskCommand({ type: 'update', taskId: id, payload: { reminderAtUtc: '2026-10-05T12:00:00Z' } });
  await executeTaskCommand({ type: 'set_status', taskId: id, status: 'done' });
  assert.equal((await getTaskById(id)).reminderAtUtc, null);
});

test('invalid reminders do not create or change task rows', async t => {
  freshDatabase(t);
  await assert.rejects(executeTaskCommand({ type: 'create', payload: {
    title: 'Bad reminder', scheduledAtUtc: '2026-10-05T10:00:00Z', reminderAtUtc: '2026-10-05T11:00:00Z',
  } }), /Reminder/);
  assert.equal((await listTimelineTasks()).length, 0);
  const id = await create();
  await assert.rejects(executeTaskCommand({ type: 'update', taskId: id, payload: { reminderAtUtc: 'invalid' } }));
  assert.equal((await getTaskById(id)).reminderAtUtc, null);
});

test('bootstrap makes only the tasks table and caches the connection', async (t) => {
  const sqlite = freshDatabase(t);
  const [first, second] = await Promise.all([getDb(), getDb()]);
  assert.equal(first, second);
  assert.deepEqual(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name), ['tasks']);
  const columns = sqlite.prepare('PRAGMA table_info(tasks)').all().map(row => row.name);
  assert.deepEqual(columns, ['id', 'title', 'scheduled_at_utc', 'duration_minutes', 'status', 'is_read', 'reminder_at_utc', 'created_at_utc', 'updated_at_utc', 'deleted_at_utc']);
});

test('a failed database open can be retried', async (t) => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  let attempts = 0;
  configureDatabase(async () => {
    if (++attempts === 1) throw new Error('Cannot open database');
    return connect(sqlite);
  });
  await assert.rejects(getDb(), /Cannot open database/);
  await getDb();
  assert.equal(attempts, 2);
});

test('create generates a UUID, trims the title and supplies defaults', async (t) => {
  freshDatabase(t);
  const id = await create('  Gym  ', '2026-10-04T09:00:00Z', 60);
  const task = await getTaskById(id);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(task.title, 'Gym');
  assert.equal(task.scheduledAtUtc, '2026-10-04T09:00:00.000Z');
  assert.equal(task.durationMinutes, 60);
  assert.equal(task.status, 'todo');
  assert.equal(task.isRead, false);
  assert.equal(task.reminderAtUtc, null);
  assert.equal(task.deletedAtUtc, null);
  assert.equal(task.createdAtUtc, task.updatedAtUtc);
});

test('timeline sorts canonical UTC timestamps and keeps done tasks', async (t) => {
  freshDatabase(t);
  const later = await create('Later', '2026-10-05T09:00:00Z');
  const first = await create('First', '2026-10-04T09:00:00Z');
  const middle = await create('Middle', '2026-10-04T09:00:00.001Z');
  await executeTaskCommand({ type: 'set_status', taskId: first, status: 'done' });
  assert.deepEqual((await listTimelineTasks()).map(task => task.id), [first, middle, later]);
});

test('update preserves omitted fields and clears an explicit null duration', async (t) => {
  freshDatabase(t);
  const id = await create('Gym', undefined, 60);
  const before = await getTaskById(id);
  await executeTaskCommand({ type: 'update', taskId: id, payload: { title: '  Walk  ' } });
  let task = await getTaskById(id);
  assert.equal(task.title, 'Walk');
  assert.equal(task.durationMinutes, 60);
  assert.equal(task.createdAtUtc, before.createdAtUtc);
  await executeTaskCommand({ type: 'update', taskId: id, payload: {
    scheduledAtUtc: '2026-10-05T07:00:00Z', durationMinutes: null,
  } });
  task = await getTaskById(id);
  assert.equal(task.scheduledAtUtc, '2026-10-05T07:00:00.000Z');
  assert.equal(task.durationMinutes, null);
});

test('status and read controls work through the same service', async (t) => {
  freshDatabase(t);
  const id = await create();
  for (const status of ['in_progress', 'done', 'todo']) {
    await executeTaskCommand({ type: 'set_status', taskId: id, status });
    assert.equal((await getTaskById(id)).status, status);
  }
  for (const isRead of [true, false]) {
    await executeTaskCommand({ type: 'set_read', taskId: id, isRead });
    assert.equal((await getTaskById(id)).isRead, isRead);
  }
});

test('soft delete hides rows and stale controls cannot change them', async (t) => {
  const sqlite = freshDatabase(t);
  const id = await create();
  await executeTaskCommand({ type: 'delete', taskId: id });
  assert.equal(await getTaskById(id), null);
  assert.deepEqual(await listTimelineTasks(), []);
  const deleted = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  assert.ok(deleted.deleted_at_utc);
  assert.equal(deleted.deleted_at_utc, deleted.updated_at_utc);
  for (const command of [
    { type: 'update', taskId: id, payload: { title: 'Changed' } },
    { type: 'set_status', taskId: id, status: 'done' },
    { type: 'set_read', taskId: id, isRead: true },
    { type: 'delete', taskId: id },
  ]) await assert.rejects(executeTaskCommand(command), /Task not found/);
  assert.deepEqual(sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(id), deleted);
});

test('invalid changes do not write any task fields', async (t) => {
  freshDatabase(t);
  const id = await create();
  const before = await getTaskById(id);
  const commands = [
    { type: 'update', taskId: id, payload: { title: ' ' } },
    { type: 'update', taskId: id, payload: { title: 'Valid', scheduledAtUtc: '2026-02-30T09:00:00Z' } },
    { type: 'update', taskId: id, payload: {} },
    { type: 'set_status', taskId: id, status: 'cancelled' },
    { type: 'set_read', taskId: id, isRead: 1 },
    { type: 'arbitrary_sql', taskId: id },
  ];
  for (const durationMinutes of [0, -1, 0.5, NaN, Infinity, '60']) {
    commands.push({ type: 'update', taskId: id, payload: { durationMinutes } });
  }
  for (const command of commands) {
    await assert.rejects(executeTaskCommand(command));
    assert.deepEqual(await getTaskById(id), before);
  }
  await assert.rejects(create(' '));
  await assert.rejects(create('Invalid date', '2026-02-30T09:00:00Z'));
  await assert.rejects(create('Invalid duration', undefined, -1));
  assert.equal((await listTimelineTasks()).length, 1);
});

test('missing references fail without changing other tasks', async (t) => {
  freshDatabase(t);
  const id = await create();
  const before = await getTaskById(id);
  for (const command of [
    { type: 'update', taskId: 'missing', payload: { title: 'No' } },
    { type: 'set_status', taskId: 'missing', status: 'done' },
    { type: 'set_read', taskId: 'missing', isRead: true },
    { type: 'delete', taskId: 'missing' },
  ]) await assert.rejects(executeTaskCommand(command), /Task not found/);
  assert.deepEqual(await getTaskById(id), before);
});

test('task text and references are bound values, never SQL', async (t) => {
  freshDatabase(t);
  const title = "Gym'); DROP TABLE tasks; --";
  const id = await create(title);
  assert.equal((await getTaskById(id)).title, title);
  const maliciousId = "' OR 1=1 --";
  assert.equal(await getTaskById(maliciousId), null);
  await assert.rejects(executeTaskCommand({ type: 'delete', taskId: maliciousId }), /Task not found/);
  assert.equal((await listTimelineTasks()).length, 1);
});

test('task data survives closing and reopening a real SQLite file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'taskflow-test-'));
  const path = join(directory, 'tasks.db');
  let sqlite = new DatabaseSync(path);
  try {
    configureDatabase(async () => connect(sqlite));
    const id = await create('Persistent task', undefined, 30);
    await executeTaskCommand({ type: 'set_status', taskId: id, status: 'done' });
    await executeTaskCommand({ type: 'set_read', taskId: id, isRead: true });
    const deleted = await create('Deleted task');
    await executeTaskCommand({ type: 'delete', taskId: deleted });
    const before = await listTimelineTasks();
    sqlite.close();
    sqlite = new DatabaseSync(path);
    configureDatabase(async () => connect(sqlite));
    assert.deepEqual(await listTimelineTasks(), before);
    assert.equal(await getTaskById(deleted), null);
  } finally {
    sqlite.close();
    rmSync(path, { force: true });
    rmdirSync(directory);
  }
});

test('queries return real rows, exclude deleted tasks and use an exclusive range end', async (t) => {
  freshDatabase(t);
  const past = await create('Past', '2026-10-03T09:00:00Z');
  const done = await create('Done', '2026-10-04T10:00:00Z');
  const next = await create('Next', '2026-10-04T11:00:00Z');
  const end = await create('End boundary', '2026-10-04T12:00:00Z');
  const deleted = await create('Deleted', '2026-10-04T10:30:00Z');
  await executeTaskCommand({ type: 'set_status', taskId: done, status: 'done' });
  await executeTaskCommand({ type: 'set_read', taskId: next, isRead: true });
  await executeTaskCommand({ type: 'delete', taskId: deleted });
  const query = async (kind, extra = {}) => (await queryTasks({ kind, nowUtc: '2026-10-04T09:00:00.000Z', ...extra })).map(task => task.id);
  assert.deepEqual(await query('next'), [next]);
  assert.deepEqual(await query('open'), [past, next, end]);
  assert.deepEqual(await query('done'), [done]);
  assert.deepEqual(await query('unread'), [past, done, end]);
  assert.deepEqual(await query('range', { fromUtc: '2026-10-04T10:00:00.000Z', toUtc: '2026-10-04T12:00:00.000Z' }), [done, next]);
});
