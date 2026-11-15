import { researchScope } from './researchPolicy.js';
import { runApifyActor } from './apify';

const actors = {
  youtube: import.meta.env?.VITE_APIFY_YOUTUBE_ACTOR || '',
  linkedin: import.meta.env?.VITE_APIFY_LINKEDIN_ACTOR || '',
  reddit: import.meta.env?.VITE_APIFY_REDDIT_ACTOR || '',
};

export async function collectPlatformData(apiToken, platform, urls = []) {
  const actorId = actors[platform];
  const validUrls = urls.filter(Boolean);
  if (!actorId || !validUrls.length) return { status: actorId ? 'not_provided' : 'actor_not_configured', items: [] };
  try {
    const adapter = platformAdapter(platform, actorId);
    const items = await runApifyActor(apiToken, actorId, { ...adapter.defaults, [adapter.urlField]: adapter.urlObjects ? validUrls.map(url => ({ url })) : validUrls });
    return { status: 'collected', items };
  } catch (error) {
    return { status: 'error', error: error.message, items: [] };
  }
}

export async function collectAllPlatformData(apiToken, businesses, target = {}) {
  const selected = researchScope(target);
  const result = [];
  for (const business of businesses) {
    const channels = {};
    for (const platform of Object.keys(actors)) {
      if (!selected.includes(platform)) continue;
      const sourceUrl = business[platform];
      channels[platform] = { ...(await collectPlatformData(apiToken, platform, sourceUrl ? [sourceUrl] : [])), sourceUrl: sourceUrl || null, owner: business.name };
    }
    result.push(channels);
  }
  return result;
}

// Topic discovery is market-wide: it searches public conversations and content
// by query, independently of whether the target brand owns a channel profile.
export async function collectTopicDiscoveryData(apiToken, queries = [], target = {}) {
  const searchTerms = [...new Set(queries.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 20);
  if (!searchTerms.length) throw new Error('عبارت جست‌وجوی معتبری برای کشف موضوعات ساخته نشد.');
  const result = {};
  for (const platform of Object.keys(actors)) {
    if (!researchScope(target).includes(platform)) continue;
    const actorId = actors[platform];
    if (!actorId) {
      result[platform] = { status: 'actor_not_configured', items: [], queries: searchTerms };
      continue;
    }
    try {
      const adapter = platformAdapter(platform, actorId);
      if (!adapter.queryField) throw new Error('جست‌وجوی موضوعی برای این Actor تأیید نشده است.');
      const items = await runApifyActor(apiToken, actorId, { ...adapter.defaults, [adapter.queryField]: adapter.queryArray ? searchTerms : searchTerms.join(', ') });
      result[platform] = { status: 'collected', items, queries: searchTerms };
    } catch (error) {
      result[platform] = { status: 'error', error: error.message, items: [], queries: searchTerms };
    }
  }
  return result;
}

function platformAdapter(platform, actorId) {
  let adapters;
  try { adapters = JSON.parse(import.meta.env?.VITE_APIFY_PLATFORM_ADAPTERS || '{}'); } catch { throw new Error('تنظیمات قرارداد Actor معتبر نیست.'); }
  const adapter = adapters[platform];
  if (!adapter || adapter.actorId !== actorId || !adapter.urlField) throw new Error('قرارداد ورودی این Actor هنوز تأیید و تنظیم نشده است؛ اجرای پولی انجام نشد.');
  return adapter;
}
