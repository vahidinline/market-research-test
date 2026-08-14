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
  const storedSnapshot = { ...snapshot, _project: { target, savedAt: new Date().toISOString(), schemaVersion: 3 } };
  const item = { id: snapshot.id || crypto.randomUUID(), name: target?.name || 'پروژه بدون نام', industry: target?.industry || '', snapshot: storedSnapshot, updated_at: new Date().toISOString() };
  try { const r = await fetch('/api/projects', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(item) }); if (!r.ok) throw new Error(); return item; } catch { const items = [item, ...local().filter(x => x.id !== item.id)]; write(items); return item; }
}

export function createProjectTransfer(project) {
  if (!project?.snapshot || !project?.name) throw new Error('این پروژه برای انتقال معتبر نیست.');
  return {
    format: 'market-research-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      industry: project.industry || '',
      snapshot: project.snapshot,
      updated_at: project.updated_at || new Date().toISOString(),
    },
  };
}

export function downloadProjectTransfer(project) {
  const transfer = createProjectTransfer(project);
  const blob = new Blob([JSON.stringify(transfer, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = String(project.name || 'project').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60) || 'project';
  link.href = url;
  link.download = `market-research-${slug}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importProjectTransfer(file) {
  if (!file) throw new Error('فایل انتقال انتخاب نشده است.');
  if (file.size > 12 * 1024 * 1024) throw new Error('حجم فایل انتقال نباید بیشتر از ۱۲ مگابایت باشد.');
  let payload;
  try { payload = JSON.parse(await file.text()); } catch { throw new Error('فایل JSON قابل خواندن نیست.'); }
  const project = payload?.format === 'market-research-project' ? payload.project : null;
  if (!project?.snapshot || typeof project.snapshot !== 'object' || !project.name) {
    throw new Error('این فایل، خروجی معتبر گزارش تحقیق بازار نیست.');
  }
  const imported = {
    id: project.id || crypto.randomUUID(),
    name: String(project.name).slice(0, 240),
    industry: String(project.industry || '').slice(0, 240),
    snapshot: project.snapshot,
    updated_at: new Date().toISOString(),
  };
  try {
    const response = await fetch('/api/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(imported),
    });
    if (!response.ok) throw new Error();
  } catch {
    write([imported, ...local().filter((item) => item.id !== imported.id)]);
  }
  return imported;
}
export async function loadProject(id) {
  try { const r = await fetch(`/api/projects?id=${encodeURIComponent(id)}`); if (r.ok) return (await r.json()).snapshot; } catch {}
  const item = local().find(x => x.id === id); return item?.snapshot || null;
}
export async function deleteProject(id) {
  try { await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch {}
  write(local().filter(x => x.id !== id));
}
