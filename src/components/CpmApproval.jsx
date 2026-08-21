import { useMemo, useState } from 'react';
import { CheckCircle2, LockKeyhole, Plus, Trash2 } from 'lucide-react';
import { approveCpmModel } from '../utils/cpm.js';
import './cpm-approval.css';
import './cpm-candidates.css';

const clone = (value) => structuredClone(value);
const sum = (items = []) => items.reduce((total, item) => total + (Number(item.weight) || 0), 0);
const id = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const percent = (value) => `${Math.round((Number(value) || 0) * 100)}٪`;
const candidateCriterionId = (candidate, index) => {
  const slug = String(candidate.id || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 42);
  return `candidate_${slug || index}`;
};
const rebalance = (items = []) => {
  if (!items.length) return;
  const weight = Number((1 / items.length).toFixed(4));
  items.forEach((item, index) => { item.weight = index === items.length - 1 ? Number((1 - weight * (items.length - 1)).toFixed(4)) : weight; });
};

function WeightSummary({ items, label }) {
  const total = sum(items);
  const valid = Math.abs(total - 1) <= 0.001;
  return <span className={valid ? 'cpm-ok' : 'cpm-error'}>{label}: {percent(total)} {valid ? '✓' : '— باید ۱۰۰٪ باشد'}</span>;
}

function MainFactorWeights({ factors, onChange }) {
  return <section className="cpm-main-weights"><div className="cpm-main-weights-copy"><span>STEP 02 · WEIGHTED FRAMEWORK</span><h2>وزن‌دهی چهار شاخص اصلی</h2><p>اهمیت نسبی هر فاکتور را برای این پروژه تعیین کنید. مجموع وزن‌ها باید دقیقاً ۱۰۰٪ باشد.</p></div><div className="cpm-main-weight-grid">{factors.map((factor, index) => <article key={factor.id} className={`cpm-main-weight-card factor-${index}`}><div className="cpm-main-weight-head"><span>{String(index + 1).padStart(2, '0')}</span><b>{factor.label}</b><strong>{Math.round((Number(factor.weight) || 0) * 100)}٪</strong></div><div className="cpm-main-weight-track"><i style={{ width: `${Math.max(0, Math.min(100, (Number(factor.weight) || 0) * 100))}%` }}/></div><label>وزن فاکتور<input type="number" min="0" max="1" step="0.01" value={factor.weight} onChange={(event) => onChange((next) => { next.factors[index].weight = Number(event.target.value); })}/></label><small>{factor.definition || 'تعریف فاکتور هنوز تکمیل نشده است.'}</small></article>)}</div></section>;
}

