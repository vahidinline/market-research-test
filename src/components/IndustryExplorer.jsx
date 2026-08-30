import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, Check, ChevronDown, FilePenLine, Loader2, Map, RefreshCw, RotateCcw, Users, Target, Lightbulb, AlertTriangle, X } from 'lucide-react';
import { discoverIndustry, prepareIndustryReview } from '../utils/industry';
import { useLanguage } from '../i18n.jsx';

const SOCIAL_FRAMEWORK = {
  instagram: { label: 'اینستاگرام', dimensions: ['کیفیت محتوای بصری', 'کیفیت محتوای نوشتاری', 'استانداردهای صفحه', 'استراتژی محتوا', 'عملکرد و اعتماد'] },
  linkedin: { label: 'لینکدین', dimensions: ['کیفیت محتوای تخصصی', 'استانداردهای صفحه', 'رهبری فکری و استراتژی', 'تعامل و لیدسازی', 'اعتبار حرفه‌ای'] },
  twitter: { label: 'توییتر / X', dimensions: ['کیفیت پیام و Thread', 'استانداردهای پروفایل', 'سرعت و استراتژی گفتگو', 'تعامل و دیده‌شدن', 'اعتبار و دقت'] },
  youtube: { label: 'یوتیوب', dimensions: ['کیفیت ویدئو', 'عنوان و توضیحات', 'استانداردهای کانال', 'بازدید و تعامل', 'اعتبار و تخصص'] },
  reddit: { label: 'ردیت', dimensions: ['کیفیت بحث و پاسخ', 'تناسب Subreddit', 'تکرار دغدغه‌ها', 'رأی و مشارکت', 'اعتبار مشارکت‌کنندگان'] },
  telegram: { label: 'تلگرام', dimensions: ['کیفیت چندرسانه‌ای', 'کیفیت متن', 'استانداردهای کانال', 'بازدید و جامعه‌سازی', 'اعتماد و پاسخ‌گویی'] },
};
const defaultSocialWeights = Object.fromEntries(Object.entries(SOCIAL_FRAMEWORK).map(([id, channel]) => [id, { channelWeight: 1 / Object.keys(SOCIAL_FRAMEWORK).length, dimensions: Object.fromEntries(channel.dimensions.map((_, index) => [`d${index}`, 0.2])) }]));
function SocialFramework({ weights, onChange }) { const update = (channel, key, value) => onChange((current) => ({ ...current, [channel]: { ...current[channel], [key]: Number(value) } })); const updateDimension = (channel, index, value) => onChange((current) => ({ ...current, [channel]: { ...current[channel], dimensions: { ...current[channel].dimensions, [`d${index}`]: Number(value) } } })); return <article className="industry-social-framework"><div className="intro-label">SOCIAL FACTOR / WEIGHTED VARIABLES</div><h3>متغیرهای ارزیابی Social</h3><p>کانال‌ها و وزن معیارها را پیش از ساخت مدل CPM تعیین کنید. مجموع وزن هر بخش باید ۱۰۰٪ باشد.</p><div className="social-framework-grid">{Object.entries(SOCIAL_FRAMEWORK).map(([id, channel]) => <section key={id}><header><b>{channel.label}</b><label>وزن کانال<input type="number" min="0" max="1" step="0.01" value={weights[id]?.channelWeight ?? 0} onChange={(event) => update(id, 'channelWeight', event.target.value)} /></label></header>{channel.dimensions.map((dimension, index) => <label key={dimension}><span>{dimension}</span><input type="number" min="0" max="1" step="0.05" value={weights[id]?.dimensions?.[`d${index}`] ?? 0} onChange={(event) => updateDimension(id, index, event.target.value)} /><small>{Math.round((weights[id]?.dimensions?.[`d${index}`] || 0) * 100)}٪</small></label>)}</section>)}</div></article>; }

