import assert from 'node:assert/strict';
import test from 'node:test';
import { localIsoToUtc } from '../src/domain/dates.ts';
import { buildActionSchema, buildActionJsonSchema } from '../src/model/actionSchema.ts';
import { buildContext, dateTable } from '../src/model/context.ts';
import { buildPrompt } from '../src/model/prompt.ts';
import { createModelService, SAFE_INTERPRETATION_ERROR } from '../src/model/modelService.ts';

const now = new Date('2026-10-04T12:00:00');
function task(index, title = `Task ${index}`) {
  return { id: `private-uuid-${index}`, title, scheduledAtUtc: new Date(2026, 9, 4, 14, index).toISOString(),
    durationMinutes: null, status: 'todo', isRead: false, reminderAtUtc: null,
    createdAtUtc: now.toISOString(), updatedAtUtc: now.toISOString(), deletedAtUtc: null };
}
function fixture(actions, queryTasks = async () => []) {
  const requests = [];
  const service = createModelService({ client: { async complete(request) {
    requests.push(request);
    const response = actions.shift();
    return typeof response === 'string' ? response : JSON.stringify(response);
  } }, queryTasks });
  return { service, requests };
}

test('valid actions become commands with task ids only after numbered reference validation', async () => {
  const tasks = [task(1), task(2)];
  const cases = [
    [{ action: 'create', title: '  खरीदारी  ', scheduled_at_local: '2026-10-05T09:00:00', duration_minutes: 30 },
      { type: 'create', payload: { title: 'खरीदारी', scheduledAtUtc: localIsoToUtc('2026-10-05T09:00:00'), durationMinutes: 30 } }],
    [{ action: 'update', task_ref: 2, scheduled_at_local: '2026-10-05T10:00:00', duration_minutes: null },
      { type: 'update', taskId: tasks[1].id, payload: { scheduledAtUtc: localIsoToUtc('2026-10-05T10:00:00'), durationMinutes: null } }],
    [{ action: 'delete', task_ref: 1 }, { type: 'delete', taskId: tasks[0].id }],
    [{ action: 'set_status', task_ref: 2, status: 'done' }, { type: 'set_status', taskId: tasks[1].id, status: 'done' }],
    [{ action: 'set_read', task_ref: 1, is_read: true }, { type: 'set_read', taskId: tasks[0].id, isRead: true }],
  ];
  const before = structuredClone(tasks);
  for (const [action, command] of cases) {
    const { service } = fixture([action]);
    const result = await service.interpretUserRequest('Change task', { tasks, now });
    assert.equal(result.kind, 'proposal');
    assert.deepEqual(result.command, command);
    assert.deepEqual(tasks, before);
  }
});

test('image requests remain proposals and invalid image data never reaches the model', async () => {
  const { service, requests } = fixture([{ action: 'create', title: 'Appointment', scheduled_at_local: '2026-10-05T10:00:00' }]);
  const image = 'data:image/png;base64,AQID';
  const result = await service.interpretUserRequest('Create from screenshot', { tasks: [], now, image });
  assert.equal(result.kind, 'proposal');
  assert.equal(requests[0].messages[1].image, image);
  assert.equal((await service.interpretUserRequest('Create', { tasks: [], now, image: 'https://example.com/private.png' })).kind, 'error');
  assert.equal(requests.length, 1);
});

test('query returns exactly repository rows and a validated UTC query, never generated answers', async () => {
  const rows = [task(9, 'Actual database title')];
  let query;
  const { service } = fixture([{ action: 'query', kind: 'range', from_local: '2026-10-04T00:00:00', to_local: '2026-10-05T00:00:00' }],
    async value => { query = value; return rows; });
  const result = await service.interpretUserRequest('Today?', { tasks: [], now });
  assert.deepEqual(result, { kind: 'query', tasks: rows });
  assert.deepEqual(query, { kind: 'range', fromUtc: localIsoToUtc('2026-10-04T00:00:00'),
    toUtc: localIsoToUtc('2026-10-05T00:00:00'), nowUtc: now.toISOString() });
  for (const kind of ['open', 'unread', 'done', 'next']) {
    const { service: another } = fixture([{ action: 'query', kind }], async value => {
      assert.equal(value.kind, kind); return rows;
    });
    assert.deepEqual(await another.interpretUserRequest('Show tasks', { tasks: [], now }), { kind: 'query', tasks: rows });
  }
});

test('invalid references, extra keys, calendar overflow, empty updates and unsafe fields are rejected', () => {
  const schema = buildActionSchema(2);
  for (const action of [
    { action: 'delete', task_ref: 0 }, { action: 'delete', task_ref: 3 },
    { action: 'delete', task_ref: 1, sql: 'DELETE FROM tasks' },
    { action: 'update', task_ref: 1 },
    { action: 'create', title: ' ', scheduled_at_local: '2026-10-05T09:00:00' },
    { action: 'create', title: 'Gym', scheduled_at_local: '2026-02-30T09:00:00' },
    { action: 'create', title: 'Gym', scheduled_at_local: '2026-10-05T09:00:00Z' },
    { action: 'set_status', task_ref: 1, status: 'cancelled' },
    { action: 'set_read', task_ref: 1, is_read: 1 },
    { action: 'query', kind: 'range' },
    { action: 'query', kind: 'range', from_local: '2026-10-05T00:00:00', to_local: '2026-10-04T00:00:00' },
    { action: 'clarify', question: 'Which?', task_refs: [3] },
  ]) assert.equal(schema.safeParse(action).success, false, JSON.stringify(action));
  assert.equal(buildActionSchema(0).safeParse({ action: 'delete', task_ref: 1 }).success, false);
});