export default function CpmApproval({ model, target, onApprove, onCancel }) {
  const [draft, setDraft] = useState(() => {
    const initial = clone(model);
    initial.factorCandidatePool = (initial.factorCandidatePool || []).map((candidate) => ({
      ...candidate,
      status: candidate.alreadyIncluded ? 'included' : 'review',
      selectedFactorId: candidate.selectedFactorId || candidate.suggestedFactorId || 'industry_specific',
    }));
    return initial;
  });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const criterionCount = useMemo(() => draft.factors.reduce((count, factor) => count + factor.dependentVariables.reduce((inner, dependent) => inner + dependent.independentVariables.length, 0), 0), [draft]);

  const change = (recipe) => {
    setDraft((current) => {
      const next = clone(current);
      recipe(next);
      return next;
    });
    setDirty(true);
    setError('');
  };
  const equalize = (items) => {
    const weight = Number((1 / items.length).toFixed(4));
    items.forEach((item, index) => { item.weight = index === items.length - 1 ? Number((1 - weight * (items.length - 1)).toFixed(4)) : weight; });
  };
  const submit = () => {
    try {
      const approved = approveCpmModel(draft, { operatorEdited: dirty });
      onApprove(approved);
    } catch (validationError) {
      setError(validationError.message);
    }
  };
  const decideCandidate = (candidateIndex, status, destination) => {
    try {
        const next = clone(draft);
        const candidate = next.factorCandidatePool[candidateIndex];
        if (candidate.alreadyIncluded) return;
        const criterionId = candidateCriterionId(candidate, candidateIndex);
        next.factors.forEach((factor) => {
          factor.dependentVariables.forEach((dependent) => {
            dependent.independentVariables = dependent.independentVariables.filter((criterion) => criterion.id !== criterionId);
            if (dependent.id.startsWith('supplemental_')) rebalance(dependent.independentVariables);
          });
          factor.dependentVariables = factor.dependentVariables.filter((dependent) => !dependent.id.startsWith('supplemental_') || dependent.independentVariables.length);
          rebalance(factor.dependentVariables);
        });
        candidate.selectedFactorId = destination || candidate.selectedFactorId || candidate.suggestedFactorId;
        candidate.status = status;
        if (status === 'review') {
          setDraft(next); setDirty(true); setError(''); return;
        }
        if (status === 'excluded') {
          setDraft(next); setDirty(true); setError(''); return;
        }
        const totalCriteria = next.factors.reduce((total, factor) => total + factor.dependentVariables.reduce((count, dependent) => count + dependent.independentVariables.length, 0), 0);
        if (totalCriteria >= 36) throw new Error('ظرفیت ۳۶ متغیر مستقل تکمیل شده است؛ ابتدا یک معیار کم‌اهمیت را حذف کنید.');
        const factor = next.factors.find((item) => item.id === candidate.selectedFactorId);
        if (!factor) throw new Error('فاکتور مقصد عامل کاندید معتبر نیست.');
        let dependent = factor.dependentVariables.find((item) => item.id === `supplemental_${factor.id}`);
        if (!dependent && factor.dependentVariables.length < 4) {
          dependent = { id: `supplemental_${factor.id}`, label: candidate.suggestedDependentLabel || 'عوامل تکمیلی تأییدشده', weight: 0, reason: 'افزوده‌شده پس از بررسی اپراتور', independentVariables: [] };
          factor.dependentVariables.push(dependent);
          rebalance(factor.dependentVariables);
        }
        if (!dependent) dependent = factor.dependentVariables.find((item) => item.independentVariables.length < 5);
        if (!dependent || dependent.independentVariables.length >= 5) throw new Error(`در فاکتور «${factor.label}» ظرفیت افزودن معیار جدید وجود ندارد.`);
        const proposed = candidate.proposedCriterion || {};
        dependent.independentVariables.push({
          id: criterionId, label: candidate.label, definition: proposed.definition || candidate.customerDecisionImpact || '',
          weight: 0, reason: proposed.reason || candidate.classificationReason || '', evidenceSource: proposed.evidenceSource || 'operator_approved_candidate',
          scoring: proposed.scoring || { type: 'binary', min: 0, max: 1, normalization: 'min-max', rubricLevels: [] },
        });
        rebalance(dependent.independentVariables);
        candidate.existingPath = `${factor.label} ← ${dependent.label} ← ${candidate.label}`;
        setDraft(next); setDirty(true); setError('');
    } catch (candidateError) { setError(candidateError.message); }
  };
  const updateCandidate = (candidateIndex, key, value) => change((next) => { next.factorCandidatePool[candidateIndex][key] = value; });

  return <div className="cpm-approval" dir="rtl">
    <header className="cpm-approval-head">
      <div><span>HUMAN-IN-THE-LOOP · CPM METHODOLOGY</span><h1>تأیید مدل کارشناسی {target?.name || 'پروژه'}</h1><p>تا زمان تأیید شما هیچ امتیازی به برندها داده نمی‌شود. پس از تأیید، همین نسخه برای تمام رقبا قفل خواهد شد.</p></div>
      <div className="cpm-status"><LockKeyhole size={18}/><b>پیشنهاد AI</b><small>نسخه {draft.version || 1}</small></div>
    </header>

    <section className="cpm-approval-panel">
      <h2>دفاع کارشناسی مدل</h2>
      <textarea value={draft.rationale || ''} onChange={(event) => change((next) => { next.rationale = event.target.value; })}/>
      <div className="cpm-basis">
        {(draft.decisionBasis || []).map((basis, index) => <article key={`${basis.source}-${index}`}>
          <span>{basis.source}</span><b>{basis.observation}</b><p>{basis.implication}</p>
        </article>)}
      </div>
      {!!draft.assumptions?.length && <div className="cpm-assumptions"><strong>فرض‌های نیازمند توجه اپراتور</strong>{draft.assumptions.map((item, index) => <p key={`${item}-${index}`}>— {item}</p>)}</div>}
    </section>

    <section className="cpm-toolbar">
      <div><WeightSummary items={draft.factors} label="مجموع وزن فاکتورهای ثابت"/><small>{draft.factors.length} فاکتور ثابت · {criterionCount} متغیر مستقل</small></div>
      <button onClick={() => change((next) => equalize(next.factors))}>توزیع مساوی وزن فاکتورها</button>
      <span className="cpm-fixed-note"><LockKeyhole size={13}/> نام و تعداد فاکتورها ثابت است</span>
    </section>

    <MainFactorWeights factors={draft.factors} onChange={change}/>

    <CandidatePool model={draft} onDecision={decideCandidate} onUpdate={updateCandidate}/>

    <main className="cpm-factor-list">
      {draft.factors.map((factor, factorIndex) => <section className="cpm-factor-editor" key={factor.id}>
        <div className="cpm-editor-title">
          <span>{String(factorIndex + 1).padStart(2, '0')}</span>
          <label>نام فاکتور ثابت<input value={factor.label} disabled/></label>
          <label>وزن فاکتور<input type="number" min="0" max="1" step="0.01" value={factor.weight} onChange={(event) => change((next) => { next.factors[factorIndex].weight = Number(event.target.value); })}/></label>
          <span className="cpm-factor-lock"><LockKeyhole size={15}/></span>
        </div>
        <div className="cpm-factor-meta">
          <label>تعریف<input value={factor.definition || ''} onChange={(event) => change((next) => { next.factors[factorIndex].definition = event.target.value; })}/></label>
          <label>دلیل انتخاب<input value={factor.reason || ''} onChange={(event) => change((next) => { next.factors[factorIndex].reason = event.target.value; })}/></label>
          <label>دفاع از وزن<input value={factor.weightRationale || ''} onChange={(event) => change((next) => { next.factors[factorIndex].weightRationale = event.target.value; })}/></label>
          <label>اطمینان<select value={factor.confidence || 'medium'} onChange={(event) => change((next) => { next.factors[factorIndex].confidence = event.target.value; })}><option value="high">بالا</option><option value="medium">متوسط</option><option value="low">پایین</option></select></label>
        </div>
        {!!factor.evidence?.length && <div className="cpm-evidence">{factor.evidence.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div>}
        {factor.id === 'industry_specific' && <IndustryFactorCase factor={factor} factorIndex={factorIndex} change={change}/>} 
        <div className="cpm-level-head"><WeightSummary items={factor.dependentVariables} label="وزن متغیرهای وابسته"/><button onClick={() => change((next) => equalize(next.factors[factorIndex].dependentVariables))}>توزیع مساوی</button><button onClick={() => change((next) => { next.factors[factorIndex].dependentVariables.push({ id: id('dependent'), label: 'متغیر وابسته جدید', weight: 0, reason: '', independentVariables: [{ id: id('criterion'), label: 'متغیر مستقل جدید', definition: '', weight: 1, reason: '', evidenceSource: 'operator', scoring: { type: 'range', min: 0, max: 3, normalization: 'min-max', rubricLevels: [] } }] }); })}><Plus size={13}/> متغیر وابسته</button></div>

        {factor.dependentVariables.map((dependent, dependentIndex) => <article className="cpm-dependent-editor" key={dependent.id}>
          <div className="cpm-editor-row">
            <input value={dependent.label} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].label = event.target.value; })}/>
            <input className="cpm-reason" placeholder="دلیل انتخاب" value={dependent.reason || ''} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].reason = event.target.value; })}/>
            <label>وزن<input type="number" min="0" max="1" step="0.01" value={dependent.weight} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].weight = Number(event.target.value); })}/></label>
            <button title="حذف متغیر وابسته" onClick={() => change((next) => { next.factors[factorIndex].dependentVariables.splice(dependentIndex, 1); })}><Trash2 size={14}/></button>
          </div>
          <div className="cpm-level-head"><WeightSummary items={dependent.independentVariables} label="وزن متغیرهای مستقل"/><button onClick={() => change((next) => equalize(next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables))}>توزیع مساوی</button><button onClick={() => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables.push({ id: id('criterion'), label: 'متغیر مستقل جدید', definition: '', weight: 0, reason: '', evidenceSource: 'operator', scoring: { type: 'range', min: 0, max: 3, normalization: 'min-max', rubricLevels: [] } }); })}><Plus size={13}/> متغیر مستقل</button></div>
          <div className="cpm-criteria">
            {dependent.independentVariables.map((criterion, criterionIndex) => <div className="cpm-criterion-editor" key={criterion.id}>
              <div className="cpm-editor-row"><input value={criterion.label} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables[criterionIndex].label = event.target.value; })}/><label>وزن<input type="number" min="0" max="1" step="0.01" value={criterion.weight} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables[criterionIndex].weight = Number(event.target.value); })}/></label><button title="حذف متغیر مستقل" onClick={() => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables.splice(criterionIndex, 1); })}><Trash2 size={13}/></button></div>
              <input placeholder="تعریف معیار" value={criterion.definition || ''} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables[criterionIndex].definition = event.target.value; })}/>
              <input placeholder="دلیل و مبنای انتخاب" value={criterion.reason || ''} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables[criterionIndex].reason = event.target.value; })}/>
              <div className="cpm-scoring"><label>نوع<select value={criterion.scoring.type} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables[criterionIndex].scoring.type = event.target.value; })}><option value="binary">صفر و یک</option><option value="range">بازه</option><option value="count">تعداد</option><option value="percentage">درصد</option><option value="rubric">روبرک</option></select></label><label>حداقل<input type="number" value={criterion.scoring.min} disabled={criterion.scoring.type === 'binary'} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables[criterionIndex].scoring.min = Number(event.target.value); })}/></label><label>حداکثر<input type="number" value={criterion.scoring.max} disabled={criterion.scoring.type === 'binary'} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables[criterionIndex].scoring.max = Number(event.target.value); })}/></label><label>نرمال‌سازی<select value={criterion.scoring.normalization || 'min-max'} onChange={(event) => change((next) => { next.factors[factorIndex].dependentVariables[dependentIndex].independentVariables[criterionIndex].scoring.normalization = event.target.value; })}><option value="min-max">Min-Max</option><option value="ratio">Ratio</option></select></label></div>
              <small>منبع پیشنهادی: {criterion.evidenceSource || 'تعریف نشده'}</small>
            </div>)}
          </div>
        </article>)}
      </section>)}
    </main>

    <footer className="cpm-approval-actions">
      <div>{error && <p>{error}</p>}<small>تأیید، مدل را قفل می‌کند و امتیازدهی همه برندها با همین نسخه آغاز می‌شود.</small></div>
      <button className="secondary" onClick={onCancel}>بازگشت بدون اعمال</button>
      <button className="primary" onClick={submit}><CheckCircle2 size={17}/> تأیید، قفل و ادامه تحلیل</button>
    </footer>
  </div>;
}

