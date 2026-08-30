import { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Building2,
  AtSign,
  Globe,
  Plus,
  Trash2,
  Sparkles,
  Download,
  Upload,
  MapPin,
  Mail,
  Send,
  Pencil,
} from 'lucide-react';
import {
  deleteProject,
  downloadProjectTransfer,
  importProjectTransfer,
  listProjects,
  loadProject,
  loadProjectRecord,
  saveProject,
  getOwnerPanelUrl,
} from '../utils/projects';
import IndustryExplorer from './IndustryExplorer';
import { testAiConnection } from '../utils/ai';
import { useLanguage } from '../i18n.jsx';

const APIFY_TOKEN = import.meta.env.VITE_APIFY_API_KEY || '';

const defaultCompetitor = () => ({
  name: '',
  instagramHandle: '',
  website: '',
  linkedin: '',
  youtube: '',
  reddit: '',
  twitter: '',
  telegram: '',
});

const STORAGE_KEY = 'market_research_form';
const DEFAULT_TARGET = {
  name: '',
  ownerName: '',
  ownerEmail: '',
  industry: '',
  category: '',
  location: '',
  audienceLanguage: 'fa',
  marketResearchMode: 'hybrid',
  instagramHandle: '',
  website: '',
  linkedin: '',
  youtube: '',
  reddit: '',
  twitter: '',
  telegram: '',
};

