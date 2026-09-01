const KEY = 'market_research_ai_settings';

export function loadAiSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      provider: '9router',
      model: String(value.model || '').trim(),
      fallbackModels: Array.isArray(value.fallbackModels)
        ? value.fallbackModels.map((item) => String(item).trim()).filter(Boolean).slice(0, 2)
        : [],
    };
  } catch {
    return { provider: '9router', model: '', fallbackModels: [] };
  }
}

export function saveAiSettings(settings = {}) {
  const next = {
    model: String(settings.model || '').trim(),
    fallbackModels: Array.isArray(settings.fallbackModels)
      ? settings.fallbackModels.map((item) => String(item).trim()).filter(Boolean).slice(0, 2)
      : [],
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return { provider: '9router', ...next };
}
