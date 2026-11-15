import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';
import { compactEvidence, compactInstagram } from '../src/utils/aiEvidence.js';

const env = { NINE_ROUTER_API_KEY: 'test-only' };
const request = (extra = {}) => new Request('https://example.test/api/ai', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'primary', prompt: 'Return JSON', ...extra }),
});

test('large scraper media is excluded while factual profile metrics survive', () => {
  const profile = { username: 'brand', followersCount: 1200, biography: 'Observed services', latestPosts: Array.from({ length: 200 }, () => ({ displayUrl: 'x'.repeat(5000) })) };
  const compact = compactInstagram(profile);
  assert.equal(compact.followersCount, 1200);
  assert.equal(compact.biography, 'Observed services');
  assert.equal(compact.latestPosts, undefined);
  const platform = compactEvidence({ status: 'collected', items: Array.from({ length: 200 }, (_, i) => ({ title: `Evidence ${i}`, text: 'a'.repeat(5000), thumbnailUrl: 'x'.repeat(50000), likes: 10 })) });
  assert.equal(platform.status, 'collected');
  assert.ok(platform.items.length <= 12);
  assert.ok(JSON.stringify(platform).length < 18000);
  assert.equal(platform.items[0].likes, 10);
  assert.equal(platform.items[0].thumbnailUrl, undefined);
});

test('HTML 502 fails over to another model and streamed JSON is assembled', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    calls.push(JSON.parse(init.body));
    if (calls.length === 1) return new Response('<html>Bad gateway</html>', { status: 502 });
    return new Response('data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}\n\ndata: {"choices":[{"delta":{"content":"true}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n', { headers: { 'content-type': 'text/event-stream' } });
  });
  const response = await worker.fetch(request({ fallbackModels: ['backup'] }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.choices[0].message.content, '{"ok":true}');
  assert.equal(body._routerDiagnostic.selectedModel, 'backup');
  assert.equal(body._routerDiagnostic.attempts[0].status, 502);
  assert.ok(calls.every((call) => call.stream === true));
});

test('deadline remains active after headers arrive and stops a stalled body', async (t) => {
  const originalTimer = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback) => originalTimer(callback, 5));
  t.mock.method(globalThis, 'fetch', async (_url, init) => new Response(new ReadableStream({
    start(controller) {
      init.signal.addEventListener('abort', () => controller.error(new Error('body deadline exceeded')), { once: true });
    },
  })));
  const response = await worker.fetch(request(), env);
  const body = await response.json();
  assert.equal(response.status, 504);
  assert.equal(body.attempts[0].reason, 'body deadline exceeded');
});

test('oversized prompts are rejected before contacting the provider', async (t) => {
  let called = false;
  t.mock.method(globalThis, 'fetch', async () => { called = true; throw new Error('Unexpected call'); });
  const response = await worker.fetch(request({ prompt: 'a'.repeat(490403) }), env);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).stage, 'prompt_budget');
  assert.equal(called, false);
});

test('fallback models share the request deadline instead of multiplying it', async (t) => {
  let now = 0;
  let calls = 0;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    now = 76000;
    throw new Error('upstream timeout');
  });
  const response = await worker.fetch(request({ fallbackModels: ['backup', 'third'] }), env);
  assert.equal(response.status, 504);
  assert.equal(calls, 1);
});

test('a provider error inside a successful SSE response is not reported as success', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('data: {"error":{"message":"provider unavailable"}}\n\ndata: [DONE]\n', { headers: { 'content-type': 'text/event-stream' } }));
  const response = await worker.fetch(request(), env);
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.attempts[0].reason, 'provider unavailable');
});
