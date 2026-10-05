import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createModelService } from '../src/model/modelService.ts';
import { llamaPayload } from '../src/model/requestPayload.ts';

const image = `data:image/png;base64,${(await readFile('docs/screenshots/vision-input.png')).toString('base64')}`;
const service = createModelService({ client: { async complete(request) {
  const response = await fetch('http://127.0.0.1:39281/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(llamaPayload(request)),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return (await response.json()).choices[0].message.content;
} }, queryTasks: async () => [] });
const result = await service.interpretUserRequest('Create one new task using the appointment title, exact date, time and duration shown in this screenshot.', {
  tasks: [], image, now: new Date('2026-10-04T17:00:00'),
});
assert.equal(result.kind, 'proposal');
assert.equal(result.command.type, 'create');
assert.match(result.command.payload.title.toLowerCase(), /dentist/);
assert.equal(new Date(result.command.payload.scheduledAtUtc).getDate(), 5);
assert.equal(new Date(result.command.payload.scheduledAtUtc).getHours(), 10);
assert.equal(result.command.payload.durationMinutes, 45);
await writeFile('tests/artifacts/vision-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), passed: true, syntheticImage: true, result }, null, 2));
console.log('PASS real Gemma screenshot: dentist, October 5 at 10 AM, 45 minutes; proposal only, no write.');
