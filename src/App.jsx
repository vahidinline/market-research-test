import { useEffect, useRef, useState } from 'react';
import ConfigForm from './components/ConfigForm';
import LoadingScreen from './components/LoadingScreen';
import ResearchDashboard from './components/ResearchDashboard';
import CpmApproval from './components/CpmApproval';
import {
  fetchInstagramProfiles,
  fetchInstagramPosts,
  normalizeProfile,
  estimateEngagementRate,
  summarizeInstagramPosts,
  normalizeInstagramHandle,
  postOwnerHandle,
} from './utils/apify';
import { completeResearchWithApprovedCpm, generateAudienceTopics, generateTopicSearchQueries, prepareResearchMethodology } from './utils/ai';
import { MOCK_ANALYSIS } from './utils/mockData';
import AuthGate from './components/AuthGate';
import { loadProject, loadProjectRecord, saveProject } from './utils/projects';
import { inspectWebsite } from './utils/website';
import { collectAllPlatformData, collectTopicDiscoveryData } from './utils/platforms';
import { loadResearchCacheFromKeys, saveResearchCache } from './utils/researchCache';
import { enforceReportIntegrity } from './utils/reportIntegrity';
import { useLanguage } from './i18n.jsx';
import { loadAiSettings } from './utils/aiSettings';

const STATE = { FORM: 'form', LOADING: 'loading', CPM_APPROVAL: 'cpm_approval', REPORT: 'report' };

