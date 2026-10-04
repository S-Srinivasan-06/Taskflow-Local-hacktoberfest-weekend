import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderQueue } from '../src/domain/reminders.ts';
import { filterTasks } from '../src/domain/taskFilters.ts';
import { buildActionJsonSchema } from '../src/model/actionSchema.ts';
import { llamaPayload, ollamaPayload } from '../src/model/requestPayload.ts';

const now = new Date('2026-10-04T12:00:00Z');
const task = (id, overrides = {}) => ({ id, title: id, scheduledAtUtc: '2026-10-04T13:00:00Z',
  reminderAtUtc: '2026-10-04T12:00:00Z', status: 'todo', deletedAtUtc: null, isRead: false, ...overrides });

test('reminder queue excludes completed, deleted, and old missed reminders but catches up recent ones', () => {
  const tasks = [task('Due'), task('Soon', { reminderAtUtc: '2026-10-04T14:00:00Z' }),
    task('Recent', { reminderAtUtc: '2026-10-04T11:58:00Z' }), task('Old', { reminderAtUtc: '2026-10-04T10:00:00Z' }),
    task('Done', { status: 'done' }), task('Deleted', { deletedAtUtc: now.toISOString() }), task('None', { reminderAtUtc: null })];
  assert.deepEqual(reminderQueue(tasks, now.getTime()).map(item => item[0]), ['Due', 'Soon', 'Recent']);
});

test('search and filters use real task fields and a local calendar date', () => {
  const tasks = [task('Gym'), task('Read report', { status: 'done', isRead: true }),
    task('Overdue', { scheduledAtUtc: '2026-10-04T10:00:00Z' }), task('Working', { status: 'in_progress' })];
  assert.deepEqual(filterTasks(tasks, ' gym ', 'all', '', now).map(row => row.id), ['Gym']);
  assert.deepEqual(filterTasks(tasks, '', 'overdue', '', now).map(row => row.id), ['Overdue']);
  assert.equal(filterTasks(tasks, '', 'unread', '', now).length, 3);
  assert.equal(filterTasks(tasks, '', 'done', '', now).length, 1);
  assert.equal(filterTasks(tasks, '', 'in_progress', '', now).length, 1);
  assert.equal(filterTasks(tasks, '', 'all', '2026-10-05', now).length, 0);
});

test('both transports preserve schema enforcement and encode images in the provider format', () => {
  const request = { messages: [{ role: 'system', content: 'Rules' }, { role: 'user', content: 'Create task', image: 'data:image/png;base64,AQID' }],
    response_format: { type: 'json_schema', json_schema: { name: 'taskflow_action', strict: true, schema: buildActionJsonSchema(2) } },
    chat_template_kwargs: { enable_thinking: false }, temperature: 0, max_tokens: 256 };
  const llama = llamaPayload(request);
  assert.equal(llama.messages[1].content[1].image_url.url, request.messages[1].image);
  assert.equal(llama.response_format, request.response_format);
  const ollama = ollamaPayload(request, 'local-model:latest');
  assert.equal(ollama.model, 'local-model:latest');
  assert.equal(ollama.format, request.response_format.json_schema.schema);
  assert.deepEqual(ollama.messages[1].images, ['AQID']);
  assert.equal(ollama.think, false);
  assert.equal(ollama.stream, false);
});
