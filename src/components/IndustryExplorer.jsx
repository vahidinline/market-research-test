import { useState } from 'react';
import { BrainCircuit, Check, ChevronDown, Loader2, Map, RefreshCw, Users } from 'lucide-react';
import { discoverIndustry } from '../utils/industry';

export default function IndustryExplorer({ target, apiToken, provider, aiConfig, selected, onChange }) {
  const [map, setMap] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true); setError('');
    try { setMap(await discoverIndustry({ apiToken, target, provider, aiConfig, onProgress: setMessage })); }
    catch (err) { setError(err.message || 'کشف صنعت ناموفق بود.'); }
    finally { setBusy(false); }
  };
  const toggle = (business) => {
    const key = `${business.name}|${business.website}|${business.instagramHandle}`;
    const exists = selected.some((item) => item._discoveryKey === key);
    onChange(exists ? selected.filter((item) => item._discoveryKey !== key) : [...selected, { ...business, _discoveryKey: key }]);
  };
  return <section className="industry-explorer">
    <div className="industry-explorer-head"><div className="industry-icon"><BrainCircuit size={20}/></div><div><span className="industry-kicker">INDUSTRY INTELLIGENCE / 01</span><h2>قبل از انتخاب رقبا، نقشه صنعت را ببینید</h2><p>با نام صنعت، سایت و اینستاگرام کسب‌وکار هدف، بخش‌های بازار و بازیگران هر بخش را کشف کنید.</p></div><button type="button" className="discover-button" disabled={busy || !target.industry.trim()} onClick={run}>{busy ? <Loader2 className="spin" size={17}/> : map ? <RefreshCw size={17}/> : <Map size={17}/>} {busy ? 'در حال کشف...' : map ? 'به‌روزرسانی نقشه' : 'کشف صنعت'}</button></div>
    {busy && <div className="industry-progress"><Loader2 className="spin" size={16}/>{message}</div>}
    {error && <div className="industry-error">{error}</div>}
    {map && <><div className="industry-intro"><div className="intro-label">BRIEFING NOTE</div><p>{map.intro}</p><span>{map.totalBusinesses} بازیگر عمومی · {map.categories.length} دسته اولیه</span></div><div className="industry-categories">{map.categories.map((category) => <article className="industry-category" key={category.id}><header><div><span className="category-count">{category.businesses.length} بازیگر</span><h3>{category.name}</h3></div><ChevronDown size={16}/></header><p>{category.description}</p><div className="discovered-list">{category.businesses.map((business) => { const key = `${business.name}|${business.website}|${business.instagramHandle}`; const checked = selected.some((item) => item._discoveryKey === key); return <button type="button" className={`discovered-business ${checked ? 'selected' : ''}`} key={key} onClick={() => toggle(business)}><span className="business-check">{checked ? <Check size={13}/> : <Users size={13}/>}</span><span><b>{business.name}</b><small>{business.category || business.location || 'بازیگر کشف‌شده'} {business.rating ? ` · ${business.rating.toFixed(1)} ★` : ''}</small></span></button>; })}</div></article>)}</div><div className="selection-note">{selected.length ? `${selected.length} رقیب از نقشه صنعت انتخاب شده است.` : 'از هر دسته رقیب‌های مناسب را انتخاب کنید؛ سپس در بخش زیر جزئیات آن‌ها را تکمیل کنید.'}</div></>}
  </section>;
}
