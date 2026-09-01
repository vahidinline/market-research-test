/**
 * AI analysis utility supporting both Google Gemini and OpenRouter
 */
import { validateCpmModel } from './cpm.js';

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
    seo: websiteData.seo,
    crawlStatus: websiteData.crawlStatus,
    pagesCrawled: websiteData.pagesCrawled,
    evidence: (websiteData.evidence || []).slice(0, pageLimit),
    pages: (websiteData.pages || []).slice(0, pageLimit).map((page) => ({
      url: page.url,
      title: page.title,
      text: String(page.text || '').slice(0, pageTextLimit),
    })),
    text: String(websiteData.text || '').slice(0, textLimit),
  };
};

// ─── Prompt builder (shared) ─────────────────────────────────────────────────

export function buildAnalysisPrompt(targetBusiness, competitors, profilesData) {
  const outputLanguage = targetBusiness.outputLanguage === 'en' ? 'English' : 'Persian';
  const compactPost = (post = {}) => ({ ownerUsername: post.ownerUsername || post.username || '', type: post.type || post.mediaType || (post.isVideo ? 'Video' : 'Image'), timestamp: post.timestamp || post.takenAt || '', caption: String(post.caption || post.text || '').slice(0, 700), likes: post.likesCount ?? post.likes ?? 0, comments: post.commentsCount ?? post.comments ?? 0, views: post.videoViewCount ?? post.videoPlayCount ?? post.views ?? 0, url: post.url || (post.shortCode ? `https://instagram.com/p/${post.shortCode}` : '') });
  const compactBusiness = (business = {}) => ({ name: business.name, industry: business.industry, instagramHandle: business.instagramHandle, website: business.website, instagramData: business.instagramData, instagramSummary: business.instagramSummary, instagramPosts: (business.instagramPosts || []).slice(0, 20).map(compactPost), websiteData: compactWebsiteData(business.websiteData, 12000, 6, 1800) });
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
  linkedin: business.linkedin || '', youtube: business.youtube || '', reddit: business.reddit || '',
  twitter: business.twitter || business.x || '', telegram: business.telegram || '',
  instagramData: business.instagramData, instagramSummary: business.instagramSummary,
  instagramPosts: (business.instagramPosts || []).slice(0, 12).map((post) => ({
    type: post.type || post.mediaType, timestamp: post.timestamp || post.takenAt,
    caption: String(post.caption || post.text || '').slice(0, 400), likes: post.likesCount ?? post.likes ?? 0,
    comments: post.commentsCount ?? post.comments ?? 0, views: post.videoViewCount ?? post.views ?? 0,
    url: post.url || (post.shortCode ? `https://instagram.com/p/${post.shortCode}` : ''),
  })),
  websiteData: compactWebsiteData(business.websiteData, 7000, 4, 1400),
  platformData: business.platformData || null,
});

const jsonOnly = (task, data, schema, language = null) => {
  const requested = language || data?.target?.outputLanguage || data?.business?.outputLanguage || 'fa';
  return `You are a senior market analyst. Return valid JSON only. Write every textual value in ${requested === 'en' ? 'English' : 'Persian'}, with no mixed-language prose.\n\nTask:\n${task}\n\nData:\n${JSON.stringify(data)}\n\nExact output structure:\n${schema}`;
};

