/**
 * Apify API utilities for fetching Instagram profile data
 */

const APIFY_BASE_URL = 'https://api.apify.com/v2';

/**
 * Run an Apify actor and wait for results
 */
export async function runApifyActor(apiToken, actorId, input) {
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
  return datasetRes.json();
}

/**
 * Fetch Instagram profiles for a list of usernames using apify/instagram-profile-scraper
 */
export async function fetchInstagramProfiles(apiToken, usernames) {
  const results = await runApifyActor(
    apiToken,
    'apify~instagram-profile-scraper',
    {
      usernames,
    },
  );
  return results;
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
  if (!profile.followersCount || profile.followersCount === 0) return 0;
  // Industry average: assume ~3% if we have no post-level data
  return 3.0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
