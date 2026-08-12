const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ensureTable = (db) => db.prepare('CREATE TABLE IF NOT EXISTS research_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  await ensureTable(env.DB);
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return json({ error: 'key is required' }, 400);
  const row = await env.DB.prepare("SELECT payload, updated_at FROM research_cache WHERE cache_key=?1 AND datetime(updated_at, '+7 days') > datetime('now')").bind(key).first();
  return row ? json({ payload: JSON.parse(row.payload), updatedAt: row.updated_at }) : json({ payload: null }, 404);
}
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  await ensureTable(env.DB);
  const { key, payload } = await request.json();
  if (!key || !payload) return json({ error: 'key and payload are required' }, 400);
  await env.DB.prepare("INSERT INTO research_cache(cache_key,payload,updated_at) VALUES(?1,?2,datetime('now')) ON CONFLICT(cache_key) DO UPDATE SET payload=?2,updated_at=datetime('now')").bind(key, JSON.stringify(payload)).run();
  return json({ ok: true });
}