const SOCIAL_DEPENDENTS = [
  { id: 'social_content_quality', label: 'کیفیت محتوا', weight: 0.3, criteria: [['visual_quality', 'کیفیت محتوای بصری'], ['written_quality', 'کیفیت محتوای نوشتاری']] },
  { id: 'social_page_standards', label: 'استانداردهای صفحه', weight: 0.25, criteria: [['profile_standards', 'استانداردهای پروفایل و صفحه'], ['channel_structure', 'ساختار و یکپارچگی کانال']] },
  { id: 'social_content_strategy', label: 'استراتژی محتوا', weight: 0.2, criteria: [['content_pillars', 'ستون‌ها و تنوع محتوا'], ['audience_fit', 'تناسب محتوا با مخاطب و سفر مشتری']] },
  { id: 'social_performance_trust', label: 'عملکرد، تعامل و اعتماد', weight: 0.25, criteria: [['engagement_performance', 'تعامل و عملکرد کانال'], ['trust_credibility', 'اعتماد و اعتبار برند']] },
];
function ensureSocialFactor(model) {
  const social = model.factors.find((factor) => factor.id === 'social');
  if (!social) return model;
  social.definition = 'ارزیابی چندبعدی کیفیت و اثربخشی حضور برند در کانال‌های اجتماعی منتخب.';
  social.dependentVariables = SOCIAL_DEPENDENTS.map((dependent) => ({
    id: dependent.id, label: dependent.label, weight: dependent.weight,
    reason: 'شاخص ثابت ارزیابی Social در پروژه',
    independentVariables: dependent.criteria.map(([id, label]) => ({ id, label, definition: `سنجش ${label} در کانال‌های اجتماعی منتخب`, weight: 0.5, reason: 'معیار قابل مشاهده و قابل استناد', evidenceSource: 'social_channel_audit', scoring: { type: 'range', min: 0, max: 3, normalization: 'min-max', rubricLevels: [] } })),
  }));
  return model;
}

const createChunkRunner = (provider, config, onProgress) => async (label, prompt) => {
  onProgress(label);
  try { return await analyzeWithAI(provider, config, prompt); }
  catch (error) {
    if (!/JSON|قابل پردازش|ناقص|نامعتبر|MAX_TOKENS|max_tokens|length/i.test(error?.message || '')) throw new Error(`${label} — ${error.message}`);
    try {
      return await analyzeWithAI(provider, config, `${prompt}\nخروجی قبلی به سقف توکن رسید. همه توضیحات و شواهد را حداکثر ۱۲ کلمه بنویس، آرایه اضافی نساز و حتماً JSON را کامل ببند.`);
    } catch (retryError) {
      throw new Error(`${label} — ${retryError.message}`);
    }
  }
};

const AUDIENCE_TOPIC_SCHEMA = '{"topics":[{"rank":1,"topic":"موضوع محدود و مشخص","audienceQuestion":"سؤال واقعی مخاطب با لحن طبیعی","audienceConcern":"دغدغه یا تصمیم پشت سؤال","whyItMatters":"چرا موضوع پیوسته مورد توجه است","searchIntent":"informational|commercial|transactional|navigational","journeyStage":"awareness|consideration|decision|retention","contentAngles":["زاویه مشخص ۱","زاویه مشخص ۲","زاویه مشخص ۳"],"platformSignals":[{"platform":"Google|Instagram|YouTube|LinkedIn|Reddit|Forum|Website","signalType":"search_demand|paa_faq|engagement|repetition|discussion","evidence":"شاهد کوتاه یا not_observed","sourceUrl":null}],"validationStatus":"observed|partially_observed|hypothesis","confidence":"high|medium|low","suggestedQueries":["عبارت اعتبارسنجی ۱","عبارت ۲"],"evergreenReason":"دلیل ماندگاری"}]}';

