import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareResearchMethodology, completeResearchWithApprovedCpm } from '../src/utils/ai.js';
import { approveCpmModel } from '../src/utils/cpm.js';
import { enforceReportIntegrity } from '../src/utils/reportIntegrity.js';
const factors = [['social', 'سوشال'], ['website', 'وب‌سایت'], ['product_service', 'محصول/خدمت'], ['industry_specific', 'عوامل اثرگذار ویژه صنعت']];
const criterion = (id, evidenceId) => ({ id, label: id, definition: 'Published evidence', reason: 'Customer comparison', weight: 1, evidenceIds: [evidenceId], scoring: { type: 'binary', min: 0, max: 1, normalization: 'min-max', rubricLevels: [{ score: 0, description: 'Absent' }, { score: 1, description: 'Observed' }] } });
const model = () => ({ framework: 'four_factor_v1', factors: factors.map(([id, label]) => ({ id, label, weight: 0.25, industryFactorCase: id === 'industry_specific' ? { customerDecisionRole: 'Published differentiation', industrySignals: [{ observation: 'offer', source: 'b1:e2' }] } : undefined, dependentVariables: [{ id: `${id}_dependent`, label: id, weight: 1, independentVariables: [criterion(`${id}_criterion`, id === 'social' ? 'b1:e1' : 'b1:e2')] }] })) });
const rawBusiness = name => ({ name, website: `https://${name}.test`, instagramHandle: name, instagramData: { username: name, biography: 'Published offer', followersCount: 100 }, instagramPosts: [], websiteData: { text: 'Published product and price', pages: [{ url: `https://${name}.test`, text: 'Published product and price' }] } });

test('full methodology and scoring resume after a late failure without regenerating indicators', async t => {
  let failing = true; let modelCalls = 0; let scoreCalls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const { prompt } = JSON.parse(init.body);
    let result;
    if (prompt.includes('Task:\nاین کسب‌وکار هدف') || prompt.includes('Task:\nاین رقیب')) result = { competitor: { services: ['offer'], strengths: ['published offer'], weaknesses: ['limited evidence'], instagramAnalytics: {}, websiteAnalytics: {} } };
    else if (prompt.includes('Task:\nSummarize')) result = { summary: 'Observed web and Instagram competition' };
    else if (prompt.includes('Task:\nتحلیل صنعت و SWOT')) result = { industryOverview: 'Digital competition', swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] } };
    else if (prompt.includes('Task:\nیک مدل CPM')) { modelCalls++; result = { cpmModel: model() }; }
    else if (prompt.includes('Task:\nدقیقاً ۶ عامل')) result = { factorCandidatePool: Array.from({ length: 6 }, (_, index) => ({ id: `candidate_${index}`, label: `Published ${index}`, status: 'excluded', classificationReason: 'Already covered', proposedCriterion: criterion(`candidate_${index}`, 'b1:e2') })) };
    else if (prompt.includes('Task:\nScore only')) {
      scoreCalls++;
      const data = JSON.parse(prompt.split('\n\nData:\n')[1].split('\n\nExact output structure:')[0]);
      const factor = data.factor;
      result = { evaluation: { factorScores: { [factor.id]: { dependentScores: Object.fromEntries(factor.dependentVariables.map(dependent => [dependent.id, { independentScores: Object.fromEntries(dependent.independentVariables.map(item => [item.id, { rawScore: 1, evidence: 'Published evidence', evidenceIds: [factor.id === 'social' ? 'e1' : 'e2'] }])) }])) } } } };
    } else if (prompt.includes('Task:\nبر اساس مدل CPM قفل')) result = { factorOverviews: Object.fromEntries(factors.map(([id]) => [id, 'Based on observed evidence'])) };
    else if (prompt.includes('Task:\nبر اساس تحلیل صنعت')) {
      if (failing) return Response.json({ error: 'simulated final-stage failure', retryable: false }, { status: 400 });
      result = { recommendations: Array.from({ length: 5 }, (_, index) => ({ priority: index + 1, title: 'Improve published offer', actionSteps: ['Review evidence'] })) };
    } else if (prompt.includes('Generate exactly')) {
      const [, count, first] = prompt.match(/Generate exactly (\d+).*?ranks (\d+) to/s);
      result = { topics: Array.from({ length: Number(count) }, (_, index) => ({ topic: `Question ${Number(first) + index}` })) };
    } else if (prompt.startsWith('Extract at most')) result = { signals: [] };
    else throw new Error(`Unexpected test stage: ${prompt.slice(0, 100)}`);
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) }, finish_reason: 'stop' }] });
  });
  const target = { ...rawBusiness('target'), industry: 'Retail' };
  const competitors = [rawBusiness('competitor')];
  const profilesData = { target, competitors };
  const versions = [];
  const methodology = { chunks: {}, save: async () => ({ persistence: 'remote' }), saveIndicators: async (value, status) => versions.push({ value: structuredClone(value), status }) };
  const preliminary = await prepareResearchMethodology('9router', { model: 'test' }, target, competitors, profilesData, () => {}, methodology);
  assert.equal(modelCalls, 1);
  assert.equal(preliminary.cpmModel.factors[0].dependentVariables[0].independentVariables[0].id, 'social_criterion');
  const approved = approveCpmModel(preliminary.cpmModel);
  const completion = { chunks: {}, save: async () => ({ persistence: 'remote' }) };
  const run = () => completeResearchWithApprovedCpm('9router', { model: 'test' }, target, competitors, profilesData, preliminary, approved, () => {}, completion);
  await assert.rejects(run(), /simulated final-stage failure/);
  assert.equal(scoreCalls, 8);
  failing = false;
  const result = enforceReportIntegrity(await run(), profilesData);
  assert.equal(modelCalls, 1); assert.equal(scoreCalls, 8);
  assert.equal(result.cpmMatrix.rows[0].coverage, 1);
  const reloaded = enforceReportIntegrity(structuredClone(result), { target: { name: target.name, website: target.website, instagramHandle: target.instagramHandle }, competitors: competitors.map(item => ({ name: item.name, website: item.website, instagramHandle: item.instagramHandle })) });
  assert.equal(reloaded.cpmMatrix.rows[0].total, result.cpmMatrix.rows[0].total);
  assert.equal(result.targetAnalysis.websiteAnalytics.uxScore, null);
  assert.deepEqual(result.marketCategories, []);
  assert.ok(versions.some(version => version.status === 'ready_for_review'));
});
