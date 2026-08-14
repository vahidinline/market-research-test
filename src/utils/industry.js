import { runApifyActor, normalizeInstagramHandle } from './apify';
import { analyzeWithAI } from './ai';
import { loadIndustryResearchCache, saveIndustryResearchCache } from './researchCache';
import { inspectWebsite } from './website';

const clean = (value) => String(value || '').trim();
const PIPELINE_VERSION = 'v7-instagram-account-resolution';

export async function discoverIndustry({ apiToken, target, aiConfig = {}, provider = 'gemini', onProgress = () => {}, forceRefresh = false, reviewBriefing = '' }) {
  const { cacheKey, result } = await loadRawIndustryData({ apiToken, target, onProgress, forceRefresh });
  result.approvedBriefing = clean(reviewBriefing);
  // A human-approved briefing changes the analytical premise. Reusing a prior
  // structure in that case would make the approval step cosmetic.
  result.pipeline = result.approvedBriefing ? {} : result.pipeline;
  try {
    const normalized = await runCachedStage(cacheKey, result, 'normalizedBusinesses', () => result.businesses, 'نرمال‌سازی و حذف کسب‌وکارهای تکراری...');
    result.businesses = normalized;
    const sourceEvidence = await runSourceEvidenceStage({ cacheKey, result, onProgress, forceRefresh });
    const targetSourceEvidence = await runTargetSourceEvidenceStage({ cacheKey, result, target, onProgress, forceRefresh });
    const evidence = await runEvidenceStage({ cacheKey, result, target, provider, aiConfig, onProgress, sourceEvidence });
    const structure = await runStructureStage({ cacheKey, result, target, provider, aiConfig, onProgress, evidence, reviewBriefing: result.approvedBriefing });
    const placements = await runPlacementStage({ cacheKey, result, target, provider, aiConfig, onProgress, evidence, structure, targetSourceEvidence, reviewBriefing: result.approvedBriefing });
    applyPipelineResult(result, target, structure, placements, evidence);
    result.intelligenceStatus = 'complete';
  } catch (error) {
    console.error('Industry intelligence pipeline failed:', error);
    result.intelligenceStatus = 'failed';
    result.intelligenceError = error.message || 'تحلیل هوشمند صنعت انجام نشد.';
    result.categories = [];
    result.totalBusinesses = 0;
    result.intro = 'داده خام پیدا شد، اما یکی از مراحل تحلیل هوشمند کامل نشد. داده‌های خام و مراحل موفق در کش باقی مانده‌اند.';
  }
  return result;
}

export async function prepareIndustryReview({ apiToken, target, aiConfig = {}, provider = 'gemini', onProgress = () => {}, forceRefresh = false }) {
  const { result } = await loadRawIndustryData({ apiToken, target, onProgress, forceRefresh });
  onProgress('ساخت پیش‌تحلیل از داده‌های خام برای تأیید شما...');
  const response = await analyzeWithAI(provider, aiConfig, rawReviewPrompt(target, result.businesses));
  const briefing = clean(response?.briefing || response?.analysis || response?.overview);
  if (!briefing) throw new Error('پیش‌تحلیل صنعت تولید نشد. لطفاً دوباره تلاش کنید.');
  return { briefing, totalBusinesses: result.businesses.length };
}

async function loadRawIndustryData({ apiToken, target, onProgress = () => {}, forceRefresh = false }) {
  const cacheKey = industryCacheKey(target);
  const cached = await loadIndustryResearchCache(cacheKey);
  const query = `${target.industry} ${target.location || ''}`.trim();
  const collectionPlan = marketCollectionPlan(target);
  const scopedQueries = collectionPlan.queries;
  let maps = forceRefresh ? null : cached?.maps;
  if (!Array.isArray(maps)) {
    onProgress('پیدا کردن کسب‌وکارهای این صنعت در Google Maps...');
    maps = await runApifyActor(apiToken, 'compass~google-maps-extractor', {
      searchStringsArray: scopedQueries,
      maxCrawledPlacesPerSearch: 40,
      language: 'fa',
    });
    await saveIndustryResearchCache(cacheKey, { ...(cached || {}), maps, instagram: cached?.instagram || [], modelSearches: cached?.modelSearches || {} });
  } else onProgress('داده خام Google Maps از کش قابل ادامه بارگذاری شد...');
  let instagram = [];
  if (!collectionPlan.collectInstagram) {
    onProgress('حالت آفلاین انتخاب شده؛ گردآوری Instagram انجام نمی‌شود.');
  } else {
    onProgress('پیدا کردن نشانه‌های بازار در Instagram...');
    instagram = forceRefresh ? null : cached?.instagram;
    if (!Array.isArray(instagram)) instagram = [];
  }
  if (collectionPlan.collectInstagram && (!cached || !Array.isArray(cached.instagram))) {
    try {
      instagram = await runApifyActor(apiToken, 'apify~instagram-search-scraper', {
        search: query,
        searchType: 'user',
        resultsLimit: 40,
      });
    } catch (error) {
      console.warn('Instagram industry discovery skipped:', error);
    }
    await saveIndustryResearchCache(cacheKey, { ...(cached || {}), maps, instagram, modelSearches: cached?.modelSearches || {} });
  } else if (collectionPlan.collectInstagram) onProgress('داده خام Instagram از کش قابل ادامه بارگذاری شد...');
  const result = buildIndustryMap(target, maps, instagram);
  result.rawCacheKey = cacheKey;
  result.rawCache = { maps, instagram, modelSearches: cached?.modelSearches || {} };
  result.pipeline = !forceRefresh && cached?.pipelineVersion === PIPELINE_VERSION ? (cached?.pipeline || {}) : {};
  result.pipelineVersion = PIPELINE_VERSION;
  return { cacheKey, cached, result };
}

