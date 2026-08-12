/**
 * AI analysis utility supporting both Google Gemini and OpenRouter
 */
import { validateCpmModel } from './cpm.js';

// ─── Prompt builder (shared) ─────────────────────────────────────────────────

export function buildAnalysisPrompt(targetBusiness, competitors, profilesData) {
  const compactPost = (post = {}) => ({ ownerUsername: post.ownerUsername || post.username || '', type: post.type || post.mediaType || (post.isVideo ? 'Video' : 'Image'), timestamp: post.timestamp || post.takenAt || '', caption: String(post.caption || post.text || '').slice(0, 700), likes: post.likesCount ?? post.likes ?? 0, comments: post.commentsCount ?? post.comments ?? 0, views: post.videoViewCount ?? post.videoPlayCount ?? post.views ?? 0, url: post.url || (post.shortCode ? `https://instagram.com/p/${post.shortCode}` : '') });
  const compactBusiness = (business = {}) => ({ name: business.name, industry: business.industry, instagramHandle: business.instagramHandle, website: business.website, instagramData: business.instagramData, instagramSummary: business.instagramSummary, instagramPosts: (business.instagramPosts || []).slice(0, 20).map(compactPost), websiteData: business.websiteData ? { ...business.websiteData, text: String(business.websiteData.text || '').slice(0, 5000) } : null });
  const dataJson = JSON.stringify({ target: compactBusiness(profilesData.target), competitors: (profilesData.competitors || []).map(compactBusiness) });

  return `شما یک تحلیلگر بازار حرفه‌ای و مشاور ارشد استراتژی برند هستید. بر اساس داده‌های خام جمع‌آوری‌شده زیر، یک گزارش تحقیق بازار جامع، عمیق و کاملاً تخصصی به زبان فارسی تهیه کنید. گزارش نهایی باید از نظر کیفیت، دایره لغات تخصصی، عمق تحلیلی و ساختار متنی دقیقاً مشابه گزارش‌های تحقیق بازار دستی و حرفه‌ای تهیه شده توسط آژانس‌های مارکتینگ طراز اول کشور باشد و حس یک مطالعه کامل ۱۲۷ صفحه‌ای را القا کند.

**کسب‌وکار هدف:** ${targetBusiness.name} (صنعت: ${targetBusiness.industry})
**اینستاگرام:** @${targetBusiness.instagramHandle}
**وب‌سایت:** ${targetBusiness.website}
**کانال‌های دیجیتال هدف:** LinkedIn=${targetBusiness.linkedin || 'ندارد'} | TikTok=${targetBusiness.tiktok || 'ندارد'} | Pinterest=${targetBusiness.pinterest || 'ندارد'}

**رقبا:**
${competitors.map((c, i) => `${i + 1}. ${c.name} - @${c.instagramHandle} - ${c.website} - LinkedIn:${c.linkedin || 'ندارد'} - TikTok:${c.tiktok || 'ندارد'} - Pinterest:${c.pinterest || 'ندارد'}`).join('\n')}

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
    "tiktok": {"status": "active/not_found", "followers": 0, "posts": 0, "engagementRate": 0, "contentNotes": "تحلیل حضور"},
    "youtube": {"status": "active/not_found", "subscribers": 0, "videos": 0, "contentNotes": "تحلیل حضور"},
    "linkedin": {"status": "active/not_found", "followers": 0, "contentNotes": "تحلیل حضور"},
    "pinterest": {"status": "active/not_found", "followers": 0, "boards": 0, "contentNotes": "تحلیل حضور"}
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
6. تمام تحلیل‌های کیفی و توضیحات را به زبان فارسی سلیس، با دایره لغات تخصصی مارکتینگ بنویسید و لحنی شبیه به یک مشاور ارشد و تحلیلگر برجسته داشته باشید.`;
}

const compactForChunks = (business = {}) => ({
  name: business.name, industry: business.industry, instagramHandle: business.instagramHandle, website: business.website,
  instagramData: business.instagramData, instagramSummary: business.instagramSummary,
  instagramPosts: (business.instagramPosts || []).slice(0, 12).map((post) => ({
    type: post.type || post.mediaType, timestamp: post.timestamp || post.takenAt,
    caption: String(post.caption || post.text || '').slice(0, 400), likes: post.likesCount ?? post.likes ?? 0,
    comments: post.commentsCount ?? post.comments ?? 0, views: post.videoViewCount ?? post.views ?? 0,
    url: post.url || (post.shortCode ? `https://instagram.com/p/${post.shortCode}` : ''),
  })),
  websiteData: business.websiteData ? { ...business.websiteData, text: String(business.websiteData.text || '').slice(0, 2500) } : null,
});

