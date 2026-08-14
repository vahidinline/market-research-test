import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, Check, ChevronDown, FilePenLine, Loader2, Map, RefreshCw, RotateCcw, Users, Target, Lightbulb, AlertTriangle, X } from 'lucide-react';
import { discoverIndustry, prepareIndustryReview } from '../utils/industry';

export default function IndustryExplorer({ target, apiToken, provider, aiConfig, selected, onChange, onBriefing, onIntelligence, hidden = false }) {
  const [map, setMap] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewCount, setReviewCount] = useState(0);
  const [scopeNotice, setScopeNotice] = useState('');
  const previousScope = useRef(target.marketResearchMode || 'hybrid');

  useEffect(() => {
    const nextScope = target.marketResearchMode || 'hybrid';
    if (previousScope.current === nextScope) return;
    previousScope.current = nextScope;
    setScopeNotice('دامنهٔ بررسی بازار تغییر کرد. برای اعمال آن در داده‌های خام، «به‌روزرسانی نقشه» را بزنید.');
  }, [target.marketResearchMode]);

  const createReview = async (forceRefresh = false) => {
    setBusy(true); setError(''); setScopeNotice('');
    try {
      const review = await prepareIndustryReview({ apiToken, target, provider, aiConfig, forceRefresh, onProgress: setMessage });
      setReviewText(review.briefing);
      setReviewCount(review.totalBusinesses);
      setReviewOpen(true);
    }
    catch (err) { setError(err.message || 'کشف صنعت ناموفق بود.'); }
    finally { setBusy(false); }
  };
  const approveReview = async () => {
    const approved = reviewText.trim();
    if (!approved) { setError('برای ادامه، پیش‌تحلیل را بنویسید یا یک‌بار دیگر تولید کنید.'); return; }
    setBusy(true); setError('');
    try {
      const nextMap = await discoverIndustry({ apiToken, target, provider, aiConfig, reviewBriefing: approved, onProgress: setMessage });
      setMap(nextMap); setReviewOpen(false); onBriefing?.(nextMap.intro); onIntelligence?.(nextMap);
    } catch (err) { setError(err.message || 'تحلیل صنعت ناموفق بود.'); }
    finally { setBusy(false); }
  };
  const rejectReview = () => { setReviewOpen(false); setReviewText(''); setMessage('پیش‌تحلیل رد شد؛ تحلیل صنعت اجرا نشد.'); };
  const toggle = (business) => {
    const key = `${business.name}|${business.website}|${business.instagramHandle}`;
    const exists = selected.some((item) => item._discoveryKey === key);
    onChange(exists ? selected.filter((item) => item._discoveryKey !== key) : [...selected, { ...business, _discoveryKey: key }]);
  };
  return <section className={`industry-explorer ${hidden ? 'industry-explorer-hidden' : ''}`}>
    <div className="industry-explorer-head"><div className="industry-icon"><BrainCircuit size={20}/></div><div><span className="industry-kicker">INDUSTRY INTELLIGENCE / 01</span><h2>قبل از انتخاب رقبا، نقشه صنعت را ببینید</h2><p>با نام صنعت، سایت و اینستاگرام کسب‌وکار هدف، بخش‌های بازار و بازیگران هر بخش را کشف کنید.</p></div><button type="button" className="discover-button" disabled={busy || !target.industry.trim()} onClick={() => createReview(Boolean(map))}>{busy ? <Loader2 className="spin" size={17}/> : map ? <RefreshCw size={17}/> : <Map size={17}/>} {busy ? 'در حال کشف...' : map ? 'به‌روزرسانی نقشه' : 'کشف صنعت'}</button></div>
    {busy && <div className="industry-progress"><Loader2 className="spin" size={16}/>{message}</div>}
    {scopeNotice && <div className="industry-scope-notice">{scopeNotice}</div>}
    {error && <div className="industry-error">{error}</div>}
    {map?.intelligenceStatus === 'failed' && <div className="industry-error"><b>تحلیل صنعت اجرا نشد:</b><span>{map.intelligenceError}</span><small>داده خام بدون تحلیل نمایش داده نمی‌شود تا زیرشاخه اشتباه ساخته نشود.</small></div>}
    {map && <><div className="industry-intro"><div className="intro-label">INDUSTRY DEFINITION / BRIEFING NOTE</div><p>{map.intro}</p>{map.industryDefinition&&<p className="industry-definition">{map.industryDefinition}</p>}<span>{map.totalBusinesses} بازیگر مرتبط · {map.subindustries?.length || map.categories.length} زیرشاخه تخصصی</span></div>{map.targetPlacement&&<article className="target-placement"><Target size={18}/><div><span>جایگاه کسب‌وکار هدف</span><h3>{map.targetPlacement.subindustry}</h3>{map.targetPlacement.businessModel&&<small>مدل کسب‌وکار: {map.targetPlacement.businessModel}</small>}<p>{map.targetPlacement.reason}</p></div></article>}{map.targetSubindustryBrief&&<article className="subindustry-brief"><div className="intro-label">DEEP DIVE / TARGET SUBINDUSTRY</div><h3>{map.targetSubindustryBrief.name}</h3><p>{map.targetSubindustryBrief.overview}</p><div className="industry-insight-grid"><div><h4><Lightbulb size={14}/> فرصت‌ها</h4>{(map.opportunities||[]).map((item) => <p key={item}>+ {item}</p>)}</div><div><h4><AlertTriangle size={14}/> تهدیدها</h4>{(map.threats||[]).map((item) => <p key={item}>− {item}</p>)}</div></div><div className="business-models"><h4>مدل‌های کسب‌وکار این زیرشاخه</h4>{(map.businessModels||[]).map((model) => <article key={model.name}><b>{model.name}</b><p>{model.description}</p><small>درآمد: {model.revenueModel}</small></article>)}</div></article>}{map.subindustries?.length>0&&<div className="industry-categories">{map.categories.map((category) => <article className="industry-category" key={category.id}><header><div><span className="category-count">{category.businesses.length} بازیگر مرتبط</span><h3>{category.name}</h3></div><ChevronDown size={16}/></header><p>{category.description}</p><div className="discovered-list">{category.businesses.map((business) => { const key = `${business.name}|${business.website}|${business.instagramHandle}`; const checked = selected.some((item) => item._discoveryKey === key); return <button type="button" className={`discovered-business ${checked ? 'selected' : ''}`} key={key} onClick={() => toggle(business)}><span className="business-check">{checked ? <Check size={13}/> : <Users size={13}/>}</span><span><b>{business.name}</b><small>{business.businessModel || business.location || 'بازیگر کشف‌شده'} {business.rating ? ` · ${business.rating.toFixed(1)} ★` : ''}</small></span></button>; })}</div></article>)}</div>}<div className="selection-note">{selected.length ? `${selected.length} رقیب از نقشه صنعت انتخاب شده است.` : 'از هر زیرشاخه رقیب‌های مناسب را انتخاب کنید؛ سپس در بخش زیر جزئیات آن‌ها را تکمیل کنید.'}</div></>}
    {reviewOpen && <div className="industry-review-backdrop" role="dialog" aria-modal="true" aria-labelledby="industry-review-title"><section className="industry-review-modal"><header><div><span>RAW DATA REVIEW / HUMAN GATE</span><h3 id="industry-review-title">پیش‌تحلیل صنعت را تأیید کنید</h3></div><button type="button" aria-label="بستن" disabled={busy} onClick={rejectReview}><X size={18}/></button></header><div className="industry-review-meta"><FilePenLine size={17}/><span>این متن از {reviewCount} نتیجهٔ خام ساخته شده است. آن را اصلاح کنید؛ متن تأییدشده مستقیماً به تحلیل هوش مصنوعی داده می‌شود.</span></div>{busy && <div className="industry-review-processing"><Loader2 className="spin" size={19}/><div><b>{message || 'تحلیل تأییدشده در حال اجراست…'}</b><small>مودال پس از آماده‌شدن نقشهٔ صنعت به‌صورت خودکار بسته می‌شود.</small></div></div>}<textarea value={reviewText} disabled={busy} onChange={(event) => setReviewText(event.target.value)} aria-label="پیش‌تحلیل صنعت" /><footer><button type="button" className="review-reject" disabled={busy} onClick={rejectReview}>رد</button><button type="button" className="review-regenerate" disabled={busy} onClick={() => createReview(false)}><RotateCcw size={15}/> بررسی مجدد</button><button type="button" className="review-approve" disabled={busy || !reviewText.trim()} onClick={approveReview}>{busy ? <Loader2 className="spin" size={15}/> : <Check size={15}/>} {busy ? 'در حال تحلیل…' : 'تأیید و شروع تحلیل'}</button></footer></section></div>}
  </section>;
}
