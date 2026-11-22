import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCpmRow } from '../src/utils/cpm.js';
import { enforceReportIntegrity } from '../src/utils/reportIntegrity.js';

const model = {
  status: 'locked', factors: ['website', 'product_service'].map((id) => ({
    id, label: id, weight: 0.5, dependentVariables: [{ id: 'quality', label: 'Quality', weight: 1,
      independentVariables: [{ id: 'metric', label: 'Metric', weight: 1, scoring: { type: 'range', min: 1, max: 5, normalization: 'min-max' } }],
    }],
  })),
};
const evaluation = { factorScores: Object.fromEntries(['website', 'product_service'].map((id) => [id, {
  dependentScores: { quality: { independentScores: { metric: { rawScore: 5, evidence: 'Excellent responsive website with booking' } } } },
}])) };

test('AI high score cannot override an observed absence of a website, including scales starting above zero', () => {
  const row = calculateCpmRow(model, evaluation, { name: 'Brand', hasWebsite: false });
  assert.equal(row.factorScores.website.score, 0);
  const metric = row.factorScores.website.dependentScores.quality.independentScores.metric;
  assert.equal(metric.rawScore, 0);
  assert.equal(metric.normalizedScore, 0);
  assert.equal(metric.evidence, 'وب‌سایت ندارد؛ امتیاز صفر.');
  assert.equal(row.factorScores.product_service.score, 1);
  assert.equal(row.total, 0.5);
});

test('a URL without collected evidence has no invented website score', () => {
  const row = calculateCpmRow(model, evaluation, { name: 'Brand', hasWebsite: true, hasWebsiteEvidence: false });
  assert.equal(row.factorScores.website.score, null);
  assert.equal(row.factorScores.website.dependentScores.quality.independentScores.metric.rawScore, null);
});

test('repair removes invented URL, UX claims and raw evaluation scores from a saved report', () => {
  const report = { cpmModel: model, cpmEvaluations: [evaluation], targetAnalysis: { name: 'Brand', website: 'https://invented.test', followers: 20, instagramAnalytics: { followers: 20 }, websiteAnalytics: { uxScore: 10, mobileFriendly: true, narrative: 'Excellent website' } }, factorOverviews: { website: 'Brand has an excellent website' } };
  const repaired = enforceReportIntegrity(report, { target: { name: 'Brand', website: '' }, competitors: [] });
  assert.equal(repaired.targetAnalysis.website, '');
  assert.equal(repaired.targetAnalysis.websiteAnalytics.uxScore, null);
  assert.equal(repaired.targetAnalysis.websiteAnalytics.status, 'absent');
  assert.equal(repaired.targetAnalysis.followers, 20);
  assert.equal(repaired.cpmMatrix.rows[0].factorScores.website.score, 0);
  assert.equal(repaired.cpmEvaluations[0].factorScores.website.dependentScores.quality.independentScores.metric.rawScore, 0);
  assert.ok(!repaired.factorOverviews.website.includes('excellent'));
  assert.equal(report.targetAnalysis.websiteAnalytics.uxScore, 10);
});

test('audited website scores survive save and reload using recorded evidence provenance', () => {
  const report = { cpmModel: model, cpmEvaluations: [evaluation], targetAnalysis: { name: 'Brand', websiteAnalytics: { uxScore: 8 } } };
  const first = enforceReportIntegrity(report, { target: { name: 'Brand', website: 'https://real.test', websiteData: { text: 'Actual collected page content' } } });
  assert.equal(first.cpmMatrix.rows[0].factorScores.website.score, 1);
  const reloaded = enforceReportIntegrity(first, { target: { name: 'Brand', website: 'https://real.test' } });
  assert.equal(reloaded.cpmMatrix.rows[0].factorScores.website.score, 1);
  assert.equal(reloaded.targetAnalysis.websiteAnalytics.uxScore, 8);
});

test('legacy website breakdowns are zeroed for businesses without sites', () => {
  const repaired = enforceReportIntegrity({ cpmMatrix: { rows: [{ name: 'Brand', websiteBreakdown: { ux: 10, seo: 9 } }] } }, { target: { name: 'Brand', website: '' } });
  assert.equal(repaired.cpmMatrix.rows[0].website, 0);
  assert.deepEqual(repaired.cpmMatrix.rows[0].websiteBreakdown, { ux: 0, seo: 0 });
});

test('reviewed missing website stays zero through estimates and reload, without claiming audit coverage', async () => {
  const {completeCpmEstimates}=await import('../src/utils/cpmEstimates.js');
  const websiteModel={...model,factors:[{...model.factors[0],weight:1}]};
  const review={name:'Brand',status:'not_found',scorePolicy:'zero',reviewedAt:'2026-11-22',sources:['https://www.instagram.com/brand/'],note:'No official website found in reviewed sources; zero by scoring policy.'};
  const report={researchMethodology:{},cpmModel:websiteModel,cpmEvaluations:[{}],websitePresenceReviews:[review],cpmEstimation:{enabled:true}};
  const identities={target:{name:'Brand',website:''}};
  const first=enforceReportIntegrity(report,identities);
  const reloaded=enforceReportIntegrity(first,identities);
  for(const matrix of [first.cpmMatrix,reloaded.cpmMatrix,completeCpmEstimates(websiteModel,reloaded.cpmMatrix)]) {
    assert.equal(matrix.rows[0].factorScores.website.score,0);
    assert.equal(matrix.rows[0].factorScores.website.coverage,0);
    assert.equal(matrix.rows[0].total,0);
  }
});

test('inactive-site decision applies only to the reviewed URL; unreviewed missing sites stay unknown', () => {
 const websiteModel={...model,factors:[{...model.factors[0],weight:1}]};
 const review={status:'inactive',website:'https://old.test/',scorePolicy:'zero',reviewedAt:'2026-11-22',sources:['https://old.test/']};
 const identity={name:'Brand',strictEvidence:true,hasWebsite:true,hasWebsiteEvidence:false,websiteUrl:'https://old.test/',websiteReview:review};
 assert.equal(calculateCpmRow(websiteModel,{},identity).factorScores.website.score,0);
 assert.equal(calculateCpmRow(websiteModel,{}, {...identity,websiteUrl:'https://new.test/'}).factorScores.website.score,null);
 assert.equal(calculateCpmRow(websiteModel,{}, {...identity,hasWebsite:false,websiteReview:undefined}).factorScores.website.score,null);
});
