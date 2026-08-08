import { useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';

const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL || '';
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD || '';

export default function AuthGate({ children }) {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('mr_authenticated') === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  if (authenticated) return children;
  const submit = (event) => {
    event.preventDefault();
    if (email.trim().toLowerCase() === AUTH_EMAIL.toLowerCase() && password === AUTH_PASSWORD) {
      sessionStorage.setItem('mr_authenticated', 'true'); setAuthenticated(true); setError('');
    } else setError('ایمیل یا رمز عبور صحیح نیست.');
  };
  return <div className="auth-page" dir="rtl"><form className="auth-card" onSubmit={submit}><div className="auth-icon"><LockKeyhole size={22}/></div><span className="eyebrow">MARKET RESEARCH · v0.0.2</span><h1>ورود به داشبورد</h1><p>برای دسترسی به گزارش‌های تحقیق بازار وارد شوید.</p><label>ایمیل<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required dir="ltr"/></label><label>رمز عبور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required dir="ltr"/></label>{error&&<div className="auth-error">{error}</div>}<button type="submit"><LogIn size={16}/> ورود</button></form></div>;
}
