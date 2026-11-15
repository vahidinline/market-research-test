import { recentPosts } from './researchPolicy.js';
const text = (value, size = 1100) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, size);
export function businessEvidence(business = {}) {
  const entries = []; const seen = new Set();
  const add = (channel, url, content, metrics = null) => {
    const excerpt = text(content, channel === 'instagram' ? 600 : 800); if (!excerpt && !metrics) return;
    const fingerprint = `${channel}|${url}|${excerpt}`; if (seen.has(fingerprint)) return; seen.add(fingerprint);
    entries.push({ id: `e${entries.length + 1}`, channel, url: text(url, 600) || null, excerpt, ...(metrics ? { metrics } : {}) });
  };
  const profile = business.instagramData;
  if (profile) add('instagram', `https://www.instagram.com/${business.instagramHandle || profile.username}/`, profile.biography || profile.bio || profile.fullName, { followers: profile.followersCount ?? null, posts: profile.postsCount ?? null });
  for (const post of recentPosts(business.instagramPosts)) add('instagram', post.url, post.caption, { likes: post.likesCount ?? null, comments: post.commentsCount ?? null, views: post.videoViewCount ?? null, timestamp: post.timestamp ?? null });
  const pages = business.websiteData?.pages || [];
  for (const page of pages.slice(0, 6)) add('website', page.url || business.website, `${page.title || ''} ${page.text || ''}`);
  if (!pages.length && business.websiteData?.text) add('website', business.website, business.websiteData.text);
  for (const [channel, payload] of Object.entries(business.platformData || {})) for (const item of (payload.items || []).slice(0, 5)) add(channel, item.url || item.postUrl || payload.sourceUrl, item.text || item.description || item.title);
  return entries;
}
export function validateEvidenceIds(ids, evidence) {
  const allowed = new Set(evidence.map(item => item.id));
  if (!Array.isArray(ids) || !ids.length || ids.some(id => !allowed.has(id))) throw new Error('ارجاع شاهد ناقص یا خارج از داده‌های ارسالی است.');
  return ids;
}
export function validateIndicatorEvidence(model, evidence) {
  for (const factor of model.factors || []) for (const dependent of factor.dependentVariables || []) for (const criterion of dependent.independentVariables || []) {
    try { validateEvidenceIds(criterion.evidenceIds, evidence); }
    catch {
      const sourceHint = factor.id === 'social' && !evidence.some(item => item.channel === 'instagram')
        ? ' هیچ شاهد Instagram در داده‌های جمع‌آوری‌شده وجود ندارد؛ پروفایل معتبر اضافه کنید یا دامنه مدل را بازبینی کنید.' : '';
      throw new Error(`ارجاع شاهد شاخص «${criterion.label || criterion.id}» (${criterion.id}) ناقص یا خارج از داده‌های ارسالی است.${sourceHint}`);
    }
    if (!String(criterion.definition || '').trim() || !String(criterion.reason || '').trim()) throw new Error(`تعریف و دلیل شاخص ${criterion.id} ناقص است.`);
    if (/visual|storytelling|layout|بصری|چیدمان|داستان.?گویی/i.test(`${criterion.id} ${criterion.label}`)) throw new Error('معیار تصویری یا ویدئویی با داده متنی قابل تأیید نیست.');
    const levels = criterion.scoring?.rubricLevels;
    const min = criterion.scoring?.min ?? 0; const max = criterion.scoring?.max;
    if (!Array.isArray(levels) || levels.length < 2 || new Set(levels.map(level => level.score)).size !== levels.length || levels.some(level => typeof level.score !== 'number' || level.score < min || level.score > max || !String(level.description || '').trim())) throw new Error(`سطوح امتیاز شاخص ${criterion.id} باید تعریف شوند.`);
  }
  return model;
}
export function sanitizeProfileAnalysis(generated, business) {
  const result = structuredClone(generated);
  const unavailable = 'ارزیابی نشده؛ شواهد تصویری یا ویدئویی دریافت نشده است.';
  result.overallScore = null;
  result.instagramAnalytics = { ...(result.instagramAnalytics || {}), ...business.instagramSummary, followers: business.instagramData?.followersCount ?? null, totalPosts: business.instagramData?.postsCount ?? null };
  result.instagramAnalytics.contentAnalysis = { ...(result.instagramAnalytics.contentAnalysis || {}), visualQuality: unavailable, creativity: unavailable, storytelling: unavailable, highlights: unavailable, layout: unavailable };
  result.websiteAnalytics = { ...(result.websiteAnalytics || {}), uxScore: null, mobileFriendly: null, viewportPresent: business.websiteData?.mobileMeta ?? null };
  return result;
}

export function preserveIndicatorIds(previous, repaired) {
  const ids = model => (model?.factors || []).flatMap(factor => (factor.dependentVariables || []).flatMap(dependent => (dependent.independentVariables || []).map(criterion => criterion.id))).filter(Boolean);
  const retained = new Set(ids(repaired));
  if (ids(previous).some(id => !retained.has(id))) throw new Error('اصلاح ساختار نباید شاخص‌های ذخیره‌شده را حذف یا جایگزین کند.');
  return repaired;
}
