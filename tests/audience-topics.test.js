import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverAudienceTopics } from '../src/utils/audienceTopics.js';

const topicsFor = (label) => {
  const [, first, last] = label.match(/(\d+) تا (\d+)/);
  return { topics: Array.from({ length: Number(last) - Number(first) + 1 }, (_, index) => ({ topic: `Question ${Number(first) + index}` })) };
};
const defaults = { target: { industry: 'Education' }, report: {}, platformData: {}, schema: '{"topics":[]}' };

test('huge report and scraper data are processed in bounded requests, with every evidence item visited', async () => {
  const chunks = {};
  let saves = 0;
  let evidenceCalls = 0;
  let topicCalls = 0;
  const result = await discoverAudienceTopics({ ...defaults,
    target: { industry: 'Education', industryIntelligence: 'x'.repeat(500000), rawCache: 'x'.repeat(500000) },
    report: { industryOverview: 'x'.repeat(500000), competitorAnalysis: Array.from({ length: 30 }, () => ({ name: 'Brand', rawData: 'x'.repeat(500000), services: ['Tutoring'] })) },
    platformData: { reddit: { items: Array.from({ length: 25 }, (_, index) => ({ title: `Source ${index}`, text: 'x'.repeat(500000), comments: Array(1000).fill({ body: 'huge' }), url: `https://example.test/${index}` })) } },
    checkpoint: { chunks, save: async () => { saves += 1; } },
    execute: async (label, prompt) => {
      assert.ok(prompt.length < 20000, `Oversized prompt ${prompt.length}`);
      if (label.startsWith('بررسی')) { evidenceCalls += 1; return { signals: [{ concern: 'Price', evidence: 'Question about price', sourceUrl: 'https://invented.test/' }] }; }
      topicCalls += 1;
      return topicsFor(label);
    },
  });
  assert.equal(evidenceCalls, 3);
  assert.equal(topicCalls, 10);
  assert.equal(saves, 13);
  assert.equal(result.length, 50);
  assert.deepEqual(result.map((item) => item.rank), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(Object.values(chunks)[0]['audience:v2:evidence:reddit:0'][0].sourceUrl, null);
});

test('failed batches are split; resume skips completed topics and evidence', async () => {
  const chunks = {};
  const calls = [];
  let offline = true;
  const options = { ...defaults, checkpoint: { chunks, save: async () => {} },
    execute: async (label) => {
      calls.push(label);
      if (offline && label.includes(' 6 تا ')) throw new Error('provider unavailable');
      return topicsFor(label);
    },
  };
  await assert.rejects(discoverAudienceTopics(options), /provider unavailable/);
  assert.equal(Object.values(chunks)[0]['audience:v2:topics:1:5'].length, 5);
  assert.ok(calls.some((label) => label.includes('6 تا 6')));
  offline = false;
  calls.length = 0;
  const result = await discoverAudienceTopics(options);
  assert.equal(result.length, 50);
  assert.ok(!calls.some((label) => label.includes('1 تا 5')));
  assert.ok(!calls.some((label) => label.includes('6 تا 10')));
  assert.equal(new Set(result.map((item) => item.topic)).size, 50);
});

test('incomplete model output is split instead of saving a partial 50-topic result', async () => {
  const result = await discoverAudienceTopics({ ...defaults,
    execute: async (label) => {
      const generated = topicsFor(label);
      if (generated.topics.length > 1) generated.topics.pop();
      return generated;
    },
  });
  assert.equal(result.length, 50);
});
