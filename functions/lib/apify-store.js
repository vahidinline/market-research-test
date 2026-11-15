const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export async function collectionKey(actor, input) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable({ actor, input })));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function writeRawSnapshot(env, key, items) {
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
export async function readRawSnapshot(env, payload) {
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
export async function durableApify(request, env) {
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
