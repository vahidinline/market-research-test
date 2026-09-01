/**
 * Apify API utilities for fetching Instagram profile data
 */

export function normalizeInstagramHandle(value) {
  if (!value) return '';
  let handle = String(value).trim();
  try {
    if (/^https?:\/\//i.test(handle)) handle = new URL(handle).pathname;
  } catch {
    return '';
  }
  return handle
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^www\.instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .trim();
}

/**
 * Run an Apify actor and wait for results
 */
export async function runApifyActor(apiToken, actorId, input) {
  return startAndCollectApifyRun({ apiToken, actorId, input });
}

/** Runs the website crawler configured server-side. The actor ID and Apify token
 * remain in Cloudflare secrets, so neither needs to be shipped in the bundle. */
export async function runWebsiteCrawler(input) {
  return startAndCollectApifyRun({ mode: 'website', input });
}

async function startAndCollectApifyRun(payload) {
  try {
    const proxy = await fetch('/api/apify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, limit: 500 }) });
    const body = await proxy.json().catch(() => ({}));
    if (!proxy.ok) throw new Error(body.error || `Apify proxy failed (${proxy.status})`);
    const runId=body.runId; let status=body.status;
    for(let attempt=0; ['READY','RUNNING'].includes(status) && attempt<120; attempt++){
      await new Promise(resolve=>setTimeout(resolve,2000));
      const response=await fetch(`/api/apify?action=status&runId=${encodeURIComponent(runId)}`); const state=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(state.error||`Apify status failed (${response.status})`); status=state.status;
    }
    if(status!=='SUCCEEDED') throw new Error(`اجرای Apify با وضعیت ${status||'UNKNOWN'} پایان یافت.`);
    const result=await fetch(`/api/apify?action=results&runId=${encodeURIComponent(runId)}&limit=500`); const dataset=await result.json().catch(()=>({}));
    if(!result.ok) throw new Error(dataset.error||`Apify dataset failed (${result.status})`); return dataset.items||[];
  } catch (error) {
    if (error instanceof TypeError) throw new Error('ارتباط با سرویس جمع‌آوری داده برقرار نشد. Cloudflare Pages Function /api/apify در دسترس نیست.');
    throw error;
  }
  /* Direct browser implementation retained below for reference, but intentionally unreachable. */
  /*
  // Start the actor run
  const runRes = await fetch(
    `${APIFY_BASE_URL}/acts/${actorId}/runs?token=${apiToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );

  if (!runRes.ok) {
    const err = await runRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Apify error: ${runRes.status}`);
  }

  const { data: run } = await runRes.json();
  const runId = run.id;

  // Poll until finished
  let status = run.status;
  let attempts = 0;
  while (['READY', 'RUNNING'].includes(status) && attempts < 60) {
    await sleep(3000);
    const pollRes = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${runId}?token=${apiToken}`,
    );
    const { data: pollData } = await pollRes.json();
    status = pollData.status;
    attempts++;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify actor run ${status}. Check your token and inputs.`);
  }

  // Fetch dataset items
  const datasetRes = await fetch(
    `${APIFY_BASE_URL}/actor-runs/${runId}/dataset/items?token=${apiToken}&limit=10`,
  );
  if (!datasetRes.ok) {
    throw new Error(`Failed to fetch dataset: ${datasetRes.status}`);
  }
  return datasetRes.json(); */
}

/**
 * Fetch Instagram profiles for a list of usernames using apify/instagram-profile-scraper
 */
export async function fetchInstagramProfiles(apiToken, usernames) {
  const normalizedUsernames = usernames.map(normalizeInstagramHandle).filter((name) => /^[A-Za-z0-9._-]+$/.test(name));
  if (!normalizedUsernames.length) return [];
  const results = await runApifyActor(
    apiToken,
    'apify~instagram-profile-scraper',
    {
      usernames: normalizedUsernames,
    },
  );
  return results;
}

/** Fetch recent public posts/reels for profile handles. Kept separate from profile
 * collection so callers can skip the more expensive post-level run when needed. */
export async function fetchInstagramPosts(apiToken, usernames, resultsLimit = 30) {
  const normalizedUsernames = usernames.map(normalizeInstagramHandle).filter((name) => /^[A-Za-z0-9._-]+$/.test(name));
  if (!normalizedUsernames.length) return [];
  return runApifyActor(apiToken, 'apify~instagram-scraper', {
    directUrls: normalizedUsernames.map((name) => `https://www.instagram.com/${name}/`),
    resultsLimit,
    resultsType: 'posts',
  });
}

export function summarizeInstagramPosts(posts = [], followers = 0) {
  const timestampOf = (post) => {
    const value = post?.timestamp ?? post?.takenAt ?? post?.taken_at ?? post?.date;
    const time = value == null ? NaN : new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  };
  const rows = posts.filter(Boolean).map((post) => ({ post, time: timestampOf(post) }));
  const datedRows = rows.filter((row) => row.time != null).sort((a, b) => a.time - b.time);
  const rawRows = rows.map((row) => row.post);
  const likes = rawRows.map((p) => Number(p.likesCount ?? p.likes ?? 0));
  const comments = rawRows.map((p) => Number(p.commentsCount ?? p.comments ?? 0));
  const views = rawRows.map((p) => Number(p.videoViewCount ?? p.videoPlayCount ?? p.views ?? 0));
  const avg = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const typeOf = (p) => String(p.type || p.mediaType || '').toLowerCase().includes('carousel') ? 'carousels' : String(p.type || p.mediaType || '').toLowerCase().includes('video') || p.isVideo ? 'videos' : 'photos';
  const counts = rawRows.reduce((acc, p) => { acc[typeOf(p)] += 1; return acc; }, { photos: 0, videos: 0, carousels: 0 });
  const percent = (count) => rawRows.length ? Number(((count / rawRows.length) * 100).toFixed(1)) : 0;
  const distribution = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, percent(value)]));
  const engagementRate = followers && rawRows.length ? ((avg(likes) + avg(comments)) / followers) * 100 : null;
  const scored = [...rawRows].sort((a, b) => {
    const score = (p) => Number(p.likesCount ?? p.likes ?? 0) + (2 * Number(p.commentsCount ?? p.comments ?? 0));
    return score(b) - score(a);
  });
  const oldest = datedRows[0]?.post;
  const newest = datedRows.at(-1)?.post;
  return {
    postsAnalyzed: rawRows.length,
    oldestSampledPost: oldest?.timestamp || oldest?.takenAt || oldest?.taken_at || null,
    latestSampledPost: newest?.timestamp || newest?.takenAt || newest?.taken_at || null,
    firstPost: null,
    firstPostStatus: 'not_collected',
    averageLikes: avg(likes), averageComments: avg(comments), averageViews: avg(views),
    engagementRate: engagementRate == null ? null : Number(engagementRate.toFixed(2)),
    mediaDistribution: distribution,
    mediaCounts: counts,
    bestPost: scored[0] || null,
    source: 'apify_sample',
  };
}

