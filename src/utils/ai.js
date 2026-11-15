/**
 * AI analysis utility supporting both Google Gemini and OpenRouter
 */
import { calculateCpmRow, validateCpmModel, cpmSensitivity } from './cpm.js';
import { logAi } from './aiLogs.js';
import { compactEvidence, compactInstagram } from './aiEvidence.js';
import { discoverAudienceTopics, topicContext } from './audienceTopics.js';
import { readAiTransport } from './aiTransport.js';
import { withDeadline } from './deadline.js';
import { retryAiRequest } from './aiRetry.js';
import { researchScope, sampleMetadata, RESEARCH_RULES } from './researchPolicy.js';
import { businessEvidence, validateIndicatorEvidence, sanitizeProfileAnalysis, preserveIndicatorIds } from './researchEvidence.js';
import { createStageRunner, promptBudget, boundedBatches } from './analysisStages.js';

const compactWebsiteData = (websiteData, textLimit, pageLimit, pageTextLimit) => {
  if (!websiteData) return null;
  return {
    url: websiteData.url,
    status: websiteData.status,
    title: websiteData.title,
    hasBooking: websiteData.hasBooking,
    hasContact: websiteData.hasContact,
    hasBlog: websiteData.hasBlog,
    mobileMeta: websiteData.mobileMeta,
    seo: compactEvidence(websiteData.seo, 2000),
    crawlStatus: websiteData.crawlStatus,
    pagesCrawled: websiteData.pagesCrawled,
    evidence: compactEvidence((websiteData.evidence || []).slice(0, pageLimit), 3000),
    pages: (websiteData.pages || []).slice(0, pageLimit).map((page) => ({
      url: page.url,
      title: page.title,
      text: String(page.text || '').slice(0, pageTextLimit),
    })),
    text: websiteData.pages?.length ? undefined : String(websiteData.text || '').slice(0, textLimit),
  };
};

// ─── Prompt builder (shared) ─────────────────────────────────────────────────

