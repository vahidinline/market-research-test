const KEY = 'market_research_projects';
const local = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (items) => localStorage.setItem(KEY, JSON.stringify(items));
const randomId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

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
  const existingProject = snapshot?._project || {};
  const projectTarget = { ...(existingProject.target || {}), ...(target || {}) };
  const ownerEmail = String(projectTarget.ownerEmail || existingProject.ownerEmail || '').trim().toLowerCase();
  const ownerAccessToken = existingProject.ownerAccessToken || randomId();
  const storedSnapshot = {
    ...snapshot,
    _project: {
      ...existingProject,
      target: projectTarget,
      savedAt: new Date().toISOString(),
      schemaVersion: 4,
      ownerEmail,
      ownerAccessToken,
      accessMode: ownerEmail ? 'owner-panel' : 'admin',
    },
  };
  const item = { id: snapshot.id || randomId(), name: target?.name || 'پروژه بدون نام', industry: target?.industry || '', snapshot: storedSnapshot, updated_at: new Date().toISOString() };
  try {
    const r = await fetch('/api/projects', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(item) });
    if (!r.ok) {
      const error = await r.json().catch(() => ({}));
      throw new Error(error?.error || `خطای ذخیره‌سازی (${r.status})`);
    }
    return { ...item, persistence: 'remote' };
  } catch (error) {
    const items = [item, ...local().filter(x => x.id !== item.id)];
    write(items);
    return { ...item, persistence: 'local', persistenceError: error.message || 'ذخیره‌سازی سمت سرور در دسترس نیست.' };
  }
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

export function createInteroperableReportExport(report, target) {
  return {
    format: 'market-research-interoperable-report',
    version: 1,
    exportedAt: new Date().toISOString(),
    report: {
      target: {
        name: target?.name || '', ownerEmail: target?.ownerEmail || '', industry: target?.industry || '', category: target?.category || '',
        location: target?.location || '', marketScope: target?.marketScope || '', audienceLanguage: target?.audienceLanguage || 'fa',
        website: target?.website || '', instagramHandle: target?.instagramHandle || '',
      },
      market: { overview: report?.industryOverview || '', categories: report?.marketCategories || [] },
      competitors: report?.competitorAnalysis || report?.competitorList || [],
      swot: report?.swot || {},
      competitivePositioning: { cpmModel: report?.cpmModel || null, cpmMatrix: report?.cpmMatrix || null, factorOverviews: report?.factorOverviews || {} },
      recommendations: report?.recommendations || [],
      evergreenTopics: {
        generatedAt: report?.audienceTopicsMeta?.updatedAt || null,
        discoveryMode: report?.audienceTopicsMeta?.searchMode || null,
        searchQueries: report?.audienceTopicsMeta?.searchQueries || [],
        sourceStatus: report?.audienceTopicsMeta?.sourceStatus || {},
        items: report?.audienceTopics || [],
      },
      sources: report?.sources || [],
    },
  };
}

export function downloadInteroperableReport(report, target) {
  const payload = createInteroperableReportExport(report, target);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = String(target?.name || 'report').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60) || 'report';
  link.href = url;
  link.download = `market-research-interoperable-${slug}.json`;
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
export async function loadProjectRecord(id) {
  try {
    const r = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (r.ok) return await r.json();
  } catch {}
  return local().find((x) => x.id === id) || null;
}
export function getOwnerPanelUrl(projectId, token) {
  const url = new URL(window.location.href);
  url.searchParams.set('panel', 'owner');
  url.searchParams.set('project', projectId);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}
export async function deleteProject(id) {
  try { await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch {}
  write(local().filter(x => x.id !== id));
}
