import { measuredWebsiteScore } from './websiteScoring.js';
import { fixedDigitalCriterion, isFixedDigitalGroup, needsVisualReview, VISUAL_REVIEW_NOTICE } from './socialCriteria.js';
import { validateIndicatorEvidence } from './researchEvidence.js';
const round = (value) => Number(Number(value).toFixed(4));
const uniqueIds = (items) => new Set(items.map((item) => item.id)).size === items.length;
const weightSum = (items) => items.reduce((sum, item) => sum + Number(item.weight), 0);
export const FIXED_CPM_FACTORS = [
  { id: 'social', label: 'سوشال' },
  { id: 'website', label: 'وب‌سایت' },
  { id: 'product_service', label: 'محصول/خدمت' },
  { id: 'industry_specific', label: 'عوامل اثرگذار ویژه صنعت' },
];

const validateWeights = (items, label, required) => {
  const defined = items.filter((item) => item.weight != null);
  if (!defined.length && !required) return;
  if (defined.length !== items.length) throw new Error(`وزن همه ${label} باید تعریف شود.`);
  if (items.some((item) => !Number.isFinite(Number(item.weight)) || Number(item.weight) < 0 || Number(item.weight) > 1)) {
    throw new Error(`وزن ${label} باید بین صفر و یک باشد.`);
  }
  if (Math.abs(weightSum(items) - 1) > 0.001) throw new Error(`مجموع وزن ${label} باید دقیقاً ۱ باشد.`);
};

export function validateCpmModel(model, { status = model?.status || 'proposed', requireWeights = true, requireCandidatePool = true } = {}) {
  if (!model || !Array.isArray(model.factors) || !model.factors.length) throw new Error('مدل CPM فاقد فاکتور است.');
  if (model.framework === 'four_factor_v1') {
    if (model.factors.length !== FIXED_CPM_FACTORS.length) throw new Error('مدل باید دقیقاً چهار فاکتور ثابت داشته باشد.');
    FIXED_CPM_FACTORS.forEach((expected, index) => {
      const actual = model.factors[index];
      if (actual?.id !== expected.id || actual?.label !== expected.label) throw new Error(`فاکتور ${index + 1} باید «${expected.label}» باشد.`);
    });
    if (requireCandidatePool && (!Array.isArray(model.factorCandidatePool) || model.factorCandidatePool.length < 6)) {
      throw new Error('مدل باید حداقل ۶ عامل کاندید اثرگذار را برای بررسی اپراتور ارائه کند.');
    }
  }
  if (model.factors.length > 6) throw new Error('مدل CPM بیش از ۶ فاکتور دارد.');
  if (!uniqueIds(model.factors)) throw new Error('شناسه فاکتورهای CPM یکتا نیست.');
  let criterionCount = 0;
  for (const factor of model.factors) {
    if (!factor.id || !factor.label || !Array.isArray(factor.dependentVariables) || !factor.dependentVariables.length) throw new Error(`ساختار فاکتور ${factor.label || factor.id || 'نامشخص'} ناقص است.`);
    if (factor.dependentVariables.filter(group => !isFixedDigitalGroup(group)).length > 4) throw new Error(`فاکتور ${factor.label} بیش از ۴ متغیر وابسته دارد.`);
    if (!uniqueIds(factor.dependentVariables)) throw new Error(`شناسه متغیرهای وابسته ${factor.label} یکتا نیست.`);
    validateWeights(factor.dependentVariables, `متغیرهای وابسته فاکتور «${factor.label}»`, requireWeights);
    for (const dependent of factor.dependentVariables) {
      if (!dependent.id || !dependent.label || !Array.isArray(dependent.independentVariables) || !dependent.independentVariables.length) throw new Error(`متغیر وابسته ${dependent.label || dependent.id || 'نامشخص'} فاقد معیار سنجش است.`);
      if (dependent.independentVariables.length > 5) throw new Error(`متغیر وابسته ${dependent.label} بیش از ۵ معیار سنجش دارد.`);
      criterionCount += dependent.independentVariables.filter(criterion => !fixedDigitalCriterion(criterion)).length;
      if (!uniqueIds(dependent.independentVariables)) throw new Error(`شناسه معیارهای ${dependent.label} یکتا نیست.`);
      validateWeights(dependent.independentVariables, `متغیرهای مستقل «${dependent.label}»`, requireWeights);
      for (const criterion of dependent.independentVariables) {
        const scoring = criterion.scoring || {};
        if (!criterion.id || !criterion.label || !['binary', 'range', 'count', 'percentage', 'rubric'].includes(scoring.type)) throw new Error(`روش سنجش معیار ${criterion.label || criterion.id || 'نامشخص'} معتبر نیست.`);
        const min = scoring.type === 'binary' ? 0 : Number(scoring.min ?? 0);
        const max = scoring.type === 'binary' ? 1 : Number(scoring.max);
        if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) throw new Error(`بازه معیار ${criterion.label} معتبر نیست.`);
      }
    }
  }
  if (criterionCount > 36) throw new Error('مدل CPM بیش از ۳۶ معیار مستقل دارد.');
  validateWeights(model.factors, 'فاکتورهای CPM', requireWeights);
  return { ...model, version: Number(model.version) || 1, status };
}

