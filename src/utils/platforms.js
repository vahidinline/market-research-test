import { runApifyActor } from './apify';

const actors = {
  youtube: import.meta.env.VITE_APIFY_YOUTUBE_ACTOR || '',
  linkedin: import.meta.env.VITE_APIFY_LINKEDIN_ACTOR || '',
  reddit: import.meta.env.VITE_APIFY_REDDIT_ACTOR || '',
};

export async function collectPlatformData(apiToken, platform, urls = []) {
  const actorId = actors[platform];
  const validUrls = urls.filter(Boolean);
  if (!actorId || !validUrls.length) return { status: actorId ? 'not_provided' : 'actor_not_configured', items: [] };
  try {
    const items = await runApifyActor(apiToken, actorId, { startUrls: validUrls.map((url) => ({ url })) });
    return { status: 'collected', items };
  } catch (error) {
    return { status: 'error', error: error.message, items: [] };
  }
}

export async function collectAllPlatformData(apiToken, businesses) {
  const result = {};
  for (const platform of Object.keys(actors)) {
    result[platform] = await collectPlatformData(apiToken, platform, businesses.map((b) => b[platform]).filter(Boolean));
  }
  return result;
}

// Topic discovery is market-wide: it searches public conversations and content
// by query, independently of whether the target brand owns a channel profile.
export async function collectTopicDiscoveryData(apiToken, queries = []) {
  const searchTerms = [...new Set(queries.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 20);
  if (!searchTerms.length) throw new Error('عبارت جست‌وجوی معتبری برای کشف موضوعات ساخته نشد.');
  const inputs = {
    youtube: { searchKeywords: searchTerms, maxResults: 100, maxResultsShorts: 50, maxResultStreams: 0 },
    linkedin: { searchQueries: searchTerms, keywords: searchTerms, maxItems: 150, contentType: 'posts' },
    reddit: { searchTerms, queries: searchTerms, keywords: searchTerms, maxItems: 200, sort: 'top', time: 'year' },
  };
  const result = {};
  for (const platform of Object.keys(actors)) {
    const actorId = actors[platform];
    if (!actorId) {
      result[platform] = { status: 'actor_not_configured', items: [], queries: searchTerms };
      continue;
    }
    try {
      const items = await runApifyActor(apiToken, actorId, inputs[platform]);
      result[platform] = { status: 'collected', items, queries: searchTerms };
    } catch (error) {
      result[platform] = { status: 'error', error: error.message, items: [], queries: searchTerms };
    }
  }
  return result;
}
