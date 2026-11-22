import { RESEARCH_VERSION, RESEARCH_RULES } from './researchPolicy.js';
import { EDITORIAL_RULES } from './plainLanguage.js';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export async function fingerprint(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
// Conservative upper bound, not an exact tokenizer; UTF-8 bytes upper-bound
// byte-level tokenization. A configured model limit may tighten this budget.
export function promptBudget(prompt, config = {}) {
  const bytes = new TextEncoder().encode(prompt).length;
  const limit = Math.min(56000, Number(config.maxInputBytes) || 56000, Math.max(2000, (Number(config.contextWindow) || 64000) - (Number(config.maxOutputTokens) || 7000) - 1000));
  if (bytes > limit) throw Object.assign(new Error(`حجم مرحله ${bytes} بایت است؛ سقف ${limit}. مرحله باید تقسیم شود.`), { code: 'PROMPT_BUDGET', retryable: false });
  return { promptBytes: bytes, conservativeInputTokens: bytes, exactTokenCount: false, maxInputBytes: limit };
}
const persistedChunks = new WeakMap();
export function createStageRunner({ execute, checkpoint, config = {}, model = '', log = () => {} }) {
  return async (id, prompt, validate = value => value) => {
    const key = `${RESEARCH_VERSION}:${id}:${await fingerprint({ prompt, model })}`;
    const chunks = checkpoint?.chunks || {};
    const cached = chunks[key];
    const save = async () => {
      // Mark only the outputs present when the save began as durable.
      const keys = Object.keys(chunks);
      const saved = await checkpoint.save();
      if (saved?.persistence && saved.persistence !== 'remote') throw Object.assign(new Error('داده مرحله در مرورگر حفظ شد؛ ادامه نیازمند ذخیره در دیتابیس است.'), { code: 'STORAGE_FAILED' });
      persistedChunks.set(chunks, new Set(keys));
    };
    if (cached) {
      const valid = validate(structuredClone(cached));
      if (!persistedChunks.get(chunks)?.has(key)) await save();
      return valid;
    }
    const startedAt = Date.now();
    let result; let parseError;
    try { result = await execute(id, prompt); }
    catch (error) { if (error.rawContent === undefined) throw error; result = error.rawContent; parseError = error; }
    try { if (parseError) throw parseError; result = validate(result); }
    catch (error) {
      let repair = `${id.startsWith('editorial:') ? EDITORIAL_RULES : RESEARCH_RULES}\nRepair only invalid or missing fields. Preserve all valid identifiers, indicators and evidence. Return JSON only. Validation error: ${error.message}\nOriginal contract and evidence:\n${prompt}\nPrevious output:\n${JSON.stringify(result)}`;
      // A repair must not concatenate two large documents beyond the input budget.
      try { promptBudget(repair, config); }
      catch (budgetError) {
        if (budgetError.code !== 'PROMPT_BUDGET') throw budgetError;
        repair = `${prompt}\nValidation failed: ${String(error.message).slice(0, 500)}\nRegenerate a complete valid response using the original identifiers and evidence. Return JSON only.`;
        try { promptBudget(repair, config); } catch { repair = prompt; }
      }
      log('stage_repair', { id, reason: error.message });
      result = validate(await execute(`${id}:repair`, repair));
    }
    if (checkpoint) {
      chunks[key] = structuredClone(result);
      chunks['analysis-metrics-v1'] = [...(chunks['analysis-metrics-v1'] || []), { id, key, elapsedMs: Date.now() - startedAt, promptBytes: new TextEncoder().encode(prompt).length, usage: result?._analysisMeta?.usage || null, selectedModel: result?._analysisMeta?.selectedModel || model }].slice(-500);
      try { await save(); } catch (error) { error.code = 'STORAGE_FAILED'; throw error; }
    }
    return result;
  };
}
export function boundedBatches(items, maxItems = 8, maxBytes = 18000) {
  const batches = []; let current = []; let size = 2;
  for (const item of items) {
    const bytes = new TextEncoder().encode(JSON.stringify(item)).length;
    if (bytes + 2 > maxBytes) throw new Error('یک رکورد شواهد از بودجه دسته بزرگ‌تر است.');
    if (current.length && (current.length >= maxItems || size + bytes + (current.length ? 1 : 0) > maxBytes)) { batches.push(current); current = []; size = 2; }
    size += bytes + (current.length ? 1 : 0); current.push(item);
  }
  if (current.length) batches.push(current);
  return batches;
}