export function buildAnalysisPrompt(targetBusiness, competitors, profilesData) {
  const outputLanguage = targetBusiness.outputLanguage === 'en' ? 'English' : 'Persian';
  const compactPost = (post = {}) => ({ ownerUsername: post.ownerUsername || post.username || '', type: post.type || post.mediaType || (post.isVideo ? 'Video' : 'Image'), timestamp: post.timestamp || post.takenAt || '', caption: String(post.caption || post.text || '').slice(0, 700), likes: post.likesCount ?? post.likes ?? 0, comments: post.commentsCount ?? post.comments ?? 0, views: post.videoViewCount ?? post.videoPlayCount ?? post.views ?? 0, url: post.url || (post.shortCode ? `https://instagram.com/p/${post.shortCode}` : '') });
  const compactBusiness = (business = {}) => ({ name: business.name, industry: business.industry, instagramHandle: business.instagramHandle, website: business.website, instagramData: compactInstagram(business.instagramData), instagramSummary: compactEvidence(business.instagramSummary, 3000), instagramPosts: (business.instagramPosts || []).slice(0, 20).map(compactPost), websiteData: compactWebsiteData(business.websiteData, 12000, 6, 1800) });
  const dataJson = JSON.stringify({ target: compactBusiness(profilesData.target), competitors: (profilesData.competitors || []).map(compactBusiness) });

  return `You are a senior market research strategist. Produce the complete report in ${outputLanguage}. Every qualitative field, label, recommendation, explanation, and user-facing text must be written in ${outputLanguage}; do not mix languages. Based on the raw data below, create a deep, professional market research report.

**کسب‌وکار هدف:** ${targetBusiness.name} (صنعت: ${targetBusiness.industry})
**اینستاگرام:** @${targetBusiness.instagramHandle}
**وب‌سایت:** ${targetBusiness.website}
**کانال‌های دیجیتال هدف:** LinkedIn=${targetBusiness.linkedin || 'ندارد'} | YouTube=${targetBusiness.youtube || 'ندارد'} | Reddit=${targetBusiness.reddit || 'ندارد'}

**رقبا:**
${competitors.map((c, i) => `${i + 1}. ${c.name} - @${c.instagramHandle} - ${c.website} - LinkedIn:${c.linkedin || 'ندارد'} - YouTube:${c.youtube || 'ندارد'} - Reddit:${c.reddit || 'ندارد'}`).join('\n')}

**داده‌های اسکرپ شده از اینستاگرام و وب‌سایت:**
\`\`\`json
${dataJson}
\`\`\`

لطفاً **فقط** یک JSON معتبر با ساختار دقیق زیر برگردانید (بدون هیچ توضیح، مقدمه یا متن اضافه در ابتدا یا انتها):

{
  "industryOverview": "تحلیل چندپاراگرافی بسیار مفصل و جامع صنعت. پاراگراف اول: معرفی کلان صنعت، روندها و جایگاه اقتصادی آن در ایران و جهان. پاراگراف دوم تا ششم: معرفی ۵ بخش اصلی این صنعت (به صورت یک لیست شماره‌دار با توضیحات عمیق برای هر کدام؛ مثلاً برای زیبایی: ۱. محصولات آرایشی ۲. خدمات سالن‌ها ۳. پزشکی زیبایی و...؛ یا برای املاک: ۱. توسعه و ساخت ۲. واسطه‌گری معامله و...). پاراگراف هفتم: تحلیل موقعیت کسب‌وکار هدف و اتصال آن به زیربخش مربوطه با تحلیل پتانسیل‌ها.",
  "marketCategories": [{"name": "نام دسته بازار/محصول", "share": 35}],
  "competitorList": [{"name": "نام برند رقیب", "instagramHandle": "@handle", "website": "https://...", "location": "شهر", "followers": 0, "verified": false}],
  "competitorAnalysis": [
    {
      "name": "نام برند رقیب",
      "instagramHandle": "@handle",
      "followers": 0,
      "posts": 0,
      "engagementRate": "x.x%",
      "location": "شهر یا نامشخص",
      "activePlatforms": ["Instagram", "Website"],
      "bio": "یک پاراگراف معرفی عمیق و حرفه‌ای رقیب (بین ۱۰۰ تا ۱۵۰ کلمه) شامل تاریخچه، سابقه، نام موسس یا پزشک در صورت وجود، سبک برندینگ، تعداد شعب، هویت برند و تمرکز اصلی خدمات آن‌ها در بازار.",
      "services": [
        "سیاهه‌ای از خدمات رقیب همراه با دسته‌بندی آن‌ها به صورت تگ‌های واضح و مشخص، مثلاً: خدمات غیرجراحی: تزریق بوتاکس، خدمات جراحی: رینوپلاستی، خدمات کاشت: کاشت مو"
      ],
      "marketingActions": [
        "اقدام بازاریابی ۱: توضیح کامل و تشریحی نحوه پیاده‌سازی این اقدام توسط رقیب بر اساس داده‌های موجود (مثلاً: اینفلوئنسر مارکتینگ: همکاری با بلاگرهای سبک زندگی برای ترویج خدمات...)",
        "اقدام بازاریابی ۲: توضیح کامل تشریحی...",
        "اقدام بازاریابی ۳: توضیح کامل تشریحی..."
      ],
      "strengths": ["نقطه قوت کلیدی ۱ رقیب", "نقطه قوت ۲"],
      "weaknesses": ["نقطه ضعف کلیدی ۱ رقیب", "نقطه ضعف ۲"],
      "overallScore": 7,
      "instagramAnalytics": {
        "firstPost": null,
        "firstPostStatus": "not_collected",
        "oldestSampledPost": "تاریخ شمسی یا میلادی اولین پست نمونه‌برداری‌شده",
        "lastPost": "تاریخ آخرین پست",
        "postsAnalyzed": 0,
        "totalPosts": 0,
        "followers": 0,
        "engagementRate": null,
        "mediaDistribution": {"photos": 60, "videos": 20, "carousels": 20},
        "contentAnalysis": {
          "visualQuality": "تحلیل عمیق و حرفه‌ای کیفیت بصری، نورپردازی، تدوین ویدئوها، نوع دوربین‌ها و تجهیزات تولید محتوا بر اساس پست‌های نمونه.",
          "creativity": "ارزیابی سطح خلاقیت در ایده‌پردازی، گرافیک و سبک ارائه محتواهای تصویری.",
          "scriptTopic": "تحلیل موضوعات و سناریوهای انتخاب‌شده برای ریل‌ها و پست‌ها؛ آیا هدفمند و دارای قلاب قوی هستند یا خیر.",
          "storytelling": "تحلیل استوری‌لاین و نحوه روایت داستان برند در پست‌ها و استوری‌ها.",
          "bio": "ارزیابی دقیق بیوگرافی پیج، شامل شعار تبلیغاتی، وضوح راه‌های ارتباطی، زیبایی‌شناسی آواتار و لوگو.",
          "highlights": "تحلیل کیفیت و کاورهای هایلایت‌ها، نظم دسته‌بندی موضوعی خدمات و میزان کاربردی بودن آن‌ها برای مراجعین.",
          "layout": "تحلیل چیدمان کلی صفحه (Grid Layout)، هارمونی رنگ‌ها، هماهنگی کاورها با رنگ سازمانی برند.",
          "captions": "ارزیابی نگارش کپشن‌ها، صمیمانه یا رسمی بودن لحن، استفاده از دعوت به اقدام (CTA) و استفاده درست از هشتگ‌ها."
        },
        "bestContent": {
          "title": "عنوان یا ایده محتوایی پست برتر رقیب در نمونه بررسی‌شده",
          "link": "لینک کامل پست برتر در اینستاگرام"
        }
      },
      "websiteAnalytics": {
        "uxScore": 7,
        "mobileFriendly": true,
        "seoStatus": "خوب / عالی / ضعیف",
        "onlineBooking": true,
        "liveSupport": false,
        "narrative": "یک تحلیل متنی و تشریحی بسیار مفصل (حدود ۱۰۰ کلمه) از وضعیت وب‌سایت رقیب، شامل پسوند دامنه، رتبه سئو تقریبی برای کلیدواژه‌های اصلی صنعت در گوگل، بخش‌های اصلی سایت (تماس با ما، مقالات، خدمات)، کیفیت بصری، سرعت بارگذاری، میزان انطباق با موبایل و وجود قابلیت‌های رزرو نوبت یا پشتیبانی آنلاین."
      }
    }
  ],
  "swot": {
    "strengths": ["نقاط قوت درونی کسب‌وکار هدف شامل آمار فالوور، تعامل، منابع و..."],
    "weaknesses": ["نقاط ضعف درونی کسب‌وکار هدف شامل ضعف محتوایی، نبود وب‌سایت و..."],
    "opportunities": ["فرصت‌های بیرونی بازار شامل مهاجرت، جذب توریست، ترندهای جدید و قشر مخاطبان خاص"],
    "threats": ["تهدیدهای بیرونی بازار شامل نوسانات نرخ ارز، نوسانات اقتصادی، فیلترینگ و حضور رقبای قدرتمند دیجیتال"]
  },
  "cpmMatrix": {
    "headers": ["کسب‌وکار", "اینستاگرام", "وب‌سایت", "اعتبار", "خدمات", "مجموع"],
    "rows": [
      {
        "name": "نام کسب‌وکار هدف یا نام رقیب (ردیف اول همیشه باید کسب‌وکار هدف باشد)",
        "isTarget": true,
        "instagram": 0.0,
        "website": 0.0,
        "credibility": 0.0,
        "services": 0.0,
        "total": 0.0,
        "instagramBreakdown": {
          "visualQuality": 7,
          "creativity": 6,
          "scriptTopic": 7,
          "captions": 6,
          "storytelling": 7,
          "bio": 7,
          "highlights": 7,
          "layout": 7,
          "engagementRate": 7
        },
        "websiteBreakdown": {
          "ux": 6,
          "deviceCompatibility": 7,
          "seo": 5,
          "serviceCategorization": 6,
          "onlineBooking": 4,
          "liveSupport": 5
        },
        "credibilityBreakdown": {
          "physicalStore": 7,
          "digitalPresence": 7,
          "influencerCollabs": 6,
          "yearsExperience": 7
        },
        "servicesBreakdown": {
          "productDiversity": 8,
          "customization": 7,
          "accessories": 7,
          "additionalServices": 8
        }
      }
    ]
  },
  "platformAnalytics": {
    "youtube": {"status": "active/not_found", "subscribers": 0, "videos": 0, "contentNotes": "تحلیل حضور"},
    "linkedin": {"status": "active/not_found", "followers": 0, "contentNotes": "تحلیل حضور"},
    "reddit": {"status": "active/not_found", "posts": 0, "comments": 0, "contentNotes": "تحلیل بحث‌ها و دغدغه‌ها"}
  },
  "recommendations": [
    {
      "priority": 1,
      "title": "عنوان توصیه استراتژیک",
      "description": "توضیح کامل و عمیق توصیه استراتژیک در جهت رشد دیجیتال مارکتینگ و برندینگ کسب‌وکار هدف.",
      "actionSteps": [
        "قدم اجرایی اول: توضیح گام‌های عملی",
        "قدم اجرایی دوم",
        "قدم اجرایی سوم"
      ]
    }
  ]
}

قوانین حیاتی تحلیل و تولید پاسخ:
1. امتیازهای CPM (بین ۱ تا ۱۰) باید کاملاً منطقی و متناسب با واقعیت‌ها باشند. مثلاً کسب‌وکاری که وب‌سایت ندارد در وب‌سایت امتیاز ۰ می‌گیرد. برندهای قوی‌تر باید امتیازهای بالاتری در اعتبار و اینستاگرام داشته باشند. میانگین breakdownها باید امتیاز کل هر فاکتور را به درستی در cpmMatrix بسازد.
2. cpmMatrix.rows اول باید کسب‌وکار هدف باشد.
3. در competitorAnalysis اطلاعات فالوور، تعداد پست‌ها، قدیمی‌ترین و جدیدترین پست نمونه‌برداری‌شده را به صورت واقعی از داده‌های خام JSON اسکرپ‌شده استخراج کنید و هرگز حدس نزنید.
4. positioningMaps تولید نکنید؛ اپلیکیشن نقشه‌ها را مستقیماً از CPM تأییدشده محاسبه می‌کند.
5. دقیقاً ۵ توصیه استراتژیک بسیار کاربردی و تخصصی در بخش recommendations به ترتیب اولویت (priority از ۱ تا ۵) ارائه دهید که هر کدام شامل ۲ تا ۴ گام اجرایی کاملاً مشخص در بخش actionSteps باشد.
6. تمام تحلیل‌های کیفی و توضیحات را فقط به زبان ${outputLanguage}، با دایره لغات تخصصی مارکتینگ بنویسید و هیچ زبان دیگری را وارد خروجی نکنید.`;
}

