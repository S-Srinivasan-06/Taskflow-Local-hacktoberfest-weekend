import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildActionJsonSchema, buildActionSchema } from '../src/model/actionSchema.ts';
import { buildContext } from '../src/model/context.ts';
import { buildPrompt } from '../src/model/prompt.ts';

const serverUrl = new URL(process.env.TASKFLOW_LLAMASERVER_URL ?? 'http://127.0.0.1:39281');
if (!['127.0.0.1', 'localhost', '::1'].includes(serverUrl.hostname)) {
  throw new Error('Phase 0 smoke tests may only send synthetic prompts to a loopback llama-server.');
}
const baseUrl = serverUrl.origin;
const modelName = process.env.TASKFLOW_LLAMASERVER_MODEL ?? 'taskflow-local';
const reportPath = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/artifacts/phase0-results.json');

function fail(condition, message) {
  if (!condition) throw new Error(message);
}

function localDateTime(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function atLocalTime(date, hours, minutes = 0, seconds = 0) {
  const value = new Date(date);
  value.setHours(hours, minutes, seconds, 0);
  return localDateTime(value);
}

function buildSyntheticTasks(now) {
  const titles = [
    'Gym', 'Send the files to the team', 'Read the report', 'Pick up groceries', 'Call the dentist',
    'Review the project notes', 'Water the plants', 'Pay the electricity bill', 'Book a haircut',
    'Reply to the landlord', 'Prepare lunch', 'Clean the desk', 'Check the train times',
    'Return the library book', 'Update the budget', 'Email the photos', 'Walk in the park',
    'Collect the parcel', 'Charge the headphones', 'Plan the weekend', 'Print the forms',
    'Buy coffee', 'Sort the receipts', 'Read a chapter', 'Take out recycling',
  ];

  return titles.map((title, index) => {
    const scheduled = new Date(now);
    scheduled.setDate(scheduled.getDate() + ((index % 7) - 3));
    scheduled.setHours(8 + ((index * 3) % 12), (index * 17) % 60, 0, 0);
    const scheduledAtUtc = scheduled.toISOString();
    const createdAtUtc = new Date(now.getTime() - 86_400_000).toISOString();
    return {
      id: `synthetic-task-${String(index + 1).padStart(2, '0')}`,
      title,
      scheduledAtUtc,
      durationMinutes: null,
      status: 'todo',
      isRead: title !== 'Read the report',
      reminderAtUtc: null,
      createdAtUtc,
      updatedAtUtc: createdAtUtc,
      deletedAtUtc: null,
    };
  });
}

function noThinking(message, content) {
  const candidates = [message.reasoning_content, message.thinking, message.reasoning];
  fail(!candidates.some(value => typeof value === 'string' ? value.trim() : value != null),
    'llama-server returned a separate thinking/reasoning field');
  fail(!/<\s*think\b|<\s*analysis\b/i.test(content), 'Response content includes a thinking/analysis block');
}

async function getCompletionMessage(messages, response_format) {
  const response = await fetch(new URL('/v1/chat/completions', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0,
      max_tokens: 256,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
      response_format,
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(`llama-server returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  const message = body?.choices?.[0]?.message;
  fail(message && typeof message.content === 'string', 'Completion did not contain a text message');
  noThinking(message, message.content);
  return message;
}

function parseJson(content, onGenerated) {
  let json;
  try {
    json = JSON.parse(content);
  } catch {
    onGenerated({ raw_content: content });
    throw new Error(`Completion was not valid JSON: ${content}`);
  }
  onGenerated(json);
  return json;
}

async function callModel({ messages, taskCount, onGenerated }) {
  const message = await getCompletionMessage(messages, {
    type: 'json_schema',
    json_schema: { name: 'taskflow_action', strict: true, schema: buildActionJsonSchema(taskCount) },
  });

  const json = parseJson(message.content, onGenerated);
  return buildActionSchema(taskCount).parse(json);
}

async function runSchemaCanary() {
  const expected = { proof: 'required' };
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: { proof: { type: 'string', const: expected.proof } },
    required: ['proof'],
  };
  let actual = null;
  const start = performance.now();
  const message = await getCompletionMessage(
    [
      { role: 'system', content: 'Return exactly this JSON object: {"proof":"different"}.' },
      { role: 'user', content: 'Return the JSON now.' },
    ],
    { type: 'json_schema', json_schema: { name: 'phase0_schema_canary', strict: true, schema } },
  );
  actual = parseJson(message.content, value => { actual = value; });
  try {
    assert.deepEqual(actual, expected, 'The server did not enforce the strict response schema canary');
  } catch (error) {
    if (error && typeof error === 'object') error.actual = actual;
    throw error;
  }
  const elapsedMs = Math.round(performance.now() - start);
  console.log(`PASS schema-canary (${elapsedMs} ms): ${JSON.stringify(actual)}`);
  return { passed: true, elapsedMs, expected, actual };
}

function targetRef(context, title) {
  const index = context.tasks.findIndex(task => task.title === title);
  fail(index >= 0, `Synthetic task was not included in model context: ${title}`);
  return index + 1;
}

function expectedResult(test, context) {
  const tomorrow = new Date(context.now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  switch (test.id) {
    case 'create-gym':
      return { action: 'create', title: 'gym', scheduled_at_local: atLocalTime(tomorrow, 7), duration_minutes: 60 };
    case 'files-done':
      return { action: 'set_status', task_ref: targetRef(context, 'Send the files to the team'), status: 'done' };
    case 'move-gym':
      return { action: 'update', task_ref: targetRef(context, 'Gym'), scheduled_at_local: atLocalTime(tomorrow, 9) };
    case 'report-unread':
      return { action: 'set_read', task_ref: targetRef(context, 'Read the report'), is_read: false };
    case 'tonight-query': {
      const midnight = new Date(tomorrow);
      midnight.setHours(0, 0, 0, 0);
      return { action: 'query', kind: 'range', from_local: atLocalTime(context.now, 18), to_local: localDateTime(midnight) };
    }
    default:
      throw new Error(`Unknown smoke test: ${test.id}`);
  }
}

function assertPromptResult(test, action, context) {
  switch (test.id) {
    case 'create-gym': {
      const tomorrow = new Date(context.now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expected = atLocalTime(tomorrow, 7);
      assert.equal(action.action, 'create');
      assert.match(action.title, /gym/i);
      assert.equal(action.scheduled_at_local, expected);
      assert.equal(action.duration_minutes, 60);
      break;
    }
    case 'files-done':
      assert.equal(action.action, 'set_status');
      assert.equal(action.task_ref, targetRef(context, 'Send the files to the team'));
      assert.equal(action.status, 'done');
      break;
    case 'move-gym': {
      const tomorrow = new Date(context.now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      assert.equal(action.action, 'update');
      assert.equal(action.task_ref, targetRef(context, 'Gym'));
      assert.equal(action.scheduled_at_local, atLocalTime(tomorrow, 9));
      assert.equal(action.duration_minutes, undefined, 'Changing time alone must preserve the existing duration');
      break;
    }
    case 'report-unread':
      assert.equal(action.action, 'set_read');
      assert.equal(action.task_ref, targetRef(context, 'Read the report'));
      assert.equal(action.is_read, false);
      break;
    case 'tonight-query':
      assert.equal(action.action, 'query');
      assert.equal(action.kind, 'range');
      assert.equal(action.from_local, atLocalTime(context.now, 18));
      const tomorrow = new Date(context.now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      assert.equal(action.to_local, atLocalTime(tomorrow, 0));
      break;
    default:
      throw new Error(`Unknown smoke test: ${test.id}`);
  }
}

const now = new Date();
now.setHours(12, 0, 0, 0);
const allTasks = buildSyntheticTasks(now);
const tests = [
  { id: 'create-gym', text: 'Add gym tomorrow at 7 for one hour', withTasks: false },
  { id: 'files-done', text: 'I already sent the files', withTasks: true },
  { id: 'move-gym', text: 'Move gym to 9 tomorrow', withTasks: true },
  { id: 'report-unread', text: 'Mark the report unread', withTasks: true },
  { id: 'tonight-query', text: 'What do I have tonight?', withTasks: true },
];

const health = await fetch(new URL('/health', baseUrl), { signal: AbortSignal.timeout(5_000) });
if (!health.ok) throw new Error(`llama-server health check failed: HTTP ${health.status}`);

let schemaCanary;
try {
  schemaCanary = await runSchemaCanary();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  schemaCanary = {
    passed: false,
    expected: { proof: 'required' },
    actual: error?.actual ?? null,
    error: message,
  };
  console.error(`FAIL schema-canary: ${message}`);
}

const results = [];
for (const test of schemaCanary.passed ? tests : []) {
  const context = buildContext(test.withTasks ? allTasks : [], now);
  if (test.withTasks) assert.equal(context.tasks.length, 25, 'Expected a full synthetic 25-task context');
  const systemPrompt = buildPrompt(context);
  fail(!allTasks.some(task => systemPrompt.includes(task.id)), 'A synthetic UUID leaked into the model prompt');

  const start = performance.now();
  let action;
  let actualAction = null;
  const expected = expectedResult(test, context);
  try {
    action = await callModel({
      taskCount: context.tasks.length,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: test.text }],
      onGenerated: generated => { actualAction = generated; },
    });
    assertPromptResult(test, action, context);
    const elapsedMs = Math.round(performance.now() - start);
    results.push({ id: test.id, passed: true, elapsedMs, action });
    console.log(`PASS ${test.id} (${elapsedMs} ms): ${JSON.stringify(action)}`);
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - start);
    const message = error instanceof Error ? error.message : String(error);
    results.push({ id: test.id, passed: false, elapsedMs, expected, actual: actualAction, error: message });
    console.error(`FAIL ${test.id} (${elapsedMs} ms): ${message}; expected=${JSON.stringify(expected)} actual=${JSON.stringify(actualAction)}`);
  }
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify({
  checkedAt: new Date().toISOString(),
  server: baseUrl,
  model: modelName,
  schemaCanary,
  syntheticTasks: allTasks.length,
  results,
}, null, 2)}\n`, 'utf8');

const failures = results.filter(result => !result.passed);
console.log(`Results saved to ${reportPath}`);
if (!schemaCanary.passed || failures.length) process.exitCode = 1;