export default function IndustryExplorer({ target, apiToken, provider, aiConfig, selected, onChange, onBriefing, onIntelligence, onCategory, hidden = false }) {
  const { t } = useLanguage();
  const [map, setMap] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewCount, setReviewCount] = useState('شواهد کسب‌وکار هدف، نه');
  const [suggestedCategory, setSuggestedCategory] = useState(target.category || '');
  const [categoryConfidence, setCategoryConfidence] = useState('low');
  const [categoryEvidence, setCategoryEvidence] = useState([]);
  const [scopeNotice, setScopeNotice] = useState('');
  const [socialWeights, setSocialWeights] = useState(() => target.industryIntelligence?.socialFramework?.weights || defaultSocialWeights);
  const currentScope = `${target.location || ''}|${target.audienceLanguage || 'fa'}|${target.marketResearchMode || 'hybrid'}`;
  const previousScope = useRef(currentScope);

  useEffect(() => {
    if (previousScope.current === currentScope) return;
    previousScope.current = currentScope;
    setScopeNotice('حوزهٔ جغرافیایی یا دامنهٔ بازار تغییر کرد. برای اعمال آن در داده‌های خام، «به‌روزرسانی نقشه» را بزنید.');
  }, [currentScope]);

  const createReview = async (forceRefresh = false) => {
    setBusy(true); setError(''); setScopeNotice('');
    try {
      const review = await prepareIndustryReview({ apiToken, target, provider, aiConfig, forceRefresh, onProgress: setMessage });
      setReviewText(review.briefing);
      setReviewCount('شواهد کسب‌وکار هدف، نه');
      setSuggestedCategory(review.category || target.category || '');
      setCategoryConfidence(review.categoryConfidence || 'low');
      setCategoryEvidence(review.categoryEvidence || []);
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
      const focusedTarget = { ...target, category: suggestedCategory.trim() };
      onCategory?.(focusedTarget.category);
      const nextMap = await discoverIndustry({ apiToken, target: focusedTarget, provider, aiConfig, reviewBriefing: approved, onProgress: setMessage });
      setMap(nextMap); setReviewOpen(false); onBriefing?.(nextMap.intro); onIntelligence?.({ ...nextMap, socialFramework: { weights: socialWeights, channels: SOCIAL_FRAMEWORK } });
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
    <div className="industry-explorer-head"><div className="industry-icon"><BrainCircuit size={20}/></div><div><span className="industry-kicker">INDUSTRY INTELLIGENCE / 01</span><h2>{t.industry.title}</h2><p>{t.industry.description}</p></div><button type="button" className="discover-button" disabled={busy || !target.industry.trim()} onClick={() => createReview(Boolean(map))}>{busy ? <Loader2 className="spin" size={17}/> : map ? <RefreshCw size={17}/> : <Map size={17}/>} {busy ? t.industry.discovering : map ? t.industry.update : t.form.discover}</button></div>
    <div className="mt-4 flex flex-wrap gap-2 text-[11px]"><span className="border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">محدوده: {target.location || 'تعیین نشده'}</span><span className="border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-cyan-200">زبان مخاطب: {{fa:'فارسی‌زبانان سراسر دنیا',en:'انگلیسی‌زبانان سراسر دنیا',ar:'عربی‌زبانان سراسر دنیا',tr:'ترکی‌زبانان سراسر دنیا',de:'آلمانی‌زبانان سراسر دنیا',fr:'فرانسوی‌زبانان سراسر دنیا',multi:'چندزبانه / بین‌المللی',any:'بدون محدودیت'}[target.audienceLanguage] || 'فارسی‌زبانان سراسر دنیا'}</span><span className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">بازار: {{online:'آنلاین',offline:'آفلاین',hybrid:'ترکیبی'}[target.marketResearchMode] || 'ترکیبی'}</span></div>
    {busy && <div className="industry-progress"><Loader2 className="spin" size={16}/>{message}</div>}
    {scopeNotice && <div className="industry-scope-notice">{scopeNotice}</div>}
    {error && <div className="industry-error">{error}</div>}
    {map?.intelligenceStatus === 'failed' && <div className="industry-error"><b>تحلیل صنعت اجرا نشد:</b><span>{map.intelligenceError}</span><small>داده خام بدون تحلیل نمایش داده نمی‌شود تا زیرشاخه اشتباه ساخته نشود.</small></div>}
    {map && <><div className="industry-intro"><div className="intro-label">INDUSTRY DEFINITION / BRIEFING NOTE</div><p>{map.intro}</p>{map.industryDefinition&&<p className="industry-definition">{map.industryDefinition}</p>}<span>{map.totalBusinesses} بازیگر مرتبط · {map.subindustries?.length || map.categories.length} زیرشاخه تخصصی</span></div>{map.targetPlacement&&<article className="target-placement"><Target size={18}/><div><span>جایگاه کسب‌وکار هدف</span><h3>{map.targetPlacement.subindustry}</h3>{map.targetPlacement.businessModel&&<small>مدل کسب‌وکار: {map.targetPlacement.businessModel}</small>}<p>{map.targetPlacement.reason}</p></div></article>}{map.targetSubindustryBrief&&<article className="subindustry-brief"><div className="intro-label">DEEP DIVE / TARGET SUBINDUSTRY</div><h3>{map.targetSubindustryBrief.name}</h3><p>{map.targetSubindustryBrief.overview}</p><div className="industry-insight-grid"><div><h4><Lightbulb size={14}/> فرصت‌ها</h4>{(map.opportunities||[]).map((item) => <p key={item}>+ {item}</p>)}</div><div><h4><AlertTriangle size={14}/> تهدیدها</h4>{(map.threats||[]).map((item) => <p key={item}>− {item}</p>)}</div></div><div className="business-models"><h4>مدل‌های کسب‌وکار این زیرشاخه</h4>{(map.businessModels||[]).map((model) => <article key={model.name}><b>{model.name}</b><p>{model.description}</p><small>درآمد: {model.revenueModel}</small></article>)}</div></article>}{map.subindustries?.length>0&&<div className="industry-categories">{map.categories.map((category) => <article className="industry-category" key={category.id}><header><div><span className="category-count">{category.businesses.length} بازیگر مرتبط</span><h3>{category.name}</h3></div><ChevronDown size={16}/></header><p>{category.description}</p><div className="discovered-list">{category.businesses.map((business) => { const key = `${business.name}|${business.website}|${business.instagramHandle}`; const checked = selected.some((item) => item._discoveryKey === key); return <button type="button" className={`discovered-business ${checked ? 'selected' : ''}`} key={key} onClick={() => toggle(business)}><span className="business-check">{checked ? <Check size={13}/> : <Users size={13}/>}</span><span><b>{business.name}</b><small>{business.businessModel || business.location || 'بازیگر کشف‌شده'} {business.rating ? ` · ${business.rating.toFixed(1)} ★` : ''}</small></span></button>; })}</div></article>)}</div>}<div className="selection-note">{selected.length ? `${selected.length} رقیب از نقشه صنعت انتخاب شده است.` : 'از هر زیرشاخه رقیب‌های مناسب را انتخاب کنید؛ سپس در بخش زیر جزئیات آن‌ها را تکمیل کنید.'}</div></>}
    {reviewOpen && <div className="industry-review-backdrop" role="dialog" aria-modal="true" aria-labelledby="industry-review-title"><section className="industry-review-modal"><header><div><span>RAW DATA REVIEW / HUMAN GATE</span><h3 id="industry-review-title">دسته فعالیت و پیش‌تحلیل را تأیید کنید</h3></div><button type="button" aria-label="بستن" disabled={busy} onClick={rejectReview}><X size={18}/></button></header><div className="industry-review-meta"><FilePenLine size={17}/><span>مدل از {reviewCount} نتیجهٔ خام، دسته فعالیت را پیشنهاد داده است. پیش از ادامه می‌توانید دسته و متن را اصلاح کنید.</span></div><label className="review-category-label">دسته فعالیت پیشنهادی</label><input className="review-category-input" value={suggestedCategory} disabled={busy} onChange={(event) => setSuggestedCategory(event.target.value)} placeholder="دسته فعالیت از شواهد استخراج نشد" />{categoryEvidence.length > 0 && <small className="review-category-evidence">سطح اطمینان: {categoryConfidence} · شاهد: {categoryEvidence.join('، ')}</small>}{busy && <div className="industry-review-processing"><Loader2 className="spin" size={19}/><div><b>{message || 'تحلیل تأییدشده در حال اجراست…'}</b><small>مودال پس از آماده‌شدن نقشهٔ صنعت به‌صورت خودکار بسته می‌شود.</small></div></div>}<textarea value={reviewText} disabled={busy} onChange={(event) => setReviewText(event.target.value)} aria-label="پیش‌تحلیل صنعت" /><footer><button type="button" className="review-reject" disabled={busy} onClick={rejectReview}>رد</button><button type="button" className="review-regenerate" disabled={busy} onClick={() => createReview(false)}><RotateCcw size={15}/> بررسی مجدد</button><button type="button" className="review-approve" disabled={busy || !reviewText.trim() || !suggestedCategory.trim()} onClick={approveReview}>{busy ? <Loader2 className="spin" size={15}/> : <Check size={15}/>} {busy ? 'در حال تحلیل…' : 'تأیید و شروع تحلیل'}</button></footer></section></div>}
  </section>;
}