const compactForChunks = (business = {}) => ({
  name: business.name, industry: business.industry, instagramHandle: business.instagramHandle, website: business.website,
  scope: researchScope(business), sampling: sampleMetadata(business),
  instagramData: compactInstagram(business.instagramData),
  instagramSummary: business.instagramSummary ? { postsAnalyzed: business.instagramSummary.postsAnalyzed, engagementRate: business.instagramSummary.engagementRate, averageLikes: business.instagramSummary.averageLikes, averageComments: business.instagramSummary.averageComments } : null,
  evidence: businessEvidence(business),
  websiteAudit: business.websiteData ? { status: business.websiteData.status, seo: compactEvidence(business.websiteData.seo, 1500), mobileMeta: business.websiteData.mobileMeta, hasBooking: business.websiteData.hasBooking } : null,
});

const jsonOnly = (task, data, schema, language = null) => {
  const requested = language || data?.target?.outputLanguage || data?.business?.outputLanguage || 'fa';
  return `${RESEARCH_RULES}\nYou are a senior market analyst. Return valid JSON only. Write every textual value in ${requested === 'en' ? 'English' : 'Persian'}, with no mixed-language prose.\n\nTask:\n${task}\n\nData:\n${JSON.stringify(data)}\n\nExact output structure:\n${schema}`;
};

const createChunkRunner = (provider, config, onProgress) => async (label, prompt) => {
  const budget = promptBudget(prompt, config);
  logAi('stage_budget', { stage: label, model: config.model, ...budget });
  onProgress(label);
  try { return await analyzeWithAI(provider, config, prompt); }
  catch (error) { throw Object.assign(new Error(`${label} — ${error.message}`), { code: error.code, retryable: error.retryable, rawContent: error.rawContent }); }
};

const AUDIENCE_TOPIC_SCHEMA = '{"topics":[{"rank":1,"topic":"موضوع محدود و مشخص","audienceQuestion":"سؤال واقعی مخاطب با لحن طبیعی","audienceConcern":"دغدغه یا تصمیم پشت سؤال","whyItMatters":"چرا موضوع پیوسته مورد توجه است","searchIntent":"informational|commercial|transactional|navigational","journeyStage":"awareness|consideration|decision|retention","contentAngles":["زاویه مشخص ۱","زاویه مشخص ۲","زاویه مشخص ۳"],"platformSignals":[{"platform":"Google|Instagram|YouTube|LinkedIn|Reddit|Forum|Website","signalType":"search_demand|paa_faq|engagement|repetition|discussion","evidence":"شاهد کوتاه یا not_observed","sourceUrl":null}],"validationStatus":"observed|partially_observed|hypothesis","confidence":"high|medium|low","suggestedQueries":["عبارت اعتبارسنجی ۱","عبارت ۲"],"evergreenReason":"دلیل ماندگاری"}]}';

export async function generateAudienceTopics(provider, config, target, report, platformData = {}, onProgress = () => {}, checkpoint = null) {
  const sourceData = { ...platformData };
  for (const channel of ['website', 'instagram']) {
    const items = (report.researchEvidence || []).filter(item => item.channel === channel).map(item => ({ text: item.excerpt, url: item.url, title: item.business || '' }));
    if (items.length) sourceData[channel] = { items, status: 'stored_evidence' };
  }
  return discoverAudienceTopics({ target, report, platformData: sourceData,
    execute: createChunkRunner(provider, config, onProgress), checkpoint,
    schema: AUDIENCE_TOPIC_SCHEMA, progress: onProgress,
  });
}

export async function generateTopicSearchQueries(provider, config, target, report, onProgress = () => {}) {
  const run = createChunkRunner(provider, config, onProgress);
  const result = await run('ساخت عبارت‌های جست‌وجوی موضوعی برای Apify...', jsonOnly(
    `برای کشف دغدغه‌ها و موضوعات پرتکرار بازار ${target.industry} دقیقاً ۱۵ عبارت جست‌وجوی مستقل بساز. عبارت‌ها درباره برند هدف نباشند؛ باید کل بازار، مسائل مخاطب، سؤال‌های خرید، ترس‌ها، مقایسه‌ها، خطاهای رایج و تصمیم‌های پرتکرار را پوشش دهند. عبارت‌ها برای جست‌وجوی محتوا و گفتگو در YouTube، Reddit و LinkedIn مناسب باشند، با زبان مخاطب گزارش نوشته شوند و از عبارت‌های بسیار کلی دوری کنند.`,
    topicContext(target, report),
    '{"queries":["عبارت جست‌وجوی دقیق ۱","عبارت جست‌وجوی دقیق ۲"]}',
  ));
  const queries = [...new Set((result.queries || []).map((value) => String(value).trim()).filter(Boolean))].slice(0, 15);
  if (queries.length < 10) throw new Error('عبارت‌های جست‌وجوی موضوعی کافی تولید نشد.');
  return queries;
}

function checkpointRunner(provider, config, onProgress, checkpoint) {
  return createStageRunner({ execute: createChunkRunner(provider, config, onProgress), checkpoint, model: config.model, log: logAi });
}