export async function generateAudienceTopics(provider, config, target, report, platformData = {}, onProgress = () => {}) {
  const run = createChunkRunner(provider, config, onProgress);
  const compactDiscoveryData = Object.fromEntries(Object.entries(platformData).map(([platform, payload]) => [platform, {
    status: payload?.status,
    error: payload?.error,
    queries: payload?.queries,
    items: (payload?.items || []).slice(0, 40).map((item) => ({
      title: String(item.title || item.name || '').slice(0, 240),
      text: String(item.text || item.body || item.selftext || item.description || item.caption || item.content || '').slice(0, 320),
      url: item.url || item.postUrl || item.link || item.webUrl || null,
      author: item.author || item.authorName || item.channelName || item.username || null,
      subreddit: item.subreddit || item.communityName || null,
      likes: item.likes ?? item.likeCount ?? item.score ?? item.numLikes ?? null,
      comments: item.comments ?? item.commentCount ?? item.numComments ?? null,
      views: item.views ?? item.viewCount ?? null,
      shares: item.shares ?? item.shareCount ?? null,
      publishedAt: item.publishedAt || item.date || item.createdAt || item.timestamp || null,
    })),
  }]));
  const topicContext = {
    industry: target.industry,
    target,
    competitors: report.competitorAnalysis || report.competitorList || [],
    marketOverview: report.industryOverview,
    swot: report.swot,
    existingInstagramEvidence: [report.targetAnalysis, ...(report.competitorAnalysis || [])].filter(Boolean).map((item) => ({ name: item.name, instagramHandle: item.instagramHandle, bestContent: item.instagramAnalytics?.bestContent, contentAnalysis: item.instagramAnalytics?.contentAnalysis })),
    freshlyCollectedPlatformData: compactDiscoveryData,
  };
  const discover = async (startRank, endRank, previousTopics = []) => run(`کشف موضوعات دغدغه‌محور ${startRank} تا ${endRank}...`, jsonOnly(
    `برای صنعت ${target.industry} دقیقاً ${endRank - startRank + 1} موضوع محدود، مستقل و قابل‌تولید بساز و rank را از ${startRank} تا ${endRank} قرار بده. این‌ها قالب محتوا، هوک، سبک اجرا یا عنوان کلی نیستند؛ هر مورد باید یک سؤال، مشکل، ابهام، ترس، مقایسه یا تصمیم واقعی مخاطب باشد. موضوع‌ها باید بر دو خانواده سیگنال تکیه کنند: ۱) تقاضای جست‌وجو، FAQ، People Also Ask و بحث‌های پرتکرار؛ ۲) استقبال از محتوایی که خود موضوع عامل توجه آن بوده، نه صرفاً اجرای سرگرم‌کننده. داده‌های Instagram و داده تازه Apify از YouTube، LinkedIn و Reddit را شاهد مستقیم بدان. درباره Google و فروم‌های فاقد داده فقط وقتی observed بنویس که در ورودی شاهد یا URL وجود دارد؛ وگرنه hypothesis یا partially_observed ثبت کن و evidence را not_observed بنویس. عدد و URL اختراع نکن. موضوع‌ها تکراری یا بازنویسی فهرست قبلی نباشند و contentAngles مستقیماً قابل تولید باشند.`,
    { ...topicContext, previousTopics }, AUDIENCE_TOPIC_SCHEMA,
  ));
  const first = await discover(1, 25);
  const firstTopics = Array.isArray(first.topics) ? first.topics : [];
  const second = await discover(26, 50, firstTopics.map((item) => item.topic));
  const topics = [...firstTopics, ...(Array.isArray(second.topics) ? second.topics : [])].slice(0, 50).map((item, index) => ({ ...item, rank: index + 1 }));
  if (topics.length < 50) throw new Error(`فهرست موضوعات پرتکرار ناقص است: ${topics.length} از ۵۰ موضوع تولید شد.`);
  return topics;
}