test('invalid output retries once with correction and never exposes raw JSON', async () => {
  const { service, requests } = fixture(['not JSON', { action: 'set_status', task_ref: 1, status: 'done' }]);
  const result = await service.interpretUserRequest('Finish task', { tasks: [task(1)], now });
  assert.equal(result.kind, 'proposal');
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages[1].content, /Return a valid action/);
  const failed = fixture([{ action: 'delete', task_ref: 50 }, '{"secret":"raw"}']);
  assert.deepEqual(await failed.service.interpretUserRequest('Delete task', { tasks: [task(1)], now }),
    { kind: 'error', message: SAFE_INTERPRETATION_ERROR });
  assert.equal(failed.requests.length, 2);
});

test('missing create time asks When and clarification references become choices', async () => {
  const tasks = [task(1), task(2)];
  const missing = fixture([{ action: 'create', title: 'Groceries' }]);
  assert.deepEqual(await missing.service.interpretUserRequest('Add groceries', { tasks, now }),
    { kind: 'clarification', question: 'When?', choices: [] });
  const clarified = fixture([{ action: 'clarify', question: 'Which task?', task_refs: [2, 1, 2] }]);
  assert.deepEqual(await clarified.service.interpretUserRequest('Move task', { tasks, now }),
    { kind: 'clarification', question: 'Which task?', choices: [tasks[1], tasks[0]] });
});

test('ambiguous delete/update cannot become proposals until a task is explicitly selected', async () => {
  const tasks = [task(1, 'Gym'), task(2, 'Gym with Sam')];
  for (const action of [{ action: 'delete', task_ref: 1 }, { action: 'update', task_ref: 1, title: 'Exercise' }]) {
    const { service } = fixture([action]);
    assert.deepEqual(await service.interpretUserRequest('Change gym', { tasks, now }),
      { kind: 'clarification', question: 'Which task?', choices: tasks });
  }
  const { service, requests } = fixture([{ action: 'delete', task_ref: 1 }]);
  const selected = await service.interpretUserRequest('Delete gym', { tasks, now, selectedTaskId: tasks[1].id });
  assert.deepEqual(selected.command, { type: 'delete', taskId: tasks[1].id });
  assert.equal(requests[0].messages[0].content.includes('private-uuid'), false);
});

test('request lock prevents concurrent model calls and releases after a failed transport', async () => {
  let resolve;
  let calls = 0;
  const service = createModelService({ client: { complete: () => {
    calls++;
    return new Promise(done => { resolve = done; });
  } }, queryTasks: async () => [] });
  const first = service.interpretUserRequest('Next?', { tasks: [], now });
  assert.equal(service.busy, true);
  const second = await service.interpretUserRequest('Next again?', { tasks: [], now });
  assert.equal(second.kind, 'error');
  assert.equal(calls, 1);
  resolve('{"action":"query","kind":"next"}');
  assert.equal((await first).kind, 'query');
  assert.equal(service.busy, false);
  const failing = createModelService({ client: { complete: async () => { throw new Error('raw private prompt'); } }, queryTasks: async () => [] });
  assert.deepEqual(await failing.interpretUserRequest('Next?', { tasks: [], now }), { kind: 'error', message: SAFE_INTERPRETATION_ERROR });
  assert.equal(failing.busy, false);
});

test('context and prompt limit tasks, hide ids, use real dates and keep current time last', async () => {
  const tasks = Array.from({ length: 30 }, (_, index) => task(index));
  tasks[0].deletedAtUtc = now.toISOString();
  const context = buildContext(tasks, now);
  assert.equal(context.tasks.length, 25);
  assert.equal(context.tasks.some(task => task.deletedAtUtc), false);
  const prompt = buildPrompt(context);
  assert.equal(prompt.includes('private-uuid'), false);
  assert.equal(dateTable(now).split('\n').length, 14);
  assert.match(dateTable(now), /Sunday, October 4, 2026/);
  assert.ok(prompt.indexOf('Examples:') < prompt.indexOf('14-day date table:'));
  assert.ok(prompt.indexOf('14-day date table:') < prompt.indexOf('Task list:'));
  assert.match(prompt.split('\n').at(-1), /^Current local time:/);
  const jsonSchema = buildActionJsonSchema(25);
  assert.ok(Array.isArray(jsonSchema.anyOf) || Array.isArray(jsonSchema.oneOf));
  const { service, requests } = fixture([{ action: 'query', kind: 'open' }]);
  await service.interpretUserRequest('Show open tasks', { tasks, now });
  const request = requests[0];
  assert.equal(request.temperature, 0);
  assert.equal(request.max_tokens, 256);
  assert.deepEqual(request.chat_template_kwargs, { enable_thinking: false });
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.name, 'taskflow_action');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.deepEqual(request.response_format.json_schema.schema, buildActionJsonSchema(25));
  assert.equal('schema' in request.response_format, false);
});

test('long task text reduces context instead of overflowing the prompt budget', async () => {
  const tasks = Array.from({ length: 25 }, (_, index) => task(index, '長い仕事'.repeat(200)));
  const { service, requests } = fixture([{ action: 'query', kind: 'open' }]);
  assert.equal((await service.interpretUserRequest('Show open tasks', { tasks, now })).kind, 'query');
  assert.ok(requests[0].messages.map(message => message.content).join('').length <= 9000);
});
