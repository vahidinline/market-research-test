import { configureWebsiteScoring } from './websiteScoring.js';
import reference from './digitalCriteriaReference.json' with { type: 'json' };
const visualIds = new Set(['visual_quality', 'candidate_creative_script_visual_quality', 'channel_structure']);
export const DIGITAL_CRITERIA_GROUPS = reference;
export const FIXED_SOCIAL_CRITERIA = reference[0].dependentVariables.flatMap(group => group.independentVariables.map(item => ({ ...item, key: item.id, groupId: group.id, groupLabel: group.label, requires: visualIds.has(item.id) ? 'visual' : 'text' })));
export const FIXED_WEBSITE_CRITERIA = reference[1].dependentVariables.flatMap(group => group.independentVariables.map(item => ({ ...item, key: item.id, groupId: group.id, groupLabel: group.label, requires: 'text' })));
export const fixedSocialCriterion = criterion => FIXED_SOCIAL_CRITERIA.find(item => item.id === criterion?.id);
export const fixedDigitalCriterion = criterion => [...FIXED_SOCIAL_CRITERIA, ...FIXED_WEBSITE_CRITERIA].find(item => item.id === criterion?.id);
export const isBaseDigitalCriterion = criterion => Boolean(fixedDigitalCriterion(criterion)) && !criterion.id.startsWith('candidate_');
export const isFixedDigitalGroup = group => reference.some(factor => factor.dependentVariables.some(item => item.id === group?.id && item.independentVariables.some(isBaseDigitalCriterion)));
export const BASE_SOCIAL_CRITERIA = FIXED_SOCIAL_CRITERIA.filter(isBaseDigitalCriterion);
export const BASE_WEBSITE_CRITERIA = FIXED_WEBSITE_CRITERIA.filter(isBaseDigitalCriterion);
export const PROJECT_DIGITAL_CRITERIA = [...FIXED_SOCIAL_CRITERIA, ...FIXED_WEBSITE_CRITERIA].filter(item => !isBaseDigitalCriterion(item));
export const needsVisualReview = criterion => fixedSocialCriterion(criterion)?.requires === 'visual' || /visual|storytelling|layout|بصری|چیدمان|داستان.?گویی|کیفیت عکس|هایلایت/i.test(`${criterion?.id} ${criterion?.label}`);
export const VISUAL_REVIEW_NOTICE = 'عکس‌ها و ویدئوهای این صفحه در این گزارش بررسی نشده‌اند؛ برای کیفیت بصری امتیازی ثبت نشده است.';

// Restore the user-supplied reference while preparing/reviewing a methodology.
// Never call this on a locked report merely to render its existing scores.
export function restoreSocialCriteria(model) {
  const next = structuredClone(model);
  for (const template of reference) {
    const factor = next.factors?.find(item => item.id === template.id);
    if (!factor) continue;
    for (const group of factor.dependentVariables) for (const criterion of group.independentVariables) {
      if (fixedDigitalCriterion(criterion)) criterion.criteriaOrigin = isBaseDigitalCriterion(criterion) ? 'base' : 'reference_project';
    }
    const required = template.dependentVariables.flatMap(group => group.independentVariables.filter(isBaseDigitalCriterion).map(c => c.id));
    const existingIds = factor.dependentVariables.flatMap(group => group.independentVariables.map(c => c.id));
    if (next.digitalCriteriaVersion === 2 && required.every(id => existingIds.includes(id)) && !existingIds.some(id => id.startsWith('fixed_social_'))) continue;
    next.previousDigitalFactors ||= {};
    next.previousDigitalFactors[template.id] ||= structuredClone(factor);
    const previous = factor.dependentVariables.flatMap(group => group.independentVariables);
    const approvedExtraIds = new Set((next.factorCandidatePool || []).filter(c => c.status === 'included' && c.selectedFactorId === template.id).map(c => `candidate_${c.id}`));
    const extras = previous.filter(c => approvedExtraIds.has(c.id) && !fixedDigitalCriterion(c));
    factor.dependentVariables = structuredClone(template.dependentVariables);
    for (const group of factor.dependentVariables) for (const criterion of group.independentVariables) {
      criterion.criteriaOrigin = isBaseDigitalCriterion(criterion) ? 'base' : 'reference_project';
      criterion.definition ||= criterion.label;
      criterion.reason ||= 'معیار چارچوب مرجع برای مقایسه برندها.';
      criterion.evidenceIds = [];
      criterion.scoring.rubricLevels = criterion.scoring.type === 'binary'
        ? [{ score: 0, description: 'پس از بررسی، وجود ندارد.' }, { score: 1, description: 'پس از بررسی، وجود دارد.' }]
        : [{ score: 0, description: 'پس از بررسی، رعایت نشده است.' }, { score: 1, description: 'ضعیف' }, { score: 2, description: 'متوسط' }, { score: 3, description: 'قوی' }];
    }
    if (extras.length) {
      factor.dependentVariables.forEach(group => { group.weight *= .9; });
      factor.dependentVariables.push({ id: `approved_extra_${template.id}`, label: 'معیارهای اختصاصی تأییدشده', weight: .1, independentVariables: extras.map(c => ({ ...c, weight: 1 / extras.length })) });
    }
  }
  next.socialCriteriaVersion = 2;
  next.digitalCriteriaVersion = 2;
  return configureWebsiteScoring(next);
}

export const needsDigitalCriteriaReview = model => Boolean(model?.factors?.some(factor => ['social', 'website'].includes(factor.id))) && model.digitalCriteriaVersion !== 2;
