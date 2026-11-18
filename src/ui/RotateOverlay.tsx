import React, { useEffect, useState } from 'react';
import { AlertTriangle, Smartphone } from 'lucide-react';
import { t } from '../data/i18n';
import { LanguageCode } from '../types/game';

export const RotateOverlay: React.FC<{ lang: LanguageCode }> = ({ lang }) => {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 760;
      setIsPortraitMobile(portrait);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isPortraitMobile) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#0F172A] px-8 text-center">
      <div className="p-4 rounded-2xl bg-[#FF8A00]/15 border border-[#FF8A00]/40 mb-4">
        <Smartphone className="w-12 h-12 text-[#FF8A00] rotate-90" />
      </div>
      <h2 className="font-display text-2xl font-bold text-[#F8FAFC]">AB Drive City</h2>
      <p className="mt-2 text-sm text-slate-300 max-w-xs">{t(lang, 'rotatePrompt')}</p>
    </div>
  );
};

export const WebGLContextBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[65] flex flex-col items-center justify-center bg-[#0F172A]/95 px-6 text-center">
      <AlertTriangle className="w-12 h-12 text-[#FFC93C] mb-3" />
      <h2 className="font-display text-2xl font-bold text-[#F8FAFC]">Graphics Context Resetting</h2>
      <p className="mt-2 text-sm text-slate-300 max-w-sm">
        Your device paused WebGL graphics memory. Tap Reload below or switch Graphics Quality to Low in Settings.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-5 rounded-xl bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] px-6 py-2.5 text-sm font-bold text-[#0F172A] cursor-pointer"
      >
        Reload Engine
      </button>
    </div>
  );
};