export function approveCpmModel(model, { operatorEdited = false } = {}) {
  if (model?.framework === 'four_factor_v1') {
    if (model.factors?.length !== FIXED_CPM_FACTORS.length) throw new Error('مدل این پروژه باید دقیقاً چهار فاکتور ثابت داشته باشد.');
    FIXED_CPM_FACTORS.forEach((expected, index) => {
      const actual = model.factors[index];
      if (actual?.id !== expected.id || actual?.label !== expected.label) throw new Error(`فاکتور ${index + 1} باید «${expected.label}» باشد.`);
    });
    const special = model.factors.find((factor) => factor.id === 'industry_specific');
    const caseFile = special?.industryFactorCase;
    if (!caseFile?.customerDecisionRole || !Array.isArray(caseFile.industrySignals) || !caseFile.industrySignals.length) {
      throw new Error('فاکتور ویژه صنعت باید نقش آن در تصمیم مشتری و شواهد صنعت را توضیح دهد.');
    }
    const undecided = model.factorCandidatePool.filter((candidate) => !['included', 'excluded'].includes(candidate.status));
    if (undecided.length) throw new Error(`تکلیف ${undecided.length} عامل کاندید هنوز توسط اپراتور مشخص نشده است.`);
    const unexplainedRejections = model.factorCandidatePool.filter((candidate) => candidate.status === 'excluded' && !String(candidate.operatorDecisionReason || candidate.classificationReason || '').trim());
    if (unexplainedRejections.length) throw new Error('برای عوامل ردشده باید دلیل تصمیم ثبت شود.');
    const invalidDestinations = model.factorCandidatePool.filter((candidate) => candidate.status === 'included' && !FIXED_CPM_FACTORS.some((factor) => factor.id === candidate.selectedFactorId));
    if (invalidDestinations.length) throw new Error('محل نهایی بعضی عوامل تأییدشده مشخص نشده است.');
  }
  if (model.evidencePolicy === 'raw_sources_v1') validateIndicatorEvidence(model, model.evidenceRegistry || []);
  const approved = validateCpmModel(model, { status: 'locked', requireWeights: true });
  return {
    ...approved,
    status: 'locked',
    approvedAt: new Date().toISOString(),
    operatorEdited: Boolean(operatorEdited),
  };
}

export function normalizeCpmScore(rawScore, scoring = {}) {
  if (rawScore == null) return null;
  const raw = Number(rawScore);
  if (!Number.isFinite(raw)) throw new Error('امتیاز خام CPM عددی نیست.');
  const min = scoring.type === 'binary' ? 0 : Number(scoring.min ?? 0);
  const max = scoring.type === 'binary' ? 1 : Number(scoring.max);
  if (raw < min || raw > max) throw new Error(`امتیاز ${raw} خارج از بازه ${min} تا ${max} است.`);
  const normalized = scoring.normalization === 'ratio' ? raw / max : (raw - min) / (max - min);
  return round(Math.max(0, Math.min(1, normalized)));
}

