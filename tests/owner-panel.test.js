import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';
import { loadOwnerProjectRecord } from '../src/utils/projects.js';

const row = { id: 'project', name: 'Report', snapshot: JSON.stringify({ _project: { ownerAccessToken: 'valid' } }) };
function database() {
  return { prepare(sql) { return { bind() { return this; }, async run() {}, async first() { return sql.includes('FROM projects') ? row : null; } }; }, async batch() {} };
}
for (const [token, status] of [['valid', 200], ['wrong', 403], ['', 400]]) {
  test(`owner link without login: ${status}`, async () => {
    const result = await worker.fetch(new Request(`https://example.com/api/projects?id=project&token=${token}`), { DB: database() });
    assert.equal(result.status, status);
    if (status === 200) {
      assert.equal((await result.json()).id, 'project');
      assert.equal(result.headers.get('cache-control'), 'no-store');
    }
  });
}
test('owner token does not grant write or archive access', async () => {
  for (const request of [new Request('https://example.com/api/projects'), new Request('https://example.com/api/projects?id=project&token=valid', { method: 'DELETE' })]) {
    assert.equal((await worker.fetch(request, { DB: database() })).status, 401);
  }
});
test('owner loader sends token and surfaces server failures without browser fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(new URL(url, 'https://example.com').searchParams.get('token'), 'valid');
    return Response.json({ error: 'server unavailable' }, { status: 503 });
  });
  await assert.rejects(loadOwnerProjectRecord('project', 'valid'), /server unavailable/);
});
