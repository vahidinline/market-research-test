import { runApifyActor, normalizeInstagramHandle } from './apify';
import { analyzeWithAI } from './ai';

const clean = (value) => String(value || '').trim();

export async function discoverIndustry({ apiToken, target, aiConfig = {}, provider = 'gemini', onProgress = () => {} }) {
  const query = `${target.industry} ${target.location || ''}`.trim();
  onProgress('پیدا کردن کسب‌وکارهای این صنعت در Google Maps...');
  const maps = await runApifyActor(apiToken, 'compass~google-maps-extractor', {
    searchStringsArray: [query, `${target.industry} businesses`, `${target.industry} competitors`],
    maxCrawledPlacesPerSearch: 40,
    language: 'fa',
  });
  onProgress('پیدا کردن نشانه‌های بازار در Instagram...');
  let instagram = [];
  try {
    instagram = await runApifyActor(apiToken, 'apify~instagram-search-scraper', {
      search: target.industry,
      searchType: 'user',
      resultsLimit: 40,
    });
  } catch (error) {
    console.warn('Instagram industry discovery skipped:', error);
  }
  const result = buildIndustryMap(target, maps, instagram);
  await classifyIndustryResults({ target, result, provider, aiConfig, onProgress });
  onProgress('نوشتن مقدمه جامع درباره ساختار و منطق این صنعت...');
  try {
    const brief = await analyzeWithAI(provider, aiConfig, `یک مقدمه حرفه‌ای و واقع‌گرایانه درباره صنعت «${target.industry}» بنویس. کسب‌وکار هدف: «${target.name}». داده‌های اولیه کسب‌وکارهای کشف‌شده: ${JSON.stringify(result.categories.map((category) => ({ category: category.name, businesses: category.businesses.slice(0, 8).map((item) => item.name) })))}\n\nخروجی فقط JSON معتبر با کلید overview برگردان. overview باید یک متن فارسی در ۲ تا ۳ پاراگراف کامل باشد و در آن تعریف و دامنه صنعت، مشتریان و نیازهای اصلی، مدل‌های رایج کسب‌وکار و درآمد، دسته‌بندی‌های اصلی، روندها و محرک‌های رقابت توضیح داده شود. از ادعای عددی بدون منبع خودداری کن و اگر داده کافی نیست با عبارت «به‌صورت کلی» بنویس.`);
    if (brief?.overview) result.intro = brief.overview;
  } catch (error) {
    console.warn('Industry briefing generation skipped:', error);
  }
  return result;
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

function normalizeBusiness(item = {}) {
  const website = item.website || item.websiteUrl || item.url || '';
  const handle = normalizeInstagramHandle(item.instagram || item.instagramUrl || item.instagramHandle || '');
  return {
    name: clean(item.title || item.name || item.businessName || item.placeName),
    website: clean(website),
    instagramHandle: handle,
    location: clean(item.address || item.location || item.city),
    rating: Number(item.totalScore ?? item.rating ?? 0) || 0,
    reviews: Number(item.reviewsCount ?? item.reviews ?? 0) || 0,
    category: clean(item.categoryName || item.category || item.type),
    source: item.source || 'Google Maps',
  };
}

function buildIndustryMap(target, maps = [], instagram = []) {
  const raw = [...maps.map(normalizeBusiness), ...instagram.map(normalizeBusiness)].filter((item) => item.name);
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
