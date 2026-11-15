const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
async function collectionKey(actor, input) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable({ actor, input })));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function writeRawSnapshot(env, key, items) {
  const serialized = JSON.stringify(items);
  if (env.RAW_DATA) {
    const objectKey = `apify/${key}.json`;
    await env.RAW_DATA.put(objectKey, serialized, { httpMetadata: { contentType: 'application/json' } });
    return JSON.stringify({ storage: 'r2', objectKey });
  }
  if (new TextEncoder().encode(serialized).length < 500000) return serialized;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS apify_raw_parts (collection_key TEXT NOT NULL, part INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(collection_key,part))').run();
  let count = 0;
  for (let offset = 0; offset < serialized.length; offset += 100000) {
    await env.DB.prepare('INSERT OR REPLACE INTO apify_raw_parts VALUES(?1,?2,?3)').bind(key, count++, serialized.slice(offset, offset + 100000)).run();
  }
  return JSON.stringify({ storage: 'd1-parts', key, count });
}
async function readRawSnapshot(env, payload) {
  const value = JSON.parse(payload);
  if (Array.isArray(value)) return value;
  if (value.storage === 'r2') {
    if (!env.RAW_DATA) throw new Error('اتصال مخزن داده خام برقرار نیست؛ اجرای جدید انجام نشد.');
    const object = await env.RAW_DATA.get(value.objectKey);
    if (!object) throw new Error('فایل داده خام پیدا نشد؛ نیاز به بررسی ذخیره‌سازی دارد.');
    return object.json();
  }
  if (value.storage !== 'd1-parts') throw new Error('Invalid raw snapshot manifest.');
  let serialized = '';
  for (let part = 0; part < value.count; part++) {
    const row = await env.DB.prepare('SELECT payload FROM apify_raw_parts WHERE collection_key=?1 AND part=?2').bind(value.key, part).first();
    if (!row) throw new Error('بخشی از داده خام در دیتابیس پیدا نشد؛ اجرای پولی جدید انجام نشد.');
    serialized += row.payload;
  }
  return JSON.parse(serialized);
}
async function durableApify(request, env) {
  if (!env.DB) return json({ error: 'برای جلوگیری از هزینه تکراری، اتصال دیتابیس الزامی است.' }, 503);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS apify_collections (collection_key TEXT PRIMARY KEY, actor TEXT NOT NULL, input TEXT NOT NULL, run_id TEXT, state TEXT NOT NULL, payload TEXT, created_at TEXT NOT NULL)').run();
  const url = new URL(request.url);
  const token = env.APIFY_API_KEY || env.VITE_APIFY_API_KEY;
  if (!token) return json({ error: 'Apify server token is required.' }, 503);
  if (request.method === 'POST') {
    const body = await request.json();
    const actor = body.mode === 'website' ? env.APIFY_WEBSITE_ACTOR : body.actorId;
    if (!actor || !body.input) return json({ error: 'Actor and input are required.' }, 400);
    if (actor.replace('~', '/') === 'apify/instagram-profile-scraper' && Array.isArray(body.input.usernames)) body.input.usernames = [...new Set(body.input.usernames.map(value => String(value).trim().replace(/^@/, '').toLowerCase()))].sort();
    const key = await collectionKey(actor.replace('~', '/'), body.input);
    if (Array.isArray(body.legacyItems)) {
      await env.DB.prepare("INSERT OR IGNORE INTO apify_collections (collection_key,actor,input,state,payload,created_at) VALUES(?1,?2,?3,'SUCCEEDED',?4,datetime('now'))").bind(key, actor, JSON.stringify(body.input), await writeRawSnapshot(env, key, body.legacyItems)).run();
      return json({ imported: true });
    }
    const claim = await env.DB.prepare("INSERT OR IGNORE INTO apify_collections VALUES(?1,?2,?3,NULL,'starting',NULL,datetime('now'))").bind(key, actor, JSON.stringify(body.input)).run();
    if (!claim.meta?.changes) {
      const row = await env.DB.prepare('SELECT * FROM apify_collections WHERE collection_key=?1').bind(key).first();
      if (row.payload) return json({ collectionKey: key, status: 'SUCCEEDED', items: await readRawSnapshot(env, row.payload), cached: true });
      if (row.run_id) return json({ collectionKey: key, runId: row.run_id, status: 'RUNNING' });
      return json({ error: 'شروع اجرای قبلی ثبت شده اما شناسه آن هنوز مشخص نیست؛ برای جلوگیری از هزینه مجدد اجرای تازه آغاز نشد.', collectionKey: key }, 409);
    }
    // Never retry an ambiguous start: Apify may have accepted it before a disconnect.
    const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body.input) });
    const result = await response.json();
    if (!response.ok || !result.data?.id) return json({ error: result.error?.message || 'Actor start failed; collection reserved for review.', collectionKey: key }, response.ok ? 502 : response.status);
    await env.DB.prepare('UPDATE apify_collections SET run_id=?1,state=?2 WHERE collection_key=?3').bind(result.data.id, result.data.status, key).run();
    return json({ collectionKey: key, runId: result.data.id, status: result.data.status }, 202);
  }
  const key = url.searchParams.get('collectionKey');
  const row = await env.DB.prepare('SELECT * FROM apify_collections WHERE collection_key=?1').bind(key).first();
  if (!row) return json({ error: 'Collection not found.' }, 404);
  if (row.payload) return json({ status: 'SUCCEEDED', items: await readRawSnapshot(env, row.payload), cached: true });
  if (!row.run_id) return json({ error: 'Collection start requires reconciliation.' }, 409);
  if (!['status', 'results'].includes(url.searchParams.get('action'))) return json({ error: 'Unknown action.' }, 400);
  const base = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(row.run_id)}`;
  if (url.searchParams.get('action') === 'status') {
    const response = await fetch(`${base}?token=${encodeURIComponent(token)}`);
    const result = await response.json();
    return response.ok ? json({ status: result.data?.status }) : json({ error: 'Status unavailable.' }, 502);
  }
  const items = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(`${base}/dataset/items?token=${encodeURIComponent(token)}&clean=true&limit=500&offset=${offset}`);
    if (!response.ok) return json({ error: 'Dataset unavailable; existing run retained.' }, 502);
    const page = await response.json();
    if (!Array.isArray(page)) return json({ error: 'Invalid dataset.' }, 502);
    items.push(...page);
    if (page.length < 500) break;
  }
  await env.DB.prepare("UPDATE apify_collections SET payload=?1,state='SUCCEEDED' WHERE collection_key=?2").bind(await writeRawSnapshot(env, key, items), key).run();
  return json({ items, status: 'SUCCEEDED' });
}

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
const ensureAuth = (db) => db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT,role TEXT NOT NULL DEFAULT \'member\',status TEXT NOT NULL DEFAULT \'active\',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY,email TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,role TEXT NOT NULL DEFAULT \'member\',permissions TEXT NOT NULL DEFAULT \'{}\',expires_at TEXT NOT NULL,accepted_at TEXT,invited_by TEXT NOT NULL,created_at TEXT NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS project_permissions (project_id TEXT NOT NULL,user_id TEXT NOT NULL,access TEXT NOT NULL,PRIMARY KEY(project_id,user_id))'),
]);
const enc = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(value))); }
async function passwordHash(password, salt = hex(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$${salt}$${hex(bits)}`;
}
async function passwordMatches(password, stored) { const [, salt, value] = String(stored || '').split('$'); return Boolean(salt && value && (await passwordHash(password, salt)).endsWith(`$${value}`)); }
const cookie = (token, maxAge = 60 * 60 * 24 * 7) => `mr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
function getCookie(request, name) { return request.headers.get('cookie')?.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${name}=`))?.slice(name.length + 1) || ''; }
async function currentUser(request, env) {
  if (!env.DB) return null; await ensureAuth(env.DB);
  const token = getCookie(request, 'mr_session'); if (!token) return null;
  const row = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>datetime('now') AND u.status='active'").bind(await digest(token)).first(); return row || null;
}
async function auth(request, env, url) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503); await ensureAuth(env.DB);
  const rootEmail = String(env.ROOT_EMAIL || env.VITE_AUTH_EMAIL || '').trim().toLowerCase();
  if (rootEmail && env.ROOT_PASSWORD) { const existing = await env.DB.prepare('SELECT id FROM users WHERE email=?1').bind(rootEmail).first(); if (!existing) await env.DB.prepare("INSERT INTO users VALUES(?1,?2,?3,'root','active',datetime('now'),datetime('now'))").bind(crypto.randomUUID(), rootEmail, await passwordHash(env.ROOT_PASSWORD)).run(); }
  const action = url.pathname.split('/').pop();
  if (action === 'me') return json({ user: await currentUser(request, env) });
  if (action === 'logout') { const token = getCookie(request, 'mr_session'); if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?1').bind(await digest(token)).run(); return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'set-cookie': cookie('', 0) } }); }
  if (action === 'login') {
    const { email, password } = await request.json(); const user = await env.DB.prepare('SELECT * FROM users WHERE email=?1 AND status=\'active\'').bind(String(email || '').trim().toLowerCase()).first();
    if (!user || !(await passwordMatches(password, user.password_hash))) return json({ error: 'ایمیل یا رمز عبور نادرست است.' }, 401);
    const token = hex(crypto.getRandomValues(new Uint8Array(32))); await env.DB.prepare("INSERT INTO sessions VALUES(?1,?2,datetime('now','+7 days'),datetime('now'))").bind(await digest(token), user.id).run();
    return new Response(JSON.stringify({ user: { id: user.id, email: user.email, role: user.role } }), { headers: { 'content-type': 'application/json', 'set-cookie': cookie(token) } });
  }
  if (action === 'accept') {
    const { token, password } = await request.json(); const inv = await env.DB.prepare("SELECT * FROM invitations WHERE token_hash=?1 AND accepted_at IS NULL AND expires_at>datetime('now')").bind(await digest(token || '')).first();
    if (!inv || String(password || '').length < 10) return json({ error: 'دعوت معتبر نیست یا رمز باید حداقل ۱۰ کاراکتر باشد.' }, 400);
    const id = crypto.randomUUID(); await env.DB.prepare("INSERT INTO users VALUES(?1,?2,?3,?4,'active',datetime('now'),datetime('now')) ON CONFLICT(email) DO UPDATE SET password_hash=?3,status='active'").bind(id, inv.email, await passwordHash(password), inv.role).run();
    const user = await env.DB.prepare('SELECT id FROM users WHERE email=?1').bind(inv.email).first();
    const permissions = JSON.parse(inv.permissions || '{}');
    for (const [projectId, access] of Object.entries(permissions)) if (access === 'view' || access === 'edit') await env.DB.prepare('INSERT OR REPLACE INTO project_permissions(project_id,user_id,access) VALUES(?1,?2,?3)').bind(projectId, user.id, access).run();
    await env.DB.prepare("UPDATE invitations SET accepted_at=datetime('now') WHERE id=?1").bind(inv.id).run(); return json({ ok: true });
  }
  if (action === 'invite') {
    const actor = await currentUser(request, env); if (!actor || actor.role !== 'root') return json({ error: 'دسترسی مدیر لازم است.' }, 403);
    const body = await request.json(); const email = String(body.email || '').trim().toLowerCase(); if (!email) return json({ error: 'ایمیل الزامی است.' }, 400);
    const raw = hex(crypto.getRandomValues(new Uint8Array(32))); const permissions = JSON.stringify(body.permissions || {});
    await env.DB.prepare("INSERT INTO invitations VALUES(?1,?2,?3,?4,?5,datetime('now','+48 hours'),NULL,?6,datetime('now'))").bind(crypto.randomUUID(), email, await digest(raw), body.role === 'root' ? 'member' : (body.role || 'member'), permissions, actor.id).run();
    return json({ ok: true, token: raw, expiresInHours: 48 });
  }
  return json({ error: 'Unknown auth action' }, 404);
}

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
  const { actorId: requestedActorId, mode, input, apiToken, limit = 500 } = await request.json();
  const actorId = mode === 'website' ? env.APIFY_WEBSITE_ACTOR : requestedActorId;
  if (mode === 'website' && !actorId)
    return json({ error: 'APIFY_WEBSITE_ACTOR is not configured in Cloudflare.' }, 503);
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
  // Owner links authorize only a single read, independently of admin sessions.
  if (request.method === 'GET' && url.searchParams.has('token')) {
    const id = url.searchParams.get('id');
    const token = url.searchParams.get('token');
    if (!id || !token) return json({ error: 'لینک پنل ناقص است.' }, 400);
    const row = await env.DB.prepare('SELECT * FROM projects WHERE id=?1').bind(id).first();
    const snapshot = row ? JSON.parse(row.snapshot) : null;
    if (!snapshot?._project?.ownerAccessToken || snapshot._project.ownerAccessToken !== token)
      return json({ error: 'دسترسی این پنل معتبر نیست.' }, 403);
    const response = json({ ...row, snapshot });
    response.headers.set('cache-control', 'no-store');
    return response;
  }
  const actor = await currentUser(request, env); if (!actor) return json({ error: 'ورود لازم است.' }, 401);
  const can = async (projectId, needed) => {
    if (actor.role === 'root') return true;
    const row = await env.DB.prepare('SELECT access FROM project_permissions WHERE project_id=?1 AND user_id=?2').bind(projectId, actor.id).first();
    return row && (row.access === 'edit' || (needed === 'view' && row.access === 'view'));
  };
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      const row = await env.DB.prepare('SELECT * FROM projects WHERE id=?1')
        .bind(id)
        .first();
      if (row && !(await can(id, 'view'))) return json({ error: 'دسترسی مشاهده ندارید.' }, 403);
      return row
        ? json({ ...row, snapshot: JSON.parse(row.snapshot) })
        : json({ error: 'not found' }, 404);
    }
    const query = actor.role === 'root' ? env.DB.prepare('SELECT id,name,industry,snapshot,created_at,updated_at FROM projects ORDER BY updated_at DESC') : env.DB.prepare('SELECT p.id,p.name,p.industry,p.snapshot,p.created_at,p.updated_at FROM projects p JOIN project_permissions pp ON pp.project_id=p.id WHERE pp.user_id=?1 ORDER BY p.updated_at DESC').bind(actor.id);
    const { results } = await query.all();
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
    const existing = await env.DB.prepare('SELECT id FROM projects WHERE id=?1').bind(id).first();
    if (existing && !(await can(id, 'edit'))) return json({ error: 'دسترسی ویرایش ندارید.' }, 403);
    await env.DB.prepare(
      "INSERT INTO projects(id,name,industry,snapshot,created_at,updated_at) VALUES(?1,?2,?3,?4,datetime('now'),datetime('now')) ON CONFLICT(id) DO UPDATE SET name=?2,industry=?3,snapshot=?4,updated_at=datetime('now')",
    )
      .bind(id, body.name, body.industry || '', JSON.stringify(body.snapshot))
      .run();
    if (!existing && actor.role !== 'root') await env.DB.prepare("INSERT OR REPLACE INTO project_permissions(project_id,user_id,access) VALUES(?1,?2,'edit')").bind(id, actor.id).run();
    return json({ id });
  }
  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id'); if (!id || !(await can(id, 'edit'))) return json({ error: 'دسترسی حذف ندارید.' }, 403);
    await env.DB.prepare('DELETE FROM projects WHERE id=?1')
      .bind(id)
      .run();
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
}