export async function prepareResearchMethodology(provider, config, target, competitors, profilesData, onProgress = () => {}, checkpoint = null) {
  const run = checkpointRunner(provider, config, onProgress, checkpoint);
  const analyzeBusinessProfile = async (business, label, role) => {
    const item = await run(label, jsonOnly(
      `این ${role === 'target' ? 'کسب‌وکار هدف' : 'رقیب'} را بر اساس نمونه داده‌شده تحلیل کن. آمار را حدس نزن. فقط شواهد وب و اینستاگرام و کانال‌های اختیاری انتخاب‌شده را تحلیل کن. خدمات و محصولات را به‌عنوان ادعای منتشرشده برند توصیف کن، نه کیفیت واقعی تأییدشده. تحلیل محتوایی و وب‌سایت فشرده ولی کاربردی باشد. نقش آن را با رقبا اشتباه نگیر. برای هر کانال اجتماعی موجود، socialAudit را با پنج بُعد کیفیت محتوا، استانداردهای صفحه، استراتژی محتوا، عملکرد و تعامل، اعتماد و اعتبار ارزیابی کن؛ هر بُعد score از ۰ تا ۱۰۰، status و evidence کوتاه داشته باشد. کانال فاقد داده را not_available ثبت کن.`, compactForChunks(business),
      '{"competitor":{"name":"...","instagramHandle":"...","website":"...","location":"...","bio":"...","services":["..."],"marketingActions":["..."],"strengths":["..."],"weaknesses":["..."],"overallScore":0,"instagramAnalytics":{"firstPost":null,"firstPostStatus":"not_collected","oldestSampledPost":null,"lastPost":null,"postsAnalyzed":0,"totalPosts":0,"followers":0,"engagementRate":null,"mediaDistribution":{"photos":0,"videos":0,"carousels":0},"contentAnalysis":{"visualQuality":"...","creativity":"...","scriptTopic":"...","captions":"...","storytelling":"...","bio":"...","highlights":"...","layout":"..."},"bestContent":{"title":"...","link":"..."}},"websiteAnalytics":{"uxScore":0,"mobileFriendly":null,"seoStatus":"...","onlineBooking":null,"liveSupport":null,"narrative":"..."}}}',
    ), value => { const item = value?.competitor; if (!item || !Array.isArray(item.services) || !Array.isArray(item.strengths) || !Array.isArray(item.weaknesses)) throw new Error('ساختار تحلیل برند ناقص است.'); return value; });
    const generated = sanitizeProfileAnalysis(item.competitor, business);
    return { ...generated, name: business.name, instagramHandle: business.instagramHandle, website: business.website, isTarget: role === 'target' };
  };
  const targetAnalysis = await analyzeBusinessProfile(profilesData.target, `تحلیل کسب‌وکار هدف: ${profilesData.target.name}...`, 'target');
  const competitorAnalysis = [];
  for (let index = 0; index < profilesData.competitors.length; index += 1) {
    const business = profilesData.competitors[index];
    competitorAnalysis.push(await analyzeBusinessProfile(business, `تحلیل رقیب ${index + 1} از ${profilesData.competitors.length}: ${business.name}...`, 'competitor'));
  }
  if (competitorAnalysis.length !== competitors.length) {
    throw new Error(`گزارش رقبا ناقص است: ${competitorAnalysis.length} از ${competitors.length} رقیب تحلیل شد.`);
  }
  const brands = [profilesData.target, ...profilesData.competitors];
  const modelEvidence = brands.flatMap((business, index) => {
    const evidence = businessEvidence(business);
    return ['website', 'instagram'].flatMap(channel => {
      const source = evidence.find(item => item.channel === channel);
      return source ? [{ ...source, id: `b${index + 1}:${source.id}`, business: business.name, excerpt: source.excerpt.slice(0, 550) }] : [];
    });
  }).slice(0, 24);
  const synthesisData = { target: { name: target.name }, competitors: competitorAnalysis.map(item => ({ name: item.name, services: item.services?.slice(0, 4), strengths: item.strengths?.slice(0, 2), weaknesses: item.weaknesses?.slice(0, 2) })), evidence: modelEvidence };
  const groupSummaries = [];
  for (const [index, group] of boundedBatches([targetAnalysis, ...competitorAnalysis].map(item => ({ name: item.name, services: item.services?.slice(0, 4), strengths: item.strengths?.slice(0, 2), weaknesses: item.weaknesses?.slice(0, 2) })), 8, 14000).entries()) {
    const summary = await run(`overview-group:${index}`, jsonOnly('Summarize only published offerings and observed digital competition in at most 500 characters. No market shares.', group, '{"summary":"..."}'), value => { if (typeof value?.summary !== 'string') throw new Error('خلاصه معتبر نیست.'); return { summary: value.summary.slice(0, 500) }; });
    groupSummaries.push(summary);
  }
  const overview = await run('overview', jsonOnly(`تحلیل صنعت و SWOT فقط در دامنه وب و اینستاگرام بنویس. سهم بازار یا درصد دسته‌ها تولید نکن. هر نتیجه استنباطی را مشخص کن.`, { target: target.name, industry: target.industry, scope: researchScope(target), summaries: groupSummaries.slice(0, 40) }, '{"industryOverview":"...","swot":{"strengths":[],"weaknesses":[],"opportunities":[],"threats":[]}}'), value => { if (typeof value?.industryOverview !== 'string' || !value.swot) throw new Error('تحلیل کلی ناقص است.'); return value; });
  overview.marketCategories = [];
  overview.researchMethodology = { scope: researchScope(target), sourceRole: { maps: 'discovery_only' }, sampleSize: brands.length, indicatorEvidenceBrands: Math.min(brands.length, 12), marketShareEstimated: false, visualEvidence: false, sampleLimitations: 'نمونه کسب‌وکارهای جمع‌آوری‌شده؛ نماینده آماری کل بازار نیست.' };
  const modelPrompt = jsonOnly(
    `یک مدل CPM فشرده و قابل دفاع بساز. دقیقاً چهار فاکتور ثابت و به‌ترتیب زیر را برگردان: social/سوشال، website/وب‌سایت، product_service/محصول/خدمت و industry_specific/عوامل اثرگذار ویژه صنعت. هر فاکتور دقیقاً ۱ یا ۲ متغیر وابسته و هر متغیر ۱ تا ۳ معیار مستقل داشته باشد. وزن هر سطح دقیقاً جمع ۱ باشد. متن هر تعریف، دلیل و شاهد حداکثر ۱۲ کلمه باشد. عامل ویژه صنعت نباید با سه فاکتور دیگر هم‌پوشانی داشته باشد. برای فاکتور چهارم پرونده‌ای کوتاه با حداقل یک شاهد صنعت و یک سؤال مشتری بساز. عامل کاندید نساز؛ در درخواست بعدی جداگانه ساخته می‌شود. چهار فاکتور فقط دسته‌بندی نمایش‌اند؛ معیارهای اثرگذار مثل قیمت منتشرشده و توزیع را در دسته مرتبط بگنجان. برای هر معیار evidenceIds با شناسه دقیق شواهد داده‌شده، definition و reason بده. برای همه معیارها rubricLevels شامل حداقل دو شیء با score عددی و description روشن در بازه امتیاز بده. معیار تصویری یا ویدئویی بدون داده نساز.`,
    { industry: target.industry, scope: researchScope(target), evidence: modelEvidence, sampleSize: brands.length, indicatorEvidenceLimit: 24 },
    '{"cpmModel":{"version":1,"framework":"four_factor_v1","status":"proposed","rationale":"...","decisionBasis":[{"observation":"...","source":"...","implication":"..."}],"assumptions":["..."],"factors":[{"id":"social","label":"سوشال","weight":0.25,"definition":"...","dependentVariables":[{"id":"social_channel","label":"...","weight":1,"independentVariables":[{"id":"social_metric","label":"...","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"website","label":"وب‌سایت","weight":0.25,"definition":"...","dependentVariables":[{"id":"website_dimension","label":"...","weight":1,"independentVariables":[{"id":"website_metric","label":"...","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"product_service","label":"محصول/خدمت","weight":0.25,"definition":"...","dependentVariables":[{"id":"offer_dimension","label":"...","weight":1,"independentVariables":[{"id":"offer_metric","label":"...","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"industry_specific","label":"عوامل اثرگذار ویژه صنعت","weight":0.25,"definition":"...","industryFactorCase":{"customerDecisionRole":"...","boundaryDefinition":"...","industrySignals":[{"observation":"...","source":"...","implication":"..."}],"customerQuestions":["..."],"excludedCandidates":[],"overlapCheck":["..."],"dataGaps":["..."]},"dependentVariables":[{"id":"industry_dimension","label":"...","weight":1,"independentVariables":[{"id":"industry_metric","label":"...","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]}]}}',
  );
  let modelResult = await run('طراحی مدل ثابت CPM برای این پروژه...', modelPrompt);
  if (checkpoint?.saveIndicators) await checkpoint.saveIndicators(modelResult.cpmModel || modelResult, 'generated');
  let cpmModel;
  try {
    cpmModel = validateCpmModel(modelResult.cpmModel || modelResult, { status: 'proposed', requireWeights: true, requireCandidatePool: false });
    validateIndicatorEvidence(cpmModel, modelEvidence);
  } catch (modelError) {
    const previousModel = modelResult.cpmModel || modelResult;
    modelResult = await run('اصلاح ساختار مدل CPM...', `${modelPrompt}\nمدل قبلی: ${JSON.stringify(modelResult)}\nمدل قبلی رد شد: ${modelError.message} شاخص‌ها، شناسه‌ها و شواهد قبلی را حفظ کن؛ فقط ساختار یا وزن نامعتبر را اصلاح کن. فقط JSON معتبر برگردان.`);
    cpmModel = validateCpmModel(modelResult.cpmModel || modelResult, { status: 'proposed', requireWeights: true, requireCandidatePool: false });
    preserveIndicatorIds(previousModel, cpmModel);
  }
  validateIndicatorEvidence(cpmModel, modelEvidence);
  cpmModel.evidenceRegistry = modelEvidence;
  cpmModel.evidencePolicy = 'raw_sources_v1';
  if (checkpoint?.saveIndicators) await checkpoint.saveIndicators(cpmModel, 'proposed');
  const candidateResult = await run('ساخت عوامل کاندید CPM برای تأیید اپراتور...', jsonOnly(
    `دقیقاً ۶ عامل تصمیم مشتری برای صنعت ${target.industry} بساز که در مدل CPM فعلی نیازمند تأیید اپراتور هستند. متن هر فیلد حداکثر ۱۰ کلمه و evidence حداکثر یک مورد باشد. برای proposedCriterion نیز evidenceIds معتبر، definition، reason و rubricLevels با score و description از شواهد همین ورودی بده. معیار فاقد شاهد را پیشنهاد نکن. عامل تکراری نساز. selectedFactorId باید یکی از چهار id ثابت باشد.`,
    { industry: target.industry, model: cpmModel, evidence: modelEvidence },
    '{"factorCandidatePool":[{"id":"...","label":"...","customerDecisionImpact":"...","customerSignal":"...","evidence":["..."],"suggestedFactorId":"social|website|product_service|industry_specific","suggestedDependentLabel":"...","classificationReason":"...","overlapRisk":"...","recommendation":"include|exclude","alreadyIncluded":false,"existingPath":"","status":"review","selectedFactorId":"social|website|product_service|industry_specific","proposedCriterion":{"definition":"...","reason":"...","evidenceSource":"...","scoring":{"type":"binary","min":0,"max":1,"normalization":"min-max","rubricLevels":[]}}}]}',
  ), value => { if (!Array.isArray(value?.factorCandidatePool) || value.factorCandidatePool.length !== 6) throw new Error('دقیقاً شش عامل کاندید لازم است.'); for (const candidate of value.factorCandidatePool) { const criterion = { ...candidate.proposedCriterion, id: candidate.id, label: candidate.label }; validateIndicatorEvidence({ factors: [{ dependentVariables: [{ independentVariables: [criterion] }] }] }, modelEvidence); } return value; });
  cpmModel.factorCandidatePool = Array.isArray(candidateResult.factorCandidatePool) ? candidateResult.factorCandidatePool : [];
  cpmModel = validateCpmModel(cpmModel, { status: 'proposed', requireWeights: true, requireCandidatePool: true });
  if (checkpoint?.saveIndicators) await checkpoint.saveIndicators(cpmModel, 'ready_for_review');
  return { overview, targetAnalysis, competitorAnalysis, synthesisData, cpmModel, researchEvidence: brands.flatMap((business, index) => businessEvidence(business).map(item => ({ ...item, id: `b${index + 1}:${item.id}`, business: business.name }))) };
}

