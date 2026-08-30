const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
const ensureCache = (db) =>
  db
    .prepare(
      'CREATE TABLE IF NOT EXISTS research_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)',
    )
    .run();
const ensureProjects = (db) =>
  db
    .prepare(
      'CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, industry TEXT, snapshot TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)',
    )
    .run();

async function apify(request, env) {
  const url = new URL(request.url);
  const token = env.APIFY_API_KEY || env.VITE_APIFY_API_KEY;
  if (request.method === 'GET' && !url.searchParams.get('action'))
    return json({
      ok: true,
      service: 'apify-proxy',
      configured: Boolean(token),
    });
  if (request.method === 'GET') {
    if (!token) return json({ error: 'Apify API key is not configured.' }, 503);
    const action = url.searchParams.get('action');
    const runId = url.searchParams.get('runId');
    if (!runId) return json({ error: 'runId is required' }, 400);
    if (action === 'status') {
      const response = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`,
      );
      const body = await response.json().catch(() => ({}));
      return response.ok
        ? json({ status: body.data?.status, runId })
        : json({ error: `Status failed (${response.status})` }, 502);
    }
    if (action === 'results') {
      const limit = url.searchParams.get('limit') || 500;
      const response = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(token)}&limit=${limit}&clean=true`,
      );
      return response.ok
        ? json({ items: await response.json(), runId })
        : json({ error: `Dataset failed (${response.status})` }, 502);
    }
    return json({ error: 'Unknown action' }, 400);
  }
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const { actorId, input, apiToken, limit = 500 } = await request.json();
  const resolvedToken = token || apiToken;
  if (!resolvedToken)
    return json({ error: 'Apify API key is not configured.' }, 503);
  const start = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(resolvedToken)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  const startBody = await start.json().catch(() => ({}));
  if (!start.ok)
    return json(
      {
        error:
          startBody.error?.message || `Apify start failed (${start.status})`,
        stage: 'start',
      },
      start.status,
    );
  return json(
    { runId: startBody.data?.id, status: startBody.data?.status, limit },
    202,
  );
}

async function cache(request, env, url) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  await ensureCache(env.DB);
  if (request.method === 'GET') {
    const key = url.searchParams.get('key');
    const row = await env.DB.prepare(
      "SELECT payload,updated_at FROM research_cache WHERE cache_key=?1 AND datetime(updated_at,'+7 days')>datetime('now')",
    )
      .bind(key)
      .first();
    return row
      ? json({ payload: JSON.parse(row.payload), updatedAt: row.updated_at })
      : json({ payload: null }, 404);
  }
  if (request.method === 'POST') {
    const { key, payload } = await request.json();
    await env.DB.prepare(
      "INSERT INTO research_cache(cache_key,payload,updated_at) VALUES(?1,?2,datetime('now')) ON CONFLICT(cache_key) DO UPDATE SET payload=?2,updated_at=datetime('now')",
    )
      .bind(key, JSON.stringify(payload))
      .run();
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
}

async function projects(request, env, url) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  await ensureProjects(env.DB);
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      const row = await env.DB.prepare('SELECT * FROM projects WHERE id=?1')
        .bind(id)
        .first();
      return row
        ? json({ ...row, snapshot: JSON.parse(row.snapshot) })
        : json({ error: 'not found' }, 404);
    }
    const { results } = await env.DB.prepare(
      'SELECT id,name,industry,snapshot,created_at,updated_at FROM projects ORDER BY updated_at DESC',
    ).all();
    return json({
      projects: (results || []).map((row) => ({
        ...row,
        snapshot: JSON.parse(row.snapshot || '{}'),
      })),
    });
  }
  if (request.method === 'POST') {
    const body = await request.json();
    const id = body.id || crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO projects(id,name,industry,snapshot,created_at,updated_at) VALUES(?1,?2,?3,?4,datetime('now'),datetime('now')) ON CONFLICT(id) DO UPDATE SET name=?2,industry=?3,snapshot=?4,updated_at=datetime('now')",
    )
      .bind(id, body.name, body.industry || '', JSON.stringify(body.snapshot))
      .run();
    return json({ id });
  }
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM projects WHERE id=?1')
      .bind(url.searchParams.get('id'))
      .run();
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
}