async function sendInvite(request, env) {
  console.info('[send-invite] request received');
  const actor = await currentUser(request, env);
  if (!actor || actor.role !== 'root') return json({ error: 'دسترسی مدیر لازم است.' }, 403);
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
  // Verify the exact emailed link against durable storage before sending.
  let link;
  try { link = new URL(panelUrl); } catch { return json({ error: 'لینک پنل معتبر نیست.' }, 400); }
  if (!env.DB) return json({ error: 'ذخیره‌سازی سرور در دسترس نیست.' }, 503);
  if (link.origin !== new URL(request.url).origin || link.searchParams.get('panel') !== 'owner'
      || link.searchParams.get('project') !== body.projectId || !link.searchParams.get('token'))
    return json({ error: 'لینک پنل معتبر نیست.' }, 400);
  const stored = await env.DB.prepare('SELECT snapshot FROM projects WHERE id=?1').bind(body.projectId).first();
  const meta = stored ? JSON.parse(stored.snapshot)?._project : null;
  if (!meta?.ownerAccessToken || meta.ownerAccessToken !== link.searchParams.get('token')
      || String(meta.ownerEmail || '').trim().toLowerCase() !== ownerEmail)
    return json({ error: 'دسترسی کارفرما روی سرور ذخیره نشده است؛ پروژه را ذخیره و دوباره دعوت کنید.' }, 409);

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

// Shared across Worker instances: reserve conservative token estimates atomically.
async function reserveAzureQuota(db, scope, tokens, now = Date.now()) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS ai_quota (id TEXT PRIMARY KEY, scope TEXT NOT NULL, at INTEGER NOT NULL, tokens INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS ai_quota_scope_at ON ai_quota(scope,at)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ai_cooldown (scope TEXT PRIMARY KEY, until_ms INTEGER NOT NULL)'),
  ]);
  const results = await db.batch([
    db.prepare('DELETE FROM ai_quota WHERE at <= ?1').bind(now - 60000),
    db.prepare(`INSERT INTO ai_quota(id,scope,at,tokens)
      SELECT ?1,?2,?3,?4 WHERE
      (SELECT COUNT(*) FROM ai_quota WHERE scope=?2) < 424 AND
      (SELECT COALESCE(SUM(tokens),0) FROM ai_quota WHERE scope=?2) + ?4 <= 424800 AND
      (SELECT COALESCE(MAX(at),0) FROM ai_quota WHERE scope=?2) <= ?3-150 AND
      COALESCE((SELECT until_ms FROM ai_cooldown WHERE scope=?2),0) <= ?3`)
      .bind(crypto.randomUUID(), scope, now, tokens),
  ]);
  if (results[1].meta?.changes) return 0;
  const cooldown = await db.prepare('SELECT until_ms FROM ai_cooldown WHERE scope=?1').bind(scope).first();
  const usage = await db.prepare('SELECT COUNT(*) AS requests, COALESCE(SUM(tokens),0) AS tokens FROM ai_quota WHERE scope=?1 AND at>?2').bind(scope, now - 60000).first();
  const budgetWait = usage.requests >= 424 || usage.tokens + tokens > 424800 ? 60 : 1;
  return Math.max(budgetWait, Math.ceil(((cooldown?.until_ms || 0) - now) / 1000));
}