const jsonOnly = (task, data, schema) => `شما تحلیلگر ارشد بازار هستید. فقط JSON معتبر و کامل برگردانید. متن‌ها فارسی، دقیق و فشرده باشند. هیچ markdown یا متن بیرون JSON ننویسید.\n\nوظیفه:\n${task}\n\nداده:\n${JSON.stringify(data)}\n\nساختار دقیق خروجی:\n${schema}`;

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

export async function prepareResearchMethodology(provider, config, target, competitors, profilesData, onProgress = () => {}) {
  const run = createChunkRunner(provider, config, onProgress);
  const allRaw = { target: compactForChunks(profilesData.target), competitors: profilesData.competitors.map(compactForChunks) };
  const overview = await run('تحلیل صنعت، فهرست رقبا و SWOT...', jsonOnly(
    `صنعت ${target.industry}، جایگاه ${target.name}، دسته‌های اصلی بازار، فهرست رقبا و SWOT برند هدف را تحلیل کن. اگر industryBriefing در داده وجود دارد، آن را به‌عنوان مقدمه کشف اولیه حفظ و با داده‌های گزارش تکمیل کن؛ مقدمه نهایی باید دید کلی صنعت بدهد. سهم دسته‌ها جمعاً نزدیک ۱۰۰ باشد.`, allRaw,
    '{"industryOverview":"...","marketCategories":[{"name":"...","share":0}],"competitorList":[{"name":"...","instagramHandle":"...","website":"...","location":"...","followers":0,"verified":false}],"swot":{"strengths":["..."],"weaknesses":["..."],"opportunities":["..."],"threats":["..."]}}',
  ));
  const competitorAnalysis = [];
  for (let index = 0; index < profilesData.competitors.length; index += 1) {
    const business = profilesData.competitors[index];
    const item = await run(`تحلیل رقیب ${index + 1} از ${profilesData.competitors.length}: ${business.name}...`, jsonOnly(
      'این رقیب را بر اساس نمونه داده‌شده تحلیل کن. آمار را حدس نزن. تحلیل محتوایی و وب‌سایت فشرده ولی کاربردی باشد.', compactForChunks(business),
      '{"competitor":{"name":"...","instagramHandle":"...","website":"...","location":"...","bio":"...","services":["..."],"marketingActions":["..."],"strengths":["..."],"weaknesses":["..."],"overallScore":0,"instagramAnalytics":{"firstPost":null,"firstPostStatus":"not_collected","oldestSampledPost":null,"lastPost":null,"postsAnalyzed":0,"totalPosts":0,"followers":0,"engagementRate":null,"mediaDistribution":{"photos":0,"videos":0,"carousels":0},"contentAnalysis":{"visualQuality":"...","creativity":"...","scriptTopic":"...","captions":"...","storytelling":"...","bio":"...","highlights":"...","layout":"..."},"bestContent":{"title":"...","link":"..."}},"websiteAnalytics":{"uxScore":0,"mobileFriendly":null,"seoStatus":"...","onlineBooking":null,"liveSupport":null,"narrative":"..."}}}',
    ));
    const generated = item.competitor || item;
    competitorAnalysis.push({
      ...generated,
      // Identity always comes from the form. The model must not rename, merge,
      // or omit a competitor when several brands have similar profiles.
      name: business.name,
      instagramHandle: business.instagramHandle,
      website: business.website,
    });
  }
  if (competitorAnalysis.length !== competitors.length) {
    throw new Error(`گزارش رقبا ناقص است: ${competitorAnalysis.length} از ${competitors.length} رقیب تحلیل شد.`);
  }
  const synthesisData = { target: compactForChunks(profilesData.target), competitors: competitorAnalysis.map(({ name, strengths, weaknesses, overallScore, services, instagramAnalytics, websiteAnalytics }) => ({ name, strengths, weaknesses, overallScore, services, instagramAnalytics, websiteAnalytics })) };
  const modelPrompt = jsonOnly(
    `مثل یک کارشناس خبره صنعت، یک مدل CPM سلسله‌مراتبی و قابل دفاع طراحی کن. مدل باید دقیقاً چهار فاکتور زیر را با همین ترتیب، id و label داشته باشد و هیچ فاکتور پنجم یا نام جایگزین نسازد:
۱) id=social و label=سوشال: همه کانال‌های ورودی اجتماعی مرتبط این پروژه مانند اینستاگرام، لینکدین، پینترست، تیک‌تاک یا سایر کانال‌های واقعاً مرتبط. هر کانال را متغیر وابسته بگیر و معیارهای سنجش آن را متغیر مستقل تعریف کن.
۲) id=website و label=وب‌سایت: تمام موارد مربوط به وب‌سایت، تجربه کاربری، فنی، محتوا، تبدیل، سئو و قابلیت‌های مرتبط با case.
۳) id=product_service و label=محصول/خدمت: سبد، کیفیت، عمق، تنوع، تناسب، بسته‌بندی یا ابعاد مرتبط محصول/خدمت.
۴) id=industry_specific و label=عوامل اثرگذار ویژه صنعت: فقط عوامل مؤثر بر تصمیم مشتری که در سه فاکتور قبل جا نمی‌شوند. این فاکتور نباید محل تکرار سوشال، وب‌سایت یا محصول/خدمت باشد.
تعداد و نام فاکتورها ثابت است؛ اما متغیرهای وابسته و مستقل هر پروژه را متناسب با صنعت بساز. برای هر فاکتور حداکثر ۴ متغیر وابسته، برای هر متغیر وابسته حداکثر ۵ متغیر مستقل و در کل حداکثر ۳۶ متغیر مستقل مجاز است. برای فاکتورها، متغیرهای وابسته و مستقل وزن پیشنهاد بده و مجموع وزن هر سطح دقیقاً ۱ باشد. وزن‌ها را با تکیه بر رفتار خرید، ریسک ادراک‌شده، اقتصاد صنعت و داده‌های پروژه تعیین کن. decisionBasis باید مشاهده، منبع و اثر آن بر وزن‌دهی را جدا کند.
برای فاکتور چهارم industryFactorCase مفصل تولید کن: customerDecisionRole، boundaryDefinition، industrySignals با observation/source/implication، customerQuestions، excludedCandidates همراه reason، overlapCheck و dataGaps. علاوه بر مدل اصلی، factorCandidatePool شامل ۸ تا ۱۶ عامل محتمل تصمیم مشتری بساز تا هیچ عامل مؤثری بی‌صدا حذف نشود. حتماً این گزینه‌ها را بررسی کن، حتی اگر نتیجه بررسی عدم ارتباط باشد: تأیید اینفلوئنسر/سلبریتی و اثبات اجتماعی، بسته‌بندی خاص، ارسال رایگان، خرید قسطی، شرایط بازگشت، خدمات جانبی، سفارشی‌سازی، همکاری سازمانی، شعب، مجوز/استاندارد و شفافیت فرایند. هر candidate باید اثر بر تصمیم، سیگنال مشتری، شواهد، محل پیشنهادی میان چهار فاکتور، دلیل طبقه‌بندی، ریسک هم‌پوشانی، پیشنهاد include/exclude و معیار سنجش پیشنهادی داشته باشد. اگر عامل از قبل در مدل آمده، alreadyIncluded=true و existingPath را پر کن و status=included بگذار؛ در غیر این صورت status=review تا اپراتور درباره افزودن یا رد آن تصمیم بگیرد. متغیر ویژه‌ای که با سه فاکتور اول هم‌پوشانی دارد وارد فاکتور چهارم نکن. بازه هر معیار بر اساس ماهیت آن باشد؛ normalization فقط ratio یا min-max. برای rubric حداکثر ۴ سطح کوتاه بساز. متن‌ها فشرده ولی استدلالی باشند.`,
    { industry: target.industry, target: synthesisData.target, competitors: synthesisData.competitors },
    '{"cpmModel":{"version":1,"framework":"four_factor_v1","status":"proposed","rationale":"...","decisionBasis":[{"observation":"...","source":"...","implication":"..."}],"assumptions":["..."],"factorCandidatePool":[{"id":"free_shipping","label":"ارسال رایگان","customerDecisionImpact":"...","customerSignal":"...","evidence":["..."],"suggestedFactorId":"industry_specific","suggestedDependentLabel":"تسهیل خرید","classificationReason":"...","overlapRisk":"...","recommendation":"include|exclude","alreadyIncluded":false,"existingPath":"","status":"review|included","selectedFactorId":"industry_specific","proposedCriterion":{"definition":"...","reason":"...","evidenceSource":"...","scoring":{"type":"binary|range|count|percentage|rubric","min":0,"max":1,"normalization":"min-max","rubricLevels":[]}}}],"factors":[{"id":"social","label":"سوشال","weight":0.25,"dependentVariables":[{"id":"social_channel","label":"کانال اجتماعی","weight":1,"independentVariables":[{"id":"social_metric","label":"معیار کانال","weight":1,"evidenceSource":"...","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"website","label":"وب‌سایت","weight":0.25,"dependentVariables":[{"id":"website_dimension","label":"بعد وب‌سایت","weight":1,"independentVariables":[{"id":"website_metric","label":"معیار وب‌سایت","weight":1,"evidenceSource":"website_data","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"product_service","label":"محصول/خدمت","weight":0.25,"dependentVariables":[{"id":"offer_dimension","label":"بعد محصول یا خدمت","weight":1,"independentVariables":[{"id":"offer_metric","label":"معیار محصول یا خدمت","weight":1,"evidenceSource":"competitor_analysis","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]},{"id":"industry_specific","label":"عوامل اثرگذار ویژه صنعت","weight":0.25,"industryFactorCase":{"customerDecisionRole":"...","boundaryDefinition":"...","industrySignals":[{"observation":"...","source":"...","implication":"..."}],"customerQuestions":["..."],"excludedCandidates":[{"name":"...","reason":"..."}],"overlapCheck":["..."],"dataGaps":["..."]},"dependentVariables":[{"id":"industry_dimension","label":"عامل ویژه صنعت","weight":1,"independentVariables":[{"id":"industry_metric","label":"معیار ویژه صنعت","weight":1,"evidenceSource":"industry_inference","scoring":{"type":"range","min":0,"max":3,"normalization":"min-max","rubricLevels":[]}}]}]}]}}',
  );
  let modelResult = await run('طراحی مدل ثابت CPM برای این پروژه...', modelPrompt);
  let cpmModel;
  try {
    cpmModel = validateCpmModel(modelResult.cpmModel || modelResult, { status: 'proposed', requireWeights: true });
  } catch (modelError) {
    modelResult = await run('اصلاح ساختار مدل CPM...', `${modelPrompt}\nمدل قبلی رد شد: ${modelError.message} دقیقاً چهار فاکتور ثابت، وزن‌ها، متغیرها و پرونده توجیه فاکتور چهارم را کامل کن.`);
    cpmModel = validateCpmModel(modelResult.cpmModel || modelResult, { status: 'proposed', requireWeights: true });
  }
  return { overview, competitorAnalysis, synthesisData, cpmModel };
}

