import React, { useEffect, useState } from 'react';
import { t } from '../data/i18n';
import { LanguageCode } from '../types/game';

interface SplashLoadingProps {
  lang: LanguageCode;
  onComplete: () => void;
}

const APP_ICON_PATH = '/assets/app-icon.jpg';

export const SplashLoading: React.FC<SplashLoadingProps> = ({ lang, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex] = useState(() => Math.floor(Math.random() * 4) + 1);

  useEffect(() => {
    const start = performance.now();
    const duration = 1400;
    let raf = 0;

    const step = (now: number) => {
      const p = Math.min(100, ((now - start) / duration) * 100);
      setProgress(Math.round(p));
      if (p < 100) {
        raf = requestAnimationFrame(step);
      } else {
        window.setTimeout(onComplete, 180);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F172A] px-6 safe-pad">
      <div className="flex flex-col items-center max-w-md w-full text-center">
        <div className="relative mb-5 rounded-3xl overflow-hidden border-2 border-[#FF8A00]/70 shadow-2xl w-32 h-32 sm:w-36 sm:h-36">
          <img
            src={APP_ICON_PATH}
            alt="AB Drive City Logo"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wide text-[#F8FAFC]">
          AB DRIVE <span className="text-[#FF8A00]">CITY</span>
        </h1>
        <p className="mt-1 text-xs font-medium tracking-widest text-[#14B8A6]">
          60 LEVELS · 10 MODES · 14 VEHICLES
        </p>

        <div className="mt-6 w-full h-3 rounded-full bg-slate-800 overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between w-full text-xs font-mono-num text-slate-400">
          <span>Loading City Grid & Physics</span>
          <span>{progress}%</span>
        </div>

        <p className="mt-5 text-xs sm:text-sm text-slate-300 bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5">
          <span className="text-[#FFC93C] font-semibold">Tip: </span>
          {t(lang, `loadingTip${tipIndex}`)}
        </p>
      </div>
    </div>
  );
};