export async function generateTopicSearchQueries(provider, config, target, report, onProgress = () => {}) {
  const run = createChunkRunner(provider, config, onProgress);
  const result = await run('ساخت عبارت‌های جست‌وجوی موضوعی برای Apify...', jsonOnly(
    `برای کشف دغدغه‌ها و موضوعات پرتکرار بازار ${target.industry} دقیقاً ۱۵ عبارت جست‌وجوی مستقل بساز. عبارت‌ها درباره برند هدف نباشند؛ باید کل بازار، مسائل مخاطب، سؤال‌های خرید، ترس‌ها، مقایسه‌ها، خطاهای رایج و تصمیم‌های پرتکرار را پوشش دهند. عبارت‌ها برای جست‌وجوی محتوا و گفتگو در YouTube، Reddit و LinkedIn مناسب باشند، با زبان مخاطب گزارش نوشته شوند و از عبارت‌های بسیار کلی دوری کنند.`,
    { target, industryOverview: report.industryOverview, marketCategories: report.marketCategories, swot: report.swot, services: report.targetAnalysis?.services },
    '{"queries":["عبارت جست‌وجوی دقیق ۱","عبارت جست‌وجوی دقیق ۲"]}',
  ));
  const queries = [...new Set((result.queries || []).map((value) => String(value).trim()).filter(Boolean))].slice(0, 15);
  if (queries.length < 10) throw new Error('عبارت‌های جست‌وجوی موضوعی کافی تولید نشد.');
  return queries;
}

