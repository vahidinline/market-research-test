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
