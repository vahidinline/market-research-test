import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import { useLanguage } from '../i18n.jsx';

const STEPS = [
  {
    id: 'fetch',
    label: 'دریافت داده‌های اینستاگرام از Apify...',
    duration: 3000,
  },
  { id: 'analyze', label: 'تحلیل اطلاعات رقبا...', duration: 2000 },
  { id: 'ai', label: 'در حال تحلیل داده‌ها...', duration: 4000 },
  { id: 'generate', label: 'تولید گزارش نهایی...', duration: 2000 },
];

export default function LoadingScreen({
  currentStep,
  message,
  error,
  onUseMockData, language = 'fa',
}) {
  const { t } = useLanguage();
  const [animatedStep, setAnimatedStep] = useState(0);

  useEffect(() => {
    if (currentStep !== undefined) {
      setAnimatedStep(currentStep);
    }
  }, [currentStep]);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-8"
      dir={language === 'fa' ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full">
        {/* Spinner */}
        {!error && (
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-slate-700" />
              <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2
                  size={28}
                  className="text-blue-400 animate-spin"
                  style={{ animationDuration: '1.5s' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
            <div className="text-red-400 text-5xl mb-4">⚠️</div>
            <h2 className="text-white text-xl font-bold mb-2">{t.loading.error}</h2>
            <p className="text-red-300 text-sm mb-6 leading-relaxed">{error}</p>
            {/* <div className="space-y-3">
              <button
                onClick={onUseMockData}
                className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-medium rounded-xl transition-colors">
                استفاده از داده ساختگی (دمو)
              </button>
            </div> */}
          </div>
        ) : (
          <>
            <h2 className="text-white text-2xl font-bold text-center mb-2">
              {t.loading.title}
            </h2>
            <p className="text-slate-400 text-center text-sm mb-8">
              {message ||
                t.loading.wait}
            </p>

            {/* Steps */}
            <div className="space-y-4">
              {STEPS.map((step, index) => {
                const isDone = index < animatedStep;
                const isActive = index === animatedStep;
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                      isDone
                        ? 'bg-green-500/10 border-green-500/30'
                        : isActive
                          ? 'bg-blue-500/10 border-blue-500/40'
                          : 'bg-slate-800/40 border-slate-700/30'
                    }`}>
                    <div className="shrink-0">
                      {isDone ? (
                        <CheckCircle2 size={22} className="text-green-400" />
                      ) : isActive ? (
                        <Loader2
                          size={22}
                          className="text-blue-400 animate-spin"
                        />
                      ) : (
                        <Circle size={22} className="text-slate-600" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isDone
                          ? 'text-green-300'
                          : isActive
                            ? 'text-blue-200'
                            : 'text-slate-500'
                      }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
