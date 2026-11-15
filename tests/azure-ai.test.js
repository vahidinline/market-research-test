import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../public/_worker.js';

function environment(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        run() { return { meta: { changes: sqlite.prepare(sql).run(...args).changes } }; },
        first() { return sqlite.prepare(sql).get(...args); },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const result = statements.map(statement => statement.run()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { AI_PROVIDER: 'azure', AZURE_OPENAI_API_KEY: 'test-secret', AZURE_OPENAI_DEPLOYMENT: 'deployment-test',
    AZURE_OPENAI_ENDPOINT: 'https://example.services.ai.azure.com/openai/v1/responses', DB: db };
}
const req = (prompt = 'Return JSON') => new Request('https://app.test/api/ai', { method: 'POST', body: JSON.stringify({ prompt, model: 'old-router-model' }) });
const result = () => Response.json({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }], usage: { total_tokens: 100 } });

test('Azure lists the configured deployment without network access and maps Responses API output', async t => {
  const env = environment(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls++;
    assert.equal(url, env.AZURE_OPENAI_ENDPOINT);
    assert.equal(init.headers['api-key'], 'test-secret');
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, 'deployment-test');
    assert.equal(payload.input, 'Return JSON');
    assert.equal(payload.max_output_tokens, 7000);
    assert.equal(payload.store, false);
    assert.equal(payload.messages, undefined);
    return result();
  });
  const models = await worker.fetch(new Request('https://app.test/api/ai?action=models'), env);
  assert.deepEqual((await models.json()).models, [{ id: 'deployment-test' }]);
  assert.equal(calls, 0);
  const response = await worker.fetch(req(), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).choices[0].message.content, '{"ok":true}');
});

test('quota is shared between simultaneous requests and expires after a minute', async t => {
  const env = environment(t);
  let now = 100000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return result(); });
  const responses = await Promise.all([worker.fetch(req(), env), worker.fetch(req(), env)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 429]);
  assert.equal(calls, 1);
  now += 61000;
  assert.equal((await worker.fetch(req(), env)).status, 200);
});

test('token budget rejects before sending even when request quota remains', async t => {
  const env = environment(t);
  let now = 100000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return result(); });
  for (let i = 0; i < 6; i++) {
    assert.equal((await worker.fetch(req('a'.repeat(56000)), env)).status, 200);
    now += 200;
  }
  const limited = await worker.fetch(req('a'.repeat(56000)), env);
  assert.equal(limited.status, 429);
  assert.equal(calls, 6);
});

test('Azure Retry-After creates a shared cooldown and survives transport in the body', async t => {
  const env = environment(t);
  let now = 100000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ error: { message: 'Rate limited' } }, { status: 429, headers: { 'retry-after-ms': '120000' } }); });
  const first = await worker.fetch(req(), env);
  assert.equal((await first.json()).retryAfterSeconds, 120);
  now += 61000;
  assert.equal((await worker.fetch(req(), env)).status, 429);
  assert.equal(calls, 1);
});

test('incomplete Responses output is never accepted as completed analysis', async t => {
  const env = environment(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'incomplete', output_text: '{"ok":true}' }));
  const response = await worker.fetch(req(), env);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).retryable, false);
});

test('missing secret or shared storage fails closed without contacting Azure', async t => {
  const env = environment(t);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not call'); });
  assert.equal((await worker.fetch(req(), { ...env, AZURE_OPENAI_API_KEY: '' })).status, 503);
  assert.equal((await worker.fetch(req(), { ...env, DB: null })).status, 503);
});


test('missing Azure deployment identifies the setting and never retries a configuration error', async t => {
  const env = environment(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code: 'DeploymentNotFound', message: 'Deployment does not exist' } }, { status: 404 }));
  const response = await worker.fetch(req(), env);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.code, 'DeploymentNotFound');
  assert.equal(body.retryable, false);
  assert.match(body.error, /AZURE_OPENAI_DEPLOYMENT/);
  assert.match(body.error, /deployment-test/);
});


test('Azure streaming uses only the terminal response and normalizes its text', async t => {
  const env = environment(t);
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(JSON.parse(init.body).stream, true);
    const events = [
      { type: 'response.output_text.delta', delta: 'partial' },
      { type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] } },
    ];
    return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
  });
  const response = await worker.fetch(req(), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).choices[0].message.content, '{"ok":true}');
});

test('Azure disconnected stream cannot turn partial JSON into a successful analysis', async t => {
  const env = environment(t);
  t.mock.method(globalThis, 'fetch', async () => new Response('data: {"type":"response.output_text.delta","delta":"{}"}\n\n', { headers: { 'content-type': 'text/event-stream' } }));
  const response = await worker.fetch(req(), env);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).retryable, true);
});


for (const event of [
  { type: 'error', code: 'rate_limit_exceeded', message: 'Your requests to the model have exceeded token rate limit.' },
  { type: 'response.failed', response: { status: 'failed', error: { code: '429', message: 'Rate limit exceeded' } } },
]) test(`SSE ${event.type} quota errors become retryable 429 with shared cooldown`, async t => {
  const env = environment(t);
  t.mock.method(globalThis, 'fetch', async () => new Response(`data: ${JSON.stringify(event)}\n\n`, { headers: { 'content-type': 'text/event-stream', 'retry-after': '90' } }));
  const response = await worker.fetch(req(), env);
  const body = await response.json();
  assert.equal(response.status, 429);
  assert.equal(body.upstreamStatus, 429);
  assert.equal(body.retryAfterSeconds, 90);
  assert.equal(body.retryable, true);
  assert.equal((await worker.fetch(req(), env)).status, 429);
});
