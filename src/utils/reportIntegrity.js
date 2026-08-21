import { normalizeInstagramHandle } from './apify.js';
import { buildCpmPositioningMaps, calculateCpmMatrix } from './cpm.js';

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
    const business = businesses.find((item) => sameBusiness(competitor, item));
    if (!business) return competitor;
    const profile = business.instagramData;
    const summary = business.instagramSummary;
    const existing = competitor.instagramAnalytics || {};
    const bestPost = summary?.bestPost;
    const website = business.websiteData;
    const seo = website?.seo || null;
    return {
      ...competitor,
      instagramHandle: business.instagramHandle || competitor.instagramHandle,
      website: business.website || competitor.website,
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
        ...(competitor.websiteAnalytics || {}),
        mobileFriendly: website ? Boolean(website.mobileMeta) : null,
        onlineBooking: website ? Boolean(website.hasBooking) : null,
        liveSupport: null,
        seoScore: seo?.overall ?? null,
        seo: seo || { onPage: null, technical: null, offPage: null, overall: null, status: 'not_audited' },
        seoStatus: seo ? `${seo.overall}/100` : 'ممیزی نشده',
        evidence: {
          mobileFriendly: website ? 'website_html' : 'unavailable',
          onlineBooking: website ? 'website_html_keyword_check' : 'unavailable',
          uxScore: 'AI inference',
          seoStatus: seo ? 'deterministic_html_audit' : 'unavailable',
          liveSupport: 'unavailable',
        },
      },
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
    const identities = businesses.map((business, index) => ({ name: business.name, isTarget: index === 0 }));
    const calculated = calculateCpmMatrix(result.cpmModel, result.cpmEvaluations, identities);
    result.cpmModel = calculated.model;
    result.cpmMatrix = calculated.matrix;
    result.positioningMaps = buildCpmPositioningMaps(result.cpmModel, result.cpmMatrix);
  }
  const rows = result.cpmMatrix?.rows || [];
  if (!result.cpmModel) {
  rows.forEach((row) => {
    row.instagram = average(row.instagramBreakdown);
    row.website = average(row.websiteBreakdown);
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
    version: 4,
    checkedAt: new Date().toISOString(),
    instagramMetrics: 'deterministic_from_raw_sample',
    positioningMaps: result.cpmModel ? 'deterministic_from_cpm_factor_scores' : 'legacy_cpm_rows',
  };
  return result;
}