export async function completeResearchWithApprovedCpm(provider, config, target, competitors, profilesData, preliminary, cpmModel, onProgress = () => {}, checkpoint = null) {
  if (cpmModel?.status !== 'locked') throw new Error('مدل CPM هنوز توسط اپراتور تأیید و قفل نشده است.');
  validateCpmModel(cpmModel, { status: 'locked', requireWeights: true });
  const run = checkpointRunner(provider, config, onProgress, checkpoint);
  const { overview, targetAnalysis, competitorAnalysis, synthesisData, researchEvidence = [] } = preliminary;
  const evaluationSchema = (model) => JSON.stringify({
    evaluation: {
      factorScores: Object.fromEntries((model.factors || []).map((factor) => [
        factor.id,
        {
          dependentScores: Object.fromEntries((factor.dependentVariables || []).map((dependent) => [
            dependent.id,
            {
              independentScores: Object.fromEntries((dependent.independentVariables || []).map((criterion) => [
                criterion.id,
                { rawScore: null, evidence: 'شاهد کوتاه و مشخص', evidenceIds: [] },
              ])),
            },
          ])),
        },
      ])),
    },
  });
  const evaluationTargets = [profilesData.target, ...profilesData.competitors];
  const cpmEvaluations = [];
  for (let index = 0; index < evaluationTargets.length; index += 1) {
    const business = evaluationTargets[index];
    const evidence = businessEvidence(business);
    const identity = { name: business.name, isTarget: index === 0, hasWebsite: Boolean(business.website), hasWebsiteEvidence: evidence.some(item => item.channel === 'website'), evidenceIds: evidence.map(item => item.id), evidenceChannels: Object.fromEntries(evidence.map(item => [item.id, item.channel])), strictEvidence: true };
    const factorScores = {};
    for (const factor of cpmModel.factors) {
      const unitModel = { ...cpmModel, factors: [factor] };
      const evaluated = await run(`score:${business.instagramHandle || business.website || business.name}:${factor.id}`, jsonOnly(
        'Score only the supplied factor using direct supplied evidence. Preserve all IDs. Every non-null rawScore requires evidenceIds from this business and a short explanation. If evidence is absent use null. Do not evaluate visual quality, video storytelling or actual service outcomes from text. Unknown website URL does not prove no website; use null. Do not calculate final scores.',
        { factor, business: { name: business.name, website: business.website, instagram: business.instagramHandle }, evidence }, evaluationSchema(unitModel),
      ), value => { calculateCpmRow(unitModel, value?.evaluation || value, identity); return value; });
      Object.assign(factorScores, (evaluated.evaluation || evaluated).factorScores);
    }
    cpmEvaluations.push(calculateCpmRow(cpmModel, { factorScores }, identity));
  }
  const factorOverviews = await run('ساخت مقدمه کیفی چهار فاکتور بر اساس امتیازهای نهایی...', jsonOnly(
    `بر اساس مدل CPM قفل‌شده و rawScoreهای واقعی، برای هر چهار فاکتور یک مقدمه کیفی مقایسه‌ای بنویس. متن باید بعد از تحلیل عددی ساخته شود و به زبان ساده توضیح دهد وضعیت برند هدف و رقبا در آن فاکتور چگونه است؛ مثلاً آیا حضور اینستاگرام رقبا قوی، متوسط یا ضعیف است و چرا. برای هر فاکتور ۲ تا ۴ جمله بنویس، نام برندهای شاخص را در صورت وجود ذکر کن، از ساختن عدد یا واقعیت جدید خودداری کن و اگر داده ناقص است صریحاً بگو. چهار id دقیقاً social, website, product_service, industry_specific باشند.`,
    { cpmModel, evaluations: cpmEvaluations, businesses: evaluationTargets.map((item) => item.name) },
    '{"factorOverviews":{"social":"...","website":"...","product_service":"...","industry_specific":"..."}}',
  ), value => { if (cpmModel.factors.some(factor => typeof value?.factorOverviews?.[factor.id] !== 'string')) throw new Error('مقدمه بعضی فاکتورها جا افتاده است.'); return value; });
  let audienceTopics = checkpoint?.chunks?.audienceTopics;
  if (!audienceTopics) {
    audienceTopics = await generateAudienceTopics(provider, config, target, { ...overview, targetAnalysis, competitorAnalysis, researchEvidence }, profilesData.target?.platformData || {}, onProgress, checkpoint);
    if (checkpoint) { checkpoint.chunks.audienceTopics = audienceTopics; await checkpoint.save(); }
  }
  const strategy = await run('تولید پیشنهادات اجرایی...', jsonOnly(
    `بر اساس تحلیل صنعت، SWOT و پرونده رقبا برای ${target.name} دقیقاً ۵ پیشنهاد اولویت‌بندی‌شده با ۲ تا ۴ گام اجرایی تولید کن. نقشه جایگاه تولید نکن؛ اپلیکیشن آن را به‌صورت قطعی از امتیازهای CPM تأییدشده محاسبه می‌کند.`,
    { overview, competitors: synthesisData.competitors.slice(0, 12), limitations: overview.researchMethodology },
    '{"recommendations":[{"priority":1,"title":"...","description":"...","actionSteps":["..."]}]}',
  ), value => { if (value?.recommendations?.length !== 5 || value.recommendations.some(item => !item.title || !Array.isArray(item.actionSteps))) throw new Error('پیشنهادهای اجرایی ناقص است.'); return value; });
  const competitorList = competitorAnalysis.map((item) => ({
    name: item.name, instagramHandle: item.instagramHandle, website: item.website,
    location: item.location, followers: item.followers ?? item.instagramAnalytics?.followers ?? null,
    verified: Boolean(profilesData.competitors.find((business) => business.name === item.name)?.instagramData?.isVerified),
    overallScore: item.overallScore,
  }));
  return { ...overview, researchEvidence, researchMethodology: overview.researchMethodology, industryOverview: target.industryBriefing ? `${target.industryBriefing}\n\nتحلیل تکمیلی بر اساس داده‌های گزارش:\n${overview.industryOverview || ''}` : overview.industryOverview, competitorList, targetAnalysis, competitorAnalysis, cpmModel, cpmEvaluations, cpmSensitivity: cpmSensitivity(cpmModel, cpmEvaluations), factorOverviews: factorOverviews.factorOverviews || factorOverviews, audienceTopics, ...strategy };
}

