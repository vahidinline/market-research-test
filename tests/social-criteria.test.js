import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../src/utils/digitalCriteriaReference.json' with { type: 'json' };
import { FIXED_SOCIAL_CRITERIA, FIXED_WEBSITE_CRITERIA, needsDigitalCriteriaReview, restoreSocialCriteria } from '../src/utils/socialCriteria.js';
import { validateCpmModel, calculateCpmRow } from '../src/utils/cpm.js';
import { validateIndicatorEvidence } from '../src/utils/researchEvidence.js';
import { simplifyLabels, PLAIN_LANGUAGE_RULES } from '../src/utils/plainLanguage.js';
const original = () => ({ factors: ['social','website'].map(id => ({ id, label: id, weight: .5, dependentVariables: [{ id: 'generated', label: 'یک معیار تولیدشده', weight: 1, independentVariables: [{ id: 'generated_metric', label: 'قدیمی', weight: 1, scoring: {type:'binary', min:0, max:1} }] }] })) });
test('social and website IDs, labels, group weights and criterion weights match the supplied Business Box report', () => {
  const before = original(); const model = restoreSocialCriteria(before);
  assert.equal(FIXED_SOCIAL_CRITERIA.length, 9);
  assert.equal(FIXED_WEBSITE_CRITERIA.length, 3);
  for (const template of reference) {
    const actual = model.factors.find(f => f.id === template.id);
    const shape = groups => groups.map(g => ({ id:g.id, label:g.label, weight:g.weight, criteria:g.independentVariables.map(c => ({id:c.id,label:c.label,weight:c.weight,type:c.scoring.type,min:c.scoring.min,max:c.scoring.max})) }));
    assert.deepEqual(shape(actual.dependentVariables),shape(template.dependentVariables));
  }
  assert.equal(before.factors[0].dependentVariables[0].id, 'generated');
  assert.doesNotThrow(() => validateCpmModel(model));
  assert.doesNotThrow(() => validateIndicatorEvidence(model, []));
  assert.deepEqual(restoreSocialCriteria(model),model);
});
test('repairs a partially restored template without duplicate groups', () => {
  const model = restoreSocialCriteria(original());
  model.factors[0].dependentVariables[0].independentVariables.shift();
  const repaired = restoreSocialCriteria(model);
  assert.equal(repaired.factors[0].dependentVariables.length,4);
  assert.equal(repaired.factors[0].dependentVariables.flatMap(g=>g.independentVariables).length,9);
  assert.doesNotThrow(()=>validateCpmModel(repaired));
});
test('restoration replaces the incorrect recent fixed_social groups and keeps explicitly approved project additions', () => {
  const before = original();
  before.factors[0].dependentVariables[0].independentVariables.push({id:'candidate_special',label:'اختصاصی',weight:0,scoring:{type:'binary',min:0,max:1}});
  before.factorCandidatePool=[{id:'special',status:'included',selectedFactorId:'social'}];
  const restored=restoreSocialCriteria(before);
  assert.ok(restored.factors[0].dependentVariables.flatMap(g=>g.independentVariables).some(c=>c.id==='candidate_special'));
  assert.doesNotThrow(()=>validateCpmModel(restored));
});
test('visual standards remain visible and cannot receive invented scores from text', () => {
  const model=restoreSocialCriteria(original());
  const factorScores=Object.fromEntries(model.factors.map(f=>[f.id,{dependentScores:Object.fromEntries(f.dependentVariables.map(g=>[g.id,{independentScores:Object.fromEntries(g.independentVariables.map(c=>[c.id,{rawScore:1,evidence:'متن',evidenceIds:['e1']}]))}]))}]));
  const row=calculateCpmRow(model,{factorScores},{name:'Brand',strictEvidence:true,evidenceIds:['e1']});
  for(const id of ['visual_quality','candidate_creative_script_visual_quality']) assert.equal(row.factorScores.social.dependentScores.social_content_quality.independentScores[id].rawScore,null);
  assert.equal(row.factorScores.social.dependentScores.social_performance_trust.independentScores.engagement_performance.rawScore,1);
});
test('generated nonstandard criteria still require evidence', () => {
  const model=restoreSocialCriteria(original());
  model.factors[0].dependentVariables[0].independentVariables.push({id:'invented',label:'ساختگی',evidenceIds:[]});
  assert.throws(()=>validateIndicatorEvidence(model,[]),/ارجاع شاهد/);
});
test('simplification changes prose but preserves IDs, links, numbers and source excerpts', () => {
  const input = { label: 'شفافیت گزاره ارزش پیشنهادی', reason: 'تبیین تمایز رقابتی', id: 'تبیین', url: 'https://example.test/تبیین', excerpt: 'تبیین', score: 3, evidenceIds: ['تبیین'] };
  const output = simplifyLabels(input);
  assert.equal(output.label, 'وضوح معرفی خدمات');
  assert.equal(output.reason, 'توضیح تفاوت با رقبا');
  for (const key of ['id', 'url', 'excerpt', 'score', 'evidenceIds']) assert.deepEqual(output[key], input[key]);
  assert.match(PLAIN_LANGUAGE_RULES, /business owner/);
});

test('existing report titles use clear wording without changing the stored model', () => {
  const stored = { factors: [{ id: 'industry_specific', dependentVariables: [{ id: 'institutional', label: 'روابط نهادی ادعاشده' }] }], label: 'عرضه مسیر تحصیلی بورسیه‌دار' };
  const display = simplifyLabels(stored);
  assert.equal(display.label, 'ارائه پذیرش همراه با بورسیه');
  assert.equal(display.factors[0].dependentVariables[0].label, 'همکاری‌های اعلام‌شده');
  assert.equal(stored.label, 'عرضه مسیر تحصیلی بورسیه‌دار');
  assert.equal(display.factors[0].id, stored.factors[0].id);
});

test('old approved drafts require review before using the replacement framework', () => {
  const model = { ...original(), status: 'locked' };
  assert.equal(needsDigitalCriteriaReview(model), true);
  assert.equal(needsDigitalCriteriaReview(restoreSocialCriteria(model)), false);
});