async function sendInvite(request, env) {
  console.info('[send-invite] request received');
  const apiKey = env.SENDPULSE_API_KEY || env.SENDPULSE_TOKEN;
  const fromEmail = env.SENDPULSE_FROM_EMAIL || 'info@roxiapp.online';
  const fromName = env.SENDPULSE_FROM_NAME || 'Roxi App';
  const body = await request.json().catch(() => null);
  const ownerEmail = String(body?.ownerEmail || '')
    .trim()
    .toLowerCase();
  const ownerName = String(body?.ownerName || '').trim();
  const projectName = String(body?.projectName || '').trim();
  const panelUrl = String(body?.panelUrl || '').trim();
  if (!ownerEmail || !panelUrl)
    return json({ error: 'ownerEmail and panelUrl are required.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))
    return json({ error: 'مالک گزارش باید یک ایمیل معتبر داشته باشد.' }, 400);
  const safe = (value = '') =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const greeting = safe(ownerName || 'همراه گرامی');
  const html = `<div dir="rtl" style="direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif;line-height:2;color:#173139;background:#f3f7f6;padding:32px 16px"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #d4e3df;border-radius:16px;overflow:hidden"><div style="background:#123238;color:#d9f2d0;padding:20px 28px;font-size:13px;letter-spacing:.3px">MARKET RESEARCH · گزارش اختصاصی شما</div><div style="padding:30px 28px"><h1 style="margin:0 0 18px;font-size:24px;line-height:1.5;color:#102a30">${greeting} عزیز،</h1><p style="margin:0 0 16px">گزارش تحقیق بازار <strong style="color:#0f766e">${safe(projectName || 'گزارش تحقیق بازار')}</strong> آماده شده است.</p><p style="margin:0 0 24px;color:#456168">از طریق لینک اختصاصی زیر می‌توانید گزارش را در هر زمان مشاهده کنید.</p><p style="margin:0 0 22px"><a href="${safe(panelUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:bold">مشاهده گزارش</a></p><p style="margin:0;color:#6b8083;font-size:12px;line-height:1.8">این لینک فقط برای شما ایجاد شده است. اگر انتظار دریافت این ایمیل را نداشتید، آن را نادیده بگیرید.</p></div></div></div>`;
  const text = `${ownerName || 'همراه گرامی'} عزیز،\n\nگزارش تحقیق بازار «${projectName || 'گزارش تحقیق بازار'}» آماده شده است.\nبرای مشاهده گزارش از لینک اختصاصی زیر استفاده کنید:\n${panelUrl}\n\nاین لینک فقط برای شما ایجاد شده است.`;
  const b64 = (value) => btoa(unescape(encodeURIComponent(value)));
  let accessToken = apiKey;
  if (!accessToken) {
    const clientId = env.SENDPULSE_CLIENT_ID || env.SENDPULSE_API_ID;
    const clientSecret =
      env.SENDPULSE_CLIENT_SECRET || env.SENDPULSE_API_SECRET;
    if (!clientId || !clientSecret)
      return json({ error: 'SendPulse is not configured.' }, 503);
    const tokenResponse = await fetch(
      'https://api.sendpulse.com/oauth/access_token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    );
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token)
      return json(
        {
          error:
            tokenData?.error_description ||
            tokenData?.message ||
            'SendPulse authorization failed.',
        },
        502,
      );
    accessToken = tokenData.access_token;
  }
  const response = await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: {
        subject: `${ownerName ? `${ownerName} عزیز، ` : ''}گزارش تحقیق بازار شما آماده است`,
        html: b64(html),
        text,
        from: { name: fromName, email: fromEmail },
        to: [{ email: ownerEmail, name: ownerName || ownerEmail }],
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[send-invite] SendPulse failed', response.status, data);
    return json(
      {
        error: data?.error || data?.message || 'SendPulse request failed.',
        details: data,
      },
      response.status,
    );
  }
  if (data?.result !== true)
    return json(
      {
        error:
          data?.error || data?.message || 'SendPulse did not accept the email.',
        details: data,
      },
      502,
    );
  console.info('[send-invite] SendPulse accepted email', ownerEmail);
  return json({ ok: true, result: data });
}

const seoAudit = (html, target, response) => {
  const count = (pattern) => (html.match(pattern) || []).length;
  const title =
    html
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<[^>]+>/g, '')
      .trim() || '';
  const description =
    html
      .match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      )?.[1]
      ?.trim() || '';
  const canonical = Boolean(
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i),
  );
  const h1 = count(/<h1\b/gi);
  const images = count(/<img\b/gi);
  const imagesWithAlt = count(/<img\b[^>]*\balt=["'][^"']*["']/gi);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const lang = /<html[^>]+\blang=["'][^"']+["']/i.test(html);
  const schema =
    /application\/ld\+json|itemtype=["']https?:\/\/schema\.org/i.test(html);
  const robots = /robots\.txt/i.test(html);
  const sitemap = /sitemap\.xml/i.test(html);
  const indexable =
    !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const internalLinks = count(/<a\b[^>]+href=["'][^"']+["']/gi);
  const score = (items) =>
    Math.round((items.filter(Boolean).length / items.length) * 100);
  const onPage = score([
    Boolean(title),
    Boolean(description),
    h1 === 1,
    canonical,
    images === 0 || imagesWithAlt / images >= 0.7,
    internalLinks > 2,
    schema,
  ]);
  const technical = score([
    response.ok,
    target.protocol === 'https:',
    viewport,
    lang,
    indexable,
    robots,
    sitemap,
  ]);
  return {
    onPage,
    technical,
    offPage: null,
    overall: Math.round(onPage * 0.55 + technical * 0.45),
    checks: {
      title,
      description,
      h1,
      canonical,
      images,
      imagesWithAlt,
      schema,
      https: target.protocol === 'https:',
      viewport,
      lang,
      indexable,
      robots,
      sitemap,
      status: response.status,
    },
  };
};