async function persistPipeline(cacheKey, result) {
  await saveIndustryResearchCache(cacheKey, { ...(result.rawCache || {}), pipelineVersion: PIPELINE_VERSION, pipeline: result.pipeline || {} });
}

async function runCachedStage(cacheKey, result, name, producer, progress) {
  if (result.pipeline?.[name]) return result.pipeline[name];
  if (progress) result.pipelineStatus = name;
  const value = await producer();
  result.pipeline = { ...(result.pipeline || {}), [name]: value };
  await persistPipeline(cacheKey, result);
  return value;
}

const chunksOf = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

async function runSourceEvidenceStage({ cacheKey, result, onProgress, forceRefresh = false }) {
  const existing = result.pipeline?.sourceEvidenceByBusiness || {};
  const pending = result.businesses.filter((item) => item.website && (forceRefresh || !existing[item.canonicalId || businessKey(item)]));
  if (!pending.length) return existing;
  onProgress(`بررسی عمیق صفحات رسمی وب‌سایت کسب‌وکارها (${pending.length} مورد)...`);
  const next = { ...existing };
  for (const business of pending) {
    const id = business.canonicalId || businessKey(business);
    try { next[id] = await inspectWebsite(business.website); }
    catch { next[id] = null; }
    result.pipeline = { ...(result.pipeline || {}), sourceEvidenceByBusiness: next };
    await persistPipeline(cacheKey, result);
  }
  return next;
}

async function runTargetSourceEvidenceStage({ cacheKey, result, target, onProgress, forceRefresh = false }) {
  if (!target.website) return result.pipeline?.targetSourceEvidence || null;
  if (!forceRefresh && result.pipeline?.targetSourceEvidence) return result.pipeline.targetSourceEvidence;
  onProgress('بررسی وب‌سایت رسمی کسب‌وکار هدف...');
  const evidence = await inspectWebsite(target.website);
  result.pipeline = { ...(result.pipeline || {}), targetSourceEvidence: evidence };
  await persistPipeline(cacheKey, result);
  return evidence;
}

async function runEvidenceStage({ cacheKey, result, target, provider, aiConfig, onProgress, sourceEvidence = {} }) {
  const existing = result.pipeline?.evidenceByBusiness || {};
  const pending = result.businesses.filter((item) => !existing[item.canonicalId || businessKey(item)]);
  const batches = chunksOf(pending, 10);
  for (let index = 0; index < batches.length; index += 1) {
    onProgress(`استخراج شواهد مدل کسب‌وکار از دسته ${index + 1} از ${batches.length}...`);
    const rows = batches[index].map((item) => {
      const id = item.canonicalId || businessKey(item);
      const website = sourceEvidence[id];
      const rawInstagram = result.rawCache?.instagram?.find((entry) => normalizeInstagramHandle(entry.username || entry.instagramHandle || entry.url || '') === item.instagramHandle);
      return { id, name: item.name, website: item.website, instagram: item.instagramHandle, location: item.location, category: item.category, sourceSignals: { googleMapsListing: item.source === 'Google Maps', hasPhysicalAddress: Boolean(item.location), hasWebsite: Boolean(item.website), hasInstagram: Boolean(item.instagramHandle), websiteTitle: website?.title || '', websiteText: String(website?.text || '').slice(0, 1800), websiteHasContact: Boolean(website?.hasContact), websiteHasBooking: Boolean(website?.hasBooking), instagramBio: rawInstagram?.biography || rawInstagram?.bio || '' } };
    });
    const response = await analyzeWithAI(provider, aiConfig, evidencePrompt(target, rows));
    const items = Array.isArray(response?.items) ? response.items : [];
    const next = { ...existing };
    items.forEach((item) => { if (item?.businessId) next[item.businessId] = item; });
    batches[index].forEach((item) => { const id = item.canonicalId || businessKey(item); if (!next[id]) next[id] = { businessId: id, signals: {}, evidence: [], evidenceStatus: 'not_found' }; });
    result.pipeline = { ...(result.pipeline || {}), evidenceByBusiness: next };
    await persistPipeline(cacheKey, result);
  }
  return result.pipeline?.evidenceByBusiness || existing;
}