// Responses SSE has a terminal response object; partial deltas are never success.
async function readAzureResponse(response) {
  if (!response.headers.get('content-type')?.includes('text/event-stream'))
    return response.json().catch(() => ({}));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let final;
  const consume = line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    const event = JSON.parse(data);
    if (['response.completed', 'response.failed', 'response.incomplete'].includes(event.type)) final = event.response;
    if (event.type === 'error' || event.error) final = { error: event.error || { message: event.message || 'Azure stream error', code: event.code, status: event.status || event.status_code } };
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      if (pending.length > 2000000) throw new Error('Azure stream frame too large');
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      lines.forEach(consume);
      if (done) { consume(pending); break; }
    }
  } finally { reader.releaseLock(); }
  if (!final) throw new Error('Azure stream ended before the completed response');
  return final;
}

async function azureAi(request, env) {
  const deployment = String(env.AZURE_OPENAI_DEPLOYMENT || '').trim();
  const endpoint = env.AZURE_OPENAI_ENDPOINT;
  const requestId = crypto.randomUUID();
  const reply = (data, status = 200) => new Response(JSON.stringify({ ...data, requestId }), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store',
      ...(data.retryAfterSeconds ? { 'retry-after': String(data.retryAfterSeconds) } : {}) },
  });
  if (!env.AZURE_OPENAI_API_KEY || !deployment || !endpoint)
    return reply({ error: 'Azure endpoint, deployment and API key must be configured on the server.', retryable: false }, 503);
  if (request.method === 'GET') return reply({ ok: true, provider: 'azure', models: [{ id: deployment }] });
  if (request.method !== 'POST') return reply({ error: 'POST required', retryable: false }, 405);
  const { prompt, maxOutputTokens = 7000, inputBudgetBytes = 56000 } = await request.json();
  if (typeof prompt !== 'string' || !prompt.trim()) return reply({ error: 'Prompt is required.', retryable: false }, 400);
  const bytes = new TextEncoder().encode(prompt).length;
  if (bytes > Math.min(56000, Number(inputBudgetBytes) || 56000)) return reply({ error: 'حجم داده تحلیل بیش از حد مجاز است.', stage: 'prompt_budget', retryable: false }, 413);
  if (!env.DB) return reply({ error: 'Shared AI quota storage (DB) is not configured.', retryable: false }, 503);
  const outputLimit = Math.floor(Math.max(1000, Math.min(7000, Number(maxOutputTokens) || 7000)));
  const scope = `${endpoint}|${deployment}`;
  // UTF-8 bytes intentionally overestimate input tokens, including Persian text.
  const wait = await reserveAzureQuota(env.DB, scope, bytes + outputLimit + 512);
  if (wait) return reply({ error: 'سهمیه AI موقتاً پر است؛ درخواست پس از انتظار دوباره ارسال می‌شود.', retryAfterSeconds: wait, stage: 'rate_limit' }, 429);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'api-key': env.AZURE_OPENAI_API_KEY },
      body: JSON.stringify({ model: deployment, input: prompt,
        instructions: 'شما یک تحلیلگر بازار حرفه‌ای هستید که فقط JSON معتبر برمی‌گردانید.',
        max_output_tokens: outputLimit, stream: true, store: false }),
    });
    const body = await readAzureResponse(upstream);
    if (!upstream.ok || body.error) {
      // Azure can signal throttling inside an HTTP 200 SSE stream.
      const errorCode = String(body.error?.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const streamRateLimit = body.error && (Number(body.error.status) === 429 || ['429', 'ratelimitexceeded', 'toomanyrequests'].includes(errorCode)
        || /exceeded (?:token|request) rate limit|rate limit exceeded|too many requests/i.test(body.error.message || ''));
      const status = streamRateLimit ? 429 : upstream.ok ? 502 : upstream.status;
      let retryAfterSeconds;
      if (status === 429) {
        const retry = upstream.headers.get('retry-after');
        const milliseconds = Number(upstream.headers.get('retry-after-ms'));
        retryAfterSeconds = Math.max(60, Math.ceil(milliseconds / 1000) || 0,
          Number(retry) || Math.ceil((Date.parse(retry) - Date.now()) / 1000) || 0);
        await env.DB.prepare('INSERT INTO ai_cooldown(scope,until_ms) VALUES(?1,?2) ON CONFLICT(scope) DO UPDATE SET until_ms=MAX(until_ms,excluded.until_ms)')
          .bind(scope, Date.now() + retryAfterSeconds * 1000).run();
      }
      return reply({ error: body.error?.code === 'DeploymentNotFound'
        ? `Deployment با نام «${deployment}» در Azure پیدا نشد. مقدار AZURE_OPENAI_DEPLOYMENT باید نام Deployment باشد، نه نام Resource.`
        : body.error?.message || `Azure HTTP ${upstream.status}`,
        code: body.error?.code, upstreamStatus: status, retryAfterSeconds,
        retryable: status === 429 || status >= 500, stage: 'azure_responses' }, status);
    }
    if (body.error || body.status === 'failed' || body.status === 'incomplete')
      return reply({ error: body.error?.message || 'Azure پاسخ کامل تولید نکرد؛ سقف خروجی یا تنظیمات مدل را بررسی کنید.', retryable: false, stage: 'azure_responses' }, 502);
    const content = body.output_text || (body.output || []).filter(item => item.type === 'message')
      .flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('');
    if (!content) return reply({ error: 'Azure پاسخ متنی قابل استفاده برنگرداند.', retryable: false }, 502);
    return reply({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: body.usage,
      _routerDiagnostic: { provider: 'azure', selectedModel: deployment, requestId, usage: body.usage, status: upstream.status } });
  } catch (error) {
    return reply({ error: error.name === 'AbortError' ? 'مهلت دریافت پاسخ Azure تمام شد.' : 'ارتباط با Azure برقرار نشد.', retryable: true, stage: 'azure_responses' }, 504);
  } finally { clearTimeout(timer); }
}

