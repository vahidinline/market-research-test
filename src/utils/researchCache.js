const PREFIX = 'mr_raw_cache:';
const INDUSTRY_PREFIX = 'industry_raw_v1:';
const DB_NAME = 'market-research-raw-cache';
const STORE_NAME = 'research';
const MAX_AGE = 7 * 86400000;

const openDb = () => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) return reject(new Error('IndexedDB unavailable'));
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readIndexedDb = async (key) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
};

const writeIndexedDb = async (key, payload) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key, savedAt: Date.now(), payload });
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB write aborted'));
  }).finally(() => db.close());
};

const fresh = (entry) => entry?.payload && Date.now() - Number(entry.savedAt || 0) < MAX_AGE;

export async function loadResearchCache(key) {
  try {
    const saved = await readIndexedDb(key);
    if (fresh(saved)) return saved.payload;
  } catch {}
  try {
    const response = await fetch(`/api/research-cache?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (response.ok) {
      const payload = (await response.json()).payload;
      if (payload) writeIndexedDb(key, payload).catch(() => {});
      return payload;
    }
  } catch {}
  // Migration fallback for smaller caches saved by older releases.
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + key) || 'null');
    if (fresh(saved)) {
      writeIndexedDb(key, saved.payload).catch(() => {});
      return saved.payload;
    }
  } catch {}
  return null;
}

export async function loadResearchCacheFromKeys(keys) {
  for (const key of [...new Set(keys.filter(Boolean))]) {
    const payload = await loadResearchCache(key);
    if (payload?.profiles || payload?.posts) return { payload, matchedKey: key };
  }
  return { payload: null, matchedKey: null };
}

export async function saveResearchCache(key, payload) {
  let browserSaved = false;
  let d1Saved = false;
  try { await writeIndexedDb(key, payload); browserSaved = true; } catch (error) { console.error('IndexedDB cache write failed', error); }
  try {
    const response = await fetch('/api/research-cache', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, payload }),
    });
    d1Saved = response.ok;
    if (!response.ok) console.error('D1 cache write failed', response.status, await response.text());
  } catch (error) { console.error('D1 cache write failed', error); }
  if (!browserSaved && !d1Saved) throw new Error('داده خام Apify نه در مرورگر و نه در D1 ذخیره نشد؛ برای جلوگیری از هزینه مجدد، تحلیل متوقف شد.');
  return { browserSaved, d1Saved };
}

// Industry discovery uses a separate namespace so its resumable raw payloads
// never change the existing Instagram profile/post cache contract.
export async function loadIndustryResearchCache(key) {
  const namespacedKey = INDUSTRY_PREFIX + key;
  const payload = await loadResearchCache(namespacedKey);
  if (payload) return payload;
  // Explicit local-browser fallback for industry discovery. This is separate
  // from the existing Instagram cache and survives AI failures/reloads.
  try {
    const saved = JSON.parse(localStorage.getItem(namespacedKey) || 'null');
    if (fresh(saved)) return saved.payload;
  } catch {}
  return null;
}

export async function saveIndustryResearchCache(key, payload) {
  const namespacedKey = INDUSTRY_PREFIX + key;
  try {
    localStorage.setItem(namespacedKey, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch (error) {
    console.warn('Industry localStorage cache write skipped:', error);
  }
  return saveResearchCache(namespacedKey, payload);
}