async function runStructureStage({ cacheKey, result, target, provider, aiConfig, onProgress, evidence, reviewBriefing = '' }) {
  if (result.pipeline?.marketStructure) return result.pipeline.marketStructure;
  onProgress('استخراج زیرشاخه‌ها و مدل‌های واقعی بازار از شواهد کسب‌وکارها...');
  const businesses = result.businesses.map((item) => ({ id: item.canonicalId || businessKey(item), name: item.name, signals: evidence[item.canonicalId || businessKey(item)]?.signals || {}, evidence: evidence[item.canonicalId || businessKey(item)]?.evidence || [] }));
  const structure = await analyzeWithAI(provider, aiConfig, structurePrompt(target, businesses, reviewBriefing));
  result.pipeline = { ...(result.pipeline || {}), marketStructure: structure };
  await persistPipeline(cacheKey, result);
  return structure;
}

async function runPlacementStage({ cacheKey, result, target, provider, aiConfig, onProgress, evidence, structure, targetSourceEvidence, reviewBriefing = '' }) {
  if (result.pipeline?.placements) return result.pipeline.placements;
  onProgress('تعیین جایگاه کسب‌وکار هدف و تحلیل عمیق زیرشاخه آن...');
  const placement = await analyzeWithAI(provider, aiConfig, placementPrompt(target, structure, evidence, targetSourceEvidence, reviewBriefing));
  result.pipeline = { ...(result.pipeline || {}), placements: placement };
  await persistPipeline(cacheKey, result);
  return placement;
}

function applyPipelineResult(result, target, structure = {}, placement = {}, evidence = {}) {
  result.intro = structure.industryOverview || `نمای کلی صنعت ${target.industry} بر اساس داده‌های عمومی ایران.`;
  result.industryDefinition = structure.industryDefinition || '';
  result.subindustries = Array.isArray(structure.subindustries) ? structure.subindustries : [];
  result.targetPlacement = placement.targetPlacement || null;
  result.targetSubindustryBrief = placement.targetSubindustryBrief || null;
  const targetBusinesses = new Map(result.businesses.map((business) => [business.canonicalId || businessKey(business), business]));
  const standardModels = new Map((Array.isArray(structure.businessModels) ? structure.businessModels : []).map((model) => [clean(model.name), model]));
  if (result.targetSubindustryBrief?.businessModels) {
    result.targetSubindustryBrief.businessModels = result.targetSubindustryBrief.businessModels.map((model) => {
      const examples = (Array.isArray(model.caseBusinessIds) ? model.caseBusinessIds : []).map((id) => targetBusinesses.get(String(id))).filter(Boolean).map((business) => ({ ...business, businessModel: model.name }));
      const standard = standardModels.get(clean(model.name));
      return { ...standard, ...model, examples, exampleCount: examples.length, evidenceStatus: examples.length && standard ? 'observed' : 'unverified' };
    }).filter((model) => model.exampleCount > 0 && standardModels.has(clean(model.name)));
  }
  result.businessModels = result.targetSubindustryBrief?.businessModels || [];
  result.opportunities = result.targetSubindustryBrief?.opportunities || [];
  result.threats = result.targetSubindustryBrief?.threats || [];
  const decisions = new Map((Array.isArray(structure.classifications) ? structure.classifications : []).map((item) => [String(item.businessId), item]));
  const categories = result.subindustries.map((subindustry, index) => ({ id: `subindustry-${index}`, name: subindustry.name, description: subindustry.description || `زیرشاخه تخصصی ${subindustry.name} در صنعت ${target.industry}.`, businesses: [] }));
  result.businesses.forEach((business) => { const id = business.canonicalId || businessKey(business); const decision = decisions.get(id); if (!decision?.relevant || !standardModels.has(clean(decision.businessModel))) return; const category = categories.find((item) => item.name === decision.subindustry); if (category) category.businesses.push({ ...business, category: decision.subindustry, businessModel: decision.businessModel, evidence: evidence[id]?.evidence || [] }); });
  result.categories = categories.filter((category) => category.businesses.length > 0);
  result.totalBusinesses = result.categories.reduce((sum, category) => sum + category.businesses.length, 0);
}

function businessKey(item = {}) { return `${clean(item.name)}|${clean(item.website)}|${clean(item.instagramHandle)}`.toLowerCase(); }