async function ai(request, env) {
  if (env.AI_PROVIDER === 'azure' || env.AZURE_OPENAI_API_KEY) return azureAi(request, env);
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
  const upstreamTimeoutMs = 75000;
  let attemptTimeoutMs = upstreamTimeoutMs;
  const fetchWithTimeout = async (input, init = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort('AI upstream timeout'),
      Math.max(1, Math.min(attemptTimeoutMs, upstreamTimeoutMs - (Date.now() - startedAt))),
    );
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      // The deadline must cover body consumption too: headers can arrive early.
      const rawBody = await response.text();
      return new Response(rawBody, { status: response.status, headers: response.headers });
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
        providers: { nineRouter: Boolean(nineRouterKey) },
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
  const { provider = '9router', model, fallbackModels = [], prompt, inputBudgetBytes = 56000, maxOutputTokens = 7000 } = await request.json();
  log('request_start', {
    provider,
    model,
    promptBytes: new TextEncoder().encode(prompt || '').length,
  });
  if (provider !== '9router')
    return json({ error: '9Router is the only configured AI provider.' }, 400);
  if (!prompt || typeof prompt !== 'string')
    return json({ error: 'Prompt is required.' }, 400);
  if (new TextEncoder().encode(prompt).length > Math.min(56000, Number(inputBudgetBytes) || 56000)) return json({ error: 'حجم داده تحلیل بیش از حد مجاز است؛ داده‌ها باید در چند مرحله تحلیل شوند.', requestId, stage: 'prompt_budget' }, 413);
  if (!nineRouterKey)
    return json(
      {
        error: '9Router API key is not configured in Cloudflare Pages.',
        retryable: false,
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
  const candidates = [model, ...(Array.isArray(fallbackModels) ? fallbackModels : [])]
    .map((item) => String(item || '').trim())
    .filter((item, index, list) => item && item !== 'auto' && list.indexOf(item) === index)
    .slice(0, 3);
  const attempts = [];
  const canFailover = (status) => [408, 429, 500, 502, 503, 504, 524].includes(status);
  const hasValidJsonContent = (body) => {
    const raw = body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.text ?? body?.output_text ?? body?.content;
    const text = Array.isArray(raw) ? raw.map((part) => typeof part === 'string' ? part : part?.text || part?.content || '').join('') : String(raw || '');
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const candidate = cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1);
    try { JSON.parse(candidate || cleaned); return true; } catch { return false; }
  };
  for (const [candidateIndex, candidate] of candidates.entries()) {
    attemptTimeoutMs = Math.max(1, Math.floor((upstreamTimeoutMs - (Date.now() - startedAt)) / (candidates.length - candidateIndex)));
    if (Date.now() - startedAt >= upstreamTimeoutMs) break;
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
        model: candidate,
        stream: true,
        messages: [
          {
            role: 'system',
            content:
              'شما یک تحلیلگر بازار حرفه‌ای هستید که فقط JSON معتبر برمی‌گردانید.',
          },
          { role: 'user', content: prompt },
        ],
        // Large non-streaming generations were crossing Cloudflare's origin
        // timeout. Chunk prompts are intentionally compact, so 7000 is enough.
        // Azure/OpenAI models reject the legacy max_tokens parameter.
        max_completion_tokens: Math.max(1000, Math.min(7000, Number(maxOutputTokens) || 7000)),
      }),
      });
    } catch (error) {
      log('upstream_network_error', { provider, model: candidate, message: error.message });
      attempts.push({ model: candidate, status: 504, reason: error.message || 'network_error' });
      continue;
    }
    const rawBody = await response.text();
  log('upstream_response', {
    provider,
    model: candidate,
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
        if (event.error) { body = { error: event.error }; break; }
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
    body = body?.error ? body : content
      ? {
          choices: [{ message: { content }, finish_reason: finishReason }],
          usage,
        }
      : { rawResponseType: response.headers.get('content-type') || 'non-json' };
  }
    if (!response.ok || body.error) {
      const message = body.error?.message || body.message || `9Router upstream failed (${response.status})`;
      const status = response.ok ? 502 : response.status;
      attempts.push({ model: candidate, status, reason: message });
      if (canFailover(status)) continue;
      return json({ error: message, stage: 'chat_completions', requestId, upstreamStatus: response.status, attempts }, response.status);
    }
    if (!hasValidJsonContent(body)) {
      attempts.push({ model: candidate, status: 502, reason: 'invalid_json_response' });
      // Return the original output for local repair instead of replacing its indicators.
      body._invalidModelJson = true;
    }
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
      selectedModel: candidate,
      attempts,
    },
  });
  }
  const last = attempts[attempts.length - 1] || {};
  return json({
    error: last.status === 504 ? 'مهلت دریافت کامل پاسخ 9Router تمام شد. پیش‌نویس را برای ادامه نگه دارید.' : (last.reason || 'هیچ‌یک از مدل‌های انتخاب‌شده پاسخ معتبر ندادند.'),
    stage: 'chat_completions', requestId, upstreamStatus: last.status || 502, attempts,
  }, last.status || 502);
}

