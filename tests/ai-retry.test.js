import test from 'node:test';
import assert from 'node:assert/strict';
import { retryAiRequest } from '../src/utils/aiRetry.js';
const reply = (status, data = {}, headers = {}) => ({ res: new Response('{}', { status, headers }), data });

test('repeated quota responses keep waiting beyond three attempts and eventually succeed', async () => {
  const waits = []; const events = []; let calls = 0; let inFlight = 0;
  const result = await retryAiRequest(async () => {
    assert.equal(inFlight++, 0);
    await Promise.resolve(); inFlight--;
    return ++calls <= 8 ? reply(429, { retryAfterSeconds: 75 }) : reply(200);
  }, { wait: async ms => waits.push(ms), random: () => 0, onWait: event => events.push(event) });
  assert.equal(result.res.status, 200);
  assert.equal(calls, 9);
  assert.deepEqual(waits, Array(8).fill(75000));
  assert.ok(events.every(event => event.reason === 'quota'));
});
test('quota waits do not exhaust the separate transient-error budget', async () => {
  const statuses = [503, 429, 429, 429, 503, 429, 200];
  const waits = [];
  const result = await retryAiRequest(async () => reply(statuses.shift()), { wait: async ms => waits.push(ms), random: () => 0 });
  assert.equal(result.res.status, 200);
  assert.deepEqual(waits, [2000, 60000, 60000, 60000, 5000, 60000]);
});
test('permanent errors return immediately; repeated non-quota failures remain bounded', async () => {
  let waits = 0;
  const options = { wait: async () => waits++, random: () => 0 };
  assert.equal((await retryAiRequest(async () => reply(401), options)).res.status, 401);
  assert.equal(waits, 0);
  assert.equal((await retryAiRequest(async () => reply(503), options)).res.status, 503);
  assert.equal(waits, 2);
});
test('Retry-After date and body survive both JSON and framed transports', async () => {
  let calls = 0; const waits = [];
  await retryAiRequest(async () => ++calls === 1
    ? reply(429, { retryAfterSeconds: 10 }, { 'retry-after': new Date(120000).toUTCString() }) : reply(200),
  { wait: async ms => waits.push(ms), now: () => 0, random: () => 0.5 });
  assert.deepEqual(waits, [120500]);
});