function evidencePrompt(target, rows) { return `تو فقط استخراج‌کننده شواهد بازار ایران هستی. برای هر کسب‌وکار فقط ویژگی‌هایی را ثبت کن که از داده موجود قابل مشاهده است؛ حدس نزن و مدل کسب‌وکار جدید نساز. وجود آدرس/لیست Google Maps به‌تنهایی شواهد فروش حضوری است؛ وجود سایت/لینک سفارش/محصول به‌تنهایی شواهد فروش آنلاین است. اگر هر دو شواهد وجود داشتند، هر دو را true کن و evidence جداگانه بده. صنعت: ${target.industry}. خروجی فقط JSON معتبر با ساختار {"items":[{"businessId":"...","signals":{"manufacturer":false,"onlineRetail":false,"physicalRetail":false,"omnichannelRetail":false,"wholesaleB2B":false,"marketplaceSeller":false,"personalBrand":false,"organicBrand":false,"processedBrand":false,"subscriptionOrGifting":false,"customOrder":false},"evidence":[{"signal":"...","text":"...","source":"website|instagram|maps"}],"evidenceStatus":"observed|weak|not_found"}]}. omnichannelRetail فقط وقتی true است که onlineRetail و physicalRetail هر دو true باشند. داده‌ها: ${JSON.stringify(rows)}`; }

function rawReviewPrompt(target, businesses) { return `تو پژوهشگر ارشد بازار ایران هستی. داده‌های خام زیر از Google Maps و Instagram برای صنعت اعلامی جمع‌آوری شده‌اند، اما هنوز تحلیل نهایی شروع نشده است. محدودهٔ جغرافیایی این پژوهش «${target.location || 'نامشخص'}» و دامنهٔ بررسی بازار «${researchModeLabel(target.marketResearchMode)}» است؛ فقط همین محدوده و همین دامنه را تحلیل کن و هیچ کسب‌وکار یا روند خارج از آن را وارد متن نکن. یک پیش‌تحلیل فارسی در دقیقاً ۲ یا ۳ پاراگراف پیوسته بنویس تا کاربر آن را تأیید یا اصلاح کند. متن باید تصویر کلی صنعت، نشانه‌های قابل مشاهده در کسب‌وکارهای کشف‌شده، برداشت اولیه از بخش‌های بازار، و هر ابهام یا ریسک داده را پوشش دهد. از ساختن واقعیت، آمار و رقیب جدید خودداری کن؛ صنعت واردشده را قطعی فرض نکن و اگر با داده‌ها مبهم است صریحاً بگو. خروجی فقط JSON معتبر با ساختار {"briefing":"..."} باشد. کسب‌وکار هدف: ${JSON.stringify({ name: target.name, industry: target.industry, website: target.website, instagram: target.instagramHandle, location: target.location, marketResearchMode: researchModeLabel(target.marketResearchMode) })}. داده‌های خامِ پالایش‌شده: ${JSON.stringify(businesses.slice(0, 80).map((item) => ({ name: item.name, category: item.category, website: item.website, instagram: item.instagramHandle, location: item.location, source: item.source })))}`; }

function structurePrompt(target, businesses, reviewBriefing = '') { return `تو تحلیلگر ساختار بازار ایران هستی. دامنهٔ این پژوهش «${researchModeLabel(target.marketResearchMode)}» است؛ فقط مدل‌ها، بازیگران و شواهد سازگار با همین دامنه را تحلیل کن. ابتدا طبقه‌بندی استاندارد مدل‌های کسب‌وکار متناسب با همین صنعت را استخراج کن؛ مدل‌ها باید اصطلاحات رایج و قابل‌تعریف صنعت باشند، نه نام‌گذاری ابداعی و نه صرفاً کانال فروش. برای هر مدل، «مبنای استاندارد» را به‌صورت کوتاه مشخص کن: نقش در زنجیره ارزش، الگوی درآمد، یا قرارداد رایج صنعت. سپس فقط بر اساس شواهد واقعی، زیرشاخه‌ها و مدل‌های مشاهده‌شده را طبقه‌بندی کن. هر مدل باید دست‌کم یک businessId و شاهد متناظر داشته باشد؛ مدل بدون نمونه یا شاهد را حذف کن. پیش‌تحلیل تأییدشده/اصلاح‌شدهٔ کاربر یک الزام عملیاتی برای جهت تحلیل است: نکات، اصلاحات و محدودیت‌های آن را اعمال کن. فقط اگر با شواهد خام تعارض روشن دارد، تعارض را در industryOverview شفاف کن؛ آن را نادیده نگیر. از دسته‌های عمومی Google Maps مثل مغازه یا فروشگاه به‌عنوان زیرشاخه صنعت استفاده نکن. صنعت: ${target.industry}. کسب‌وکار هدف: ${target.name}. پیش‌تحلیل تأییدشده: ${reviewBriefing || 'ندارد'}. خروجی فقط JSON معتبر با این ساختار: {"industryOverview":"حداقل دو پاراگراف","industryDefinition":"...","businessModels":[{"name":"...","standardBasis":"نقش در زنجیره ارزش|الگوی درآمد|قرارداد رایج صنعت","definition":"...","businessIds":["..."],"evidenceSignals":["..."]}],"subindustries":[{"name":"...","description":"...","businessIds":["..."]}],"classifications":[{"businessId":"...","relevant":true,"subindustry":"...","businessModel":"نام دقیق یکی از businessModels","evidenceSignals":["..."]}]}. در classifications همه businessIdهای مرتبط را بیاور و نام businessModel باید دقیقاً با یکی از مدل‌های businessModels برابر باشد. شواهد: ${JSON.stringify(businesses)}`; }