function streamAiResponse(request, env, context) {
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event) => { if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      send({ event: 'accepted' });
      heartbeat = setInterval(() => send({ event: 'heartbeat' }), 10000);
      const work = (async () => {
        try {
          const response = await ai(request, env);
          send({ event: 'result', status: response.status, data: await response.json() });
        } catch (error) {
          send({ event: 'result', status: 500, data: { error: error.message || 'AI proxy failed', stage: 'proxy' } });
        } finally {
          clearInterval(heartbeat);
          if (!closed) { closed = true; controller.close(); }
        }
      })();
      context?.waitUntil(work);
    },
    cancel() { closed = true; clearInterval(heartbeat); },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store, no-transform' } });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/apify') return await (request.method === 'POST' || url.searchParams.has('collectionKey') ? durableApify(request, env) : apify(request, env));
      if (url.pathname.startsWith('/api/auth/')) return await auth(request, env, url);
      if (url.pathname === '/api/research-cache')
        return await cache(request, env, url);
      if (url.pathname === '/api/projects')
        return await projects(request, env, url);
      if (url.pathname === '/api/send-invite')
        return await sendInvite(request, env);
      if (url.pathname === '/api/website') return await website(request);
      if (url.pathname === '/api/ai') {
        if (request.method === 'POST' && request.headers.get('accept')?.includes('application/x-ndjson')) return streamAiResponse(request, env, context);
        return await ai(request, env);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error.message || 'Worker request failed' }, 500);
    }
  },
};
