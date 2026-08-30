// Cloudflare Pages Function. Bind a D1 database as DB in wrangler.jsonc.
// The frontend falls back to localStorage when this endpoint is unavailable locally.
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const row = await env.DB.prepare('SELECT * FROM projects WHERE id=?1').bind(id).first();
    return row ? json({ ...row, snapshot: JSON.parse(row.snapshot) }) : json({ error: 'not found' }, 404);
  }
  const { results } = await env.DB.prepare('SELECT id, name, industry, snapshot, created_at, updated_at FROM projects ORDER BY updated_at DESC').all();
  return json({ projects: (results || []).map((row) => ({
    ...row,
    snapshot: JSON.parse(row.snapshot || '{}'),
  })) });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  if (!body?.name || !body?.snapshot) return json({ error: 'name and snapshot are required' }, 400);
  if (!env.DB) return json({ error: 'D1 is not configured' }, 503);
  const id = body.id || crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO projects (id,name,industry,snapshot,created_at,updated_at) VALUES (?1,?2,?3,?4,datetime('now'),datetime('now')) ON CONFLICT(id) DO UPDATE SET name=?2, industry=?3, snapshot=?4, updated_at=datetime('now')`).bind(id, body.name, body.industry || '', JSON.stringify(body.snapshot)).run();
  return json({ id });
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: 'D1 is not configured' }, 503);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id is required' }, 400);
  await env.DB.prepare('DELETE FROM projects WHERE id=?1').bind(id).run();
  return json({ ok: true });
}