async function website(request) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const { url } = await request.json();
  try {
    const target = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
    const response = await fetch(target, {
      headers: { 'user-agent': 'MarketResearchBot/0.0.2' },
    });
    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const seo = seoAudit(html, target, response);
    return json({
      url: target.toString(),
      status: response.status,
      title: seo.checks.title,
      text: text.slice(0, 12000),
      hasBooking: /رزرو|booking|appointment/i.test(html),
      hasContact: /contact|تماس/i.test(html),
      hasBlog: /blog|بلاگ/i.test(html),
      mobileMeta: seo.checks.viewport,
      seo,
    });
  } catch (error) {
    return json({ error: error.message }, 422);
  }
}

async function ai(request, env) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = (event, details = {}) =>
    console.error(
      JSON.stringify({
        service: 'ai-proxy',
        requestId,
        event,
        elapsedMs: Date.now() - startedAt,
        ...details,
      }),
    );
  // Accept both server-secret names and the legacy VITE_* names that were
  // previously documented/configured in this project. Values stay server-side.
  const nineRouterKey = env.NINE_ROUTER_API_KEY || env.VITE_NINE_ROUTER_API_KEY;
  const baseUrl = String(
    env.NINE_ROUTER_BASE_URL ||
      env.VITE_NINE_ROUTER_BASE_URL ||
      'https://router.vahidafshari.com/v1',
  ).replace(/\/$/, '');
  // Cloudflare returns an HTML 524 response when the origin remains silent for
  // roughly 100 seconds. Stop earlier so the UI receives a useful JSON error.
  const upstreamTimeoutMs = 85000;
  const fetchWithTimeout = async (input, init = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort('AI upstream timeout'),
      upstreamTimeoutMs,
    );
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.searchParams.get('action') !== 'models')
      return json({
        ok: true,
        service: 'ai-proxy',
        providers: {
          nineRouter: Boolean(nineRouterKey),
          gemini: Boolean(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        },
        geminiModel:
          env.GEMINI_MODEL || env.VITE_GEMINI_MODEL || 'not-configured',
      });
    if (!nineRouterKey)
      return json(
        {
          error: '9Router API key is not configured in Cloudflare Pages.',
          requestId,
        },
        503,
      );
    log('models_start', { baseUrl });
    let response;
    try {
      response = await fetchWithTimeout(`${baseUrl}/models`, {
        headers: { authorization: `Bearer ${nineRouterKey}` },
      });
    } catch (error) {
      log('models_network_error', { message: error.message });
      return json(
        {
          error: `اتصال Worker به 9Router برقرار نشد: ${error.message}`,
          stage: 'models',
          requestId,
        },
        502,
      );
    }
    const body = await response.json().catch(() => ({}));
    log('models_end', { status: response.status });
    if (!response.ok)
      return json(
        {
          error:
            body.error?.message ||
            body.message ||
            `9Router models failed (${response.status})`,
          stage: 'models',
          requestId,
        },
        response.status,
      );
    return json({ models: Array.isArray(body.data) ? body.data : [] });
  }
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const { provider, model, prompt, apiKey } = await request.json();
  log('request_start', {
    provider,
    model,
    promptBytes: new TextEncoder().encode(prompt || '').length,
  });
  if (!['gemini', '9router'].includes(provider))
    return json({ error: 'Unsupported AI provider' }, 400);
  if (!prompt || typeof prompt !== 'string')
    return json({ error: 'Prompt is required.' }, 400);
  if (provider === 'gemini') {
    const geminiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || apiKey;
    // Production configuration must win over the model baked into an older
    // frontend build. The previous order kept forcing retired Gemini models.
    const geminiModel = env.GEMINI_MODEL || env.VITE_GEMINI_MODEL || model;
    if (!geminiModel)
      return json(
        {
          error:
            'Gemini model is not configured. Set GEMINI_MODEL in Cloudflare Pages.',
          requestId,
        },
        503,
      );
    if (!geminiKey)
      return json(
        {
          error:
            'Gemini API key is not configured. Set GEMINI_API_KEY in .dev.vars or Cloudflare secrets.',
        },
        503,
      );
    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `شما یک تحلیلگر بازار حرفه‌ای هستید که فقط JSON معتبر برمی‌گردانید.\n\n${prompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 16384,
              responseMimeType: 'application/json',
            },
          }),
        },
      );
    } catch (error) {
      return json(
        { error: `Gemini upstream connection failed: ${error.message}` },
        502,
      );
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      return json(
        {
          error:
            body.error?.message ||
            `Gemini upstream failed (${response.status})`,
        },
        response.status >= 400 && response.status < 600 ? response.status : 502,
      );
    return json(body);
  }
  if (!nineRouterKey)
    return json(
      {
        error: '9Router API key is not configured in Cloudflare Pages.',
        requestId,
      },
      503,
    );
  if (!model || model === 'auto')
    return json(
      {
        error: 'یک مدل یا Combo معتبر از فهرست 9Router انتخاب کنید.',
        requestId,
      },
      400,
    );
  let response;
  try {
    response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${nineRouterKey}`,
        'X-9Router-Token-Saver': 'off',
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'شما یک تحلیلگر بازار حرفه‌ای هستید که فقط JSON معتبر برمی‌گردانید.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        // Large non-streaming generations were crossing Cloudflare's origin
        // timeout. Chunk prompts are intentionally compact, so 7000 is enough.
        max_tokens: 7000,
      }),
    });
  } catch (error) {
    log('upstream_network_error', { provider, model, message: error.message });
    const timedOut =
      error?.name === 'AbortError' ||
      /timeout|aborted/i.test(error?.message || '');
    return json(
      {
        error: timedOut
          ? 'مدل انتخاب‌شده در ۸۵ ثانیه پاسخ نداد. یک مدل سریع‌تر انتخاب کنید یا دوباره تلاش کنید.'
          : `اتصال Worker به 9Router قطع شد: ${error.message}`,
        stage: 'chat_completions',
        requestId,
      },
      timedOut ? 504 : 502,
    );
  }
  const rawBody = await response.text();
  log('upstream_response', {
    provider,
    model,
    status: response.status,
    contentType: response.headers.get('content-type'),
    bodyBytes: new TextEncoder().encode(rawBody).length,
  });
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    const chunks = rawBody
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== '[DONE]');
    let content = '';
    let finishReason = null;
    let usage = null;
    for (const chunk of chunks) {
      try {
        const event = JSON.parse(chunk);
        const piece =
          event.choices?.[0]?.delta?.content ??
          event.choices?.[0]?.message?.content ??
          event.choices?.[0]?.text ??
          '';
        content +=
          typeof piece === 'string'
            ? piece
            : Array.isArray(piece)
              ? piece.map((part) => part?.text || '').join('')
              : '';
        finishReason = event.choices?.[0]?.finish_reason || finishReason;
        usage = event.usage || usage;
      } catch {}
    }
    body = content
      ? {
          choices: [{ message: { content }, finish_reason: finishReason }],
          usage,
        }
      : { rawResponseType: response.headers.get('content-type') || 'non-json' };
  }
  if (!response.ok)
    return json(
      {
        error:
          body.error?.message ||
          body.message ||
          `9Router upstream failed (${response.status})`,
        stage: 'chat_completions',
        requestId,
        upstreamStatus: response.status,
      },
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  return json({
    ...body,
    _routerDiagnostic: {
      status: response.status,
      contentType: response.headers.get('content-type'),
      finishReason:
        body.choices?.[0]?.finish_reason || body.finish_reason || null,
      usage: body.usage || null,
      responseKeys: Object.keys(body),
      requestId,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/apify') return await apify(request, env);
      if (url.pathname === '/api/research-cache')
        return await cache(request, env, url);
      if (url.pathname === '/api/projects')
        return await projects(request, env, url);
      if (url.pathname === '/api/send-invite')
        return await sendInvite(request, env);
      if (url.pathname === '/api/website') return await website(request);
      if (url.pathname === '/api/ai') return await ai(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error.message || 'Worker request failed' }, 500);
    }
  },
};
