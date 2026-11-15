import test from 'node:test';
import assert from 'node:assert/strict';
import { withDeadline } from '../src/utils/deadline.js';
import { readAiTransport } from '../src/utils/aiTransport.js';

test('a pending operation that ignores AbortSignal still stops waiting', async () => {
  let signal;
  await assert.rejects(withDeadline((value) => { signal = value; return new Promise(() => {}); }, 10, 'deadline'), (error) => error.code === 'DEADLINE_EXCEEDED');
  assert.equal(signal.aborted, true);
});

test('reading a stalled AI stream has a hard deadline even if cancellation is ignored', async () => {
  const response = new Response(new ReadableStream({ start() {}, cancel() { return new Promise(() => {}); } }), { headers: { 'content-type': 'application/x-ndjson' } });
  await assert.rejects(withDeadline(() => readAiTransport(response), 10, 'deadline'), /deadline/);
});

test('receiving the final result does not await indefinitely stuck stream cleanup', async () => {
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('{"event":"result","status":200,"data":{"ok":true}}\n'));
  }, cancel() { return new Promise(() => {}); } }), { headers: { 'content-type': 'application/x-ndjson' } });
  const result = await withDeadline(() => readAiTransport(response), 100, 'deadline');
  assert.equal((await result.json()).ok, true);
});
