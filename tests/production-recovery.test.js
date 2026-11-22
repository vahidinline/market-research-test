import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { saveProject, loadProject, encodeProjectRequest } from '../src/utils/projects.js';
import { listBrowserProjects, saveBrowserProject, deleteBrowserProject } from '../src/utils/projectBrowserStore.js';
import { readProjectBody } from '../functions/lib/project-body.js';
import { createStageRunner, promptBudget, boundedBatches } from '../src/utils/analysisStages.js';
import { generateFactorOverviews, factorOverviewRows } from '../src/utils/factorOverviews.js';
import worker from '../public/_worker.js';

function storage(t) {
  const prior = { indexedDB: globalThis.indexedDB, localStorage: globalThis.localStorage };
  globalThis.indexedDB = new IDBFactory();
  const entries = new Map();
  globalThis.localStorage = { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
  t.after(() => { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
}

test('7 MB draft survives localStorage quota exhaustion, offline server and reload', async t => {
  storage(t);
  t.mock.method(localStorage, 'setItem', () => { throw new DOMException('full', 'QuotaExceededError'); });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const snapshot = { id: 'large', _draft: { stage: 'scoring', content: 'ش'.repeat(3500000) } };
  const saved = await saveProject(snapshot, { name: 'Large draft' });
  assert.equal(saved.persistence, 'local');
  const loaded = await loadProject('large');
  assert.deepEqual(loaded._draft, snapshot._draft);
});

test('legacy archive and IndexedDB merge without losing other drafts; deleted drafts stay deleted', async t => {
  storage(t);
  localStorage.setItem('market_research_projects', JSON.stringify([{ id: 'legacy', snapshot: {} }, { id: 'same', snapshot: { old: true } }]));
  await saveBrowserProject({ id: 'same', snapshot: { current: true }, updated_at: '2026-11-16' });
  const items = await listBrowserProjects();
  assert.equal(items.length, 2);
  assert.equal(items.find(item => item.id === 'same').snapshot.current, true);
  await deleteBrowserProject('same');
  assert.deepEqual((await listBrowserProjects()).map(item => item.id), ['legacy']);
});

test('gzip upload preserves every Persian byte and is accepted by authenticated worker', async () => {
  const item = { id: 'compressed', name: 'گزارش', snapshot: { evidence: 'شاهد فارسی '.repeat(600000) } };
  const encoded = await encodeProjectRequest(item);
  assert.equal(encoded.headers['x-project-encoding'], 'gzip');
  assert.ok(encoded.body.byteLength < new TextEncoder().encode(JSON.stringify(item)).length / 10);
  assert.deepEqual(await readProjectBody(new Request('https://test/api/projects', encoded)), item);
  let stored;
  const DB = { async batch() {}, prepare(sql) { return { bind(...args) { this.args = args; return this; }, async first() { return sql.includes('JOIN users') ? { id: 'root', role: 'root' } : null; }, async run() { if (sql.startsWith('INSERT INTO projects')) stored = JSON.parse(this.args[3]); } }; } };
  const response = await worker.fetch(new Request('https://test/api/projects', { ...encoded, headers: { ...encoded.headers, cookie: 'mr_session=test' } }), { DB });
  assert.equal(response.status, 200);
  assert.deepEqual(stored, item.snapshot);
});

test('corrupt compressed requests fail without database writes', async () => {
  await assert.rejects(readProjectBody(new Request('https://test', { method: 'POST', headers: { 'x-project-encoding': 'gzip' }, body: 'corrupt' })), error => error.status === 400);
});

test('save queue freezes snapshots and prevents out-of-order overwrites', async t => {
  storage(t);
  let release; let firstStarted;
  const started = new Promise(resolve => { firstStarted = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const body = await readProjectBody(new Request('https://test', init));
    writes.push(body.snapshot.step);
    if (writes.length === 1) { firstStarted(); await wait; }
    return Response.json({ id: body.id });
  });
  const snapshot = { id: 'serial', step: 1 };
  const first = saveProject(snapshot, { name: 'Test' });
  snapshot.step = 2;
  const second = saveProject(snapshot, { name: 'Test' });
  await started;
  assert.deepEqual(writes, [1]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(writes, [1, 2]);
});

test('transient server failure retries; HTML success cannot falsely confirm persistence', async t => {
  storage(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? new Response('', { status: 503 }) : Response.json({ id: 'retry' }));
  assert.equal((await saveProject({ id: 'retry' }, { name: 'Test' })).persistence, 'remote');
  assert.equal(calls, 2);
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>unavailable</html>'));
  assert.equal((await saveProject({ id: 'retry' }, { name: 'Test' })).persistence, 'local');
});

test('resuming many cached outputs saves once, while a new output still requires a durable save', async () => {
  let saves = 0;
  const checkpoint = { chunks: {}, save: async () => { saves++; return { persistence: 'remote' }; } };
  let run = createStageRunner({ checkpoint, execute: async id => ({ id }) });
  for (let i = 0; i < 30; i++) await run(String(i), String(i));
  checkpoint.chunks = structuredClone(checkpoint.chunks); // Simulate reopening the saved draft.
  run = createStageRunner({ checkpoint, execute: async () => { throw new Error('cached output rerun'); } });
  const before = saves;
  for (let i = 0; i < 30; i++) await run(String(i), String(i));
  assert.equal(saves - before, 1);
});

test('oversized repair output does not create another prompt budget failure', async () => {
  let calls = 0;
  const run = createStageRunner({ execute: async (_id, prompt) => { promptBudget(prompt); return calls++ ? { valid: true } : { large: 'آ'.repeat(40000) }; } });
  assert.deepEqual(await run('repair', 'Original contract', value => { if (!value.valid) throw new Error('missing valid'); return value; }), { valid: true });
});

test('large Persian CPM overview inputs split without dropping brands or changing scores', async () => {
  const factor = { id: 'social', label: 'اجتماعی', dependentVariables: [{ id: 'd', independentVariables: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, label: `معیار ${i}` })) }] };
  const evaluations = Array.from({ length: 80 }, (_, i) => ({ name: `برند ${i}`, isTarget: i === 0, coverage: .8, factorScores: { social: { score: .75, dependentScores: { d: { independentScores: Object.fromEntries(factor.dependentVariables[0].independentVariables.map(c => [c.id, { rawScore: i === 1 ? null : 1, normalizedScore: i === 1 ? null : .75, evidence: 'شاهد فارسی '.repeat(80) }])) } } } } }));
  const model = { factors: [factor], evidenceRegistry: 'آ'.repeat(100000), factorCandidatePool: 'آ'.repeat(100000) };
  const rows = factorOverviewRows(factor, evaluations);
  assert.equal(rows.length, 480);
  assert.equal(rows.find(row => row.businessIndex === 1).rawScore, null);
  const seen = new Set(); let calls = 0;
  const result = await generateFactorOverviews({ model, evaluations, config: { maxInputBytes: 12000 }, run: async (_id, prompt, validate) => {
    promptBudget(prompt, { maxInputBytes: 12000 });
    assert.ok(!prompt.includes('evidenceRegistry'));
    for (const match of prompt.matchAll(/"businessIndex":(\d+)/g)) seen.add(Number(match[1]));
    calls++;
    const data = JSON.parse(prompt.split('\nData:\n')[1].split('\nOutput:')[0]);
    return validate({ summary: 'برخی امتیازها نامشخص است.', factIds: data.slice(0, 3).map(row => row.factId) });
  } });
  assert.equal(seen.size, 80);
  assert.ok(calls > 1);
  assert.ok(result.factorOverviews.social);
});

test('batch byte limit includes JSON brackets and commas', () => {
  const rows = ['آ', 'آ', 'آ'];
  const groups = boundedBatches(rows, 8, 11);
  assert.deepEqual(groups.flat(), rows);
  assert.ok(groups.every(group => new TextEncoder().encode(JSON.stringify(group)).length <= 11));
});
