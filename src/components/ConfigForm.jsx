import { useEffect, useState } from 'react';
import {
  Settings,
  Building2,
  AtSign,
  Globe,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { deleteProject, listProjects } from '../utils/projects';
import IndustryExplorer from './IndustryExplorer';

const APIFY_TOKEN = import.meta.env.VITE_APIFY_API_KEY || '';

const defaultCompetitor = () => ({
  name: '',
  instagramHandle: '',
  website: '',
  linkedin: '',
  tiktok: '',
  pinterest: '',
});

const STORAGE_KEY = 'market_research_form';

export default function ConfigForm({ onSubmit, loading, onLoadProject }) {
  const loadSaved = () => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  };

  const saved = loadSaved();

  const [target, setTarget] = useState(
    saved?.target || {
      name: '',
      industry: '',
      instagramHandle: '',
      website: '',
      linkedin: '',
      tiktok: '',
      pinterest: '',
    },
  );
  const [competitors, setCompetitors] = useState(
    saved?.competitors || [defaultCompetitor(), defaultCompetitor()],
  );
  const [discoveredCompetitors, setDiscoveredCompetitors] = useState([]);
  const [industryBriefing, setIndustryBriefing] = useState('');
  const [projects, setProjects] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [provider, setProvider] = useState(saved?.settings?.provider || 'gemini');
  const [routerModel, setRouterModel] = useState(saved?.settings?.routerModel === 'auto' ? '' : saved?.settings?.routerModel || '');
  const [routerModels, setRouterModels] = useState([]);
  const [routerModelsError, setRouterModelsError] = useState('');
  const [routerModelsLoading, setRouterModelsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const persistForm = (nextTarget = target, nextCompetitors = competitors, nextProvider = provider, nextRouterModel = routerModel) => {
    try {
      const cleanCompetitors = nextCompetitors.map(({ _discoveryKey, ...competitor }) => competitor);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        target: nextTarget,
        competitors: cleanCompetitors,
        settings: { provider: nextProvider, routerModel: nextRouterModel },
      }));
    } catch {
      // Ignore browser storage quota/privacy errors.
    }
  };
  useEffect(() => {
    persistForm();
  }, [target, competitors, provider, routerModel]);
  useEffect(() => {
    const refresh = () => listProjects().then(setProjects);
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    if (provider !== '9router') return;
    let active = true;
    setRouterModelsLoading(true); setRouterModelsError('');
    fetch('/api/ai?action=models', { cache: 'no-store' })
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`); return body.models || []; })
      .then((models) => {
        if (!active) return;
        const normalized = models.map((item) => typeof item === 'string' ? { id: item } : item).filter((item) => item.id);
        setRouterModels(normalized);
        setRouterModel((current) => current && normalized.some((item) => item.id === current) ? current : '');
      })
      .catch((error) => { if (active) setRouterModelsError(error.message || 'دریافت مدل‌ها ناموفق بود.'); })
      .finally(() => { if (active) setRouterModelsLoading(false); });
    return () => { active = false; };
  }, [provider]);
  const removeSavedProject = async (id) => {
    await deleteProject(id);
    setProjects((items) => items.filter((project) => project.id !== id));
    setPendingDelete(null);
  };

  const addCompetitor = () => {
    if (competitors.length < 10)
      setCompetitors([...competitors, defaultCompetitor()]);
  };

  const removeCompetitor = (i) => {
    if (competitors.length > 1)
      setCompetitors(competitors.filter((_, idx) => idx !== i));
  };

  const updateCompetitor = (i, field, value) =>
    setCompetitors(
      competitors.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    );

  const handleSubmit = (e) => {
    e.preventDefault();
    persistForm();
    onSubmit({
      apifyToken: APIFY_TOKEN,
      provider,
      aiConfig: provider === 'gemini'
        ? { apiKey: import.meta.env.VITE_GEMINI_API_KEY || '', model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash' }
        : { model: routerModel.trim() },
      target: { ...target, industryBriefing }, competitors: competitors.map(({ _discoveryKey, ...competitor }) => competitor), useMockData: false,
    });
  };

  const handleDemo = () => {
    onSubmit({ apifyToken: APIFY_TOKEN, provider, aiConfig: {}, target, competitors, useMockData: true });
  };

  const isValid =
    target.name.trim() &&
    target.industry.trim() &&
    competitors.every((c) => c.name.trim()) &&
    (provider !== '9router' || Boolean(routerModel.trim()));

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8"
      dir="rtl">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <div className="inline-flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl px-6 py-3 mb-4">
          <Sparkles className="text-blue-400" size={20} />
          <span className="text-blue-300 font-medium text-sm">نسخه 0.0.2</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
          گزارش‌ساز تحقیق بازار
        </h1>
          <p className="text-slate-400 text-lg">
          داشبورد جامع تحلیل بازار و کانال‌های دیجیتال
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        <section className="projects-panel">
          <div className="projects-panel-head"><div><span>RESEARCH ARCHIVE</span><h2>پروژه‌های ذخیره‌شده</h2></div><strong>{projects.length}</strong></div>
          {projects.length ? <div className="projects-list">{projects.map((p)=><article className="project-item" key={p.id}><button type="button" className="project-open" onClick={()=>onLoadProject(p.id)}><span className="project-mark">{(p.name||'پ').slice(0,1)}</span><span><b>{p.name}</b><small>{p.industry||'بدون دسته‌بندی'} · {p.updated_at ? new Date(p.updated_at).toLocaleDateString('fa-IR') : 'تاریخ نامشخص'}</small></span></button>{pendingDelete===p.id?<div className="project-confirm"><span>حذف شود؟</span><button type="button" onClick={()=>removeSavedProject(p.id)}>بله، حذف</button><button type="button" onClick={()=>setPendingDelete(null)}>انصراف</button></div>:<button type="button" className="project-delete" onClick={()=>setPendingDelete(p.id)} aria-label={`حذف ${p.name}`}><Trash2 size={16}/></button>}</article>)}</div>:<div className="projects-empty">هنوز گزارشی ذخیره نشده است. اولین گزارش پس از تولید اینجا نمایش داده می‌شود.</div>}
        </section>
        <IndustryExplorer hidden target={target} apiToken={APIFY_TOKEN} provider={provider} aiConfig={provider === 'gemini'
          ? { apiKey: import.meta.env.VITE_GEMINI_API_KEY || '', model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash' }
          : { model: routerModel.trim() }} selected={discoveredCompetitors} onChange={(items) => {
          setDiscoveredCompetitors(items);
          setCompetitors(items.length ? items.map((item) => ({ ...defaultCompetitor(), ...item })) : competitors);
        }} />
        <section className="settings-inline-hidden bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg"><Settings size={18} className="text-violet-400" /></div>
            <div><span className="text-white font-semibold">تنظیمات مدل تحلیل</span><p className="text-slate-400 text-xs mt-1">انتخاب برای گزارش بعدی ذخیره می‌شود.</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={()=>setProvider('gemini')} className={`rounded-xl border px-4 py-3 text-sm transition-colors ${provider==='gemini'?'border-blue-500 bg-blue-500/15 text-blue-200':'border-slate-600 bg-slate-900/40 text-slate-400'}`}>Google Gemini</button>
            <button type="button" onClick={()=>setProvider('9router')} className={`rounded-xl border px-4 py-3 text-sm transition-colors ${provider==='9router'?'border-violet-500 bg-violet-500/15 text-violet-200':'border-slate-600 bg-slate-900/40 text-slate-400'}`}>9Router</button>
          </div>
          {provider==='9router'&&<div><label className="block text-slate-300 text-sm font-medium mb-2">مدل یا Combo فعال 9Router</label>{routerModelsLoading?<div className="w-full bg-slate-900/60 border border-slate-600 text-slate-400 rounded-xl px-4 py-3 text-sm">در حال دریافت فهرست مدل‌ها…</div>:routerModels.length?<select value={routerModel} onChange={(event)=>setRouterModel(event.target.value)} className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm" dir="ltr"><option value="">مدل یا Combo را انتخاب کنید</option>{routerModels.map((item)=><option key={item.id} value={item.id}>{item.id}{item.owned_by?` · ${item.owned_by}`:''}</option>)}</select>:<input value={routerModel} onChange={(event)=>setRouterModel(event.target.value)} placeholder="مثال: kr/claude-sonnet-4.5 یا نام Combo" className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm" dir="ltr"/>}{routerModelsError&&<p className="text-red-400 text-xs mt-2">{routerModelsError}</p>}<p className="text-slate-500 text-xs mt-2">فقط مدلی را انتخاب کنید که Provider آن در Dashboard خود 9Router متصل است؛ انتخاب مدل `openai/...` بدون credential فعال همین خطا را ایجاد می‌کند.</p><p className="text-slate-500 text-xs mt-1" dir="ltr">Endpoint: https://router.vahidafshari.com/v1</p></div>}
        </section>
        <button type="button" className="settings-trigger" onClick={() => setSettingsOpen(true)}><Settings size={16}/> تنظیمات مدل تحلیل</button>
        {settingsOpen && <div className="settings-modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={(event) => event.stopPropagation()}><header><h2>تنظیمات مدل تحلیل</h2><button type="button" onClick={() => setSettingsOpen(false)}>×</button></header><p>Provider و مدل برای تحلیل بعدی ذخیره می‌شوند.</p><div className="grid grid-cols-2 gap-3"><button type="button" onClick={()=>setProvider('gemini')}>Google Gemini</button><button type="button" onClick={()=>setProvider('9router')}>9Router</button></div>{provider==='9router'&&<input value={routerModel} onChange={(event)=>setRouterModel(event.target.value)} placeholder="نام مدل یا Combo" className="modal-field" dir="ltr"/>}<button type="button" className="modal-done" onClick={() => setSettingsOpen(false)}>تأیید</button></section></div>}
        {/* Target Business */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Building2 size={18} className="text-blue-400" />
            </div>
            <span className="text-white font-semibold">کسب‌وکار هدف</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['linkedin','tiktok','pinterest'].map((channel)=><input key={channel} type="url" value={target[channel]} onChange={(e)=>setTarget({...target,[channel]:e.target.value})} placeholder={`${channel === 'linkedin' ? 'LinkedIn Business' : channel === 'tiktok' ? 'TikTok Business' : 'Pinterest Business'} URL`} className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm" dir="ltr" />)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                نام کسب‌وکار <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={target.name}
                onChange={(e) => setTarget({ ...target, name: e.target.value })}
                placeholder="مثال: دکوراسیون آنا"
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder-slate-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                صنعت / حوزه فعالیت <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={target.industry}
                onChange={(e) =>
                  setTarget({ ...target, industry: e.target.value })
                }
                placeholder="مثال: دکوراسیون کودک"
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder-slate-500 transition-colors"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                <AtSign size={14} className="inline ml-1 text-pink-400" />
                هندل اینستاگرام
              </label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={target.instagramHandle}
                  onChange={(e) =>
                    setTarget({
                      ...target,
                      instagramHandle: e.target.value.replace('@', ''),
                    })
                  }
                  placeholder="yourbusiness"
                  className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 pr-8 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder-slate-500 transition-colors"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                <Globe size={14} className="inline ml-1 text-green-400" />
                آدرس وب‌سایت
              </label>
              <input
                type="text"
                value={target.website}
                onChange={(e) =>
                  setTarget({ ...target, website: e.target.value })
                }
                placeholder="https://example.com"
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder-slate-500 transition-colors"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <IndustryExplorer target={target} apiToken={APIFY_TOKEN} provider={provider} aiConfig={provider === 'gemini'
          ? { apiKey: import.meta.env.VITE_GEMINI_API_KEY || '', model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash' }
          : { model: routerModel.trim() }} selected={discoveredCompetitors} onChange={(items) => {
          setDiscoveredCompetitors(items);
          setCompetitors(items.length ? items.map((item) => ({ ...defaultCompetitor(), ...item })) : competitors);
        }} onBriefing={setIndustryBriefing} />
        {/* Competitors */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 rounded-lg">
                <Settings size={18} className="text-rose-400" />
              </div>
              <span className="text-white font-semibold">رقبا</span>
              <span className="text-slate-400 text-sm">
                ({competitors.length}/10)
              </span>
            </div>
            {competitors.length < 10 && (
              <button
                type="button"
                onClick={addCompetitor}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg">
                <Plus size={15} />
                افزودن رقیب
              </button>
            )}
          </div>

          {competitors.map((comp, index) => (
            <div
              key={index}
              className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm font-medium">
                  رقیب {index + 1}
                </span>
                {competitors.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeCompetitor(index)}
                    className="text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={comp.name}
                  onChange={(e) =>
                    updateCompetitor(index, 'name', e.target.value)
                  }
                  placeholder="نام رقیب"
                  className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500 transition-colors"
                  required
                />
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    value={comp.instagramHandle}
                    onChange={(e) =>
                      updateCompetitor(
                        index,
                        'instagramHandle',
                        e.target.value.replace('@', ''),
                      )
                    }
                    placeholder="instagramhandle"
                    className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 pr-7 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500 transition-colors"
                    dir="ltr"
                  />
                </div>
                <input
                  type="text"
                  value={comp.website}
                  onChange={(e) =>
                    updateCompetitor(index, 'website', e.target.value)
                  }
                  placeholder="https://competitor.com"
                  className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500 transition-colors"
                  dir="ltr"
                />
                <input type="url" value={comp.linkedin} onChange={(e)=>updateCompetitor(index,'linkedin',e.target.value)} placeholder="LinkedIn business URL" className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm" dir="ltr" />
                <input type="url" value={comp.tiktok} onChange={(e)=>updateCompetitor(index,'tiktok',e.target.value)} placeholder="TikTok URL / handle" className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm" dir="ltr" />
                <input type="url" value={comp.pinterest} onChange={(e)=>updateCompetitor(index,'pinterest',e.target.value)} placeholder="Pinterest Business URL" className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm" dir="ltr" />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl transition-all duration-200 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3">
            <Sparkles size={22} />
            {loading ? 'در حال پردازش...' : 'ساخت گزارش تحقیق بازار'}
          </button>
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="w-full py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 disabled:cursor-not-allowed text-slate-300 font-medium text-sm rounded-2xl transition-colors flex items-center justify-center gap-2">
            مشاهده نمونه گزارش (داده ساختگی)
          </button>
        </div>
      </form>
    </div>
  );
}
