import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';
import { readAiTransport } from '../src/utils/aiTransport.js';

test('AI proxy sends immediate acknowledgement while upstream is still pending', async (t) => {
  let resolveUpstream;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  t.mock.method(globalThis, 'fetch', () => new Promise((resolve) => { resolveUpstream = resolve; markStarted(); }));
  const request = new Request('https://example.test/api/ai', { method: 'POST', headers: { accept: 'application/x-ndjson' }, body: JSON.stringify({ model: 'test', prompt: 'Return JSON' }) });
  const tasks = [];
  const response = await worker.fetch(request, { NINE_ROUTER_API_KEY: 'test' }, { waitUntil: (task) => tasks.push(task) });
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.equal(JSON.parse(new TextDecoder().decode(first.value)).event, 'accepted');
  await started;
  resolveUpstream(Response.json({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] }));
  const last = await reader.read();
  const event = JSON.parse(new TextDecoder().decode(last.value));
  assert.equal(event.event, 'result');
  assert.equal(event.status, 200);
  assert.equal((await reader.read()).done, true);
  await Promise.all(tasks);
});

test('stream framing handles UTF-8 fragmentation and preserves final HTTP error', async () => {
  const encoder = new TextEncoder();
  const frames = encoder.encode('{"event":"accepted"}\n{"event":"heartbeat"}\n{"event":"result","status":504,"data":{"error":"مهلت تمام شد"}}\n');
  const response = new Response(new ReadableStream({ start(controller) {
    for (let index = 0; index < frames.length; index += 3) controller.enqueue(frames.slice(index, index + 3));
    controller.close();
  } }), { headers: { 'content-type': 'application/x-ndjson' } });
  const events = [];
  const result = await readAiTransport(response, (event) => events.push(event));
  assert.equal(result.status, 504);
  assert.equal((await result.json()).error, 'مهلت تمام شد');
  assert.deepEqual(events, ['accepted', 'heartbeat']);
});

test('a disconnected stream is retryable and never treated as completed analysis', async () => {
  const response = new Response('{"event":"accepted"}\n', { headers: { 'content-type': 'application/x-ndjson' } });
  await assert.rejects(readAiTransport(response), (error) => error.retryable === true);
});

test('existing JSON deployments remain compatible with the new client', async () => {
  const response = Response.json({ error: 'Unavailable' }, { status: 503 });
  assert.equal(await readAiTransport(response), response);
});