/**
 * Extract normalized profile data from Apify Instagram scraper result
 */
export function normalizeProfile(rawProfile) {
  if (!rawProfile) return null;
  return {
    username: rawProfile.username || rawProfile.handle || '',
    fullName: rawProfile.fullName || rawProfile.name || '',
    biography: rawProfile.biography || rawProfile.bio || '',
    followersCount: rawProfile.followersCount ?? rawProfile.followers ?? 0,
    followingCount: rawProfile.followingCount ?? rawProfile.following ?? 0,
    postsCount: rawProfile.postsCount ?? rawProfile.posts ?? 0,
    isVerified: rawProfile.verified ?? rawProfile.isVerified ?? false,
    profilePicUrl: rawProfile.profilePicUrl || rawProfile.profilePicture || '',
    externalUrl: rawProfile.externalUrl || rawProfile.website || '',
    avgLikes:
      rawProfile.latestIgtvVideos?.[0]?.likesCount ??
      rawProfile.avgLikes ??
      null,
    engagementRate: rawProfile.engagementRate ?? null,
  };
}

/**
 * Estimate engagement rate from profile data (if not provided)
 */
export function estimateEngagementRate(profile) {
  if (profile.engagementRate != null) return profile.engagementRate;
  return null;
}

export function postOwnerHandle(post) {
  const explicit = post?.ownerUsername || post?.username || post?.owner?.username;
  if (explicit) return normalizeInstagramHandle(explicit).toLowerCase();
  const candidate = normalizeInstagramHandle(post?.profileUrl || post?.inputUrl || '').toLowerCase();
  return ['p', 'reel', 'reels', 'tv', 'explore'].includes(candidate) ? '' : candidate;
}