export async function completeResearchWithApprovedCpm(provider, config, target, competitors, profilesData, preliminary, cpmModel, onProgress = () => {}) {
  if (cpmModel?.status !== 'locked') throw new Error('مدل CPM هنوز توسط اپراتور تأیید و قفل نشده است.');
  validateCpmModel(cpmModel, { status: 'locked', requireWeights: true });
  const run = createChunkRunner(provider, config, onProgress);
  const { overview, competitorAnalysis, synthesisData } = preliminary;
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
  return { ...overview, industryOverview: target.industryBriefing ? `${target.industryBriefing}\n\nتحلیل تکمیلی بر اساس داده‌های گزارش:\n${overview.industryOverview || ''}` : overview.industryOverview, competitorList, competitorAnalysis, cpmModel, cpmEvaluations, factorOverviews: factorOverviews.factorOverviews || factorOverviews, ...strategy };
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
      `ارتباط با سرویس AI برقرار نشد. Worker پروژه فعال نیست یا اتصال شبکه قطع شده است. پروژه را با "pnpm dev" اجرا کنید. (${error.message})`,
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(
      `مسیر /api/ai به Worker متصل نیست (HTTP ${res.status}). سرور Vite ایستا را ببندید و پروژه را با "pnpm dev" اجرا کنید.`,
    );
  }

  const data = await res.json().catch(() => null);
  if (!data) {
    throw new Error(`سرویس AI پاسخ JSON معتبر برنگرداند (HTTP ${res.status}).`);
  }
  return { res, data };
}

/**
 * Call Google Gemini API directly
 * @param {string} apiKey  - VITE_GEMINI_API_KEY
 * @param {string} prompt
 * @param {string} model   - e.g. "gemini-2.0-flash"
 */
export async function analyzeWithGemini(
  apiKey,
  prompt,
  model = 'gemini-2.0-flash',
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

export async function analyzeWith9Router(prompt, model) {
  const { res, data } = await requestAiProxy({ provider: '9router', model, prompt });
  if (!res.ok) throw new Error(data.error?.message || data.error || `خطای 9Router: ${res.status}`);
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
  if (provider === 'gemini') {
    return analyzeWithGemini(config.apiKey, prompt, config.model);
  }
  if (provider === '9router') return analyzeWith9Router(prompt, config.model);
  return analyzeWithOpenRouter(
    config.apiKey,
    prompt,
    config.model,
    config.endpoint,
  );
}
