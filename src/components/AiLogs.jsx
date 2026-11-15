import { useEffect, useState } from 'react';
import { clearAiLogs, getAiLogs } from '../utils/aiLogs';

export default function AiLogs() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState(getAiLogs);
  useEffect(() => {
    const refresh = () => setLogs(getAiLogs());
    window.addEventListener('ai-logs-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('ai-logs-updated', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'market-research-ai-logs.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <aside dir="rtl" style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 1000, maxWidth: 'calc(100vw - 32px)', background: '#172033', color: '#fff', border: '1px solid #64748b', borderRadius: 12, padding: 12 }}>
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>لاگ AI ({logs.length}) {open ? '−' : '+'}</button>
    {open && <div style={{ width: 620, maxWidth: 'calc(100vw - 60px)' }}>
      <p>۱۰۰ رویداد آخر در همین مرورگر نگهداری می‌شود.</p>
      <div style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
        <button type="button" onClick={download}>دانلود لاگ</button>
        <button type="button" onClick={clearAiLogs}>پاک‌کردن لاگ‌ها</button>
      </div>
      <pre dir="ltr" style={{ maxHeight: '50vh', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{logs.length ? JSON.stringify(logs.slice().reverse(), null, 2) : 'لاگی ثبت نشده است.'}</pre>
    </div>}
  </aside>;
}