function placementPrompt(target, structure, evidence, targetSourceEvidence, reviewBriefing = '') { return `تو استراتژیست بازار ایران هستی. بر اساس ساختار اثبات‌شده و شواهد، جایگاه و مدل کسب‌وکار هدف را تعیین کن. فقط از مدل‌های استاندارد موجود در structure استفاده کن و مدل جدید نساز. مدل‌های زیرشاخه باید حداقل یک نمونهٔ واقعی داشته باشند. پیش‌تحلیل تأییدشدهٔ کاربر را الزام عملیاتی بدان و همهٔ جزئیات آن را در تصمیم‌گیری اعمال کن؛ در صورت تعارض روشن با شواهد، confidence را کاهش بده و دلیل را بنویس. خروجی فقط JSON معتبر: {"targetPlacement":{"subindustry":"...","businessModel":"نام دقیق یکی از مدل‌های structure","confidence":"high|medium|low","reason":"..."},"targetSubindustryBrief":{"name":"...","overview":"دو تا سه پاراگراف عمیق که به اصلاحات کاربر هم پاسخ دهد","businessModels":[{"name":"نام دقیق یکی از مدل‌های structure","description":"...","revenueModel":"...","caseBusinessIds":["..."],"evidenceStatus":"observed"}],"opportunities":["..."],"threats":["..."],"successFactors":["..."]}}. کسب‌وکار هدف: ${JSON.stringify({ name: target.name, industry: target.industry, website: target.website, instagram: target.instagramHandle, location: target.location })}. پیش‌تحلیل تأییدشده: ${reviewBriefing || 'ندارد'}. شواهد سایت هدف: ${JSON.stringify(targetSourceEvidence || {})}. ساختار: ${JSON.stringify(structure)}. شواهد بازار: ${JSON.stringify(evidence)}`; }

async function collectTargetModelExamples({ apiToken, target, result, provider, aiConfig, onProgress, cacheKey }) {
  const models = result.businessModels || [];
  if (!models.length || !apiToken) return;
  onProgress('جمع‌آوری نمونه‌های واقعی مدل‌های بخش هدف از Google و Instagram...');
  const queries = models.flatMap((model) => [`${target.industry} ${result.targetPlacement?.subindustry || ''} ${model.name}`.trim(), `${model.name} ${target.industry} ایران`]);
  const modelSearchKey = models.map((model) => model.name).join('|');
  const cached = result.rawCache?.modelSearches?.[modelSearchKey];
  let maps = cached;
  if (!Array.isArray(maps)) {
    maps = await runApifyActor(apiToken, 'compass~google-maps-extractor', { searchStringsArray: queries.slice(0, 16), maxCrawledPlacesPerSearch: 20, language: 'fa' });
    const nextModelSearches = { ...(result.rawCache?.modelSearches || {}), [modelSearchKey]: maps };
    result.rawCache = { ...(result.rawCache || {}), modelSearches: nextModelSearches };
    await saveIndustryResearchCache(cacheKey, result.rawCache);
  } else onProgress('داده خام نمونه‌های مدل‌های کسب‌وکار از کش بارگذاری شد...');
  const candidates = [...new Map(maps.map(normalizeBusiness).filter((item) => item.name).map((item) => [`${item.name}|${item.website}`.toLowerCase(), item])).values()];
  if (!candidates.length) return;
  const classification = await analyzeWithAI(provider, aiConfig, `صنعت: ${target.industry}\nبخش هدف: ${result.targetPlacement?.subindustry || ''}\nمدل‌های هدف: ${JSON.stringify(models.map((model) => model.name))}\nکسب‌وکارها: ${JSON.stringify(candidates.map((item, index) => ({ index, name: item.name, category: item.category, website: item.website })))}\nفقط JSON معتبر با ساختار {"items":[{"index":0,"relevant":true,"businessModel":"...","evidence":"..."}]} برگردان. فقط اگر شواهد کافی برای تعلق به بخش هدف و مدل وجود دارد relevant=true بگذار.`);
  const items = Array.isArray(classification?.items) ? classification.items : [];
  const accepted = items.filter((item) => (item.relevant === true || String(item.relevant).toLowerCase() === 'true') && candidates[Number(item.index)]);
  result.businessModels = models.map((model) => { const examples = accepted.filter((item) => item.businessModel === model.name).map((item) => ({ ...candidates[Number(item.index)], businessModel: model.name, evidence: item.evidence || '', confidence: 'medium' })).slice(0, 10); return { ...model, examples, exampleCount: examples.length, minimumExamples: 10, evidenceStatus: examples.length >= 10 ? 'complete' : 'partial' }; });
  if (result.targetSubindustryBrief) result.targetSubindustryBrief.businessModels = result.businessModels;
}

