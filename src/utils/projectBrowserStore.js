import { withDeadline } from './deadline.js';
const KEY = 'market_research_projects';
const savedTime = item => Date.parse(item.snapshot?._project?.savedAt || item.updated_at || '') || 0;
const legacy = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
// One record per project: a growing draft must not rewrite the whole archive.
export async function projectStoreOperation(mode, operation) {
  if (!globalThis.indexedDB) throw new Error('IndexedDB در دسترس نیست.');
  return withDeadline(signal => new Promise((resolve, reject) => {
    const opening = indexedDB.open('market-research-drafts', 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('projects', { keyPath: 'id' });
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error('ذخیره مرورگر توسط تب دیگری مسدود شده است.'));
    opening.onsuccess = () => {
      const db = opening.result;
      if (signal.aborted) { db.close(); return; }
      const tx = db.transaction('projects', mode);
      const abort = () => { try { tx.abort(); } catch {} };
      signal.addEventListener('abort', abort, { once: true });
      const close = () => { signal.removeEventListener('abort', abort); db.close(); };
      let request;
      try { request = operation(tx.objectStore('projects')); }
      catch (error) { close(); reject(error); return; }
      tx.oncomplete = () => { close(); resolve(request?.result); };
      tx.onabort = tx.onerror = () => { close(); reject(tx.error || request?.error || new Error('ذخیره مرورگر ناموفق بود.')); };
    };
  }), 10000, 'مهلت دسترسی به ذخیره مرورگر تمام شد.');
}
export async function listBrowserProjects() {
  const merged = new Map(legacy().map(item => [item.id, item]));
  try {
    for (const item of await projectStoreOperation('readonly', store => store.getAll())) {
      const old = merged.get(item.id);
      if (!old || savedTime(item) >= savedTime(old)) merged.set(item.id, item);
    }
  } catch { /* Legacy drafts remain readable when IndexedDB is unavailable. */ }
  return [...merged.values()];
}
export async function saveBrowserProject(item) {
  try { await projectStoreOperation('readwrite', store => store.put(item)); }
  catch (indexedError) {
    try { localStorage.setItem(KEY, JSON.stringify([item, ...legacy().filter(old => old.id !== item.id)])); }
    catch (error) { throw new Error(`${indexedError.message}؛ ${error.name}: ${error.message}`); }
  }
}
export async function deleteBrowserProject(id) {
  // Clear legacy copies too so a deleted draft cannot reappear on reload.
  if (globalThis.indexedDB) await projectStoreOperation('readwrite', store => store.delete(id));
  localStorage.setItem(KEY, JSON.stringify(legacy().filter(item => item.id !== id)));
}
