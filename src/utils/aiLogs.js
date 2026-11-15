const KEY = 'market_research_ai_logs';
let memory = [];
let storageFailed = false;
export function getAiLogs() {
  if (storageFailed) return memory;
  try {
    const stored = localStorage.getItem(KEY);
    const entries = stored ? JSON.parse(stored) : memory;
    return Array.isArray(entries) ? entries.slice(-100) : memory;
  } catch { return memory; }
}
function write(entries) {
  memory = entries;
  try { localStorage.setItem(KEY, JSON.stringify(entries)); storageFailed = false; } catch { storageFailed = true; }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ai-logs-updated'));
}
export function clearAiLogs() { write([]); }
export function logAi(event, details = {}) {
  const entry = { time: new Date().toISOString(), event, ...details };
  console.info('[Market Research AI]', entry);
  write([...getAiLogs(), entry].slice(-100));
}
