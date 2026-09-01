const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  const { actorId: requestedActorId, mode, input, apiToken, limit = 500 } = await request.json();
  const token = env.APIFY_API_KEY || env.VITE_APIFY_API_KEY || apiToken;
  if (!token) return json({ error: 'Apify API key is not configured in Cloudflare.' }, 503);
  const actorId = mode === 'website' ? env.APIFY_WEBSITE_ACTOR : requestedActorId;
  if (mode === 'website' && !actorId) return json({ error: 'APIFY_WEBSITE_ACTOR is not configured in Cloudflare.' }, 503);
  if (!actorId || !input) return json({ error: 'actorId and input are required.' }, 400);
  try {
    const start = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const startBody = await start.json().catch(() => ({}));
    if (!start.ok) return json({ error: startBody.error?.message || `Apify start failed (${start.status})`, stage: 'start' }, start.status);
    return json({ runId: startBody.data?.id, status: startBody.data?.status, limit }, 202);
  } catch (error) {
    return json({ error: error.message || 'Apify network request failed.', stage: 'network' }, 502);
  }
}

export async function onRequestGet({ request, env }) {
  const token = env.APIFY_API_KEY || env.VITE_APIFY_API_KEY;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (!action) return json({ ok: true, service: 'apify-proxy', configured: Boolean(token) });
  if (!token) return json({ error: 'Apify API key is not configured in Cloudflare.' }, 503);
  const runId = url.searchParams.get('runId');
  if (!runId) return json({ error: 'runId is required.' }, 400);
  try {
    if (action === 'status') {
      const response = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`);
      const body = await response.json().catch(() => ({}));
      return response.ok ? json({ runId, status: body.data?.status }) : json({ error: `Apify status check failed (${response.status})` }, 502);
    }
    if (action === 'results') {
      const limit = url.searchParams.get('limit') || '500';
      const response = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/dataset/items?token=${encodeURIComponent(token)}&limit=${encodeURIComponent(limit)}&clean=true`);
      return response.ok ? json({ runId, items: await response.json() }) : json({ error: `Apify dataset fetch failed (${response.status})` }, 502);
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: error.message || 'Apify network request failed.', stage: action }, 502);
  }
}
