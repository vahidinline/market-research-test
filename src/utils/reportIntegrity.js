import { reportPositioningMaps } from './positioningMaps.js';
import { businessEvidence, sanitizeProfileAnalysis } from './researchEvidence.js';
import { normalizeInstagramHandle } from './apify.js';
import { calculateCpmMatrix } from './cpm.js';

const postUrl = (post) => post?.url || post?.postUrl || (post?.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : null);
const postTitle = (post) => String(post?.caption || post?.text || '').trim().slice(0, 100) || 'محتوای برتر در نمونه بررسی‌شده';
const sameBusiness = (analysis, business) => {
  const aHandle = normalizeInstagramHandle(analysis?.instagramHandle).toLowerCase();
  const bHandle = normalizeInstagramHandle(business?.instagramHandle).toLowerCase();
  return (aHandle && aHandle === bHandle) || String(analysis?.name || '').trim().toLowerCase() === String(business?.name || '').trim().toLowerCase();
};
const clamp = (value) => Math.max(0, Math.min(10, Number(value) || 0));
const average = (group) => {
  const values = Object.values(group || {}).map(Number).filter(Number.isFinite);
  return values.length ? Number((values.reduce((sum, value) => sum + clamp(value), 0) / values.length).toFixed(2)) : 0;
};