function industryCacheKey(target = {}) {
  return [target.industry, target.location, researchMode(target), target.name, target.website, target.instagramHandle]
    .map((value) => clean(value).toLowerCase().replace(/\s+/g, '-'))
    .join('|');
}

function buildIndustryPrompt(target, businesses) {
  return `شما مشاور ارشد استراتژی و تحلیلگر صنایع هستید. صنعت «${target.industry}» را برای کسب‌وکار هدف «${target.name}» تحلیل کن. سایت: ${target.website || 'نامشخص'}، اینستاگرام: ${target.instagramHandle || 'نامشخص'}.

هدف: اول خود صنعت را تعریف کن، سپس زیرشاخه‌های واقعی بازار را بر اساس نوع محصول، خدمت، مشتری، زنجیره ارزش و مدل درآمدی پیدا کن؛ هرگز از دسته‌های مکانی Google Maps مثل مغازه، فروشگاه، مطب یا آجیل‌فروشی به‌عنوان زیرشاخه استفاده نکن. بعد کسب‌وکار هدف را در مناسب‌ترین زیرشاخه قرار بده و همان زیرشاخه را عمیق‌تر تحلیل کن. در آن زیرشاخه مدل‌های کسب‌وکار متفاوت را شناسایی کن؛ مثل تولیدکننده، کشاورز/تأمین‌کننده، محصول فرآوری‌شده، ارگانیک، فروشگاه، D2C، عمده‌فروشی، اشتراکی و پرسونال‌برند، اما فقط مواردی را برگردان که با صنعت داده‌شده سازگارند.

داده کسب‌وکارهای عمومی برای کشف و اعتبارسنجی: ${JSON.stringify(businesses.slice(0, 60).map((item, index) => ({ index, name: item.name, venueCategory: item.category, website: item.website, instagram: item.instagramHandle, location: item.location })))}

خروجی فقط JSON معتبر با همین ساختار باشد. متن‌ها فارسی، دقیق و کیفی باشند؛ عدد بدون منبع نساز. industryOverview حداقل ۲ تا ۳ پاراگراف باشد. subindustries بین ۴ تا ۸ مورد و businessModels بین ۳ تا ۸ مورد برگردان. classifications برای هر کسب‌وکار یک index، relevant، subindustry و businessModel بده. اگر داده کافی برای انتساب کسب‌وکاری نیست، relevant=false بگذار.
{"industryOverview":"...","industryDefinition":"...","subindustries":[{"name":"...","description":"...","customers":"...","offers":["..."],"competitiveLogic":"..."}],"targetPlacement":{"subindustry":"...","confidence":"high|medium|low","reason":"..."},"targetSubindustryBrief":{"name":"...","overview":"۲ تا ۳ پاراگراف عمیق درباره این زیرشاخه","businessModels":[{"name":"...","description":"...","revenueModel":"...","signals":["..."]}],"opportunities":["..."],"threats":["..."],"successFactors":["..."]},"classifications":[{"index":0,"relevant":true,"subindustry":"...","businessModel":"..."}]}`;
}

function applyIndustryIntelligence(result, intelligence, target) {
  if (!intelligence || typeof intelligence !== 'object') return;
  if (intelligence.industryOverview) result.intro = intelligence.industryOverview;
  result.industryDefinition = intelligence.industryDefinition || '';
  result.subindustries = Array.isArray(intelligence.subindustries) ? intelligence.subindustries : [];
  result.targetPlacement = intelligence.targetPlacement || null;
  result.targetSubindustryBrief = intelligence.targetSubindustryBrief || null;
  result.businessModels = intelligence.targetSubindustryBrief?.businessModels || [];
  result.opportunities = intelligence.targetSubindustryBrief?.opportunities || [];
  result.threats = intelligence.targetSubindustryBrief?.threats || [];
  const classifications = Array.isArray(intelligence.classifications) ? intelligence.classifications : [];
  const classified = new Map(classifications.map((item) => [Number(item.index), item]));
  const relevant = result.businesses.map((item, index) => ({ item, decision: classified.get(index) })).filter(({ decision }) => decision?.relevant === true || ['true', 'بله', 'مرتبط'].includes(String(decision?.relevant).toLowerCase()));
  result.categories = result.subindustries.map((subindustry, index) => ({ id: `subindustry-${index}`, name: subindustry.name, description: subindustry.description || `زیرشاخه تخصصی ${subindustry.name} در صنعت ${target.industry}.`, businesses: relevant.filter(({ decision }) => decision.subindustry === subindustry.name).map(({ item, decision }) => ({ ...item, category: decision.subindustry, businessModel: decision.businessModel })) }));
  result.categories = result.categories.filter((category) => category.businesses.length || result.subindustries.length <= 4);
  result.totalBusinesses = relevant.length;
}