function CandidatePool({ model, onDecision, onUpdate }) {
  const factors = model.factors || [];
  const candidates = model.factorCandidatePool || [];
  const pending = candidates.filter((candidate) => candidate.status === 'review').length;
  return <section className="cpm-approval-panel cpm-candidate-pool">
    <header><span>CANDIDATE POOL · OPERATOR DECISION</span><h2>عوامل بررسی‌شده در تصمیم مشتری</h2><p>هر عامل باید تأیید و در یکی از چهار فاکتور قرار گیرد یا با دلیل رد شود. عوامل موجود در مدل با مسیرشان مشخص شده‌اند.</p><strong className={pending ? 'cpm-error' : 'cpm-ok'}>{pending ? `${pending} عامل نیازمند تصمیم` : 'تکلیف همه عوامل مشخص است ✓'}</strong></header>
    <div className="cpm-candidate-grid">{candidates.map((candidate, index) => <article key={`${candidate.id}-${index}`} className={`candidate-${candidate.status}`}>
      <div className="cpm-candidate-title"><div><b>{candidate.label}</b><small>{candidate.alreadyIncluded ? 'از قبل در مدل قرار دارد' : candidate.recommendation === 'exclude' ? 'پیشنهاد AI: رد' : 'پیشنهاد AI: افزودن'}</small></div><span>{candidate.status === 'included' ? 'تأییدشده' : candidate.status === 'excluded' ? 'ردشده' : 'در انتظار'}</span></div>
      <p><strong>اثر بر تصمیم:</strong> {candidate.customerDecisionImpact || 'توضیح داده نشده'}</p>
      <p><strong>سیگنال مشتری:</strong> {candidate.customerSignal || 'توضیح داده نشده'}</p>
      <p><strong>منطق طبقه‌بندی:</strong> {candidate.classificationReason || '—'}</p>
      {candidate.overlapRisk && <p className="cpm-overlap"><strong>ریسک هم‌پوشانی:</strong> {candidate.overlapRisk}</p>}
      {!!candidate.evidence?.length && <div className="cpm-evidence">{candidate.evidence.map((item, evidenceIndex) => <span key={evidenceIndex}>{item}</span>)}</div>}
      {candidate.existingPath && <p className="cpm-existing-path">مسیر: {candidate.existingPath}</p>}
      {!candidate.alreadyIncluded && <input className="cpm-candidate-note" placeholder="یادداشت یا دلیل تصمیم اپراتور" value={candidate.operatorDecisionReason || ''} onChange={(event) => onUpdate(index, 'operatorDecisionReason', event.target.value)}/>} 
      {!candidate.alreadyIncluded && <div className="cpm-candidate-actions">
        <select value={candidate.selectedFactorId} onChange={(event) => candidate.status === 'included' ? onDecision(index, 'included', event.target.value) : onDecision(index, 'review', event.target.value)}>{factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.label}</option>)}</select>
        <button className="candidate-include" onClick={() => onDecision(index, 'included', candidate.selectedFactorId)}>افزودن به مدل</button>
        <button className="candidate-exclude" onClick={() => onDecision(index, 'excluded', candidate.selectedFactorId)}>رد عامل</button>
      </div>}
    </article>)}</div>
  </section>;
}

