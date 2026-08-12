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

export function validateCpmModel(model, { status = model?.status || 'proposed', requireWeights = true } = {}) {
  if (!model || !Array.isArray(model.factors) || !model.factors.length) throw new Error('مدل CPM فاقد فاکتور است.');
  if (model.framework === 'four_factor_v1') {
    if (model.factors.length !== FIXED_CPM_FACTORS.length) throw new Error('مدل باید دقیقاً چهار فاکتور ثابت داشته باشد.');
    FIXED_CPM_FACTORS.forEach((expected, index) => {
      const actual = model.factors[index];
      if (actual?.id !== expected.id || actual?.label !== expected.label) throw new Error(`فاکتور ${index + 1} باید «${expected.label}» باشد.`);
    });
    if (!Array.isArray(model.factorCandidatePool) || model.factorCandidatePool.length < 6) {
      throw new Error('مدل باید حداقل ۶ عامل کاندید اثرگذار را برای بررسی اپراتور ارائه کند.');
    }
  }
  if (model.factors.length > 6) throw new Error('مدل CPM بیش از ۶ فاکتور دارد.');
  if (!uniqueIds(model.factors)) throw new Error('شناسه فاکتورهای CPM یکتا نیست.');
  let criterionCount = 0;
  for (const factor of model.factors) {
    if (!factor.id || !factor.label || !Array.isArray(factor.dependentVariables) || !factor.dependentVariables.length) throw new Error(`ساختار فاکتور ${factor.label || factor.id || 'نامشخص'} ناقص است.`);
    if (factor.dependentVariables.length > 4) throw new Error(`فاکتور ${factor.label} بیش از ۴ متغیر وابسته دارد.`);
    if (!uniqueIds(factor.dependentVariables)) throw new Error(`شناسه متغیرهای وابسته ${factor.label} یکتا نیست.`);
    validateWeights(factor.dependentVariables, `متغیرهای وابسته فاکتور «${factor.label}»`, requireWeights);
    for (const dependent of factor.dependentVariables) {
      if (!dependent.id || !dependent.label || !Array.isArray(dependent.independentVariables) || !dependent.independentVariables.length) throw new Error(`متغیر وابسته ${dependent.label || dependent.id || 'نامشخص'} فاقد معیار سنجش است.`);
      if (dependent.independentVariables.length > 5) throw new Error(`متغیر وابسته ${dependent.label} بیش از ۵ معیار سنجش دارد.`);
      criterionCount += dependent.independentVariables.length;
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
        if (!(criterion.id in suppliedCriteria)) throw new Error(`معیار ${criterion.label} برای ${identity.name} در خروجی وجود ندارد.`);
        const supplied = suppliedCriteria[criterion.id] || {};
        independentScores[criterion.id] = {
          rawScore: supplied.rawScore ?? null,
          normalizedScore: normalizeCpmScore(supplied.rawScore, criterion.scoring),
          evidence: supplied.evidence || '',
          status: supplied.rawScore == null ? 'not_available' : 'scored',
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
    const factorScore = availableDependentWeight
      ? availableDependents.reduce((sum, dependent) => sum + dependentScores[dependent.id].score * Number(dependent.weight), 0) / availableDependentWeight
      : null;
    factorScores[factor.id] = { score: factorScore == null ? null : round(factorScore), dependentScores };
  }
  const availableFactors = model.factors.filter((factor) => factorScores[factor.id].score != null);
  const availableWeight = availableFactors.reduce((sum, factor) => sum + Number(factor.weight || 0), 0);
  const total = availableWeight
    ? availableFactors.reduce((sum, factor) => sum + factorScores[factor.id].score * Number(factor.weight), 0) / availableWeight
    : null;
  return { name: identity.name, isTarget: Boolean(identity.isTarget), factorScores, total: total == null ? null : round(total) };
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
      const x = row.factorScores?.[xFactorId]?.score;
      const y = row.factorScores?.[yFactorId]?.score;
      if (x == null || y == null) return [];
      return [{
        name: row.name,
        x: round(x),
        y: round(y),
        isTarget: Boolean(row.isTarget),
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
      source: 'cpm_factor_scores',
      data,
    };
  }).filter(Boolean);
}
