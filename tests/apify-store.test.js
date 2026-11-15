import test from 'node:test';
import assert from 'node:assert/strict';
import { durableApify, collectionKey } from '../functions/lib/apify-store.js';
function database() {
  const rows = new Map();
  return { rows, prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return rows.get(args[0]) || null; }, async run() {
    if (sql.startsWith('INSERT')) { if (rows.has(args[0])) return { meta: { changes: 0 } }; rows.set(args[0], { actor: args[1], input: args[2], state: args.length === 4 ? 'SUCCEEDED' : 'starting', payload: args[3] }); return { meta: { changes: 1 } }; }
    if (sql.includes('SET run_id')) Object.assign(rows.get(args[2]), { run_id: args[0], state: args[1] });
    if (sql.includes('SET payload')) Object.assign(rows.get(args[1]), { payload: args[0], state: 'SUCCEEDED' });
    return { meta: { changes: 1 } };
  } }; } };
}
const start = () => new Request('https://app/api/apify', { method: 'POST', body: JSON.stringify({ actorId: 'apify~instagram-profile-scraper', input: { usernames: ['brand'] } }) });
test('canonical input keys are insensitive to object property order', async () => {
  assert.equal(await collectionKey('actor', { a: 1, b: 2 }), await collectionKey('actor', { b: 2, a: 1 }));
});
test('resume and duplicate submissions start only one run; all dataset pages persist', async () => {
  const original = globalThis.fetch; const DB = database(); let starts = 0; let pages = 0;
  globalThis.fetch = async (url, init) => {
    if (init?.method === 'POST') { starts++; return Response.json({ data: { id: 'run', status: 'RUNNING' } }); }
    pages++; return Response.json(pages === 1 ? Array.from({ length: 500 }, (_, id) => ({ id })) : [{ id: 500 }]);
  };
  try {
    const env = { DB, APIFY_API_KEY: 'test' };
    const first = await (await durableApify(start(), env)).json();
    const resumed = await (await durableApify(start(), env)).json();
    assert.equal(resumed.runId, first.runId); assert.equal(starts, 1);
    const result = await (await durableApify(new Request(`https://app/api/apify?action=results&collectionKey=${first.collectionKey}`), env)).json();
    assert.equal(result.items.length, 501);
    const cached = await (await durableApify(start(), env)).json();
    assert.equal(cached.cached, true); assert.equal(cached.items.length, 501); assert.equal(starts, 1); assert.equal(pages, 2);
  } finally { globalThis.fetch = original; }
});
test('ambiguous start never retries the paid request, including concurrent submissions', async () => {
  const original = globalThis.fetch; let starts = 0;
  globalThis.fetch = async () => { starts++; throw new Error('connection lost after acceptance'); };
  try {
    const env = { DB: database(), APIFY_API_KEY: 'test' };
    await assert.rejects(durableApify(start(), env));
    assert.equal((await durableApify(start(), env)).status, 409);
    assert.equal(starts, 1);
  } finally { globalThis.fetch = original; }
});
test('missing database blocks collection before any paid call', async () => {
  assert.equal((await durableApify(start(), { APIFY_API_KEY: 'test' })).status, 503);
});

test('concurrent starts share a unique database claim', async () => {
  const original = globalThis.fetch; let starts = 0;
  globalThis.fetch = async () => { starts++; return Response.json({ data: { id: 'shared', status: 'RUNNING' } }); };
  try {
    const env = { DB: database(), APIFY_API_KEY: 'test' };
    const responses = await Promise.all([durableApify(start(), env), durableApify(start(), env)]);
    assert.equal(starts, 1);
    assert.ok(responses.every(response => [200, 202, 409].includes(response.status)));
  } finally { globalThis.fetch = original; }
});
test('legacy data imports without a paid call and is reused on later collection', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('must not start an Actor'); };
  try {
    const env = { DB: database(), APIFY_API_KEY: 'test' };
    const body = { actorId: 'apify~instagram-profile-scraper', input: { usernames: ['BRAND'] }, legacyItems: [{ username: 'brand' }] };
    await durableApify(new Request('https://app/api/apify', { method: 'POST', body: JSON.stringify(body) }), env);
    const result = await (await durableApify(start(), env)).json();
    assert.equal(result.cached, true); assert.equal(result.items[0].username, 'brand');
  } finally { globalThis.fetch = original; }
});