// Compatibility helper for non-interactive callers. The app uses the two-stage
// functions above so operator approval can never be skipped.
export async function analyzeResearchInChunks() {
  throw new Error('تحلیل CPM اکنون نیازمند تأیید اپراتور در مرحله متدولوژی است.');
}

// ─── JSON extractor (shared) ──────────────────────────────────────────────────

function extractJson(text, diagnostic = {}) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1));
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch {}
    // Models occasionally emit a trailing comma before a closing object/array.
    try { return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')); } catch {}
  }
  const finish = diagnostic.finishReason || 'نامشخص';
  const outputTokens = diagnostic.outputTokens ?? 'نامشخص';
  console.error('Invalid AI JSON', {
    provider: diagnostic.provider,
    model: diagnostic.model,
    finishReason: finish,
    outputTokens,
    contentLength: cleaned.length,
    tail: cleaned.slice(-240),
  });
  throw Object.assign(new Error(`پاسخ AI قابل پردازش نیست (پایان: ${finish}، توکن خروجی: ${outputTokens}). خروجی JSON ناقص یا نامعتبر است.`), { rawContent: cleaned });
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

async function requestAiProxy(payload) {
  const dispatch = (name, detail) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
  };
  return retryAiRequest(() => requestAiProxyOnce(payload), {
    onWait: detail => {
      logAi(detail.reason === 'quota' ? 'quota_wait' : 'automatic_retry', { model: payload.model, ...detail });
      dispatch('ai-retry', detail);
    },
    onRetry: detail => dispatch('ai-retry-start', detail),
  });
}

async function requestAiProxyOnce(payload) {
  return withDeadline((signal) => performAiProxyOnce(payload, signal), 210000, 'مهلت دریافت پاسخ AI تمام شد؛ ادامه از همین بخش انجام می‌شود.');
}

async function performAiProxyOnce(payload, signal) {
  const startedAt = Date.now();
  const clientRequestId = crypto.randomUUID();
  const details = () => ({ clientRequestId, model: payload.model, elapsedMs: Date.now() - startedAt });
  logAi('request_start', { ...details(), promptChars: payload.prompt?.length || 0, promptBytes: new TextEncoder().encode(payload.prompt || '').length });
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 210000);
  try {
  let res;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson, application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    res = await readAiTransport(res, (event) => {
      if (event === 'accepted') logAi('server_accepted', details());
    });
  } catch (error) {
    logAi('network_error', { ...details(), message: String(error.message).slice(0, 1500) });
    throw Object.assign(new Error(
      `ارتباط هنگام دریافت پاسخ AI قطع شد. (${error.message})`,
    ), { retryable: true });
  }

  const contentType = res.headers.get('content-type') || '';
  logAi('response_headers', { ...details(), status: res.status, contentType });
  if (!contentType.toLowerCase().includes('application/json')) {
    const responseText = await res.text().catch(() => '');
    logAi('non_json_response', { ...details(), status: res.status });
    const isCloudflareTimeout = res.status === 524 || /error\s*(code\s*)?524|A timeout occurred/i.test(responseText);
    if (isCloudflareTimeout) {
      throw Object.assign(new Error('مهلت دریافت پاسخ AI تمام شد (خطای 524). پیش‌نویس برای ادامه حفظ شده است.'), { retryable: true });
    }
    throw Object.assign(new Error(
      `سرویس /api/ai پاسخ غیرمنتظره برگرداند (HTTP ${res.status}).`,
    ), { retryable: [408, 429, 500, 502, 503, 504, 524].includes(res.status) });
  }

  const data = await res.json().catch((error) => {
    if (controller.signal.aborted) throw error;
    if (!(error instanceof SyntaxError)) throw Object.assign(error, { retryable: true });
    return null;
  });
  if (!data) {
    logAi('invalid_json_response', { ...details(), status: res.status });
    throw new Error(`سرویس AI پاسخ JSON معتبر برنگرداند (HTTP ${res.status}).`);
  }
  logAi(res.ok ? 'request_success' : 'request_error', {
    ...details(), status: res.status, requestId: data.requestId || data._routerDiagnostic?.requestId,
    stage: data.stage, upstreamStatus: data.upstreamStatus,
    message: res.ok ? undefined : String(data.error?.message || data.error || '').slice(0, 1500),
    attempts: (data.attempts || data._routerDiagnostic?.attempts || []).slice(0, 3).map(({ model, status, reason }) => ({ model, status, reason: String(reason || '').slice(0, 1500) })),
    finishReason: data._routerDiagnostic?.finishReason,
    usage: data._routerDiagnostic?.usage,
  });
  return { res, data };
  } catch (error) {
    if (controller.signal.aborted) {
      logAi('client_timeout', details());
      throw Object.assign(new Error('مهلت دریافت کامل پاسخ AI تمام شد.'), { retryable: true });
    }
    throw error;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
}