async function classifyIndustryResults({ target, result, provider, aiConfig, onProgress }) {
  const businesses = result.categories.flatMap((category) => category.businesses);
  if (!businesses.length) return;
  onProgress('اعتبارسنجی ارتباط کسب‌وکارها با صنعت هدف...');
  try {
    const prompt = 'صنعت هدف: «' + target.industry + '». فهرست کسب‌وکارهای کشف‌شده را بررسی کن. فقط کسب‌وکارهایی را مرتبط بدان که واقعاً محصول یا خدمت آن‌ها در همین صنعت است؛ شباهت مکانی یا کلمه عمومی کافی نیست. خروجی فقط JSON معتبر با ساختار {"items":[{"index":0,"relevant":true,"category":"نام زیرشاخه مناسب"}]} باشد. برای هر index دقیقاً یک مورد بده. کسب‌وکارها: ' + JSON.stringify(businesses.map((item, index) => ({ index, name: item.name, category: item.category, website: item.website })));
    const response = await analyzeWithAI(provider, aiConfig, prompt);
    const decisions = Array.isArray(response?.items)
      ? response.items
      : Array.isArray(response?.businesses)
        ? response.businesses
        : Array.isArray(response?.classifications)
          ? response.classifications
          : [];
    const venueWords = /آجیل.?فروشی|مغازه|فروشگاه|سوپرمارکت|رستوران|کافه|پزشک|درمانگاه|مطب|سالن زیبایی|store|shop|restaurant|cafe/i;
    const isTrue = (value) => value === true || ['true', 'yes', 'بله', 'مرتبط'].includes(String(value).trim().toLowerCase());
    const accepted = decisions.filter((item) => isTrue(item.relevant ?? item.isRelevant ?? item.related) && Number.isInteger(Number(item.index)) && clean(item.category || item.subcategory || item.segment) && !venueWords.test(item.category || item.subcategory || item.segment));
    if (!accepted.length) {
      result.categories = [];
      result.totalBusinesses = 0;
      result.intro = 'برای صنعت ' + target.industry + '، داده مرتبط قابل تأیید از نتایج عمومی پیدا نشد. رقبای دستی فرم همچنان قابل استفاده هستند.';
      return;
    }
    const acceptedByIndex = new Map(accepted.map((item) => [Number(item.index), clean(item.category || item.subcategory || item.segment) || 'سایر کسب‌وکارهای مرتبط']));
    const filtered = businesses.map((item, index) => ({ item, index })).filter(({ index }) => acceptedByIndex.has(index)).map(({ item, index }) => ({ ...item, category: acceptedByIndex.get(index) }));
    const names = [...new Set(filtered.map((item) => item.category).filter(Boolean))].slice(0, 8);
    result.categories = names.map((name, index) => ({ id: 'category-' + index, name, description: 'کسب‌وکارهای مرتبط با بخش «' + name + '» در صنعت ' + target.industry + '.', businesses: filtered.filter((item) => item.category === name).slice(0, 12) }));
    result.totalBusinesses = filtered.length;
  } catch (error) {
    console.warn('Industry relevance validation skipped:', error);
  }
}

function normalizeBusiness(item = {}, sourceHint = 'Google Maps') {
  const website = item.website || item.websiteUrl || item.externalUrl || item.url || '';
  const handle = normalizeInstagramHandle(item.instagram || item.instagramUrl || item.instagramHandle || item.username || item.handle || item.profileUrl || '');
  return {
    name: clean(item.title || item.name || item.fullName || item.businessName || item.placeName),
    website: clean(website),
    instagramHandle: handle,
    location: clean(item.address || item.location || item.city),
    rating: Number(item.totalScore ?? item.rating ?? 0) || 0,
    reviews: Number(item.reviewsCount ?? item.reviews ?? 0) || 0,
    category: clean(item.categoryName || item.category || item.type),
    source: item.source || sourceHint,
  };
}

