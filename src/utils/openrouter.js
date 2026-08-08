/**
 * OpenRouter API utility for AI analysis
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Build the analysis prompt from scraped profile data (Persian output)
 */
export function buildAnalysisPrompt(targetBusiness, competitors, profilesData) {
  const dataJson = JSON.stringify(profilesData, null, 2);

  return `شما یک تحلیلگر بازار حرفه‌ای هستید. بر اساس داده‌های زیر، یک تحلیل جامع بازار به زبان فارسی تهیه کنید.

**کسب‌وکار هدف:** ${targetBusiness.name} (صنعت: ${targetBusiness.industry})
**اینستاگرام:** @${targetBusiness.instagramHandle}
**وب‌سایت:** ${targetBusiness.website}

**رقبا:**
${competitors.map((c, i) => `${i + 1}. ${c.name} - @${c.instagramHandle} - ${c.website}`).join('\n')}

**داده‌های اسکرپ شده از اینستاگرام:**
\`\`\`json
${dataJson}
\`\`\`

لطفاً **فقط** یک JSON معتبر با ساختار دقیق زیر برگردانید (بدون هیچ توضیح اضافه):

{
  "industryOverview": "متن کوتاه درباره وضعیت صنعت (2-3 جمله)",
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
        "total": 32
      }
    ]
  },
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
- دقیقاً ۵ توصیه استراتژیک ارائه دهید
- تمام متون به فارسی باشند`;
}

/**
 * Call OpenRouter API with the analysis prompt
 */
export async function analyzeWithAI(
  apiKey,
  prompt,
  model = 'anthropic/claude-3.5-sonnet',
) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
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
      max_tokens: 4000,
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

  // Strip markdown code fences if present
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('پاسخ AI قابل پردازش نیست. لطفاً دوباره تلاش کنید.');
  }
}
