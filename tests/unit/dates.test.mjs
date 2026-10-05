import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { localIsoToUtc, normalizeUtcDateTime, toLocalIsoWithoutOffset } from '../../src/domain/dates.ts';

test('UTC dates are stored in one sortable format', () => {
  assert.equal(normalizeUtcDateTime('2026-10-04T12:00:00Z'), '2026-10-04T12:00:00.000Z');
  assert.equal(normalizeUtcDateTime('2024-02-29T12:00:00.123Z'), '2024-02-29T12:00:00.123Z');
});

test('rejects UTC calendar overflow, invalid times and offsets', () => {
  for (const value of [
    '2026-02-29T12:00:00Z', '2026-04-31T12:00:00Z',
    '2026-10-04T24:00:00Z', '2026-10-04T12:60:00Z',
    '2026-10-04T12:00:60Z', '2026-10-04T12:00:00+05:30',
    '2026-10-04', '2026-10-04T12:00:00', '', null,
  ]) assert.throws(() => normalizeUtcDateTime(value));
});

test('local date conversion preserves real wall-clock values', () => {
  const value = '2024-02-29T09:30:00';
  assert.equal(toLocalIsoWithoutOffset(new Date(localIsoToUtc(value))), value);
});

test('rejects local calendar overflow and non-local date formats', () => {
  for (const value of [
    '2026-02-29T09:00:00', '2026-04-31T09:00:00',
    '2026-10-04T24:00:00', '2026-10-04T12:60:00',
    '2026-10-04T09:00:00Z', '2026-10-04T09:00:00+05:30',
    '2026-10-04T09:00', '', null,
  ]) assert.throws(() => localIsoToUtc(value));
  assert.throws(() => toLocalIsoWithoutOffset(new Date('invalid')));
});

test('conversion uses local timezone and rejects a daylight-saving gap', () => {
  const moduleUrl = new URL('../../src/domain/dates.ts', import.meta.url).href;
  const cases = [
    ['Asia/Kolkata', `assert.equal(localIsoToUtc('2026-10-04T09:00:00'), '2026-10-04T03:30:00.000Z');`],
    ['America/New_York', `
      assert.equal(localIsoToUtc('2026-03-08T01:30:00'), '2026-03-08T06:30:00.000Z');
      assert.throws(() => localIsoToUtc('2026-03-08T02:30:00'));
      assert.equal(localIsoToUtc('2026-03-08T03:30:00'), '2026-03-08T07:30:00.000Z');
    `],
  ];
  for (const [timezone, assertions] of cases) {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      import assert from 'node:assert/strict';
      import { localIsoToUtc } from ${JSON.stringify(moduleUrl)};
      ${assertions}
    `], { env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || String(result.error));
  }
});
