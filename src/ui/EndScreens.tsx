import React from 'react';
import { ArrowRight, Car, Home, Play, RotateCcw, Settings, Star, Trophy } from 'lucide-react';
import { soundEngine } from '../core/audio';
import { ACHIEVEMENTS } from '../data/achievements';
import { t } from '../data/i18n';
import { LanguageCode, RunResult } from '../types/game';

interface PauseModalProps {
  lang: LanguageCode;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onQuit: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  lang,
  onResume,
  onRestart,
  onSettings,
  onQuit,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#0F172A] p-5 text-center space-y-2.5 shadow-2xl">
        <h2 className="font-display text-2xl font-bold text-[#F8FAFC] mb-2">{t(lang, 'pause')}</h2>
        <button
          onClick={() => {
            soundEngine.playUiClick();
            onResume();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] py-2.5 font-display text-base font-bold text-[#0F172A] cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" /> {t(lang, 'resume')}
        </button>
        <button
          onClick={() => {
            soundEngine.playUiClick();
            onRestart();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white hover:bg-slate-700 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> {t(lang, 'restart')}
        </button>
        <button
          onClick={() => {
            soundEngine.playUiClick();
            onSettings();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white hover:bg-slate-700 cursor-pointer"
        >
          <Settings className="w-4 h-4" /> {t(lang, 'settings')}
        </button>
        <button
          onClick={() => {
            soundEngine.playUiClick();
            onQuit();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer"
        >
          <Home className="w-4 h-4" /> {t(lang, 'quit')}
        </button>
      </div>
    </div>
  );
};

interface RunResultModalProps {
  result: RunResult;
  lang: LanguageCode;
  hasNextLevel: boolean;
  onNextLevel: () => void;
  onRetry: () => void;
  onGarage: () => void;
  onMenu: () => void;
}

export const RunResultModal: React.FC<RunResultModalProps> = ({
  result,
  lang,
  hasNextLevel,
  onNextLevel,
  onRetry,
  onGarage,
  onMenu,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0F172A] p-5 shadow-2xl">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-[#14B8A6]">
            {result.mode.replace('_', ' ')} · {result.difficulty.toUpperCase()}
          </div>
          <h2
            className={`mt-1 font-display text-3xl font-bold ${
              result.victory ? 'text-[#FFC93C]' : 'text-[#EF4444]'
            }`}
          >
            {result.victory ? t(lang, 'victory') : t(lang, 'failed')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">{result.reason}</p>

          {result.victory && (
            <div className="flex items-center justify-center gap-2 my-3">
              {[1, 2, 3].map((n) => (
                <Star
                  key={n}
                  className={`w-9 h-9 transition-transform ${
                    n <= result.stars ? 'text-[#FFC93C] fill-[#FFC93C] scale-110' : 'text-slate-700'
                  }`}
                />
              ))}
            </div>
          )}

          {!result.victory && result.tip && (
            <div className="mt-3 rounded-xl bg-slate-900 border border-[#FFC93C]/30 p-3 text-xs text-slate-300">
              <strong className="text-[#FFC93C]">Tip: </strong>
              {result.tip}
            </div>
          )}
        </div>

        {/* Metrics & Rewards Breakdown */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center font-mono-num bg-slate-950/80 rounded-xl p-3 border border-white/10">
          <div>
            <div className="text-[10px] text-slate-400">TIME</div>
            <div className="text-sm font-bold text-white">{result.elapsedTime.toFixed(1)}s</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">SCORE</div>
            <div className="text-sm font-bold text-[#FFC93C]">
              {result.score.toLocaleString()}
              {result.isNewBest ? ' ★' : ''}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">DAMAGE</div>
            <div className="text-sm font-bold text-[#14B8A6]">{result.damageTakenPct}%</div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-around bg-slate-900 rounded-xl py-2.5 px-3 border border-white/10 font-mono-num text-xs font-bold">
          <span className="text-[#FFC93C]">+{result.coinsEarned} Coins</span>
          <span className="text-[#14B8A6]">+{result.gemsEarned} Gems</span>
          <span className="text-sky-400">+{result.xpEarned} XP</span>
        </div>

        {result.newlyUnlockedAchievements.length > 0 && (
          <div className="mt-2.5 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/40 px-3 py-2 text-xs text-[#14B8A6] flex items-center gap-2">
            <Trophy className="w-4 h-4 shrink-0" />
            <span>
              Unlocked:{' '}
              {result.newlyUnlockedAchievements
                .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title || id)
                .join(', ')}
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {result.victory && hasNextLevel && (
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onNextLevel();
              }}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] py-2.5 font-display text-sm font-bold text-[#0F172A] cursor-pointer"
            >
              {t(lang, 'nextLevel')} <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onRetry();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> {t(lang, 'retry')}
          </button>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onGarage();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-xs sm:text-sm font-bold text-[#FF8A00] hover:bg-slate-700 cursor-pointer"
          >
            <Car className="w-4 h-4" /> Garage
          </button>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onMenu();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white cursor-pointer"
          >
            <Home className="w-4 h-4" /> Menu
          </button>
        </div>
      </div>
    </div>
  );
};