export function calculateCpmRow(model, rawEvaluation, identity) {
  const suppliedFactors = rawEvaluation?.factorScores || {};
  const expectedFactorIds = model.factors.map((factor) => factor.id);
  if (Object.keys(suppliedFactors).some((id) => !expectedFactorIds.includes(id))) throw new Error(`معیار اضافه در ارزیابی ${identity.name} وجود دارد.`);
  const factorScores = {};
  for (const factor of model.factors) {
    const review = identity.websiteReview;
    const reviewedUnavailable = (review?.status === 'not_found' && identity.hasWebsite === false)
      || (review?.status === 'inactive' && review.website === identity.websiteUrl);
    if (factor.id === 'website' && reviewedUnavailable && review?.scorePolicy === 'zero' && review?.reviewedAt && review?.sources?.length) {
      factorScores[factor.id] = {
        score: 0, coverage: 0, websiteReview: structuredClone(review),
        dependentScores: Object.fromEntries(factor.dependentVariables.map(dependent => [dependent.id, {
          score: 0,
          independentScores: Object.fromEntries(dependent.independentVariables.map(criterion => [criterion.id, {
            rawScore: 0, normalizedScore: 0, status: 'policy_zero', evidenceIds: [],
            evidence: review.note || 'در بررسی منابع، وب‌سایت رسمی شناسایی نشد؛ طبق تصمیم امتیازدهی، صفر منظور شده است.',
          }])),
        }])),
      };
      continue;
    }
    const suppliedDependents = suppliedFactors[factor.id]?.dependentScores || {};
    const expectedDependentIds = factor.dependentVariables.map((dependent) => dependent.id);
    if (Object.keys(suppliedDependents).some((id) => !expectedDependentIds.includes(id))) throw new Error(`متغیر وابسته اضافه در فاکتور ${factor.label} وجود دارد.`);
    const dependentScores = {};
    for (const dependent of factor.dependentVariables) {
      const suppliedCriteria = suppliedDependents[dependent.id]?.independentScores || {};
      const expectedCriterionIds = dependent.independentVariables.map((criterion) => criterion.id);
      if (Object.keys(suppliedCriteria).some((id) => !expectedCriterionIds.includes(id))) throw new Error(`معیار اضافه در ${dependent.label} وجود دارد.`);
      const independentScores = {};
      for (const criterion of dependent.independentVariables) {
        if (factor.id !== 'website' || (identity.hasWebsite !== false && identity.hasWebsiteEvidence !== false)) {
          if (!needsVisualReview(criterion) && !(criterion.id in suppliedCriteria)) throw new Error(`معیار ${criterion.label} برای ${identity.name} در خروجی وجود ندارد.`);
        }
        const measured = factor.id === 'website' && factor.auditScoringVersion === 2 && identity.websiteEvidence
          ? measuredWebsiteScore(criterion, identity.websiteEvidence) : undefined;
        const supplied = measured || suppliedCriteria[criterion.id] || {};
        // A missing website is an observed zero, not missing data. Keeping it
        // as null causes the website factor to become null and positioning maps
        // to drop the entire brand from their dataset.
        const websiteUnavailable = factor.id === 'website' && identity.hasWebsite === false && !identity.strictEvidence;
        const websiteNotAudited = factor.id === 'website' && identity.hasWebsiteEvidence === false && (identity.hasWebsite !== false || identity.strictEvidence);
        const unsupportedVisual = fixedDigitalCriterion(criterion)?.requires === 'visual' || (identity.strictEvidence && needsVisualReview(criterion));
        const rawScore = unsupportedVisual ? null : websiteUnavailable ? 0 : websiteNotAudited ? null : supplied.rawScore ?? null;
        if (identity.strictEvidence && rawScore != null) {
          if (identity.evidenceChannels && supplied.evidenceIds?.some(id => factor.id === 'website' ? identity.evidenceChannels[id] !== 'website' : factor.id === 'social' ? identity.evidenceChannels[id] === 'website' : false)) throw new Error('شاهد امتیاز متعلق به کانال این فاکتور نیست.');
          if (typeof rawScore !== 'number' || !Number.isFinite(rawScore)) throw new Error(`امتیاز ${criterion.id} باید عدد باشد.`);
          if (!String(supplied.evidence || '').trim() || !Array.isArray(supplied.evidenceIds) || !supplied.evidenceIds.length || supplied.evidenceIds.some(id => !identity.evidenceIds?.includes(id))) throw new Error(`امتیاز ${criterion.id} شاهد معتبر همان برند ندارد.`);
        }
        independentScores[criterion.id] = {
          evidenceIds: unsupportedVisual ? [] : supplied.evidenceIds || [],
          rawScore,
          normalizedScore: websiteUnavailable ? 0 : normalizeCpmScore(rawScore, criterion.scoring),
          evidence: unsupportedVisual ? VISUAL_REVIEW_NOTICE : websiteUnavailable ? 'وب‌سایت ندارد؛ امتیاز صفر.' : websiteNotAudited ? 'داده قابل بررسی از وب‌سایت موجود نیست؛ ارزیابی نشده.' : supplied.evidence || '',
          status: unsupportedVisual ? 'needs_visual_review' : rawScore == null ? 'not_available' : 'scored',
        };
      }
      const availableCriteria = dependent.independentVariables.filter((criterion) => independentScores[criterion.id].normalizedScore != null);
      const availableCriterionWeight = availableCriteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0);
      const dependentScore = availableCriterionWeight
        ? availableCriteria.reduce((sum, criterion) => sum + independentScores[criterion.id].normalizedScore * Number(criterion.weight), 0) / availableCriterionWeight
        : null;
      dependentScores[dependent.id] = { score: dependentScore == null ? null : round(dependentScore), independentScores };
    }
    const availableDependents = factor.dependentVariables.filter((dependent) => dependentScores[dependent.id].score != null);
    const availableDependentWeight = availableDependents.reduce((sum, dependent) => sum + Number(dependent.weight), 0);
    let factorScore = availableDependentWeight
      ? availableDependents.reduce((sum, dependent) => sum + dependentScores[dependent.id].score * Number(dependent.weight), 0) / availableDependentWeight
      : null;
    const criterionWeights = factor.dependentVariables.flatMap(dependent => dependent.independentVariables.map(criterion => ({
      weight: Number(dependent.weight) * Number(criterion.weight),
      score: dependentScores[dependent.id].independentScores[criterion.id].normalizedScore,
    })));
    const factorCoverage = criterionWeights.reduce((sum, item) => sum + (item.score == null ? 0 : item.weight), 0);
    if (factor.id === 'website' && factor.auditScoringVersion === 2) {
      factorScore = factorCoverage ? criterionWeights.reduce((sum, item) => sum + (item.score ?? 0) * item.weight, 0) / factorCoverage : null;
    }
    factorScores[factor.id] = { score: factorScore == null ? null : round(factorScore), dependentScores,
      ...(factor.id === 'website' && factor.auditScoringVersion === 2 ? { coverage: round(factorCoverage) } : {}) };
  }
  const availableFactors = model.factors.filter((factor) => factorScores[factor.id].score != null);
  const availableWeight = availableFactors.reduce((sum, factor) => sum + Number(factor.weight || 0), 0);
  const total = availableWeight
    ? availableFactors.reduce((sum, factor) => sum + factorScores[factor.id].score * Number(factor.weight), 0) / availableWeight
    : null;
  const coverage = model.factors.reduce((sum, factor) => sum + Number(factor.weight) * factor.dependentVariables.reduce((inner, dependent) => inner + Number(dependent.weight) * dependent.independentVariables.reduce((covered, criterion) => {
    const score = factorScores[factor.id].dependentScores[dependent.id].independentScores[criterion.id];
    return covered + (score.rawScore == null || score.status === 'policy_zero' ? 0 : Number(criterion.weight));
  }, 0), 0), 0);
  return { coverage: round(coverage), comparable: coverage >= 0.8, name: identity.name, isTarget: Boolean(identity.isTarget), factorScores, total: total == null ? null : round(total) };
}