export function enforceReportIntegrity(analysis, profilesData) {
  const result = structuredClone(analysis || {});
  const businesses = [profilesData.target, ...(profilesData.competitors || [])];
  const enrichAnalysis = (competitor) => {
    const business = competitor.isTarget ? profilesData.target : businesses.find((item) => sameBusiness(competitor, item));
    if (!business) return competitor;
    const profile = business.instagramData;
    const summary = business.instagramSummary;
    const checked = result.researchMethodology ? sanitizeProfileAnalysis(competitor, business) : competitor;
    const existing = checked.instagramAnalytics || {};
    const bestPost = summary?.bestPost;
    const recorded = result._integrity?.businessSources?.find((item) => sameBusiness(item, business));
    const websiteUrl = String(business.website || '').trim();
    const website = websiteUrl ? business.websiteData : null;
    const hasWebsiteEvidence = Boolean(websiteUrl && (website?.text || website?.pagesCrawled > 0 || website?.pages?.some((page) => page.text) || (recorded?.website === websiteUrl && recorded.hasWebsiteEvidence)));
    const websiteStatus = !websiteUrl ? result.researchMethodology ? 'not_audited' : 'absent' : hasWebsiteEvidence ? 'audited' : 'not_audited';
    const seo = hasWebsiteEvidence ? website?.seo || competitor.websiteAnalytics?.seo || null : null;
    return {
      ...(result.researchMethodology ? sanitizeProfileAnalysis(competitor, business) : competitor),
      instagramHandle: business.instagramHandle || competitor.instagramHandle,
      website: websiteUrl,
      followers: profile?.followersCount ?? null,
      posts: profile?.postsCount ?? null,
      engagementRate: summary?.engagementRate ?? null,
      instagramAnalytics: {
        ...existing,
        firstPost: null,
        firstPostStatus: 'not_collected',
        oldestSampledPost: summary?.oldestSampledPost ?? null,
        lastPost: summary?.latestSampledPost ?? null,
        totalPosts: profile?.postsCount ?? null,
        postsAnalyzed: summary?.postsAnalyzed ?? 0,
        followers: profile?.followersCount ?? null,
        engagementRate: summary?.engagementRate ?? null,
        mediaDistribution: summary?.mediaDistribution || {},
        mediaCounts: summary?.mediaCounts || {},
        bestContent: bestPost ? { title: postTitle(bestPost), link: postUrl(bestPost) } : null,
        evidence: {
          metrics: 'Apify',
          contentAnalysis: 'AI inference',
          sampleLimited: true,
        },
      },
      websiteAnalytics: {
        ...(hasWebsiteEvidence ? checked.websiteAnalytics || {} : {}),
        status: websiteStatus,
        uxScore: hasWebsiteEvidence ? checked.websiteAnalytics?.uxScore ?? null : null,
        narrative: hasWebsiteEvidence ? competitor.websiteAnalytics?.narrative || '' : websiteUrl ? 'داده کافی برای ارزیابی وب‌سایت موجود نیست.' : result.researchMethodology ? 'آدرس وب‌سایت ثبت نشده؛ نمی‌توان گفت این کسب‌وکار وب‌سایت ندارد.' : 'این کسب‌وکار وب‌سایت ندارد.',
        mobileFriendly: result.researchMethodology ? null : hasWebsiteEvidence ? website ? Boolean(website.mobileMeta) : competitor.websiteAnalytics?.mobileFriendly ?? null : null,
        onlineBooking: hasWebsiteEvidence ? website ? Boolean(website.hasBooking) : competitor.websiteAnalytics?.onlineBooking ?? null : null,
        liveSupport: null,
        seoScore: seo?.overall ?? null,
        seo: seo || { onPage: null, technical: null, offPage: null, overall: null, status: 'not_audited' },
        seoStatus: seo ? `${seo.overall}/100` : 'ممیزی نشده',
        evidence: {
          mobileFriendly: website ? 'website_html' : 'unavailable',
          onlineBooking: website ? 'website_html_keyword_check' : 'unavailable',
          uxScore: hasWebsiteEvidence ? 'AI inference from website evidence' : 'unavailable',
          seoStatus: seo ? 'deterministic_html_audit' : 'unavailable',
          liveSupport: 'unavailable',
        },
      },
      ...(business.instagramData === undefined && business.instagramSummary === undefined ? { followers: competitor.followers ?? null, posts: competitor.posts ?? null, engagementRate: competitor.engagementRate ?? null, instagramAnalytics: competitor.instagramAnalytics || {} } : {}),
    };
  };
  result.targetAnalysis = result.targetAnalysis ? enrichAnalysis({ ...result.targetAnalysis, isTarget: true }) : null;
  result.competitorAnalysis = (result.competitorAnalysis || []).map(enrichAnalysis);
  // Directory is derived from the canonical detailed analyses. AI-generated
  // summary lists frequently omit brands when the input contains many rivals.
  result.competitorList = result.competitorAnalysis.map((detail) => ({
    name: detail.name,
    location: detail.location,
    instagramHandle: detail.instagramHandle,
    website: detail.website,
    followers: detail.followers,
    verified: Boolean(businesses.find((item) => sameBusiness(detail, item))?.instagramData?.isVerified),
    overallScore: detail.overallScore,
  }));

  if (result.cpmModel) {
    const evidenceFor = business => {
      const stored = (result.researchEvidence || []).filter(item => item.business === business.name).map(item => ({ ...item, id: item.id.split(':').at(-1) }));
      return stored.length ? stored : businessEvidence(business);
    };
    const identities = businesses.map((business, index) => ({
      name: business.name,
      isTarget: index === 0,
      strictEvidence: Boolean(result.researchMethodology),
      websiteEvidence: evidenceFor(business),
      evidenceIds: evidenceFor(business).map(item => item.id),
      evidenceChannels: Object.fromEntries(evidenceFor(business).map(item => [item.id, item.channel])),
      hasWebsite: Boolean(String(business.website || '').trim()),
      hasWebsiteEvidence: Boolean(String(business.website || '').trim() && (business.websiteData?.text || business.websiteData?.pagesCrawled > 0 || business.websiteData?.pages?.some((page) => page.text) || result._integrity?.businessSources?.some((source) => sameBusiness(source, business) && source.website === business.website && source.hasWebsiteEvidence))),
    }));
    const calculated = calculateCpmMatrix(result.cpmModel, result.cpmEvaluations, identities);
    result.cpmModel = calculated.model;
    result.cpmMatrix = calculated.matrix;
    result.cpmEvaluations = structuredClone(calculated.matrix.rows);
    result.factorOverviews = { ...(result.factorOverviews || {}), website: businesses.map((business, index) => {
      const row = calculated.matrix.rows[index];
      const score = row.factorScores.website?.score;
      const absent = !String(business.website || '').trim();
      const state = absent ? result.researchMethodology ? 'آدرس وب‌سایت ثبت نشده؛ ارزیابی نشده است.' : 'وب‌سایت ندارد؛ امتیاز صفر.' : score == null ? 'وب‌سایت ثبت شده، اما شواهد کافی برای امتیازدهی موجود نیست.' : `امتیاز وب‌سایت بر اساس داده بررسی‌شده: ${Math.round(score * 100)}/100.`;
      return `${business.name}: ${state}`;
    }).join(' ') };
    result.positioningMaps = reportPositioningMaps(result);
  }
  const rows = result.cpmMatrix?.rows || [];
  if (!result.cpmModel) {
  rows.forEach((row) => {
    row.instagram = average(row.instagramBreakdown);
    const business = businesses.find((item) => sameBusiness(row, item));
    if (business && !String(business.website || '').trim()) {
      row.websiteBreakdown = Object.fromEntries(Object.keys(row.websiteBreakdown || {}).map((key) => [key, 0]));
      row.website = 0;
    } else row.website = average(row.websiteBreakdown);
    row.credibility = average(row.credibilityBreakdown);
    row.services = average(row.servicesBreakdown);
    row.total = Number((row.instagram + row.website + row.credibility + row.services).toFixed(2));
  });
  if (result.cpmMatrix) result.cpmMatrix.rows = rows;
  }
  const point = (row, x, y) => ({ name: row.name, x: row[x], y: row[y], isTarget: Boolean(row.isTarget) });
  if (!result.cpmModel) result.positioningMaps = [
    { title: 'Instagram vs Website', xAxis: 'امتیاز اینستاگرام', yAxis: 'امتیاز وب‌سایت', data: rows.map((row) => point(row, 'instagram', 'website')) },
    { title: 'Credibility vs Product', xAxis: 'امتیاز اعتبار', yAxis: 'امتیاز محصول و خدمات', data: rows.map((row) => point(row, 'credibility', 'services')) },
    { title: 'Website vs Credibility', xAxis: 'امتیاز وب‌سایت', yAxis: 'امتیاز اعتبار', data: rows.map((row) => point(row, 'website', 'credibility')) },
    { title: 'Instagram vs Credibility', xAxis: 'امتیاز اینستاگرام', yAxis: 'امتیاز اعتبار', data: rows.map((row) => point(row, 'instagram', 'credibility')) },
  ];
  result._integrity = {
    version: 5,
    businessSources: businesses.map((business) => ({ name: business.name, instagramHandle: business.instagramHandle, website: String(business.website || '').trim(), hasWebsiteEvidence: Boolean(String(business.website || '').trim() && (business.websiteData?.text || business.websiteData?.pagesCrawled > 0 || business.websiteData?.pages?.some((page) => page.text) || result._integrity?.businessSources?.some((source) => sameBusiness(source, business) && source.website === business.website && source.hasWebsiteEvidence))) })),
    checkedAt: new Date().toISOString(),
    instagramMetrics: 'deterministic_from_raw_sample',
    positioningMaps: result.cpmModel ? 'deterministic_from_cpm_factor_scores' : 'legacy_cpm_rows',
  };
  return result;
}
