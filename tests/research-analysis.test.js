import test from 'node:test';
import assert from 'node:assert/strict';
import { createStageRunner, boundedBatches, promptBudget } from '../src/utils/analysisStages.js';
import { businessEvidence, sanitizeProfileAnalysis, validateIndicatorEvidence, preserveIndicatorIds } from '../src/utils/researchEvidence.js';
import { researchScope } from '../src/utils/researchPolicy.js';
import { calculateCpmRow, cpmSensitivity } from '../src/utils/cpm.js';
import { validateStructure, mergeStructures } from '../src/utils/industryAnalysis.js';
import { writeRawSnapshot, readRawSnapshot } from '../functions/lib/apify-store.js';

test('default channels are web and Instagram; optional channels require selection', () => {
  assert.deepEqual(researchScope({ youtube: 'https://youtube.com/brand' }), ['website', 'instagram']);
  assert.deepEqual(researchScope({ optionalChannels: ['youtube', 'unknown'] }), ['website', 'instagram', 'youtube']);
});
test('a failed downstream unit preserves completed outputs; input changes invalidate only affected units', async () => {
  const checkpoint = { chunks: {}, save: async () => ({ persistence: 'remote' }) };
  let calls = 0; let failing = true;
  const run = createStageRunner({ checkpoint, model: 'model', execute: async id => { calls++; if (id === 'next' && failing) throw new Error('offline'); return { indicators: ['price'] }; } });
  assert.deepEqual(await run('indicators', 'raw:v1'), { indicators: ['price'] });
  await assert.rejects(run('next', 'raw:v1'), /offline/);
  assert.deepEqual(await run('indicators', 'raw:v1'), { indicators: ['price'] });
  assert.equal(calls, 2);
  failing = false;
  await run('next', 'raw:v1');
  await run('indicators', 'raw:v2');
  assert.equal(calls, 4);
});
test('invalid structured output is repaired using original output and evidence', async () => {
  let calls = 0;
  const run = createStageRunner({ execute: async (_id, prompt) => { if (!calls++) return { indicators: ['price'], missing: true }; assert.match(prompt, /"indicators":\["price"\]/); assert.match(prompt, /raw-evidence/); return { indicators: ['price'], valid: true }; } });
  const result = await run('indicators', 'raw-evidence', value => { if (!value.valid) throw new Error('invalid weights'); return value; });
  assert.deepEqual(result.indicators, ['price']); assert.equal(calls, 2);
});
test('database failure preserves the paid model output and blocks downstream progress', async () => {
  let calls = 0;
  const checkpoint = { chunks: {}, save: async () => ({ persistence: 'local' }) };
  const run = createStageRunner({ checkpoint, execute: async () => { calls++; return { ok: true }; } });
  await assert.rejects(run('stage', 'input'), /ذخیره/);
  checkpoint.save = async () => ({ persistence: 'remote' });
  assert.deepEqual(await run('stage', 'input'), { ok: true }); assert.equal(calls, 1);
});
test('UTF-8 budget accounts for Persian bytes and batches do not drop rows', () => {
  assert.throws(() => promptBudget('آ'.repeat(30000)), /حجم/);
  const rows = Array.from({ length: 37 }, (_, id) => ({ id, evidence: 'آ'.repeat(120) }));
  const batches = boundedBatches(rows, 6, 1500);
  assert.deepEqual(batches.flat(), rows);
  assert.ok(batches.every(batch => batch.length <= 6 && new TextEncoder().encode(JSON.stringify(batch)).length <= 1500));
});
test('text evidence cannot establish visual quality or a generated overall score', () => {
  const business = { instagramHandle: 'brand', instagramData: { followersCount: 100, biography: 'bio' }, instagramPosts: [{ caption: 'offer', url: 'https://instagram.com/p/one' }], website: 'https://brand.test', websiteData: { pages: [{ url: 'https://brand.test', text: 'published price' }] } };
  const registry = businessEvidence(business);
  assert.ok(registry.every(item => item.id && item.url));
  const result = sanitizeProfileAnalysis({ overallScore: 99, instagramAnalytics: { contentAnalysis: { visualQuality: 'excellent' } }, websiteAnalytics: { uxScore: 98 } }, business);
  assert.equal(result.overallScore, null); assert.equal(result.websiteAnalytics.uxScore, null); assert.match(result.instagramAnalytics.contentAnalysis.visualQuality, /ارزیابی نشده/);
});
const model = { factors: [{ id: 'website', label: 'وب‌سایت', weight: 1, dependentVariables: [{ id: 'offer', label: 'offer', weight: 1, independentVariables: [{ id: 'price', label: 'price', definition: 'published price', reason: 'comparison', evidenceIds: ['e1'], weight: 1, scoring: { type: 'binary', min: 0, max: 1, rubricLevels: [{ score: 0, description: 'not shown' }, { score: 1, description: 'shown' }] } }] }] }] };
const evaluation = score => ({ factorScores: { website: { dependentScores: { offer: { independentScores: { price: { rawScore: score, evidence: 'published price', evidenceIds: ['e1'] } } } } } } });
test('scoring rejects invented evidence and does not turn an unknown website into zero', () => {
  const identity = { name: 'brand', strictEvidence: true, evidenceIds: ['e2'], hasWebsite: true, hasWebsiteEvidence: true };
  assert.throws(() => calculateCpmRow(model, evaluation(1), identity), /شاهد/);
  const row = calculateCpmRow(model, evaluation(1), { ...identity, evidenceIds: ['e1'], hasWebsite: false, hasWebsiteEvidence: false });
  assert.equal(row.total, null); assert.equal(row.coverage, 0); assert.equal(row.comparable, false);
  validateIndicatorEvidence(model, [{ id: 'e1' }]);
  assert.throws(() => validateIndicatorEvidence(model, [{ id: 'invented' }]), /شاهد/);
});
test('sensitivity excludes brands whose evidence coverage is insufficient', () => {
  const rows = [{ name: 'a', comparable: true, factorScores: { website: { score: 0.9 } } }, { name: 'b', comparable: false, factorScores: { website: { score: 1 } } }];
  assert.deepEqual(cpmSensitivity(model, rows).baseline.map(row => row.name), ['a']);
});
test('market batches require all IDs and merge without losing classifications', () => {
  const structure = id => ({ industryOverview: 'scope', industryDefinition: 'industry', businessModels: [{ name: 'retail', businessIds: [id] }], subindustries: [{ name: 'food', businessIds: [id] }], classifications: [{ businessId: id, relevant: true, businessModel: 'retail', subindustry: 'food' }] });
  assert.throws(() => validateStructure(structure('1'), [{ id: '1' }, { id: '2' }]), /جا افتاده/);
  const merged = mergeStructures([structure('1'), structure('2')]);
  assert.deepEqual(merged.businessModels[0].businessIds, ['1', '2']); assert.equal(merged.classifications.length, 2);
});
test('large raw snapshots use object storage and preserve exact paid data', async () => {
  const objects = new Map();
  const env = { RAW_DATA: { put: async (key, value) => objects.set(key, value), get: async key => objects.has(key) ? { json: async () => JSON.parse(objects.get(key)) } : null } };
  const items = [{ caption: 'آ'.repeat(300000) }];
  const manifest = await writeRawSnapshot(env, 'collection', items);
  assert.equal(JSON.parse(manifest).storage, 'r2');
  assert.deepEqual(await readRawSnapshot(env, manifest), items);
});

