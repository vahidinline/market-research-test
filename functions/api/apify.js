const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function onRequestPost({ request, env }) {
  const { actorId, input, apiToken, limit = 500 } = await request.json();
  const token = env.APIFY_API_KEY || env.VITE_APIFY_API_KEY || apiToken;
  if (!token) return json({ error: 'Apify API key is not configured in Cloudflare.' }, 503);
  if (!actorId || !input) return json({ error: 'actorId and input are required.' }, 400);
  try {
    const start = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const startBody = await start.json().catch(() => ({}));
    if (!start.ok) return json({ error: startBody.error?.message || `Apify start failed (${start.status})`, stage: 'start' }, start.status);
    const runId = startBody.data?.id;
    let status = startBody.data?.status;
    for (let attempt = 0; ['READY','RUNNING'].includes(status) && attempt < 90; attempt++) {
      await sleep(2000);
      const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
      const pollBody = await poll.json().catch(() => ({}));
      if (!poll.ok) return json({ error: `Apify status check failed (${poll.status})`, stage: 'poll' }, 502);
      status = pollBody.data?.status;
    }
    if (status !== 'SUCCEEDED') return json({ error: `Apify run ended with status ${status || 'UNKNOWN'}`, stage: 'run', runId }, 502);
    const dataset = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(token)}&limit=${limit}&clean=true`);
    if (!dataset.ok) return json({ error: `Apify dataset fetch failed (${dataset.status})`, stage: 'dataset', runId }, 502);
    return json({ items: await dataset.json(), runId, cached: false });
  } catch (error) {
    return json({ error: error.message || 'Apify network request failed.', stage: 'network' }, 502);
  }
}

export async function onRequestGet({ env }) {
  return json({ ok: true, service: 'apify-proxy', configured: Boolean(env.APIFY_API_KEY || env.VITE_APIFY_API_KEY) });
}
