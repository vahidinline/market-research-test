import { useEffect, useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import { useLanguage } from '../i18n.jsx';
export default function AuthGate({ children }) {
  const { language, setLanguage, t } = useLanguage();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  useEffect(() => { fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(x => setAuthenticated(Boolean(x.user))).catch(() => {}).finally(() => setChecking(false)); }, []);
  if (authenticated) return children;
  const english = language === 'en';
  const submit = async (event) => { event.preventDefault(); setError(''); try { const r = await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: {'content-type':'application/json'}, body: JSON.stringify({ email, password }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || t.auth.invalid); setAuthenticated(true); } catch (e) { setError(e.message); } };
  if (checking) return <div className="auth-page"><div className="auth-card">در حال بررسی نشست…</div></div>;
  return <div className="auth-page" dir={english ? 'ltr' : 'rtl'}><div className="language-switcher"><span>{t.language}</span><button type="button" onClick={() => setLanguage('fa')}>{t.persian}</button><button type="button" onClick={() => setLanguage('en')}>{t.english}</button></div><form className="auth-card" onSubmit={submit}><div className="auth-icon"><LockKeyhole size={22}/></div><span className="eyebrow">MARKET RESEARCH · v0.0.2</span><h1>{t.auth.title}</h1><p>{t.auth.description}</p><label>{t.auth.email}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required dir="ltr"/></label><label>{t.auth.password}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required dir="ltr"/></label>{error&&<div className="auth-error">{error}</div>}<button type="submit"><LogIn size={16}/> {t.auth.submit}</button></form></div>;
}
