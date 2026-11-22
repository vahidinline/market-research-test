// Versioned, opt-in scoring: archived reports keep their approved methodology.
export function configureWebsiteScoring(model) {
  const next = structuredClone(model);
  const factor = next.factors?.find(item => item.id === 'website');
  if (!factor) return next;
  factor.auditScoringVersion = 2;
  factor.definition = 'بررسی موارد قابل‌اندازه‌گیری صفحه و زیرساخت؛ عملکرد فرم‌ها فقط پس از آزمون واقعی امتیاز می‌گیرد.';
  for (const group of factor.dependentVariables) for (const criterion of group.independentVariables) {
    if (criterion.id === 'technical_seo') {
      criterion.definition = 'نسبت موارد رعایت‌شده از هفت بررسی صفحه: عنوان، توضیح، یک تیتر اصلی، نشانی مرجع، متن جایگزین تصاویر، پیوندها و داده ساختاریافته. امتیاز خام برابر این نسبت ضرب‌در ۳ است؛ رتبه گوگل سنجیده نمی‌شود.';
      criterion.scoring = { ...criterion.scoring, type: 'range', min: 0, max: 3, normalization: 'min-max', rubricLevels: [
        { score: 0, description: 'هیچ‌یک از هفت بررسی صفحه رعایت نشده است.' },
        { score: 3, description: 'هر هفت بررسی صفحه رعایت شده‌اند؛ امتیازهای بین این دو متناسب با تعداد موارد رعایت‌شده‌اند.' },
      ] };
    }
    if (criterion.id === 'candidate_technical_seo_compliance') criterion.definition = 'پاسخ موفق صفحه، HTTPS و نقشه سایت معتبر باید مستقیماً تأیید شوند. پیدا نشدن نقشه سایت در مسیرهای بررسی‌شده، به‌تنهایی امتیاز صفر نمی‌گیرد.';
  }
  return next;
}

export function measuredWebsiteScore(criterion, evidence) {
  const entry = evidence?.findLast(item => item.channel === 'website' && item.metrics?.seo?.version === 2);
  const seo = entry?.metrics?.seo;
  const ids = entry ? [entry.id] : [];
  const unavailable = reason => ({ rawScore: null, evidenceIds: ids, evidence: reason });
  if (!['technical_seo', 'candidate_technical_seo_compliance', 'candidate_website_ux_lead_tools'].includes(criterion.id)) return undefined;
  if (criterion.id === 'candidate_website_ux_lead_tools') return unavailable('فرم تماس و مراحل رزرو مشاوره تست نشده‌اند؛ این بخش هنوز امتیاز ندارد.');
  if (!seo || !(seo.checks.status >= 200 && seo.checks.status < 300)) return unavailable('بررسی موفق و قابل‌استناد صفحه موجود نیست؛ امتیازگذاری نشده است.');
  if (criterion.id === 'technical_seo') {
    if (!Number.isFinite(seo.onPage)) return unavailable('نتیجه بررسی موارد صفحه موجود نیست.');
    const passed = Math.round(seo.onPage * 7 / 100);
    return { rawScore: passed * 3 / 7, evidenceIds: ids, evidence: `در صفحه بررسی‌شده، ${passed} مورد از ۷ بررسی پایه سئو رعایت شده است. جزئیات در بخش ممیزی سئو آمده است. سرعت سایت، رتبه گوگل و عملکرد فرم‌ها در این امتیاز لحاظ نشده‌اند.` };
  }
  if (seo.checks.https === false) return { rawScore: 0, evidenceIds: ids, evidence: 'صفحه نهایی از اتصال HTTPS استفاده نمی‌کند؛ شرط اتصال امن رعایت نشده است.' };
  if (seo.checks.sitemap !== true) return unavailable('در آدرس‌هایی که بررسی کردیم، نقشه سایت معتبری پیدا نشد. ممکن است نقشه سایت در آدرس دیگری باشد؛ بنابراین برای این معیار امتیازی ثبت نشده است.');
  return { rawScore: 1, evidenceIds: ids, evidence: 'صفحه باز شد، اتصال HTTPS برقرار بود و نقشه سایت معتبر دریافت شد. هر سه شرط این معیار برقرار است.' };
}
