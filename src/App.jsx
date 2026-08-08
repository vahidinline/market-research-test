import { useRef, useState } from 'react';
import ConfigForm from './components/ConfigForm';
import LoadingScreen from './components/LoadingScreen';
import Report from './components/Report';
import {
  fetchInstagramProfiles,
  normalizeProfile,
  estimateEngagementRate,
} from './utils/apify';
import { buildAnalysisPrompt, analyzeWithAI } from './utils/ai';
import { MOCK_ANALYSIS } from './utils/mockData';
import AuthGate from './components/AuthGate';

const STATE = { FORM: 'form', LOADING: 'loading', REPORT: 'report' };

export default function App() {
  const [appState, setAppState] = useState(STATE.FORM);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingError, setLoadingError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [isMock, setIsMock] = useState(false);
  // Keep scraped data for this app session so an AI parse/retry never costs another Apify run.
  const profilesCache = useRef(new Map());

  const runWithMockData = (target) => {
    setIsMock(true);
    setReportTarget(target || { name: 'کسب‌وکار هدف', industry: 'عمومی' });
    setReportData(MOCK_ANALYSIS);
    setAppState(STATE.REPORT);
  };

  const handleSubmit = async (formData) => {
    const { provider, apifyToken, aiConfig, target, competitors, useMockData } =
      formData;

    if (useMockData) {
      runWithMockData(target);
      return;
    }

    setAppState(STATE.LOADING);
    setLoadingError(null);
    setLoadingStep(0);

    try {
      // Step 0: Fetch Instagram profiles via Apify
      setLoadingStep(0);
      const allHandles = [
        target.instagramHandle,
        ...competitors.map((c) => c.instagramHandle),
      ].filter(Boolean);

      const cacheKey = allHandles.map((h) => h.toLowerCase()).sort().join('|');
      let profiles = profilesCache.current.get(cacheKey) || [];
      if (allHandles.length > 0 && !profilesCache.current.has(cacheKey)) {
        const rawProfiles = await fetchInstagramProfiles(
          apifyToken,
          allHandles,
        );
        profiles = rawProfiles.map(normalizeProfile).filter(Boolean);
        profilesCache.current.set(cacheKey, profiles);
      }

      // Step 1: Enrich profiles
      setLoadingStep(1);
      const enrichedProfiles = profiles.map((p) => ({
        ...p,
        engagementRate: estimateEngagementRate(p),
      }));

      const profileMap = {};
      enrichedProfiles.forEach((p) => {
        profileMap[p.username?.toLowerCase()] = p;
      });

      const profilesData = {
        target: {
          ...target,
          instagramData:
            profileMap[target.instagramHandle?.toLowerCase()] || null,
        },
        competitors: competitors.map((c) => ({
          ...c,
          instagramData: profileMap[c.instagramHandle?.toLowerCase()] || null,
        })),
      };

      // Step 2: AI analysis
      setLoadingStep(2);
      const prompt = buildAnalysisPrompt(target, competitors, profilesData);
      let analysis;
      try {
        analysis = await analyzeWithAI(provider, aiConfig, prompt);
      } catch (firstError) {
        // Retry only the model call with a compact-output instruction. Apify data is reused above.
        const retryPrompt = `${prompt}\n\nپاسخ قبلی ناقص بود. این بار JSON را بسیار فشرده و بدون markdown، توضیح یا متن اضافه برگردان. از تمام فیلدهای schema استفاده کن اما متن‌ها را کوتاه نگه دار و حتماً JSON را کامل ببند.`;
        try {
          analysis = await analyzeWithAI(provider, aiConfig, retryPrompt);
        } catch {
          throw firstError;
        }
      }

      // Step 3: Done
      setLoadingStep(3);
      await new Promise((r) => setTimeout(r, 600));

      setReportTarget(target);
      setReportData(analysis);
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
  };

  const app = appState === STATE.LOADING ? (
    <LoadingScreen currentStep={loadingStep} error={loadingError} onUseMockData={handleUseMockFallback} />
  ) : appState === STATE.REPORT && reportData ? (
    <Report data={reportData} target={reportTarget} isMock={isMock} onReset={handleReset} />
  ) : (
    <ConfigForm onSubmit={handleSubmit} loading={appState === STATE.LOADING} />
  );
  return <AuthGate>{app}</AuthGate>;
}
