import { runApifyActor } from './apify';

const actors = {
  tiktok: import.meta.env.VITE_APIFY_TIKTOK_ACTOR || '',
  youtube: import.meta.env.VITE_APIFY_YOUTUBE_ACTOR || '',
  linkedin: import.meta.env.VITE_APIFY_LINKEDIN_ACTOR || '',
  pinterest: import.meta.env.VITE_APIFY_PINTEREST_ACTOR || '',
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
