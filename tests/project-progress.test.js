import test from 'node:test';
import assert from 'node:assert/strict';
import { saveProject, loadProject, listProjects } from '../src/utils/projects.js';

function storage(t) {
  const original = globalThis.localStorage;
  const entries = new Map();
  globalThis.localStorage = { getItem: (key) => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
  t.after(() => { if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original; });
  return entries;
}

test('successful analysis is saved before a disconnected server request, and resumes from newest local draft', async (t) => {
  storage(t);
  const draft = { id: 'project', _draft: { chunks: { completion: { 'brand-one': { score: 7 } } } } };
  let localBeforeNetwork = false;
  t.mock.method(globalThis, 'fetch', async () => {
    localBeforeNetwork = JSON.parse(localStorage.getItem('market_research_projects'))[0].snapshot._draft.chunks.completion['brand-one'].score === 7;
    throw new Error('offline');
  });
  const saved = await saveProject(draft, { name: 'Brand' });
  assert.equal(saved.persistence, 'local');
  assert.equal(localBeforeNetwork, true);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'project', snapshot: { id: 'project', _project: { savedAt: '2020-01-01T00:00:00Z' }, _draft: { chunks: {} } } }));
  const resumed = await loadProject('project');
  assert.equal(resumed._draft.chunks.completion['brand-one'].score, 7);
});

test('project archive preserves newer local progress but uses newer completed server reports', async (t) => {
  storage(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'project' }));
  await saveProject({ id: 'project', _draft: { stage: 'scoring' } }, { name: 'Brand' });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ projects: [{ id: 'project', snapshot: { _project: { savedAt: '2020-01-01T00:00:00Z' } } }] }));
  assert.equal((await listProjects())[0].snapshot._draft.stage, 'scoring');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ projects: [{ id: 'project', snapshot: { audienceTopics: ['completed'], _project: { savedAt: '2099-01-01T00:00:00Z' } } }] }));
  assert.equal((await listProjects())[0].snapshot._draft, undefined);
});

test('storage failure is explicit if neither browser nor server can save a checkpoint', async (t) => {
  storage(t);
  t.mock.method(globalThis.localStorage, 'setItem', () => { throw new Error('quota exceeded'); });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  await assert.rejects(saveProject({ id: 'project' }, { name: 'Brand' }), /مرورگر و سرور/);
});

test('a server save that never responds times out and preserves the browser checkpoint', async (t) => {
  storage(t);
  const originalTimer = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback) => originalTimer(callback, 10));
  t.mock.method(globalThis, 'fetch', () => new Promise(() => {}));
  const saved = await saveProject({ id: 'project', _draft: { stage: 'scoring', chunks: { completion: { profile: { score: 7 } } } } }, { name: 'Brand' });
  assert.equal(saved.persistence, 'local');
  assert.match(saved.persistenceError, /مهلت/);
  assert.equal(JSON.parse(localStorage.getItem('market_research_projects'))[0].snapshot._draft.chunks.completion.profile.score, 7);
});
