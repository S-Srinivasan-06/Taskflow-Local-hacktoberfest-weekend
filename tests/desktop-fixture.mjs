// Dev-only browser fixture. No disk writes, localStorage, server, or real model.
// Real SQLite behavior is checked separately in tasks.test.mjs.
import { mockIPC } from '@tauri-apps/api/mocks';
import { toLocalIsoWithoutOffset } from '../src/domain/dates.ts';

if (!import.meta.env.DEV) throw new Error('This fixture runs only in development');
globalThis.isTauri = true;

const databasePath = 'sqlite:taskflow-local.db';
const parameters = new URLSearchParams(location.search);
let failLoad = parameters.has('fail_load');
const now = Date.now();
const browserErrors = [];
window.addEventListener('error', (event) => browserErrors.push(event.message));
window.addEventListener('unhandledrejection', (event) => browserErrors.push(String(event.reason)));
const originalConsoleError = console.error;
console.error = (...args) => {
  browserErrors.push(args.map(String).join(' '));
  originalConsoleError(...args);
};

function seed(title, offsetMinutes, status = 'todo') {
  return {
    id: crypto.randomUUID(), title,
    scheduled_at_utc: new Date(now + offsetMinutes * 60_000).toISOString(),
    duration_minutes: 30, status, is_read: status === 'done' ? 1 : 0,
    reminder_at_utc: null, created_at_utc: new Date(now).toISOString(),
    updated_at_utc: new Date(now).toISOString(), deleted_at_utc: null,
  };
}

const tasks = parameters.has('empty') ? [] : [
  seed('Send the project notes', -90, 'done'),
  seed('Finish the report', -30),
  seed('Already finished tomorrow’s prep', 10, 'done'),
  seed('Gym', 20),
  seed('அம்மாவை அழைக்கவும்', 24 * 60),
];
let modelRunning = false;

const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== 'http://127.0.0.1:39281') return originalFetch(input, init);
  if (url.pathname === '/health') return new Response(JSON.stringify({ status: 'ok' }), { status: modelRunning ? 200 : 503 });
  if (url.pathname === '/v1/chat/completions' && init?.method === 'POST') {
    const request = JSON.parse(init.body);
    if (request.response_format?.type !== 'json_schema' || request.response_format?.json_schema?.strict !== true
      || request.chat_template_kwargs?.enable_thinking !== false) throw new Error('Model request did not enforce the strict fixture contract');
    const scheduled = new Date(Date.now() + 86_400_000);
    scheduled.setHours(9, 0, 0, 0);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'create',
      title: 'Approved browser request', scheduled_at_local: toLocalIsoWithoutOffset(scheduled), duration_minutes: 60 }) } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 404 });
};

mockIPC((command, args) => {
  if (command === 'model_exists') return true;
  if (command === 'model_running') return modelRunning;
  if (command === 'start_local_model') { modelRunning = true; return null; }
  if (command === 'model_set_busy') return null;
  if (command === 'stop_model') { modelRunning = false; return null; }
  if (command === 'open_models_folder') return null;
  if (command === 'plugin:sql|load') {
    if (failLoad) {
      failLoad = false;
      throw new Error('Fixture database open failure');
    }
    if (args.db !== databasePath) throw new Error('Unexpected fixture database');
    return databasePath;
  }
  if (args.db !== databasePath) throw new Error('Unexpected fixture database');
  const values = args.values ?? [];
  if (command === 'plugin:sql|select') {
    const active = tasks.filter((task) => task.deleted_at_utc === null);
    if (args.query.includes('WHERE id = ?')) return active.filter((task) => task.id === values[0]);
    return structuredClone(active.sort((a, b) => a.scheduled_at_utc.localeCompare(b.scheduled_at_utc)));
  }
  if (command !== 'plugin:sql|execute') throw new Error('Unexpected fixture command');
  if (args.query.startsWith('CREATE')) return [0, 0];
  if (args.query.startsWith('INSERT INTO tasks')) {
    const [id, title, scheduled_at_utc, duration_minutes, created_at_utc, updated_at_utc] = values;
    tasks.push({ id, title, scheduled_at_utc, duration_minutes, created_at_utc, updated_at_utc,
      status: 'todo', is_read: 0, reminder_at_utc: null, deleted_at_utc: null });
    return [1, 0];
  }
  if (args.query.startsWith('UPDATE tasks SET ')) {
    const task = tasks.find((row) => row.id === values.at(-1) && row.deleted_at_utc === null);
    if (!task) return [0, 0];
    const columns = args.query.split(' SET ')[1].split('WHERE')[0].trim().split(', ');
    columns.forEach((assignment, index) => { task[assignment.split(' = ')[0]] = values[index]; });
    return [1, 0];
  }
  throw new Error('Unexpected fixture query');
});

await import('../src/main.tsx');

if (parameters.has('smoke')) {
  const { runSmoke } = await import('./browser-smoke.mjs');
  await runSmoke(browserErrors);
}