export async function testAiConnection(provider, config = {}) {
  if (!config.model) throw new Error('ابتدا یک مدل اصلی از 9Router انتخاب کنید.');
  const { res, data } = await requestAiProxy({
    provider: '9router',
    model: config.model,
    fallbackModels: config.fallbackModels || [],
    prompt: 'فقط این کلمه را به صورت JSON معتبر برگردان: {"status":"ok"}',
  });
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `خطای 9Router: ${res.status}`);
  return { ok: true, provider: '9router', model: data?._routerDiagnostic?.selectedModel || config.model };
}

/**
 * Call Google Gemini API directly
 * @param {string} apiKey  - VITE_GEMINI_API_KEY
 * @param {string} prompt
 * @param {string} model   - e.g. "gemini-3.5-flash-lite"
 */
export async function analyzeWithGemini(
  apiKey,
  prompt,
  model = 'gemini-3.5-flash-lite'
) {
  const { res, data } = await requestAiProxy({ provider: 'gemini', model, prompt, apiKey });

  if (!res.ok) {
    const msg =
      data.error?.message ||
      data.error ||
      (res.status === 400
        ? 'کلید Gemini نامعتبر است، مدل در دسترس نیست یا درخواست بزرگ‌تر از محدودیت مدل است.'
        : `خطای Gemini: ${res.status}`);
    throw new Error(msg);
  }

  const content = data.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') ?? '';

  if (!content) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new Error(`Gemini پاسخ خالی برگرداند (دلیل: ${reason || 'نامشخص'})`);
  }

  return extractJson(content, {
    provider: 'gemini',
    model,
    finishReason: data.candidates?.[0]?.finishReason,
    outputTokens: data.usageMetadata?.candidatesTokenCount,
  });
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────

/**
 * Call OpenRouter (or a compatible local proxy)
 * @param {string} apiKey
 * @param {string} prompt
 * @param {string} model   - e.g. "anthropic/claude-3.5-sonnet"
 * @param {string} endpoint - defaults to official OpenRouter endpoint
 */
export async function analyzeWithOpenRouter(
  apiKey,
  prompt,
  model = 'anthropic/claude-3.5-sonnet',
  endpoint = 'https://openrouter.ai/api/v1/chat/completions',
) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer':
        typeof window !== 'undefined' ? window.location.origin : '',
      'X-Title': 'Market Research Report Generator',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'شما یک تحلیلگر بازار حرفه‌ای هستید که فقط JSON معتبر برمی‌گردانید.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 12000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      err.error?.message ||
      (res.status === 401
        ? 'کلید OpenRouter نامعتبر است.'
        : `خطای OpenRouter: ${res.status}`);
    throw new Error(msg);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return extractJson(content, {
    provider: 'openrouter', model,
    finishReason: data.choices?.[0]?.finish_reason,
    outputTokens: data.usage?.completion_tokens,
  });
}

export async function analyzeWith9Router(prompt, model, fallbackModels = []) {
  const budget = promptBudget(prompt);
  const { res, data } = await requestAiProxy({ provider: '9router', model, fallbackModels, prompt, inputBudgetBytes: budget.maxInputBytes, maxOutputTokens: 7000 });
  if (!res.ok) {
    const details = [data.stage && `مرحله: ${data.stage}`, data.requestId && `شناسه: ${data.requestId}`, data.upstreamStatus && `upstream: ${data.upstreamStatus}`].filter(Boolean).join(' · ');
    throw new Error(`${data.error?.message || data.error || `خطای 9Router: ${res.status}`}${details ? ` (${details})` : ''}`);
  }
  const rawContent = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? data.output_text ?? data.content ?? '';
  const content = Array.isArray(rawContent)
    ? rawContent.map((part) => typeof part === 'string' ? part : part?.text || part?.content || '').join('')
    : typeof rawContent === 'object' && rawContent ? rawContent.text || rawContent.content || JSON.stringify(rawContent) : rawContent;
  if (!content) {
    const diagnostic = data._routerDiagnostic || {};
    const finish = diagnostic.finishReason || data.choices?.[0]?.finish_reason || 'نامشخص';
    const usage = diagnostic.usage || data.usage;
    const outputTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 'نامشخص';
    console.error('9Router empty response diagnostic', { model, finishReason: finish, usage, responseKeys: diagnostic.responseKeys || Object.keys(data) });
    throw new Error(`9Router پاسخ متنی برنگرداند (پایان: ${finish}، توکن خروجی: ${outputTokens}). درخواست دوباره ارسال نشد.`);
  }
  const diagnostic = data._routerDiagnostic || {};
  const parsed = extractJson(content, {
    provider: '9router', model,
    finishReason: diagnostic.finishReason || data.choices?.[0]?.finish_reason,
    outputTokens: diagnostic.usage?.completion_tokens ?? data.usage?.completion_tokens,
  });
  if (parsed && typeof parsed === 'object') Object.defineProperty(parsed, '_analysisMeta', { value: { usage: diagnostic.usage || data.usage, selectedModel: diagnostic.selectedModel || model }, enumerable: false });
  return parsed;
}

// ─── Unified entry point ──────────────────────────────────────────────────────

/**
 * Analyze with either Gemini or OpenRouter based on provider choice.
 *
 * @param {'gemini'|'openrouter'} provider
 * @param {object} config  { apiKey, model, endpoint? }
 * @param {string} prompt
 */
export async function analyzeWithAI(provider, config, prompt) {
  if (provider !== '9router') throw new Error('تنها Provider فعال این پروژه 9Router است.');
  return analyzeWith9Router(prompt, config.model, config.fallbackModels || []);
}