export async function prepareResearchMethodology(provider, config, target, competitors, profilesData, onProgress = () => {}) {
  const run = createChunkRunner(provider, config, onProgress);
  const allRaw = { target: { ...compactForChunks(profilesData.target), industryIntelligence: target.industryIntelligence || null }, competitors: profilesData.competitors.map(compactForChunks) };
  const overview = await run('تحلیل صنعت، فهرست رقبا و SWOT...', jsonOnly(
    `صنعت ${target.industry}، جایگاه ${target.name}، دسته‌های اصلی بازار، فهرست رقبا و SWOT برند هدف را تحلیل کن. اگر industryBriefing در داده وجود دارد، آن را به‌عنوان مقدمه کشف اولیه حفظ و با داده‌های گزارش تکمیل کن؛ مقدمه نهایی باید دید کلی صنعت بدهد. سهم دسته‌ها جمعاً نزدیک ۱۰۰ باشد.`, allRaw,
    '{"industryOverview":"...","marketCategories":[{"name":"...","share":0}],"competitorList":[{"name":"...","instagramHandle":"...","website":"...","location":"...","followers":0,"verified":false}],"swot":{"strengths":["..."],"weaknesses":["..."],"opportunities":["..."],"threats":["..."]}}',
  ));
  const analyzeBusinessProfile = async (business, label, role) => {
    const item = await run(label, jsonOnly(
      `این ${role === 'target' ? 'کسب‌وکار هدف' : 'رقیب'} را بر اساس نمونه داده‌شده تحلیل کن. آمار را حدس نزن. نقاط قوت و ضعف را فقط به وب‌سایت و سوشال محدود نکن؛ محصول و خدمت، تنوع و تمایز، اعتبار و اعتماد، تناسب با نیاز صنعت و فرصت‌های تجاری را نیز پوشش بده. تحلیل محتوایی و وب‌سایت فشرده ولی کاربردی باشد. نقش آن را با رقبا اشتباه نگیر. برای هر کانال اجتماعی موجود، socialAudit را با پنج بُعد کیفیت محتوا، استانداردهای صفحه، استراتژی محتوا، عملکرد و تعامل، اعتماد و اعتبار ارزیابی کن؛ هر بُعد score از ۰ تا ۱۰۰، status و evidence کوتاه داشته باشد. کانال فاقد داده را not_available ثبت کن.`, compactForChunks(business),
      '{"competitor":{"name":"...","instagramHandle":"...","website":"...","location":"...","bio":"...","services":["..."],"marketingActions":["..."],"strengths":["..."],"weaknesses":["..."],"overallScore":0,"instagramAnalytics":{"firstPost":null,"firstPostStatus":"not_collected","oldestSampledPost":null,"lastPost":null,"postsAnalyzed":0,"totalPosts":0,"followers":0,"engagementRate":null,"mediaDistribution":{"photos":0,"videos":0,"carousels":0},"contentAnalysis":{"visualQuality":"...","creativity":"...","scriptTopic":"...","captions":"...","storytelling":"...","bio":"...","highlights":"...","layout":"..."},"bestContent":{"title":"...","link":"..."}},"websiteAnalytics":{"uxScore":0,"mobileFriendly":null,"seoStatus":"...","onlineBooking":null,"liveSupport":null,"narrative":"..."}}}',
    ));
    const generated = item.competitor || item;
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
  const synthesisData = { target: compactForChunks(profilesData.target), competitors: competitorAnalysis.map(({ name, strengths, weaknesses, overallScore, services, instagramAnalytics, websiteAnalytics }) => ({ name, strengths, weaknesses, overallScore, services, instagramAnalytics, websiteAnalytics })) };
  const modelPrompt = jsonOnly(
    `یک مدل CPM فشرده و قابل دفاع بساز. دقیقاً چهار فاکتور ثابت و به‌ترتیب زیر را برگردان: social/سوشال، website/وب‌سایت، product_service/محصول/خدمت و industry_specific/عوامل اثرگذار ویژه صنعت. هر فاکتور دقیقاً ۱ یا ۲ متغیر وابسته و هر متغیر ۱ تا ۳ معیار مستقل داشته باشد. وزن هر سطح دقیقاً جمع ۱ باشد. متن هر تعریف، دلیل و شاهد حداکثر ۱۲ کلمه باشد. عامل ویژه صنعت نباید با سه فاکتور دیگر هم‌پوشانی داشته باشد. برای فاکتور چهارم پرونده‌ای کوتاه با حداقل یک شاهد صنعت و یک سؤال مشتری بساز. عامل کاندید نساز؛ در درخواست بعدی جداگانه ساخته می‌شود.`,
    { industry: target.industry, target: synthesisData.target, competitors: synthesisData.competitors },
    '{"cpmModel":{"version":1,"framework":"four_factor_v1","status":"proposed","rationale":"...","decisionBasis":[{"observation":"...","source":"...","implication":"..."}],"assumptions":["..."],"factors":[{"id":"social","label":"سوشال","weight":0.25,"definition":"...","dependentVariables":[{"id":"social_channel","label":"...","weight":1,"independentVariables":[{"id":"social_metric","label":"...","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"website","label":"وب‌سایت","weight":0.25,"definition":"...","dependentVariables":[{"id":"website_dimension","label":"...","weight":1,"independentVariables":[{"id":"website_metric","label":"...","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"product_service","label":"محصول/خدمت","weight":0.25,"definition":"...","dependentVariables":[{"id":"offer_dimension","label":"...","weight":1,"independentVariables":[{"id":"offer_metric","label":"...","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"industry_specific","label":"عوامل اثرگذار ویژه صنعت","weight":0.25,"definition":"...","industryFactorCase":{"customerDecisionRole":"...","boundaryDefinition":"...","industrySignals":[{"observation":"...","source":"...","implication":"..."}],"customerQuestions":["..."],"excludedCandidates":[],"overlapCheck":["..."],"dataGaps":["..."]},"dependentVariables":[{"id":"industry_dimension","label":"...","weight":1,"independentVariables":[{"id":"industry_metric","label":"...","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]}]}}',
  );
  let modelResult = await run('طراحی مدل ثابت CPM برای این پروژه...', modelPrompt);
  let cpmModel;
  try {
    cpmModel = validateCpmModel(modelResult.cpmModel || modelResult, { status: 'proposed', requireWeights: true, requireCandidatePool: false });
  } catch (modelError) {
    modelResult = await run('اصلاح ساختار مدل CPM...', `${modelPrompt}\nمدل قبلی رد شد: ${modelError.message} فقط JSON کوتاه، دقیقاً چهار فاکتور و وزن‌های معتبر برگردان.`);
    cpmModel = validateCpmModel(modelResult.cpmModel || modelResult, { status: 'proposed', requireWeights: true, requireCandidatePool: false });
  }
  cpmModel = ensureSocialFactor(cpmModel);
  const candidateResult = await run('ساخت عوامل کاندید CPM برای تأیید اپراتور...', jsonOnly(
    `دقیقاً ۶ عامل تصمیم مشتری برای صنعت ${target.industry} بساز که در مدل CPM فعلی نیازمند تأیید اپراتور هستند. متن هر فیلد حداکثر ۱۰ کلمه و evidence حداکثر یک مورد باشد. عامل تکراری نساز. selectedFactorId باید یکی از چهار id ثابت باشد.`,
    { industry: target.industry, model: cpmModel, target: synthesisData.target, competitors: synthesisData.competitors },
    '{"factorCandidatePool":[{"id":"...","label":"...","customerDecisionImpact":"...","customerSignal":"...","evidence":["..."],"suggestedFactorId":"social|website|product_service|industry_specific","suggestedDependentLabel":"...","classificationReason":"...","overlapRisk":"...","recommendation":"include|exclude","alreadyIncluded":false,"existingPath":"","status":"review","selectedFactorId":"social|website|product_service|industry_specific","proposedCriterion":{"definition":"...","reason":"...","evidenceSource":"...","scoring":{"type":"binary","min":0,"max":1,"normalization":"min-max","rubricLevels":[]}}}]}',
  ));
  cpmModel.factorCandidatePool = Array.isArray(candidateResult.factorCandidatePool) ? candidateResult.factorCandidatePool : [];
  cpmModel = validateCpmModel(cpmModel, { status: 'proposed', requireWeights: true, requireCandidatePool: true });
  return { overview, targetAnalysis, competitorAnalysis, synthesisData, cpmModel };
}

export async function completeResearchWithApprovedCpm(provider, config, target, competitors, profilesData, preliminary, cpmModel, onProgress = () => {}) {
  if (cpmModel?.status !== 'locked') throw new Error('مدل CPM هنوز توسط اپراتور تأیید و قفل نشده است.');
  validateCpmModel(cpmModel, { status: 'locked', requireWeights: true });
  const run = createChunkRunner(provider, config, onProgress);
  const { overview, targetAnalysis, competitorAnalysis, synthesisData } = preliminary;
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
                { rawScore: null, evidence: 'شاهد کوتاه و مشخص' },
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
    const evaluated = await run(`امتیازدهی CPM برند ${index + 1} از ${evaluationTargets.length}: ${business.name}...`, jsonOnly(
      `این برند را فقط با مدل قفل‌شده داده‌شده ارزیابی کن. همه شناسه‌ها و معیارها باید عیناً در خروجی باشند؛ معیار اضافه یا حذف‌شده ممنوع است. فقط rawScore بده و score نهایی محاسبه نکن. rawScore باید داخل بازه معیار باشد؛ اگر داده واقعاً موجود نیست null بده، نه صفر. هر evidence حداکثر ۱۲ کلمه باشد.`,
      { cpmModel, business: compactForChunks(business) }, evaluationSchema(cpmModel),
    ));
    cpmEvaluations.push(evaluated.evaluation || evaluated);
  }
  const factorOverviews = await run('ساخت مقدمه کیفی چهار فاکتور بر اساس امتیازهای نهایی...', jsonOnly(
    `بر اساس مدل CPM قفل‌شده و rawScoreهای واقعی، برای هر چهار فاکتور یک مقدمه کیفی مقایسه‌ای بنویس. متن باید بعد از تحلیل عددی ساخته شود و به زبان ساده توضیح دهد وضعیت برند هدف و رقبا در آن فاکتور چگونه است؛ مثلاً آیا حضور اینستاگرام رقبا قوی، متوسط یا ضعیف است و چرا. برای هر فاکتور ۲ تا ۴ جمله بنویس، نام برندهای شاخص را در صورت وجود ذکر کن، از ساختن عدد یا واقعیت جدید خودداری کن و اگر داده ناقص است صریحاً بگو. چهار id دقیقاً social, website, product_service, industry_specific باشند.`,
    { cpmModel, evaluations: cpmEvaluations, businesses: evaluationTargets.map((item) => item.name) },
    '{"factorOverviews":{"social":"...","website":"...","product_service":"...","industry_specific":"..."}}',
  ));
  const audienceTopics = await generateAudienceTopics(provider, config, target, { ...overview, targetAnalysis, competitorAnalysis }, profilesData.target?.platformData || {}, onProgress);
  const strategy = await run('تولید پیشنهادات اجرایی...', jsonOnly(
    `بر اساس تحلیل صنعت، SWOT و پرونده رقبا برای ${target.name} دقیقاً ۵ پیشنهاد اولویت‌بندی‌شده با ۲ تا ۴ گام اجرایی تولید کن. نقشه جایگاه تولید نکن؛ اپلیکیشن آن را به‌صورت قطعی از امتیازهای CPM تأییدشده محاسبه می‌کند.`,
    { overview, competitors: synthesisData.competitors },
    '{"recommendations":[{"priority":1,"title":"...","description":"...","actionSteps":["..."]}]}',
  ));
  const competitorList = competitorAnalysis.map((item) => ({
    name: item.name, instagramHandle: item.instagramHandle, website: item.website,
    location: item.location, followers: item.followers ?? item.instagramAnalytics?.followers ?? null,
    verified: Boolean(profilesData.competitors.find((business) => business.name === item.name)?.instagramData?.isVerified),
    overallScore: item.overallScore,
  }));
  return { ...overview, industryOverview: target.industryBriefing ? `${target.industryBriefing}\n\nتحلیل تکمیلی بر اساس داده‌های گزارش:\n${overview.industryOverview || ''}` : overview.industryOverview, competitorList, targetAnalysis, competitorAnalysis, cpmModel, cpmEvaluations, factorOverviews: factorOverviews.factorOverviews || factorOverviews, audienceTopics, ...strategy };
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
  throw new Error(`پاسخ AI قابل پردازش نیست (پایان: ${finish}، توکن خروجی: ${outputTokens}). خروجی JSON ناقص یا نامعتبر است.`);
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

async function requestAiProxy(payload) {
  let res;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      `ارتباط هنگام دریافت پاسخ AI قطع شد. ممکن است مدل شلوغ، پاسخ کند یا درخواست بیش از حد سنگین باشد. مدل دیگری انتخاب کنید و دوباره تلاش کنید. (${error.message})`,
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const responseText = await res.text().catch(() => '');
    const isCloudflareTimeout = res.status === 524 || /error\s*(code\s*)?524|A timeout occurred/i.test(responseText);
    if (isCloudflareTimeout) {
      throw new Error('سرویس AI بیشتر از مهلت Cloudflare منتظر پاسخ مدل مانده است (خطای 524). یک مدل سریع‌تر انتخاب کنید یا دوباره تلاش کنید.');
    }
    throw new Error(
      `سرویس /api/ai پاسخ غیرمنتظره برگرداند (HTTP ${res.status}).`,
    );
  }

  const data = await res.json().catch(() => null);
  if (!data) {
    throw new Error(`سرویس AI پاسخ JSON معتبر برنگرداند (HTTP ${res.status}).`);
  }
  return { res, data };
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
  const { res, data } = await requestAiProxy({ provider: '9router', model, fallbackModels, prompt });
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
  return extractJson(content, {
    provider: '9router', model,
    finishReason: diagnostic.finishReason || data.choices?.[0]?.finish_reason,
    outputTokens: diagnostic.usage?.completion_tokens ?? data.usage?.completion_tokens,
  });
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
  const result = await analyzeWithAI(provider, config, prompt);
  const slides = Array.isArray(result?.slides) ? result.slides.slice(0, 22) : [];
  if (slides.length < 3) throw new Error('مدل ساختار کافی برای پرزنتیشن تولید نکرد. دوباره تلاش کنید.');
  const allowed = new Set(['cover', 'statement', 'bullets', 'segments', 'competitors', 'swot', 'cpm', 'recommendations', 'closing']);
  return {
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
}
