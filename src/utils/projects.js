import { withDeadline } from './deadline.js';
import { listBrowserProjects, saveBrowserProject, deleteBrowserProject } from './projectBrowserStore.js';
const randomId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const savedTime = (project) => Date.parse(project?.snapshot?._project?.savedAt || project?.updated_at || '') || 0;
const newest = (browser, remote) => browser && (!remote || savedTime(browser) > savedTime(remote)) ? browser : remote;


async function projectRequest(url, init = {}) {
  return withDeadline(async (signal) => {
    const response = await fetch(url, { ...init, signal });
    const data = await response.json().catch((error) => {
      if (error instanceof SyntaxError) return {};
      throw error;
    });
    return { response, data };
  }, init.method === 'POST' ? 60000 : 15000, 'مهلت ارتباط با ذخیره‌سازی سرور تمام شد.');
}

export async function encodeProjectRequest(item) {
  const serialized = JSON.stringify(item);
  const headers = { 'content-type': 'application/json' };
  if (serialized.length > 64000 && globalThis.CompressionStream) {
    const body = await new Response(new Blob([serialized]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    return { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-project-encoding': 'gzip' }, body };
  }
  return { method: 'POST', headers, body: serialized };
}
async function sendProject(item) {
  const init = await encodeProjectRequest(item);
  // Upserts with a stable project id can safely retry a lost acknowledgement.
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await projectRequest('/api/projects', init);
      if (attempt === 0 && [408, 429, 502, 503, 504].includes(result.response.status)) continue;
      return result;
    } catch (error) { if (attempt > 0) throw error; }
  }
}

export async function listProjects() {
  const localProjects = await listBrowserProjects();
  try {
    const { response: r, data } = await projectRequest('/api/projects', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error();
    const remoteProjects = data.projects || [];
    const merged = new Map();
    [...localProjects, ...remoteProjects].forEach((project) => merged.set(project.id, newest(merged.get(project.id), project)));
    return [...merged.values()].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  } catch { return localProjects; }
}
const saveQueues = new Map();
export function saveProject(snapshot, target) {
  // Freeze the checkpoint now; later stages must not mutate an in-flight save.
  const frozen = structuredClone(snapshot);
  frozen.id ||= randomId();
  const frozenTarget = structuredClone(target);
  const previous = saveQueues.get(frozen.id) || Promise.resolve();
  const pending = previous.catch(() => {}).then(() => saveProjectNow(frozen, frozenTarget));
  saveQueues.set(frozen.id, pending);
  const cleanup = () => { if (saveQueues.get(frozen.id) === pending) saveQueues.delete(frozen.id); };
  pending.then(cleanup, cleanup);
  return pending;
}
async function saveProjectNow(snapshot, target) {
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
  // Commit locally before awaiting the network; a tab refresh or disconnect
  // must not replace a successful analysis with an older server draft.
  let browserSaved = false; let browserError;
  try { await saveBrowserProject(item); browserSaved = true; } catch (error) { browserError = error; }
  try {
    const { response: r, data } = await sendProject(item);
    if (!r.ok) {
      const error = data;
      throw new Error(error?.error || `خطای ذخیره‌سازی (${r.status})`);
    }
    if (data.id !== item.id) throw new Error('پاسخ معتبر تأیید ذخیره از سرور دریافت نشد.');
    return { ...item, persistence: 'remote' };
  } catch (error) {
    if (!browserSaved) throw new Error(`ذخیره این بخش در مرورگر و سرور ناموفق بود. مرورگر: ${browserError?.message}؛ سرور: ${error.message}`);
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
    await saveBrowserProject(imported);
  }
  return imported;
}
export async function loadProject(id) {
  return (await loadProjectRecord(id))?.snapshot || null;
}
export async function loadProjectRecord(id) {
  const browser = (await listBrowserProjects()).find((x) => x.id === id);
  try {
    const { response: r, data } = await projectRequest(`/api/projects?id=${encodeURIComponent(id)}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (r.ok) return newest(browser, data);
  } catch {}
  return browser || null;
}
export async function loadOwnerProjectRecord(id, token) {
  const query = new URLSearchParams({ id, token });
  const { response, data } = await projectRequest(`/api/projects?${query}`, {
    headers: { accept: 'application/json' }, cache: 'no-store',
  });
  if (!response.ok) throw new Error(data.error || 'بارگذاری پنل ناموفق بود.');
  return data;
}
export function getOwnerPanelUrl(projectId, token) {
  const url = new URL(window.location.href);
  url.searchParams.set('panel', 'owner');
  url.searchParams.set('project', projectId);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}
export async function deleteProject(id) {
  try { await projectRequest(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch {}
  await deleteBrowserProject(id);
}
