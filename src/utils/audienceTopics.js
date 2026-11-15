import { fingerprint } from './analysisStages.js';
import { compactEvidence } from './aiEvidence.js';

const short = (value, limit = 600) => typeof value === 'string' ? value.slice(0, limit) : '';
const identity = (value) => short(value, 300).trim().toLocaleLowerCase().replace(/\s+/g, ' ');

export function topicContext(target = {}, report = {}) {
  return {
    target: { name: short(target.name), industry: short(target.industry), location: short(target.location), outputLanguage: target.outputLanguage, website: short(target.website, 400) },
    marketOverview: short(report.industryOverview, 2400),
    services: compactEvidence(report.targetAnalysis?.services, 2000),
    swot: compactEvidence(report.swot, 3000),
    instagramEvidence: compactEvidence([report.targetAnalysis, ...(report.competitorAnalysis || []).slice(0, 10)].filter(Boolean).map((item) => ({ name: short(item.name, 160), bestContent: item.instagramAnalytics?.bestContent, contentAnalysis: item.instagramAnalytics?.contentAnalysis })), 3500),
    competitors: (report.competitorAnalysis || report.competitorList || []).slice(0, 15).map((item) => ({ name: short(item.name, 160), services: compactEvidence(item.services, 600) })),
  };
}

const evidenceItem = (item = {}) => ({
  title: short(item.title || item.name, 200),
  text: short(item.text || item.body || item.selftext || item.description || item.caption || item.content, 400),
  url: short(item.url || item.postUrl || item.link || item.webUrl, 500),
  author: short(item.authorName || item.channelName || item.username || item.author, 100),
  likes: numeric(item.likes ?? item.likeCount ?? item.score ?? item.numLikes),
  comments: numeric(item.commentCount ?? item.numComments ?? item.comments),
  views: numeric(item.views ?? item.viewCount),
});
const numeric = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;

// Successful units are persisted before the next request starts. A failed unit
// is split, and resuming never repeats an already completed unit.
export async function discoverAudienceTopics({ target, report, platformData, execute, checkpoint, schema, progress = () => {} }) {
  const context = topicContext(target, report);
  const inputVersion = await fingerprint({ context, platformData, version: 'audience-v3' });
  const root = checkpoint?.chunks || {};
  const chunks = root[`audience-v3:${inputVersion}`] ||= {};
  const save = async (key, value) => {
    chunks[key] = structuredClone(value);
    if (checkpoint) await checkpoint.save();
  };
  const signalGroups = [];
  for (const [platform, payload] of Object.entries(platformData || {})) {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    for (let offset = 0; offset < items.length; offset += 10) {
      const key = `audience:v2:evidence:${platform}:${offset}`;
      let signals = chunks[key];
      if (!signals) {
        const evidence = items.slice(offset, offset + 10).map(evidenceItem);
        const label = `بررسی شواهد ${platform}: ${offset + 1} تا ${Math.min(offset + 10, items.length)}...`;
        const prompt = `Extract at most 5 distinct audience questions or concerns from this evidence. Return JSON only: {"signals":[{"concern":"...","evidence":"...","sourceUrl":"...","platform":"${platform}"}]}. Write in ${target.outputLanguage === 'en' ? 'English' : 'Persian'}. Only cite supplied URLs; do not invent search demand or metrics. Industry: ${short(target.industry)}. Evidence: ${JSON.stringify(evidence)}`;
        const result = await execute(label, prompt);
        if (!Array.isArray(result?.signals)) throw new Error(`${label} پاسخ شواهد معتبر نیست؛ ادامه از همین دسته انجام می‌شود.`);
        const urls = new Set(evidence.map((item) => item.url).filter(Boolean));
        signals = result.signals.slice(0, 5).map((signal) => ({ concern: short(signal.concern, 200), evidence: short(signal.evidence, 300), sourceUrl: urls.has(signal.sourceUrl) ? signal.sourceUrl : null, platform }));
        await save(key, signals);
      } else progress(`بازیابی شواهد ذخیره‌شده ${platform}: ${offset + 1}...`);
      signalGroups.push(signals);
    }
  }
  const allowedUrls = new Set(Object.values(platformData || {}).flatMap(payload => (payload.items || []).map(item => evidenceItem(item).url)).filter(Boolean));
  const topics = [];
  const generate = async (start, end) => {
    const key = `audience:v2:topics:${start}:${end}`;
    if (chunks[key]) { topics.push(...structuredClone(chunks[key])); progress(`ادامه از موضوع ${topics.length + 1}؛ ${topics.length} موضوع ذخیره شده است.`); return; }
    const middle = Math.floor((start + end) / 2);
    const splitKey = `${key}:split`;
    if (start < end && chunks[splitKey]) {
      await generate(start, middle);
      await generate(middle + 1, end);
      return;
    }
    const label = `کشف موضوعات دغدغه‌محور ${start} تا ${end}...`;
    // Rotate across evidence groups; never embed raw report or scraper trees.
    const groups = Array.from({ length: Math.min(4, signalGroups.length) }, (_, index) => signalGroups[((start - 1) + index) % signalGroups.length]);
    const data = { ...context, signals: groups, previousTopics: topics.map((item) => short(item.topic, 200)) };
    const prompt = `Return valid JSON only in ${target.outputLanguage === 'en' ? 'English' : 'Persian'}. Generate exactly ${end - start + 1} distinct evergreen audience concerns, questions or buying decisions for ranks ${start} to ${end}. These must be specific topics, not content formats or entertainment hooks. Do not repeat previousTopics. Each topic needs 3 concrete contentAngles. Use only supplied evidence and URLs; without direct evidence use hypothesis, low confidence and not_observed. Do not invent Google/PAA demand, URLs or metrics. Keep descriptions concise. Data: ${JSON.stringify(data)}. Output: ${schema}`;
    try {
      const result = await execute(label, prompt);
      const generated = Array.isArray(result?.topics) ? result.topics : [];
      const seen = new Set(topics.map((item) => identity(item.topic)));
      if (generated.length !== end - start + 1 || generated.some((item) => { const name = identity(item?.topic); if (!name || seen.has(name)) return true; seen.add(name); return false; })) throw new Error('تعداد یا یکتایی موضوعات معتبر نیست.');
      const batch = generated.map((item, index) => {
        const signals = (item.platformSignals || []).map(signal => allowedUrls.has(signal.sourceUrl) ? signal : { ...signal, sourceUrl: null, evidence: 'not_observed' });
        const observed = signals.some(signal => signal.sourceUrl);
        return { ...item, platformSignals: signals, validationStatus: observed ? 'partially_observed' : 'hypothesis', confidence: observed ? 'medium' : 'low', rank: start + index };
      });
      await save(key, batch);
      topics.push(...batch);
    } catch (error) {
      // Storage failures must not trigger more model calls.
      if (chunks[key] || start === end) throw error;
      progress(`دسته ${start} تا ${end} کامل نشد؛ ادامه با دسته کوچک‌تر...`);
      await save(splitKey, true);
      await generate(start, middle);
      await generate(middle + 1, end);
    }
  };
  for (let start = 1; start <= 50; start += 5) await generate(start, start + 4);
  return topics;
}