export default function ConfigForm({ onSubmit, loading, onLoadProject }) {
  const { language, setLanguage, t, dir } = useLanguage();
  const loadSaved = () => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  };

  const saved = loadSaved();

  const [target, setTarget] = useState({
    ...DEFAULT_TARGET,
    ...(saved?.target || {}),
  });
  const [competitors, setCompetitors] = useState(
    saved?.competitors || [defaultCompetitor(), defaultCompetitor()],
  );
  const [discoveredCompetitors, setDiscoveredCompetitors] = useState([]);
  const [industryBriefing, setIndustryBriefing] = useState(
    saved?.target?.industryBriefing || '',
  );
  const [industryIntelligence, setIndustryIntelligence] = useState(
    saved?.target?.industryIntelligence || null,
  );
  const [projects, setProjects] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [ownerEmailDrafts, setOwnerEmailDrafts] = useState({});
  const [ownerNameDrafts, setOwnerNameDrafts] = useState({});
  const [emailSaveBusy, setEmailSaveBusy] = useState(null);
  const [invitationEditors, setInvitationEditors] = useState({});
  const [provider, setProvider] = useState(
    saved?.settings?.provider || 'gemini',
  );
  const [routerModel, setRouterModel] = useState(
    saved?.settings?.routerModel === 'auto'
      ? ''
      : saved?.settings?.routerModel || '',
  );
  const [routerModels, setRouterModels] = useState([]);
  const [routerModelsError, setRouterModelsError] = useState('');
  const [routerModelsLoading, setRouterModelsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const transferInputRef = useRef(null);
  const persistForm = (
    nextTarget = target,
    nextCompetitors = competitors,
    nextProvider = provider,
    nextRouterModel = routerModel,
  ) => {
    try {
      const cleanCompetitors = nextCompetitors.map(
        ({ _discoveryKey, ...competitor }) => competitor,
      );
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          target: { ...nextTarget, industryBriefing, industryIntelligence },
          competitors: cleanCompetitors,
          settings: { provider: nextProvider, routerModel: nextRouterModel },
        }),
      );
    } catch {
      // Ignore browser storage quota/privacy errors.
    }
  };
  useEffect(() => {
    persistForm();
  }, [
    target,
    competitors,
    provider,
    routerModel,
    industryBriefing,
    industryIntelligence,
  ]);
  useEffect(() => {
    const refresh = () => listProjects().then(setProjects);
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    if (provider !== '9router') return;
    let active = true;
    setRouterModelsLoading(true);
    setRouterModelsError('');
    fetch('/api/ai?action=models', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error || `HTTP ${response.status}`);
        return body.models || [];
      })
      .then((models) => {
        if (!active) return;
        const normalized = models
          .map((item) => (typeof item === 'string' ? { id: item } : item))
          .filter((item) => item.id);
        setRouterModels(normalized);
        setRouterModel((current) =>
          current && normalized.some((item) => item.id === current)
            ? current
            : '',
        );
      })
      .catch((error) => {
        if (active)
          setRouterModelsError(error.message || 'دریافت مدل‌ها ناموفق بود.');
      })
      .finally(() => {
        if (active) setRouterModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provider]);
  const removeSavedProject = async (id) => {
    await deleteProject(id);
    setProjects((items) => items.filter((project) => project.id !== id));
    setPendingDelete(null);
  };

  const handleProjectExport = async () => {
    setTransferMessage('');
    setTransferError('');
    setTransferBusy(true);
    try {
      const project = projects[0] ? await loadProject(projects[0].id) : null;
      const fullProject = project
        ? { ...projects[0], snapshot: project }
        : null;
      if (!fullProject) throw new Error('گزارشی برای خروجی‌گرفتن وجود ندارد.');
      downloadProjectTransfer(fullProject);
      setTransferMessage(
        'فایل انتقال آخرین گزارش دانلود شد. آن را در تنظیمات محیط پروداکشن وارد کنید.',
      );
    } catch (error) {
      setTransferError(error.message || 'خروجی گرفتن از گزارش ناموفق بود.');
    } finally {
      setTransferBusy(false);
    }
  };

  const handleSendInvite = async (projectId) => {
    setInviteBusy(projectId);
    setInviteMessage('');
    setInviteError('');
    console.info('[send-invite] started', { projectId });
    try {
      const record = await loadProjectRecord(projectId);
      const ownerEmail = String(record?.snapshot?._project?.ownerEmail || '').trim();
      const ownerName = String(record?.snapshot?._project?.target?.ownerName || '').trim();
      const panelToken = String(record?.snapshot?._project?.ownerAccessToken || '').trim();
      if (!ownerEmail) throw new Error('برای این پروژه ایمیل کارفرما ثبت نشده است.');
      const panelUrl = getOwnerPanelUrl(projectId, panelToken);
      const response = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectName: record?.name || 'گزارش تحقیق بازار',
          ownerName,
          ownerEmail,
          panelUrl,
        }),
      });
      const raw = await response.text();
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { error: raw }; }
      console.info('[send-invite] response', { projectId, status: response.status, body });
      if (!response.ok) throw new Error(body.error || body.message || `خطای سرور (${response.status})`);
      const invitation = {
        ...(record.snapshot._project?.invitation || {}),
        lastSentAt: new Date().toISOString(),
        messageId: body?.result?.id || null,
        recipient: ownerEmail,
        recipientName: ownerName,
      };
      const saved = await saveProject({ ...record.snapshot, id: projectId, _project: { ...record.snapshot._project, invitation } }, record.snapshot._project?.target || {});
      // Use the record that was just written. Refetching here can briefly restore
      // an older project snapshot and make the saved address look empty.
      setProjects((items) => items.map((project) => project.id === projectId ? saved : project));
      setInvitationEditors((items) => ({ ...items, [projectId]: false }));
      setInviteMessage(saved.persistence === 'remote'
        ? `دعوت برای ${ownerEmail} به SendPulse تحویل شد.`
        : `دعوت ارسال شد، اما وضعیت آن فقط روی همین مرورگر ذخیره شد.`);
    } catch (error) {
      console.error('[send-invite] failed', error);
      setInviteError(error.message || 'ارسال دعوت ناموفق بود.');
    } finally {
      setInviteBusy(null);
    }
  };

  const handleSaveOwnerEmail = async (projectId) => {
    const email = String(ownerEmailDrafts[projectId] || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('یک ایمیل معتبر برای کارفرما وارد کنید.');
      return;
    }
    setEmailSaveBusy(projectId);
    setInviteMessage('');
    setInviteError('');
    try {
      const record = await loadProjectRecord(projectId);
      if (!record?.snapshot) throw new Error('گزارش پیدا نشد.');
      const ownerName = String(ownerNameDrafts[projectId] ?? record.snapshot._project?.target?.ownerName ?? '').trim();
      const target = { ...(record.snapshot._project?.target || {}), ownerName, ownerEmail: email };
      const saved = await saveProject({ ...record.snapshot, id: projectId }, target);
      // Update this card from the write result immediately. A second list request
      // could otherwise paint an older cached record back over the saved email.
      setProjects((items) => items.map((project) => project.id === projectId ? saved : project));
      // Saving contact details is only the first step. Keep this editor open so
      // the administrator can send the invitation immediately afterwards.
      setInvitationEditors((items) => ({ ...items, [projectId]: true }));
      setInviteMessage(saved.persistence === 'remote'
        ? 'ایمیل کارفرما ذخیره شد؛ اکنون روی «ارسال دعوت» بزنید.'
        : `ایمیل فقط روی همین مرورگر ذخیره شد: ${saved.persistenceError}`);
      setInviteError('');
    } catch (error) {
      setInviteError(error.message || 'ذخیره ایمیل ناموفق بود.');
    } finally {
      setEmailSaveBusy(null);
    }
  };

  const handleProjectImport = async (event) => {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;
    setTransferMessage('');
    setTransferError('');
    setTransferBusy(true);
    try {
      const imported = await importProjectTransfer(file);
      setProjects((items) => [
        imported,
        ...items.filter((item) => item.id !== imported.id),
      ]);
      setTransferMessage(`«${imported.name}» وارد و در فضای فعلی ذخیره شد.`);
    } catch (error) {
      setTransferError(error.message || 'واردکردن گزارش ناموفق بود.');
    } finally {
      setTransferBusy(false);
    }
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
      aiConfig:
        provider === 'gemini'
          ? {
              apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
              model:
                import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash-lite',
            }
          : { model: routerModel.trim() },
      target: {
        ...target,
        industryBriefing,
        industryIntelligence,
        outputLanguage: language,
      },
      competitors: competitors.map(
        ({ _discoveryKey, ...competitor }) => competitor,
      ),
      industryIntelligence,
      useMockData: false,
    });
  };

  const handleDemo = () => {
    onSubmit({
      apifyToken: APIFY_TOKEN,
      provider,
      aiConfig: {},
      target,
      competitors,
      useMockData: true,
    });
  };

  const handleTestConnection = async () => {
    setConnectionTesting(true);
    setConnectionMessage('');
    setConnectionError('');
    try {
      const config =
        provider === 'gemini'
          ? {
              apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
              model:
                import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash-lite',
            }
          : { model: routerModel.trim() };
      await testAiConnection(provider, config);
      setConnectionMessage(
        `اتصال موفق است · ${provider === '9router' ? routerModel : config.model}`,
      );
    } catch (error) {
      setConnectionError(error.message || 'تست اتصال ناموفق بود.');
    } finally {
      setConnectionTesting(false);
    }
  };

  const isValid =
    target.name.trim() &&
    target.industry.trim() &&
    competitors.every((c) => c.name.trim()) &&
    (provider !== '9router' || Boolean(routerModel.trim()));

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8"
      dir={dir}>
      <div className="max-w-3xl mx-auto flex justify-end mb-5">
        <div
          className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/70 p-1 text-xs"
          aria-label={t.language}>
          <span className="px-2 text-slate-400">{t.language}</span>
          <button
            type="button"
            onClick={() => setLanguage('fa')}
            className={`rounded-lg px-3 py-2 ${language === 'fa' ? 'bg-emerald-400 text-slate-950' : 'text-slate-300'}`}>
            {t.persian}
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`rounded-lg px-3 py-2 ${language === 'en' ? 'bg-emerald-400 text-slate-950' : 'text-slate-300'}`}>
            {t.english}
          </button>
        </div>
      </div>
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <div className="inline-flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl px-6 py-3 mb-4">
          <Sparkles className="text-blue-400" size={20} />
          <span className="text-blue-300 font-medium text-sm">نسخه 0.1.1</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
          {t.form.title}
        </h1>
        <p className="text-slate-400 text-lg">
          {t.form.subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        <section className="projects-panel">
          <div className="projects-panel-head">
            <div>
              <span>RESEARCH ARCHIVE</span>
              <h2>{t.form.archive}</h2>
            </div>
            <strong>{projects.length}</strong>
          </div>
          {projects.length ? (
            <div className="projects-list">
              {projects.map((p) => {
                const invitation = p.snapshot?._project?.invitation;
                const hasSentInvite = Boolean(invitation?.lastSentAt);
                const editorOpen = invitationEditors[p.id] ?? !hasSentInvite;
                const storedOwnerName = p.snapshot?._project?.target?.ownerName || invitation?.recipientName || '';
                const ownerName = storedOwnerName || 'کارفرما';
                const ownerEmail = p.snapshot?._project?.ownerEmail || invitation?.recipient || '';
                const hasUnsavedInvitationChange = (ownerEmailDrafts[p.id] !== undefined
                  && ownerEmailDrafts[p.id].trim().toLowerCase() !== ownerEmail.toLowerCase())
                  || (ownerNameDrafts[p.id] !== undefined && ownerNameDrafts[p.id].trim() !== storedOwnerName);
                return <article className="project-item" key={p.id}>
                  <header className="project-item-head">
                    <button type="button" className="project-open" onClick={() => onLoadProject(p.id)}>
                      <span className="project-mark">{(p.name || 'پ').slice(0, 1)}</span>
                      <span><b>{p.name}</b><small>{p.industry || 'بدون دسته‌بندی'} · {p.updated_at ? new Date(p.updated_at).toLocaleDateString('fa-IR') : 'تاریخ نامشخص'}</small></span>
                    </button>
                    {pendingDelete === p.id ? (
                      <div className="project-delete-confirm"><span>حذف شود؟</span><button type="button" onClick={() => removeSavedProject(p.id)}>بله، حذف</button><button type="button" onClick={() => setPendingDelete(null)}>انصراف</button></div>
                    ) : <button type="button" className="project-delete" onClick={() => setPendingDelete(p.id)} aria-label={`حذف ${p.name}`}><Trash2 size={16} /></button>}
                  </header>
                  <section className="project-invitation" aria-label={`دعوت کارفرما برای ${p.name}`}>
                    <div className="project-invitation-copy"><Mail size={16} /><span><b>دسترسی کارفرما</b><small>{hasSentInvite ? `دعوت برای ${ownerName} در ${new Date(invitation.lastSentAt).toLocaleDateString('fa-IR')} ارسال شده است.` : 'نام و ایمیل کارفرما را ثبت کنید، سپس لینک اختصاصی را ارسال کنید.'}</small></span></div>
                    {editorOpen ? <div className="project-invitation-actions"><input type="text" value={ownerNameDrafts[p.id] ?? p.snapshot?._project?.target?.ownerName ?? ''} onChange={(e) => setOwnerNameDrafts({ ...ownerNameDrafts, [p.id]: e.target.value })} placeholder="نام کارفرما" aria-label="نام کارفرما" /><input type="email" value={ownerEmailDrafts[p.id] ?? ownerEmail} onChange={(e) => setOwnerEmailDrafts({ ...ownerEmailDrafts, [p.id]: e.target.value })} placeholder="owner@company.com" dir="ltr" aria-label="ایمیل کارفرما" /><button type="button" className="invite-save" onClick={() => handleSaveOwnerEmail(p.id)} disabled={emailSaveBusy === p.id}>{emailSaveBusy === p.id ? 'در حال ذخیره' : 'ذخیره'}</button><button type="button" className="invite-send" onClick={() => handleSendInvite(p.id)} disabled={inviteBusy === p.id || emailSaveBusy === p.id || hasUnsavedInvitationChange || !ownerEmail} title={hasUnsavedInvitationChange ? 'ابتدا ایمیل جدید را ذخیره کنید.' : undefined}><Send size={14} />{inviteBusy === p.id ? 'در حال ارسال' : 'ارسال دعوت'}</button></div> : <button type="button" className="invite-edit" onClick={() => setInvitationEditors((items) => ({ ...items, [p.id]: true }))}><Pencil size={14} />ویرایش یا ارسال مجدد</button>}
                  </section>
                </article>
              })}
            </div>
          ) : (
            <div className="projects-empty">
              هنوز گزارشی ذخیره نشده است. اولین گزارش پس از تولید اینجا نمایش
              داده می‌شود.
            </div>
          )}
          {inviteMessage && <div className="connection-success">✓ {inviteMessage}</div>}
          {inviteError && <div className="settings-model-error">✕ {inviteError}</div>}
        </section>
        <IndustryExplorer
          hidden
          target={target}
          apiToken={APIFY_TOKEN}
          provider={provider}
          aiConfig={
            provider === 'gemini'
              ? {
                  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
                  model:
                    import.meta.env.VITE_GEMINI_MODEL ||
                    'gemini-3.5-flash-lite',
                }
              : { model: routerModel.trim() }
          }
          selected={discoveredCompetitors}
          onChange={(items) => {
            setDiscoveredCompetitors(items);
            setCompetitors(
              items.length
                ? items.map((item) => ({ ...defaultCompetitor(), ...item }))
                : competitors,
            );
          }}
          onIntelligence={setIndustryIntelligence}
        />
        <section className="settings-inline-hidden bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Settings size={18} className="text-violet-400" />
            </div>
            <div>
              <span className="text-white font-semibold">
                تنظیمات مدل تحلیل
              </span>
              <p className="text-slate-400 text-xs mt-1">
                انتخاب برای گزارش بعدی ذخیره می‌شود.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProvider('gemini')}
              className={`rounded-xl border px-4 py-3 text-sm transition-colors ${provider === 'gemini' ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-slate-600 bg-slate-900/40 text-slate-400'}`}>
              Google Gemini
            </button>
            <button
              type="button"
              onClick={() => setProvider('9router')}
              className={`rounded-xl border px-4 py-3 text-sm transition-colors ${provider === '9router' ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-slate-600 bg-slate-900/40 text-slate-400'}`}>
              9Router
            </button>
          </div>
          {provider === '9router' && (
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                مدل یا Combo فعال 9Router
              </label>
              {routerModelsLoading ? (
                <div className="w-full bg-slate-900/60 border border-slate-600 text-slate-400 rounded-xl px-4 py-3 text-sm">
                  در حال دریافت فهرست مدل‌ها…
                </div>
              ) : routerModels.length ? (
                <select
                  value={routerModel}
                  onChange={(event) => setRouterModel(event.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm"
                  dir="ltr">
                  <option value="">مدل یا Combo را انتخاب کنید</option>
                  {routerModels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                      {item.owned_by ? ` · ${item.owned_by}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={routerModel}
                  onChange={(event) => setRouterModel(event.target.value)}
                  placeholder="مثال: kr/claude-sonnet-4.5 یا نام Combo"
                  className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm"
                  dir="ltr"
                />
              )}
              {routerModelsError && (
                <p className="text-red-400 text-xs mt-2">{routerModelsError}</p>
              )}
              <p className="text-slate-500 text-xs mt-2">
                فقط مدلی را انتخاب کنید که Provider آن در Dashboard خود 9Router
                متصل است؛ انتخاب مدل `openai/...` بدون credential فعال همین خطا
                را ایجاد می‌کند.
              </p>
              <p className="text-slate-500 text-xs mt-1" dir="ltr">
                Endpoint: https://router.vahidafshari.com/v1
              </p>
            </div>
          )}
        </section>
        <button
          type="button"
          className="settings-trigger"
          onClick={() => setSettingsOpen(true)}>
          <Settings size={16} /> تنظیمات مدل تحلیل
        </button>
        {settingsOpen && (
          <div
            className="settings-modal-backdrop"
            onClick={() => setSettingsOpen(false)}>
            <section
              className="settings-modal"
              onClick={(event) => event.stopPropagation()}>
              <header>
                <h2>تنظیمات مدل تحلیل</h2>
                <button type="button" onClick={() => setSettingsOpen(false)}>
                  ×
                </button>
              </header>
              <p>Provider و مدل برای تحلیل بعدی ذخیره می‌شوند.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setProvider('gemini');
                    setConnectionMessage('');
                    setConnectionError('');
                  }}>
                  Google Gemini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProvider('9router');
                    setConnectionMessage('');
                    setConnectionError('');
                  }}>
                  9Router
                </button>
              </div>
              {provider === '9router' && (
                <div className="settings-model-picker">
                  <label>مدل یا Combo فعال 9Router</label>
                  {routerModelsLoading ? (
                    <div className="modal-field modal-field-muted">
                      در حال دریافت فهرست مدل‌ها…
                    </div>
                  ) : routerModels.length ? (
                    <select
                      value={routerModel}
                      onChange={(event) => setRouterModel(event.target.value)}
                      className="modal-field"
                      dir="ltr">
                      <option value="">مدل یا Combo را انتخاب کنید</option>
                      {routerModels.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.id}
                          {item.owned_by ? ` · ${item.owned_by}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={routerModel}
                      onChange={(event) => setRouterModel(event.target.value)}
                      placeholder="نام مدل یا Combo"
                      className="modal-field"
                      dir="ltr"
                    />
                  )}
                  {routerModelsError && (
                    <p className="settings-model-error">{routerModelsError}</p>
                  )}
                  <small>
                    فقط مدلی را انتخاب کنید که Provider آن در Dashboard 9Router
                    credential فعال دارد.
                  </small>
                </div>
              )}
              <button
                type="button"
                className="connection-test-button"
                disabled={
                  connectionTesting ||
                  (provider === '9router' && !routerModel.trim())
                }
                onClick={handleTestConnection}>
                {connectionTesting ? 'در حال تست اتصال…' : 'تست اتصال مدل'}
              </button>
              {connectionMessage && (
                <p className="connection-success">✓ {connectionMessage}</p>
              )}
              {connectionError && (
                <p className="settings-model-error">✕ {connectionError}</p>
              )}
              <section className="project-transfer" aria-label="انتقال گزارش">
                <div>
                  <span>انتقال گزارش</span>
                  <p>
                    برای جابه‌جایی گزارش میان لوکال و پروداکشن؛ کلیدها و تنظیمات
                    مدل منتقل نمی‌شوند.
                  </p>
                </div>
                <div className="project-transfer-actions">
                  <button
                    type="button"
                    disabled={transferBusy || !projects.length}
                    onClick={handleProjectExport}>
                    <Download size={15} /> خروجی آخرین گزارش
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy}
                    onClick={() => transferInputRef.current?.click()}>
                    <Upload size={15} /> ورود فایل گزارش
                  </button>
                  <input
                    ref={transferInputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={handleProjectImport}
                  />
                </div>
                {transferBusy && <small>در حال آماده‌سازی انتقال…</small>}
                {transferMessage && (
                  <small className="project-transfer-success">
                    ✓ {transferMessage}
                  </small>
                )}
                {transferError && (
                  <small className="settings-model-error">
                    ✕ {transferError}
                  </small>
                )}
              </section>
              <button
                type="button"
                className="modal-done"
                onClick={() => setSettingsOpen(false)}>
                تأیید
              </button>
            </section>
          </div>
        )}
        {/* Target Business */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Building2 size={18} className="text-blue-400" />
            </div>
            <span className="text-white font-semibold">{t.form.target}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['linkedin', 'youtube', 'reddit', 'twitter', 'telegram'].map(
              (channel) => (
                <input
                  key={channel}
                  type="url"
                  value={target[channel]}
                  onChange={(e) =>
                    setTarget({ ...target, [channel]: e.target.value })
                  }
                  placeholder={`${channel === 'linkedin' ? 'LinkedIn Business' : channel === 'youtube' ? 'YouTube Channel' : channel === 'reddit' ? 'Reddit profile / subreddit' : channel === 'twitter' ? 'Twitter / X' : 'Telegram'} URL`}
                  className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm"
                  dir="ltr"
                />
              ),
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                نام کارفرما
              </label>
              <input
                type="text"
                value={target.ownerName}
                onChange={(e) => setTarget({ ...target, ownerName: e.target.value })}
                placeholder="مثال: آقای احمدی"
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder-slate-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                ایمیل کارفرما
              </label>
              <input
                type="email"
                value={target.ownerEmail}
                onChange={(e) =>
                  setTarget({ ...target, ownerEmail: e.target.value })
                }
                placeholder="owner@company.com"
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder-slate-500 transition-colors"
                dir="ltr"
              />
            </div>
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
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                دسته فعالیت پیشنهادی (توسط مدل)
              </label>
              <input
                type="text"
                value={target.category}
                readOnly
                placeholder="پس از پیش‌تحلیل مدل نمایش داده می‌شود"
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 placeholder-slate-500 transition-colors"
              />
              <p className="text-slate-500 text-xs mt-2">
                اختیاری؛ فقط بر اساس شواهد Instagram یا Telegram وارد کنید.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                <MapPin size={14} className="inline ml-1 text-amber-400" />
                حوزه جغرافیایی بررسی{' '}
                <span className="text-slate-500">(اختیاری)</span>
              </label>
              <input
                type="text"
                value={target.location}
                onChange={(e) =>
                  setTarget({ ...target, location: e.target.value })
                }
                placeholder="مثال: ایران، تهران یا منطقه خاورمیانه"
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 placeholder-slate-500 transition-colors"
              />
              <p className="text-slate-500 text-xs mt-2">
                در صورت خالی بودن، جست‌وجو بدون محدودیت جغرافیایی انجام می‌شود.
              </p>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                زبان مخاطب <span className="text-red-400">*</span>
              </label>
              <select
                value={target.audienceLanguage || 'fa'}
                onChange={(e) =>
                  setTarget({ ...target, audienceLanguage: e.target.value })
                }
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                required>
                <option value="fa">فارسی — فارسی‌زبانان سراسر دنیا</option>
                <option value="en">انگلیسی — انگلیسی‌زبانان سراسر دنیا</option>
                <option value="ar">عربی — عربی‌زبانان سراسر دنیا</option>
                <option value="tr">ترکی — ترکی‌زبانان سراسر دنیا</option>
                <option value="de">آلمانی — آلمانی‌زبانان سراسر دنیا</option>
                <option value="fr">فرانسوی — فرانسوی‌زبانان سراسر دنیا</option>
                <option value="multi">چندزبانه / بین‌المللی</option>
                <option value="any">بدون محدودیت زبانی</option>
              </select>
              <p className="text-slate-500 text-xs mt-2">
                زبان مخاطب مستقل از لوکیشن است؛ مثلاً فارسی‌زبانان مقیم کانادا و
                آلمان هم پوشش داده می‌شوند.
              </p>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                دامنه بررسی بازار <span className="text-red-400">*</span>
              </label>
              <select
                value={target.marketResearchMode}
                onChange={(e) =>
                  setTarget({ ...target, marketResearchMode: e.target.value })
                }
                className="w-full bg-slate-900/60 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                required>
                <option value="online">
                  آنلاین — وب‌سایت و شبکه‌های اجتماعی
                </option>
                <option value="offline">
                  آفلاین — فروشگاه‌ها و بازار محلی
                </option>
                <option value="hybrid">ترکیبی — آنلاین و آفلاین</option>
              </select>
              <p className="text-slate-500 text-xs mt-2">
                این انتخاب مستقیماً queryهای Maps و Instagram را تغییر می‌دهد.
              </p>
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

        <IndustryExplorer
          target={target}
          apiToken={APIFY_TOKEN}
          provider={provider}
          aiConfig={
            provider === 'gemini'
              ? {
                  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
                  model:
                    import.meta.env.VITE_GEMINI_MODEL ||
                    'gemini-3.5-flash-lite',
                }
              : { model: routerModel.trim() }
          }
          selected={discoveredCompetitors}
          onChange={(items) => {
            setDiscoveredCompetitors(items);
            setCompetitors(
              items.length
                ? items.map((item) => ({ ...defaultCompetitor(), ...item }))
                : competitors,
            );
          }}
          onBriefing={setIndustryBriefing}
          onIntelligence={setIndustryIntelligence}
          onCategory={(category) =>
            setTarget((current) => ({ ...current, category }))
          }
        />
        {/* Competitors */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 rounded-lg">
                <Settings size={18} className="text-rose-400" />
              </div>
              <span className="text-white font-semibold">{t.form.competitors}</span>
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
                {t.form.addCompetitor}
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
                <input
                  type="url"
                  value={comp.linkedin}
                  onChange={(e) =>
                    updateCompetitor(index, 'linkedin', e.target.value)
                  }
                  placeholder="LinkedIn business URL"
                  className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm"
                  dir="ltr"
                />
                <input
                  type="url"
                  value={comp.youtube}
                  onChange={(e) =>
                    updateCompetitor(index, 'youtube', e.target.value)
                  }
                  placeholder="YouTube channel URL"
                  className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm"
                  dir="ltr"
                />
                <input
                  type="url"
                  value={comp.reddit}
                  onChange={(e) =>
                    updateCompetitor(index, 'reddit', e.target.value)
                  }
                  placeholder="Reddit profile / subreddit URL"
                  className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm"
                  dir="ltr"
                />
                <input
                  type="url"
                  value={comp.twitter}
                  onChange={(e) =>
                    updateCompetitor(index, 'twitter', e.target.value)
                  }
                  placeholder="Twitter / X URL"
                  className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm"
                  dir="ltr"
                />
                <input
                  type="url"
                  value={comp.telegram}
                  onChange={(e) =>
                    updateCompetitor(index, 'telegram', e.target.value)
                  }
                  placeholder="Telegram URL"
                  className="w-full bg-slate-800/60 border border-slate-600/60 text-white rounded-lg px-3 py-2.5 text-sm"
                  dir="ltr"
                />
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
          {/* <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="w-full py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 disabled:cursor-not-allowed text-slate-300 font-medium text-sm rounded-2xl transition-colors flex items-center justify-center gap-2">
            مشاهده نمونه گزارش (داده ساختگی)
          </button> */}
        </div>
      </form>
    </div>
  );
}
