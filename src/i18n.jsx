import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import fa from './locales/fa.js';
import en from './locales/en.js';
const Context = createContext(null);
const labels = { fa, en };
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('market_research_ui_language') || 'fa');
  useEffect(() => { localStorage.setItem('market_research_ui_language', language); document.documentElement.lang = language; document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr'; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, dir: language === 'fa' ? 'rtl' : 'ltr', t: labels[language] }), [language]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useLanguage = () => useContext(Context);