test('repair cannot silently remove a previously generated indicator', () => {
  assert.equal(preserveIndicatorIds(model, structuredClone(model)).factors.length, 1);
  assert.throws(() => preserveIndicatorIds(model, { factors: [] }), /شاخص/);
});
test('large snapshots fall back to D1 parts and missing parts block reuse', async () => {
  const parts = new Map();
  const env = { DB: { prepare: sql => ({ bind(...args) { this.args = args; return this; }, async run() { if (sql.startsWith('INSERT')) parts.set(`${this.args[0]}:${this.args[1]}`, this.args[2]); }, async first() { const payload = parts.get(`${this.args[0]}:${this.args[1]}`); return payload == null ? null : { payload }; } }) } };
  const items = [{ caption: 'آ😀'.repeat(150000) }];
  const manifest = await writeRawSnapshot(env, 'large', items);
  assert.equal(JSON.parse(manifest).storage, 'd1-parts');
  assert.deepEqual(await readRawSnapshot(env, manifest), items);
  parts.delete('large:1');
  await assert.rejects(readRawSnapshot(env, manifest), /بخشی/);
});


test('missing social evidence reports the affected criterion and required source', () => {
  const unavailableSocial = { factors: [{ id: 'social', dependentVariables: [{ independentVariables: [{ id: 'social_metric', label: 'Social presence', evidenceIds: [] }] }] }] };
  assert.throws(() => validateIndicatorEvidence(unavailableSocial, [{ id: 'b1:e1', channel: 'website' }]), /social_metric.*Instagram/);
});