const presentationText = (value, limit = 1800) => String(value || '').trim().slice(0, limit);
const compactIndustryIntelligence = (intel = {}) => ({
  intro: presentationText(intel.intro, 2200),
  industryDefinition: presentationText(intel.industryDefinition, 1400),
  subindustries: (intel.subindustries || []).slice(0, 8).map((item) => ({
    name: presentationText(item.name, 160), description: presentationText(item.description, 650),
  })),
  targetPlacement: intel.targetPlacement ? {
    subindustry: presentationText(intel.targetPlacement.subindustry, 200),
    businessModel: presentationText(intel.targetPlacement.businessModel, 200),
    reason: presentationText(intel.targetPlacement.reason, 1200),
  } : null,
  targetSubindustryBrief: intel.targetSubindustryBrief ? {
    name: presentationText(intel.targetSubindustryBrief.name, 200),
    overview: presentationText(intel.targetSubindustryBrief.overview, 2200),
    businessModels: (intel.targetSubindustryBrief.businessModels || []).slice(0, 7).map((model) => ({
      name: presentationText(model.name, 180), description: presentationText(model.description, 650),
      exampleCount: model.exampleCount, evidenceStatus: model.evidenceStatus,
    })),
  } : null,
});

const presentationReportSnapshot = (data = {}, target = {}) => ({
  target: {
    name: target.name,
    industry: target.industry,
    location: target.location,
    marketResearchMode: target.marketResearchMode,
    industryIntelligence: compactIndustryIntelligence(target.industryIntelligence),
  },
  industryOverview: presentationText(data.industryOverview, 2800),
  marketCategories: (data.marketCategories || []).slice(0, 10),
  competitorList: (data.competitorList || []).slice(0, 12),
  competitorAnalysis: (data.competitorAnalysis || []).slice(0, 12).map((item) => ({
    name: item.name,
    location: item.location,
    bio: presentationText(item.bio, 700),
    services: (item.services || []).slice(0, 8).map((value) => presentationText(value, 180)),
    strengths: (item.strengths || []).slice(0, 5).map((value) => presentationText(value, 220)),
    weaknesses: (item.weaknesses || []).slice(0, 5).map((value) => presentationText(value, 220)),
    followers: item.followers ?? item.instagramAnalytics?.followers,
    engagementRate: item.engagementRate ?? item.instagramAnalytics?.engagementRate,
    overallScore: item.overallScore,
    website: item.website,
    instagramHandle: item.instagramHandle,
  })),
  swot: data.swot,
  cpmModel: data.cpmModel ? {
    rationale: data.cpmModel.rationale,
    factors: data.cpmModel.factors?.map((factor) => ({ id: factor.id, label: factor.label, weight: factor.weight })),
  } : null,
  cpmRows: data.cpmMatrix?.rows?.map((row) => ({
    name: row.name,
    isTarget: row.isTarget,
    total: row.total,
    factorScores: Object.fromEntries(Object.entries(row.factorScores || {}).map(([id, result]) => [id, { score: result?.score }])),
  })),
  recommendations: (data.recommendations || []).slice(0, 7).map((item) => ({
    priority: item.priority, title: presentationText(item.title, 180),
    description: presentationText(item.description, 700),
    actionSteps: (item.actionSteps || []).slice(0, 4).map((value) => presentationText(value, 260)),
  })),
});

export async function generatePresentationPlan(provider, config, data, target, options = {}) {
  const requestedSlides = Math.max(10, Math.min(22, Number(options.slideCount) || 16));
  const prompt = `شما مدیر ارشد استراتژی و طراح روایت ارائه هستید. از گزارش تحقیق بازار زیر یک پرزنتیشن مدیریتی حرفه‌ای به زبان فارسی بسازید.

مخاطب: ${options.audience || 'مدیران و تصمیم‌گیرندگان کسب‌وکار'}
هدف ارائه: ${options.purpose || 'تصمیم‌گیری درباره جایگاه رقابتی و اولویت‌های رشد'}
تعداد هدف: ${requestedSlides} اسلاید

قواعد قطعی:
- فقط از داده گزارش استفاده کنید و هیچ عدد، برند، منبع یا ادعایی اختراع نکنید.
- هر اسلاید فقط یک پیام اصلی داشته باشد و عنوان آن نتیجه‌محور باشد.
- متن روی اسلاید کوتاه باشد؛ توضیح کامل در speakerNotes قرار گیرد.
- روایت از زمینه و مسئله به شواهد، پیامد و اقدام برسد.
- اسلاید اول cover و اسلاید آخر closing باشد.
- layout فقط یکی از این مقادیر باشد: cover, statement, bullets, segments, competitors, swot, cpm, recommendations, closing.
- bullets حداکثر 5 مورد و هر مورد حداکثر 16 کلمه باشد.
- sources فقط URLهایی باشد که عیناً در گزارش وجود دارند. اگر منبع URL ندارید آرایه خالی بدهید.

فقط JSON معتبر با این ساختار برگردانید:
{"deckTitle":"...","deckSubtitle":"...","slides":[{"layout":"cover","title":"...","subtitle":"...","claim":"...","bullets":["..."],"items":[{"label":"...","value":"...","detail":"..."}],"speakerNotes":"...","sources":["https://..."]}]}

گزارش:
${JSON.stringify(presentationReportSnapshot(data, target))}`;
  const checkpoint = options.checkpoint;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prompt));
  const key = `presentation:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (checkpoint?.chunks?.[key]) return structuredClone(checkpoint.chunks[key]);
  const result = await analyzeWithAI(provider, config, prompt);
  const slides = Array.isArray(result?.slides) ? result.slides.slice(0, 22) : [];
  if (slides.length < 3) throw new Error('مدل ساختار کافی برای پرزنتیشن تولید نکرد. دوباره تلاش کنید.');
  const allowed = new Set(['cover', 'statement', 'bullets', 'segments', 'competitors', 'swot', 'cpm', 'recommendations', 'closing']);
  const plan = {
    deckTitle: String(result.deckTitle || `تحقیق بازار ${target?.name || ''}`).trim(),
    deckSubtitle: String(result.deckSubtitle || target?.industry || '').trim(),
    slides: slides.map((slide, index) => ({
      layout: allowed.has(slide.layout) ? slide.layout : index === 0 ? 'cover' : 'bullets',
      title: String(slide.title || '').trim(),
      subtitle: String(slide.subtitle || '').trim(),
      claim: String(slide.claim || '').trim(),
      bullets: (Array.isArray(slide.bullets) ? slide.bullets : []).slice(0, 5).map(String),
      items: (Array.isArray(slide.items) ? slide.items : []).slice(0, 8).map((item) => ({
        label: String(item?.label || '').trim(), value: String(item?.value || '').trim(), detail: String(item?.detail || '').trim(),
      })),
      speakerNotes: String(slide.speakerNotes || '').trim(),
      sources: (Array.isArray(slide.sources) ? slide.sources : []).filter((source) => /^https?:\/\//i.test(source)).slice(0, 12),
    })),
  };
  if (checkpoint?.save) await checkpoint.save(key, plan);
  return plan;
}
