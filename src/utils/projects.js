const KEY = 'market_research_projects';
const local = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (items) => localStorage.setItem(KEY, JSON.stringify(items));

export async function listProjects() {
  const localProjects = local();
  try {
    const r = await fetch('/api/projects', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error();
    const remoteProjects = (await r.json()).projects || [];
    const merged = new Map();
    [...localProjects, ...remoteProjects].forEach((project) => merged.set(project.id, project));
    return [...merged.values()].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  } catch { return localProjects; }
}
export async function saveProject(snapshot, target) {
  const storedSnapshot = { ...snapshot, _project: { target, savedAt: new Date().toISOString(), schemaVersion: 2 } };
  const item = { id: snapshot.id || crypto.randomUUID(), name: target?.name || 'پروژه بدون نام', industry: target?.industry || '', snapshot: storedSnapshot, updated_at: new Date().toISOString() };
  try { const r = await fetch('/api/projects', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(item) }); if (!r.ok) throw new Error(); return item; } catch { const items = [item, ...local().filter(x => x.id !== item.id)]; write(items); return item; }
}
export async function loadProject(id) {
  try { const r = await fetch(`/api/projects?id=${encodeURIComponent(id)}`); if (r.ok) return (await r.json()).snapshot; } catch {}
  const item = local().find(x => x.id === id); return item?.snapshot || null;
}
export async function deleteProject(id) {
  try { await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch {}
  write(local().filter(x => x.id !== id));
}