export default function App() {
  const { language, dir } = useLanguage();
  const [appState, setAppState] = useState(STATE.FORM);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingError, setLoadingError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('آماده‌سازی درخواست...');
  const [reportData, setReportData] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const [pendingResearch, setPendingResearch] = useState(null);
  const [reportAiRuntime, setReportAiRuntime] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [ownerPanel, setOwnerPanel] = useState({ loading: false, error: '', project: null });
  // Keep scraped data for this app session so an AI parse/retry never costs another Apify run.
  const profilesCache = useRef(new Map());

  const runWithMockData = (target) => {
    setIsMock(true);
    setReportTarget(target || { name: 'کسب‌وکار هدف', industry: 'عمومی' });
    setReportData(MOCK_ANALYSIS);
    setAppState(STATE.REPORT);
  };

  const handleSubmit = async (formData) => {
    const { provider, apifyToken, aiConfig, target, competitors, industryIntelligence, useMockData } =
      formData;

    target.outputLanguage = language;
    if (useMockData) {
      runWithMockData(target);
      return;
    }

    setAppState(STATE.LOADING);
    setReportAiRuntime({ provider, config: aiConfig });
    setReportTarget({ ...target, industryIntelligence });
    setLoadingError(null);
    setLoadingStep(0);

    try {
      // Step 0: reuse persistent raw data, otherwise call Apify once and save immediately.
      setLoadingStep(0);
      setLoadingMessage('بررسی داده‌های ذخیره‌شده برای جلوگیری از اجرای مجدد Apify...');
      const allHandles = [
        target.instagramHandle,
        ...competitors.map((c) => c.instagramHandle),
      ].filter(Boolean);

      const normalizedHandles = [...new Set(allHandles.map(normalizeInstagramHandle).filter(Boolean).map((handle) => handle.toLowerCase()))].sort();
      const handleSignature = normalizedHandles.join('|');
      const cacheKey = `instagram-v2:${handleSignature}`;
      const legacyRawKey = allHandles.map((handle) => String(handle).trim().toLowerCase()).sort().join('|');
      const { payload: persisted, matchedKey } = await loadResearchCacheFromKeys([cacheKey, handleSignature, legacyRawKey]);
      let profiles = persisted?.profiles || profilesCache.current.get(cacheKey) || [];
      let posts = persisted?.posts || profilesCache.current.get(`${cacheKey}:posts`) || [];
      if (persisted) {
        profilesCache.current.set(cacheKey, profiles);
        profilesCache.current.set(`${cacheKey}:posts`, posts);
        setLoadingMessage('داده خام Instagram از کش بازیابی شد؛ هزینه جدیدی برای Apify ایجاد نشد.');
        if (matchedKey !== cacheKey) saveResearchCache(cacheKey, persisted).catch((error) => console.error('Cache key migration failed', error));
      }
      if (allHandles.length > 0 && !persisted && !profilesCache.current.has(cacheKey)) {
        setLoadingMessage('مرحله ۱ از ۶: دریافت پروفایل‌های Instagram...');
        const rawProfiles = await fetchInstagramProfiles(
          apifyToken,
          allHandles,
        );
        profiles = rawProfiles.map(normalizeProfile).filter(Boolean);
        profilesCache.current.set(cacheKey, profiles);
        setLoadingMessage('مرحله ۲ از ۶: دریافت پست‌ها و Reels عمومی...');
        posts = await fetchInstagramPosts(apifyToken, allHandles, 30);
        profilesCache.current.set(`${cacheKey}:posts`, posts);
        setLoadingMessage('ذخیره فوری داده خام در D1 و حافظه مرورگر...');
        const compactPosts = posts.map((post) => ({
          ownerUsername: post.ownerUsername || post.username || post.owner?.username || '',
          profileUrl: post.profileUrl || post.inputUrl || '',
          type: post.type || post.mediaType || '', isVideo: Boolean(post.isVideo),
          timestamp: post.timestamp || post.takenAt || post.taken_at || post.date || null,
          caption: String(post.caption || post.text || '').slice(0, 1200),
          likesCount: post.likesCount ?? post.likes ?? 0,
          commentsCount: post.commentsCount ?? post.comments ?? 0,
          videoViewCount: post.videoViewCount ?? post.videoPlayCount ?? post.views ?? 0,
          url: post.url || post.postUrl || '', shortCode: post.shortCode || '',
        }));
        posts = compactPosts;
        profilesCache.current.set(`${cacheKey}:posts`, posts);
        await saveResearchCache(cacheKey, { profiles, posts, handles: normalizedHandles, schemaVersion: 3 });
      }

      // Step 1: Enrich profiles
      setLoadingStep(1);
      setLoadingMessage('مرحله ۳ از ۶: محاسبه تعامل و شاخص‌های محتوایی...');
      const enrichedProfiles = profiles.map((p) => ({
        ...p,
        engagementRate: estimateEngagementRate(p),
      }));

      const profileMap = {};
      enrichedProfiles.forEach((p) => {
        profileMap[normalizeInstagramHandle(p.username).toLowerCase()] = p;
      });

      const enrichBusiness = (business, websiteDataForBusiness) => {
        const handle = normalizeInstagramHandle(business.instagramHandle).toLowerCase();
        const businessPosts = posts.filter((post) => postOwnerHandle(post) === handle);
        const instagramData = profileMap[handle] || null;
        return {
          ...business,
          instagramHandle: handle,
          instagramData,
          instagramPosts: businessPosts,
          instagramSummary: summarizeInstagramPosts(businessPosts, instagramData?.followersCount || 0),
          websiteData: websiteDataForBusiness,
          platformData,
        };
      };

      setLoadingMessage('مرحله ۴ از ۶: بررسی Websiteهای ثبت‌شده...');
      const websiteData = await Promise.all([target, ...competitors].map((business) => inspectWebsite(business.website)));
      const platformData = await collectAllPlatformData(apifyToken, [target, ...competitors]);
      const profilesData = {
        target: enrichBusiness(target, websiteData[0]),
        competitors: competitors.map((c, index) => ({
          ...enrichBusiness(c, websiteData[index + 1]),
          platformData,
        })),
      };

      // Step 2: AI analysis
      setLoadingStep(2);
      setLoadingMessage('مرحله ۵ از ۶: تولید تحلیل عمیق بازار و رقبا...');
      const enrichedTarget = { ...target, industryIntelligence };
      const preliminary = await prepareResearchMethodology(
        provider, aiConfig, enrichedTarget, competitors, profilesData,
        (message) => setLoadingMessage(`مرحله ۵ از ۶: ${message}`),
      );
      setPendingResearch({ provider, aiConfig, target: enrichedTarget, competitors, profilesData, preliminary });
      setAppState(STATE.CPM_APPROVAL);
    } catch (err) {
      console.error(err);
      setLoadingError(err.message || 'خطای ناشناخته رخ داد.');
    }
  };

  const handleApproveCpm = async (approvedModel) => {
    if (!pendingResearch) return;
    const { provider, aiConfig, target, competitors, profilesData, preliminary } = pendingResearch;
    setAppState(STATE.LOADING);
    setLoadingError(null);
    setLoadingStep(2);
    try {
      setLoadingMessage('مرحله ۵ از ۶: مدل CPM تأیید شد؛ امتیازدهی همه برندها با نسخه قفل‌شده...');
      let analysis = await completeResearchWithApprovedCpm(
        provider, aiConfig, target, competitors, profilesData, preliminary, approvedModel,
        (message) => setLoadingMessage(`مرحله ۵ از ۶: ${message}`),
      );
      setLoadingStep(3);
      setLoadingMessage('مرحله ۶ از ۶: ذخیره گزارش نهایی و آماده‌سازی داشبورد...');
      analysis = enforceReportIntegrity(analysis, profilesData);
      setReportTarget(target);
      setReportData(analysis);
      const savedProject = await saveProject(analysis, target);
      setCurrentProjectId(savedProject.id);
      setPendingResearch(null);
      setIsMock(false);
      setAppState(STATE.REPORT);
    } catch (err) {
      console.error(err);
      setLoadingError(err.message || 'خطای ناشناخته رخ داد.');
    }
  };

  const handleUseMockFallback = () => {
    setLoadingError(null);
    runWithMockData(reportTarget);
  };

  const handleReset = () => {
    setAppState(STATE.FORM);
    setLoadingStep(0);
    setLoadingError(null);
    setReportData(null);
    setReportTarget(null);
    setIsMock(false);
    setPendingResearch(null);
    setReportAiRuntime(null);
    setCurrentProjectId(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('panel') !== 'owner') return;
    const projectId = params.get('project');
    const token = params.get('token');
    if (!projectId || !token) {
      setOwnerPanel({ loading: false, error: 'لینک پنل ناقص است.', project: null });
      return;
    }
    let active = true;
    setOwnerPanel({ loading: true, error: '', project: null });
    loadProjectRecord(projectId)
      .then((record) => {
        if (!active) return;
        const savedToken = String(record?.snapshot?._project?.ownerAccessToken || '');
        if (!record || savedToken !== token) {
          setOwnerPanel({ loading: false, error: 'دسترسی این پنل معتبر نیست.', project: null });
          return;
        }
        setOwnerPanel({ loading: false, error: '', project: record });
      })
      .catch((error) => {
        if (active) setOwnerPanel({ loading: false, error: error.message || 'بارگذاری پنل ناموفق بود.', project: null });
      });
    return () => { active = false; };
  }, []);

  const handleRefreshTopics = async (onProgress = () => {}, runtimeOverride = null) => {
    if (!reportData || !reportTarget) throw new Error('گزارش فعالی برای به‌روزرسانی وجود ندارد.');
    const globalAi = loadAiSettings();
    const runtime = runtimeOverride || reportAiRuntime || { provider: '9router', config: { model: globalAi.model, fallbackModels: globalAi.fallbackModels } };
    onProgress('ساخت عبارت‌های جست‌وجو از صنعت، مخاطب و خدمات گزارش...');
    const searchQueries = await generateTopicSearchQueries(runtime.provider, runtime.config, reportTarget, reportData, onProgress);
    onProgress('جست‌وجوی بازار در YouTube، LinkedIn و Reddit با Apify...');
    const platformData = await collectTopicDiscoveryData(import.meta.env.VITE_APIFY_API_KEY || '', searchQueries);
    onProgress('تحلیل سیگنال‌ها و ساخت ۵۰ موضوع پرتکرار...');
    const audienceTopics = await generateAudienceTopics(runtime.provider, runtime.config, reportTarget, reportData, platformData, onProgress);
    const updated = { ...reportData, id: currentProjectId || reportData.id, audienceTopics, audienceTopicsMeta: { updatedAt: new Date().toISOString(), searchMode: 'market_wide_keyword_discovery', searchQueries, sourceStatus: Object.fromEntries(Object.entries(platformData).map(([key, value]) => [key, value.status])) } };
    await saveProject(updated, reportTarget);
    setReportData(updated);
    return audienceTopics;
  };

  const handleLoadProject = async (id) => {
    const snapshot = await loadProject(id);
    if (snapshot) {
      const savedTarget = snapshot._project?.target || { name: 'پروژه ذخیره‌شده' };
      const savedCompetitors = (snapshot.competitorAnalysis || []).map((competitor) => ({
        name: competitor.name,
        instagramHandle: competitor.instagramHandle,
        website: competitor.website,
      }));
      const handles = [savedTarget.instagramHandle, ...savedCompetitors.map((item) => item.instagramHandle)]
        .map(normalizeInstagramHandle).filter(Boolean);
      const signature = [...new Set(handles.map((handle) => handle.toLowerCase()))].sort().join('|');
      const cacheKey = `instagram-v2:${signature}`;
      const { payload: cached } = handles.length ? await loadResearchCacheFromKeys([cacheKey, signature]) : { payload: null };
      let repaired = snapshot;
      if (cached?.profiles && cached?.posts) {
        const profileMap = Object.fromEntries(cached.profiles.map((profile) => [normalizeInstagramHandle(profile.username).toLowerCase(), profile]));
        const enrich = (business) => {
          const handle = normalizeInstagramHandle(business.instagramHandle).toLowerCase();
          const instagramData = profileMap[handle] || null;
          const instagramPosts = cached.posts.filter((post) => postOwnerHandle(post) === handle);
          return { ...business, instagramData, instagramPosts, instagramSummary: summarizeInstagramPosts(instagramPosts, instagramData?.followersCount || 0) };
        };
        repaired = enforceReportIntegrity(snapshot, { target: enrich(savedTarget), competitors: savedCompetitors.map(enrich) });
      }
      setReportData(repaired); setReportTarget(savedTarget); setIsMock(false); setAppState(STATE.REPORT);
      setCurrentProjectId(id);
      const globalAi = loadAiSettings();
      setReportAiRuntime({ provider: '9router', config: { model: globalAi.model, fallbackModels: globalAi.fallbackModels } });
    }
  };

  const globalAiRuntime = reportAiRuntime || (() => {
    const settings = loadAiSettings();
    return { provider: '9router', config: { model: settings.model, fallbackModels: settings.fallbackModels } };
  })();
  const dashboardTarget = reportTarget && {
    ...reportTarget,
    aiPolicy: {
      primaryModel: globalAiRuntime.config.model,
      fallbackModels: globalAiRuntime.config.fallbackModels,
      strategy: 'ordered-failover',
    },
  };
  const app = appState === STATE.LOADING ? (
    <LoadingScreen currentStep={loadingStep} message={loadingMessage} error={loadingError} onUseMockData={handleUseMockFallback} language={language} />
  ) : appState === STATE.CPM_APPROVAL && pendingResearch ? (
    <CpmApproval model={pendingResearch.preliminary.cpmModel} target={pendingResearch.target} onApprove={handleApproveCpm} onCancel={handleReset} />
  ) : appState === STATE.REPORT && reportData ? (
    <ResearchDashboard data={reportData} target={dashboardTarget} isMock={isMock} onReset={handleReset} presentationAi={globalAiRuntime} onRefreshTopics={handleRefreshTopics} />
  ) : (
    <ConfigForm onSubmit={handleSubmit} loading={appState === STATE.LOADING} onLoadProject={handleLoadProject} language={language} />
  );
  if (ownerPanel.loading) return <div dir={dir} className="min-h-screen grid place-items-center text-slate-200">در حال بارگذاری پنل کارفرما…</div>;
  if (ownerPanel.error) return <div dir={dir} className="min-h-screen grid place-items-center text-red-300">{ownerPanel.error}</div>;
  if (ownerPanel.project) {
    const snapshot = ownerPanel.project.snapshot || {};
    const target = snapshot._project?.target || snapshot.target || { name: ownerPanel.project.name || 'گزارش' };
    return <div dir={dir}><ResearchDashboard data={snapshot} target={target} isMock={false} onReset={() => window.location.assign(window.location.pathname)} presentationAi={null} onRefreshTopics={null} readOnly /></div>;
  }
  return <div dir={dir}><AuthGate>{app}</AuthGate></div>;
}
