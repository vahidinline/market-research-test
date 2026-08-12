export async function inspectWebsite(url) {
  if (!url) return null;
  try { const r = await fetch('/api/website', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({url}) }); return r.ok ? r.json() : null; } catch { return null; }
}
