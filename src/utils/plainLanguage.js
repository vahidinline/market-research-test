export const PLAIN_LANGUAGE_RULES = `Write for a business owner, not an academic reader. Use familiar everyday words and complete, short sentences. Name the concrete action or observation. Avoid abstract noun chains, jargon and untranslated English in prose. Criterion titles should be 2–6 clear words; definitions should explain what to check in one sentence. In Persian say «وضوح معرفی خدمات» instead of «شفافیت گزاره ارزش پیشنهادی», «راه تماس با کسب‌وکار» instead of «مسیر تبدیل مخاطب», and «تفاوت با رقبا» instead of «تمایز رقابتی». Never change identifiers, numbers, evidence references or the meaning of a finding to simplify wording.`;
const replacements = [
 ['مخاطب ثبت‌شده', 'تعداد مخاطبان صفحه'], ['ورود به فرایند درخواست', 'راه‌های ثبت درخواست'],
 ['تنوع مسیرهای آغاز درخواست', 'تعداد راه‌های ثبت درخواست'], ['شفافیت پیشنهاد خدمات', 'وضوح معرفی خدمات'],
 ['پوشش مراحل اجرایی', 'مراحل خدمات اعلام‌شده'], ['شفافیت قیمت منتشرشده', 'روشن بودن قیمت و شرایط'],
 ['پوشش جغرافیایی خدمات', 'کشورهای مقصد خدمات'], ['شرایط ورود تحصیلی', 'شرایط پذیرش تحصیلی'],
 ['عرضه مسیر تحصیلی بورسیه‌دار', 'ارائه پذیرش همراه با بورسیه'], ['شفافیت مشخصات حقوقی', 'اطلاعات ثبت و مجوز'],
 ['جزئیات قابل‌پیگیری ادعای حقوقی', 'جزئیات قابل‌بررسی ثبت و مجوز'], ['روابط نهادی ادعاشده', 'همکاری‌های اعلام‌شده'],
 ['شفافیت رابطه با دانشگاه', 'اطلاعات همکاری با دانشگاه'],
 ['شفافیت گزاره ارزش پیشنهادی', 'وضوح معرفی خدمات'], ['گزاره ارزش پیشنهادی', 'ارزش پیشنهادی برای مشتری'],
 ['مسیر تبدیل مخاطب', 'راه تبدیل مخاطب به مشتری'], ['تمایز رقابتی', 'تفاوت با رقبا'],
 ['اعتبارسنجی', 'بررسی اعتبار'], ['مبتنی بر', 'بر اساس'], ['تبیین', 'توضیح'],
 ['هم‌راستایی', 'هماهنگی'], ['همراستایی', 'هماهنگی'], ['روبرک', 'راهنمای امتیازدهی'],
];
export function plainText(value) {
  if (typeof value !== 'string') return value;
  return replacements.reduce((text, [from, to]) => text.replaceAll(from, to), value);
}
// Only human-facing fields: no IDs, URLs, source excerpts or numerical data.
const prose = new Set(['label','definition','reason','rationale','description','title','classificationReason','customerDecisionImpact','customerSignal','overlapRisk','industryOverview','narrative','summary']);
export function simplifyLabels(value) {
  if (Array.isArray(value)) return value.map(simplifyLabels);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, prose.has(key) && typeof item === 'string' ? plainText(item) : simplifyLabels(item)]));
}

export const EDITORIAL_RULES = `${PLAIN_LANGUAGE_RULES}\nYou are a Persian business-report editor. Explain observations directly, without academic or legalistic wording. Example: «این صفحه ۹۲۶ دنبال‌کننده دارد. تعداد دنبال‌کننده به‌تنهایی کیفیت محتوا را نشان نمی‌دهد.» Avoid «احراز»، «گزاره»، «ادعاشده»، «تبیین» and «شناسه شواهد ارائه نشده». Preserve uncertainty: announced services are not verified results. Never turn missing information into a negative finding. Do not add recommendations unless editing an existing recommendation.`;
const digits = text => String(text).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replaceAll('٫', '.').replaceAll('٬', ',');
export const numbersIn = text => (digits(text).match(/\d+(?:[.,]\d+)*/g) || []).map(number => number.replaceAll(',', ''));
export function validatePlainSummary(summary, facts = []) {
  if (typeof summary !== 'string' || !summary.trim() || summary.length > 1200) throw new Error('مقدمه باید متن غیرخالی و حداکثر ۱۲۰۰ نویسه باشد.');
  if (/احراز|گزاره|تبیین|شناسه.{0,12}شواهد.{0,20}(ارائه نشده|موجود نیست)/.test(summary)) throw new Error('متن را با واژه‌های روزمره و جمله‌های مستقیم بازنویسی کن.');
  const allowed = new Set(numbersIn(JSON.stringify(facts.map(({ name, criterion, evidence, rawScore, normalizedScore, factorScore }) => ({ name, criterion, evidence, rawScore, normalizedScore, factorScore })))));
  if (numbersIn(summary).some(number => !allowed.has(number))) throw new Error('عدد جدیدی در متن آمده که در نکته‌های انتخاب‌شده نیست.');
  return summary;
}