export function calculateCpmMatrix(modelInput, evaluations, identities) {
  const model = validateCpmModel(modelInput, { status: 'locked', requireWeights: true });
  if (modelInput.status !== 'locked') throw new Error('مدل CPM باید پیش از امتیازدهی توسط اپراتور تأیید و قفل شود.');
  if (!Array.isArray(evaluations) || evaluations.length !== identities.length) throw new Error(`تعداد ارزیابی‌های CPM باید دقیقاً ${identities.length} باشد.`);
  return { model, matrix: { rows: identities.map((identity, index) => calculateCpmRow(model, evaluations[index], identity)) } };
}

const CPM_POSITIONING_PAIRS = [
  ['social', 'website'],
  ['product_service', 'industry_specific'],
  ['social', 'product_service'],
  ['website', 'industry_specific'],
];

export function buildCpmPositioningMaps(model, matrix) {
  if (!model?.factors || !Array.isArray(matrix?.rows)) return [];
  const factors = Object.fromEntries(model.factors.map((factor) => [factor.id, factor]));
  return CPM_POSITIONING_PAIRS.map(([xFactorId, yFactorId]) => {
    const xFactor = factors[xFactorId];
    const yFactor = factors[yFactorId];
    if (!xFactor || !yFactor) return null;
    const data = matrix.rows.flatMap((row) => {
      if (row.comparable === false && matrix.scenario !== true) return [];
      const x = row.factorScores?.[xFactorId]?.score;
      const y = row.factorScores?.[yFactorId]?.score;
      if (x == null || y == null) return [];
      return [{
        name: row.name,
        x: round(x),
        y: round(y),
        isTarget: Boolean(row.isTarget),
        ...(matrix.scenario === true ? { estimated: Boolean(row.factorScores[xFactorId].estimated || row.factorScores[yFactorId].estimated) } : {}),
      }];
    });
    return {
      title: `${xFactor.label} × ${yFactor.label}`,
      xAxis: `امتیاز CPM ${xFactor.label}`,
      yAxis: `امتیاز CPM ${yFactor.label}`,
      xFactorId,
      yFactorId,
      domain: [0, 1],
      midpoint: 0.5,
      source: matrix.scenario === true ? 'cpm_factor_estimates' : 'cpm_factor_scores',
      data,
    };
  }).filter(Boolean);
}

// Show whether small factor-weight changes alter the ranking, using existing
// scores only. This does not make differently covered samples comparable.
export function cpmSensitivity(model, rows, delta = 0.1) {
  const eligible = rows.filter(row => row.comparable !== false && model.factors.every(factor => row.factorScores?.[factor.id]?.score != null));
  const rank = factors => eligible.map(row => ({ name: row.name, total: round(factors.reduce((sum, factor) => sum + factor.weight * row.factorScores[factor.id].score, 0)) })).sort((a,b) => b.total-a.total);
  return { delta, baseline: rank(model.factors), scenarios: model.factors.flatMap(changed => [-delta, delta].map(adjustment => {
    const weights = model.factors.map(factor => ({ ...factor, weight: Math.max(0, factor.weight + (factor.id === changed.id ? adjustment : 0)) }));
    const total = weights.reduce((sum, factor) => sum + factor.weight, 0);
    return { factorId: changed.id, adjustment, ranking: rank(weights.map(factor => ({ ...factor, weight: factor.weight / total }))) };
  })) };
}
