/**
 * AI analysis utility supporting both Google Gemini and OpenRouter
 */

// ─── Prompt builder (shared) ─────────────────────────────────────────────────

export function buildAnalysisPrompt(targetBusiness, competitors, profilesData) {
  const dataJson = JSON.stringify(profilesData, null, 2);

  return `شما یک تحلیلگر بازار حرفه‌ای و مشاور استراتژی هستید. بر اساس داده‌های زیر، یک گزارش عمیق و قابل‌اجرا به زبان فارسی تهیه کنید. خروجی باید عمق یک گزارش 127 صفحه‌ای را در یک JSON کامل حفظ کند.

**کسب‌وکار هدف:** ${targetBusiness.name} (صنعت: ${targetBusiness.industry})
**اینستاگرام:** @${targetBusiness.instagramHandle}
**وب‌سایت:** ${targetBusiness.website}
**کانال‌های دیجیتال هدف:** LinkedIn=${targetBusiness.linkedin || 'ندارد'} | TikTok=${targetBusiness.tiktok || 'ندارد'} | Pinterest=${targetBusiness.pinterest || 'ندارد'}

**رقبا:**
${competitors.map((c, i) => `${i + 1}. ${c.name} - @${c.instagramHandle} - ${c.website} - LinkedIn:${c.linkedin || 'ندارد'} - TikTok:${c.tiktok || 'ندارد'} - Pinterest:${c.pinterest || 'ندارد'}`).join('\n')}

**داده‌های اسکرپ شده از اینستاگرام:**
\`\`\`json
${dataJson}
\`\`\`

لطفاً **فقط** یک JSON معتبر با ساختار دقیق زیر برگردانید (بدون هیچ توضیح اضافه):

{
  "industryOverview": "تحلیل چندپاراگرافی روندها، اندازه و محرک‌های صنعت",
  "marketCategories": [{"name":"نام دسته","share":35}],
  "competitorList": [{"name":"نام","instagramHandle":"@handle","website":"https://...","location":"شهر","followers":0,"verified":false}],
  "competitorAnalysis": [
    {
      "name": "نام رقیب",
      "instagramHandle": "@handle",
      "followers": 0,
      "posts": 0,
      "engagementRate": "x.x%",
      "strengths": ["نقطه قوت ۱", "نقطه قوت ۲"],
      "weaknesses": ["نقطه ضعف ۱", "نقطه ضعف ۲"],
      "overallScore": 7
      ,"location":"شهر","activePlatforms":["Instagram","Website"],
      "services":["دسته محصول ۱","دسته محصول ۲"],
      "marketingActions":["اقدام بازاریابی ۱","اقدام بازاریابی ۲"],
      "instagramAnalytics":{"firstPost":"تاریخ","lastPost":"تاریخ","totalPosts":0,"followers":0,"engagementRate":0,"mediaDistribution":{"photos":60,"videos":20,"carousels":20},"contentAnalysis":{"visualIdentity":"تحلیل","bioQuality":"تحلیل","captionStrategy":"تحلیل","hashtagStrategy":"تحلیل"},"bestContent":{"title":"ایده برتر","link":"https://instagram.com/..."}},
      "websiteAnalytics":{"uxScore":7,"mobileFriendly":true,"seoStatus":"خوب","onlineBooking":true,"liveSupport":false}
    }
  ],
  "swot": {
    "strengths": ["قوت ۱", "قوت ۲", "قوت ۳"],
    "weaknesses": ["ضعف ۱", "ضعف ۲", "ضعف ۳"],
    "opportunities": ["فرصت ۱", "فرصت ۲", "فرصت ۳"],
    "threats": ["تهدید ۱", "تهدید ۲", "تهدید ۳"]
  },
  "cpmMatrix": {
    "headers": ["کسب‌وکار", "اینستاگرام", "وب‌سایت", "اعتبار", "خدمات", "مجموع"],
    "rows": [
      {
        "name": "نام کسب‌وکار هدف",
        "isTarget": true,
        "instagram": 8,
        "website": 7,
        "credibility": 8,
        "services": 9,
        "total": 32,
        "instagramBreakdown":{"visualQuality":8,"creativity":8,"scriptTopic":8,"captions":8,"storytelling":8,"bio":8,"highlights":8,"layout":8,"engagementRate":8},
        "websiteBreakdown":{"ux":8,"deviceCompatibility":8,"seo":8,"serviceCategorization":8,"onlineBooking":8,"liveSupport":8},
        "credibilityBreakdown":{"physicalStore":8,"digitalPresence":8,"influencerCollabs":8,"yearsExperience":8},
        "servicesBreakdown":{"productDiversity":8,"customization":8,"accessories":8,"additionalServices":8}
      }
    ]
  },
  "positioningMaps":[{"title":"Instagram vs Website","xAxis":"امتیاز اینستاگرام","yAxis":"امتیاز وب‌سایت","data":[{"name":"برند","x":8,"y":7,"isTarget":true}]}],
  "recommendations": [
    {
      "priority": 1,
      "title": "عنوان توصیه",
      "description": "توضیح کامل توصیه استراتژیک"
    }
  ]
}

مطمئن شوید:
- مجموع در CPM Matrix درست محاسبه شود
- هر رقیب در competitorAnalysis آمده باشد و کسب‌وکار هدف نیز در cpmMatrix.rows اول باشد
- برای هر ردیف CPM تمام breakdownهای عددی را با امتیاز 1 تا 10 تولید کن؛ میانگین هر breakdown باید factor اصلی را بسازد
- برای هر competitor همه فیلدهای bio/location/website/platforms/services/marketing/Instagram analytics/website analytics را پر کن
- positioningMaps باید دقیقاً ۴ نقشه با مختصات x/y بین ۰ تا ۱۰ داشته باشد
- دقیقاً ۵ توصیه استراتژیک ارائه دهید
- تمام متون به فارسی باشند`;
}

// ─── JSON extractor (shared) ──────────────────────────────────────────────────

function extractJson(text) {
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
  throw new Error('پاسخ AI قابل پردازش نیست. خروجی JSON ناقص یا نامعتبر است؛ لطفاً دوباره تلاش کنید.');
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                'شما یک تحلیلگر بازار حرفه‌ای هستید که فقط JSON معتبر برمی‌گردانید.\n\n' +
                prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 12288,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      err.error?.message ||
      (res.status === 400
        ? 'کلید Gemini نامعتبر است یا مدل در دسترس نیست.'
        : `خطای Gemini: ${res.status}`);
    throw new Error(msg);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!content) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new Error(`Gemini پاسخ خالی برگرداند (دلیل: ${reason || 'نامشخص'})`);
  }

  return extractJson(content);
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
  return extractJson(content);
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
  return analyzeWithOpenRouter(
    config.apiKey,
    prompt,
    config.model,
    config.endpoint,
  );
}
