import { useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import { useLanguage } from '../i18n.jsx';
const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL || '';
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD || '';
export default function AuthGate({ children }) {
  const { language, setLanguage, t } = useLanguage();
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('mr_authenticated') === 'true');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  if (authenticated) return children;
  const english = language === 'en';
  const submit = (event) => { event.preventDefault(); if (email.trim().toLowerCase() === AUTH_EMAIL.toLowerCase() && password === AUTH_PASSWORD) { sessionStorage.setItem('mr_authenticated', 'true'); setAuthenticated(true); setError(''); } else setError(t.auth.invalid); };
  return <div className="auth-page" dir={english ? 'ltr' : 'rtl'}><div className="language-switcher"><span>{t.language}</span><button type="button" onClick={() => setLanguage('fa')}>{t.persian}</button><button type="button" onClick={() => setLanguage('en')}>{t.english}</button></div><form className="auth-card" onSubmit={submit}><div className="auth-icon"><LockKeyhole size={22}/></div><span className="eyebrow">MARKET RESEARCH · v0.0.2</span><h1>{t.auth.title}</h1><p>{t.auth.description}</p><label>{t.auth.email}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required dir="ltr"/></label><label>{t.auth.password}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required dir="ltr"/></label>{error&&<div className="auth-error">{error}</div>}<button type="submit"><LogIn size={16}/> {t.auth.submit}</button></form></div>;
}
