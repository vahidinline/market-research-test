import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldResumeDraft, normalizeDraft } from '../src/utils/draftResume.js';

test('older failed collection drafts resume even when their saved stage is form', () => {
  assert.equal(shouldResumeDraft({ stage: 'form', error: 'Failed to fetch' }), true);
  assert.equal(shouldResumeDraft({ stage: 'form', profilesData: { target: {} } }), true);
  assert.equal(shouldResumeDraft({ stage: 'form', chunks: { methodology: { profile: { name: 'Brand' } } } }), true);
});

test('collection and scoring resume, while a saved unstarted form remains editable', () => {
  assert.equal(shouldResumeDraft({ stage: 'collecting' }), true);
  assert.equal(shouldResumeDraft({ stage: 'scoring' }), true);
  assert.equal(shouldResumeDraft({ stage: 'form', chunks: { methodology: {}, completion: {} } }), false);
});

test('migration adds missing checkpoint containers without losing completed analyses', () => {
  const draft = { stage: 'methodology', chunks: { methodology: { firstBrand: { score: 7 } } } };
  const migrated = normalizeDraft(draft);
  assert.equal(migrated.chunks.methodology.firstBrand.score, 7);
  assert.deepEqual(migrated.chunks.completion, {});
  assert.equal(draft.chunks.completion, undefined);
});