function normalizedName(value = '') {
  return clean(value)
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function websiteHost(value = '') {
  try { return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

function accountMatchScore(business, account) {
  const businessName = normalizedName(business.name);
  const accountName = normalizedName(account.name);
  const businessHost = websiteHost(business.website);
  const accountHost = websiteHost(account.website);
  if (businessHost && accountHost && businessHost === accountHost) return 1;
  if (!businessName || !accountName) return 0;
  if (businessName === accountName) return 0.96;
  const businessTokens = new Set(businessName.split(' ').filter((item) => item.length > 1));
  const accountTokens = new Set(accountName.split(' ').filter((item) => item.length > 1));
  const shared = [...businessTokens].filter((item) => accountTokens.has(item)).length;
  if (!shared) return 0;
  return shared / Math.max(businessTokens.size, accountTokens.size);
}

function linkInstagramAccounts(mapBusinesses, instagramBusinesses) {
  const claimed = new Set();
  const linked = mapBusinesses.map((business) => {
    if (business.instagramHandle) return business;
    const candidate = instagramBusinesses
      .map((account, index) => ({ account, index, score: accountMatchScore(business, account) }))
      .filter(({ account, index }) => account.instagramHandle && !claimed.has(index))
      .sort((a, b) => b.score - a.score)[0];
    // Exact names, a shared official domain, or a strong multi-token name match
    // are required. Similar-looking accounts stay unlinked rather than guessed.
    if (!candidate || candidate.score < 0.72) return business;
    claimed.add(candidate.index);
    return { ...business, instagramHandle: candidate.account.instagramHandle, instagramMatchConfidence: candidate.score >= 0.95 ? 'high' : 'medium', instagramMatchSource: candidate.account.source };
  });
  return { linked, unmatchedInstagram: instagramBusinesses.filter((_, index) => !claimed.has(index)) };
}

function researchMode(target = {}) {
  return ['online', 'offline', 'hybrid'].includes(target.marketResearchMode) ? target.marketResearchMode : 'hybrid';
}

function researchModeLabel(value) {
  return ({ online: 'بازار آنلاین', offline: 'بازار آفلاین', hybrid: 'بازار ترکیبی (آنلاین و آفلاین)' })[value] || 'بازار ترکیبی (آنلاین و آفلاین)';
}

function marketCollectionPlan(target = {}) {
  const mode = researchMode(target);
  const base = `${target.industry} ${target.location || ''}`.trim();
  const terms = mode === 'online'
    ? ['فروش اینترنتی', 'خرید آنلاین', 'فروشگاه آنلاین', 'ecommerce']
    : mode === 'offline'
      ? ['فروشگاه حضوری', 'مغازه', 'بازار محلی', 'عمده فروشی']
      : ['فروش اینترنتی', 'فروشگاه حضوری', 'خرید آنلاین', 'عمده فروشی'];
  return {
    collectInstagram: mode !== 'offline',
    queries: [base, ...terms.map((term) => `${target.industry} ${term} ${target.location || ''}`.trim())]
      .filter((item, index, items) => item && items.indexOf(item) === index),
  };
}

const FOREIGN_LOCATION_MARKERS = /\b(canada|toronto|usa|u\.s\.a|united states|america|uk|united kingdom|london|germany|deutschland|australia|dubai|uae|turkey|istanbul)\b|کانادا|تورنتو|آمریکا|انگلیس|لندن|آلمان|استرالیا|دبی|امارات|ترکیه|استانبول/i;

function isWithinGeographicScope(business, target = {}) {
  const scope = clean(target.location).toLowerCase();
  const location = clean(business.location);
  if (!scope || !location) return true;
  // Iran is a country-wide scope: keep Iranian city-level records, but reject
  // explicit foreign locations that can leak in through broad Maps searches.
  if (/\biran\b|ایران/i.test(scope)) return !FOREIGN_LOCATION_MARKERS.test(location);
  return true;
}

function matchesResearchMode(business, target = {}) {
  const mode = researchMode(target);
  if (mode === 'online') return Boolean(business.website || business.instagramHandle);
  if (mode === 'offline') return Boolean(business.location);
  return true;
}

function buildIndustryMap(target, maps = [], instagram = []) {
  const mapBusinesses = maps.map((item) => normalizeBusiness(item, 'Google Maps'));
  const instagramBusinesses = instagram.map((item) => normalizeBusiness(item, 'Instagram'));
  const { linked, unmatchedInstagram } = linkInstagramAccounts(mapBusinesses, instagramBusinesses);
  const raw = [...linked, ...unmatchedInstagram]
    .filter((item) => item.name && isWithinGeographicScope(item, target) && matchesResearchMode(item, target));
  const unique = [...new Map(raw.map((item) => [(`${item.name}|${item.website}|${item.instagramHandle}`).toLowerCase(), item])).values()];
  // Google Maps categories describe the venue, not the industry's competitive
  // subgroups. They must never be shown as market segments.
  const names = ['در حال تحلیل زیرگروه‌های تخصصی'];
  const categories = names.map((name, index) => ({
    id: `category-${index}`,
    name,
    description: `کسب‌وکارهایی که در بخش «${name}» از صنعت ${target.industry} فعالیت می‌کنند.`,
    businesses: unique.slice(0, 12),
  }));
  const assigned = new Set(categories.flatMap((category) => category.businesses.map((item) => item.name)));
  // The AI classifier replaces this placeholder after it validates relevance.
  const total = unique.length;
  return {
    title: `نقشه اولیه صنعت ${target.industry}`,
    intro: total
      ? `در جست‌وجوی اولیه ${total} کسب‌وکار عمومی پیدا شد. بازار به ${categories.length} بخش قابل بررسی تقسیم شد؛ این دسته‌بندی اولیه است و می‌توانید پیش از شروع گزارش آن را اصلاح کنید.`
      : `برای صنعت ${target.industry} داده عمومی کافی پیدا نشد. دسته‌بندی اولیه ساخته شده و می‌توانید رقبا را دستی اضافه کنید.`,
    categories,
    businesses: unique,
    totalBusinesses: total,
    generatedAt: new Date().toISOString(),
  };
}