function IndustryFactorCase({ factor, factorIndex, change }) {
  const detail = factor.industryFactorCase || {};
  const update = (key, value) => change((next) => {
    const target = next.factors[factorIndex];
    target.industryFactorCase = { ...(target.industryFactorCase || {}), [key]: value };
  });
  return <section className="cpm-industry-case">
    <header><span>INDUSTRY-SPECIFIC JUSTIFICATION</span><h3>پرونده توجیه عوامل ویژه این صنعت</h3><p>این عوامل باید در تصمیم مشتری مؤثر باشند و در سوشال، وب‌سایت یا محصول/خدمت قرار نگیرند.</p></header>
    <div className="cpm-case-fields">
      <label>نقش در تصمیم مشتری<textarea value={detail.customerDecisionRole || ''} onChange={(event) => update('customerDecisionRole', event.target.value)}/></label>
      <label>مرز این فاکتور با سه فاکتور قبلی<textarea value={detail.boundaryDefinition || ''} onChange={(event) => update('boundaryDefinition', event.target.value)}/></label>
    </div>
    <div className="cpm-case-grid">
      <CaseList title="شواهد و سیگنال‌های صنعت" items={detail.industrySignals} render={(item) => <><b>{item.observation}</b><small>{item.source}</small><p>{item.implication}</p></>}/>
      <CaseList title="سؤال‌های واقعی مشتری" items={detail.customerQuestions} render={(item) => <p>— {item}</p>}/>
      <CaseList title="گزینه‌های بررسی‌شده و ردشده" items={detail.excludedCandidates} render={(item) => <><b>{item.name}</b><p>{item.reason}</p></>}/>
      <CaseList title="کنترل عدم هم‌پوشانی" items={detail.overlapCheck} render={(item) => <p>✓ {item}</p>}/>
      <CaseList title="کمبود داده و ریسک استنباط" items={detail.dataGaps} render={(item) => <p>! {item}</p>}/>
    </div>
  </section>;
}

function CaseList({ title, items = [], render }) {
  return <article><h4>{title}</h4>{items.length ? items.map((item, index) => <div key={index}>{render(item)}</div>) : <p className="cpm-empty-case">توسط AI ارائه نشده است.</p>}</article>;
}
