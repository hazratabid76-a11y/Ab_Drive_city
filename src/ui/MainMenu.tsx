import React from 'react';
import {
  Award,
  Calendar,
  Car,
  Flame,
  Gamepad2,
  Play,
  Settings,
  ShoppingBag,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { soundEngine } from '../core/audio';
import { getCarById } from '../data/cars';
import { getDailyChallengeSpec, getTodayDateString, getWeeklyEventSpec, getXpForLevel } from '../data/economy';
import { t } from '../data/i18n';
import { SaveData } from '../types/game';

interface MainMenuProps {
  save: SaveData;
  onOpenCareer: () => void;
  onOpenModes: () => void;
  onOpenGarage: () => void;
  onOpenShop: () => void;
  onOpenDaily: () => void;
  onOpenAchievements: () => void;
  onOpenSettings: () => void;
  onQuickDaily: () => void;
  onQuickWeekly: () => void;
}

const APP_ICON_PATH = '/assets/app-icon.jpg';

export const MainMenu: React.FC<MainMenuProps> = ({
  save,
  onOpenCareer,
  onOpenModes,
  onOpenGarage,
  onOpenShop,
  onOpenDaily,
  onOpenAchievements,
  onOpenSettings,
  onQuickDaily,
  onQuickWeekly,
}) => {
  const lang = save.settings.language;
  const car = getCarById(save.selectedCarId);
  const xpReq = getXpForLevel(save.level);
  const xpPct = Math.min(100, Math.round((save.xp / xpReq) * 100));
  const today = getTodayDateString();
  const dailyDone = save.dailyChallengeCompletedDate === today;
  const dailySpec = getDailyChallengeSpec(today);
  const weeklySpec = getWeeklyEventSpec();
  const weeklyDone = save.weeklyEventCompletedWeek === weeklySpec.weekStr;

  const click = (fn: () => void) => {
    soundEngine.playUiClick();
    fn();
  };

  return (
    <div
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5 safe-pad"
    >
      {/* Top Bar */}
      <header className="pointer-events-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 bg-[#0F172A]/85 border border-white/10 rounded-2xl px-3 py-2">
          <img
            src={APP_ICON_PATH}
            alt="AB Drive City"
            className="w-11 h-11 rounded-xl object-cover border border-[#FF8A00]/60 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <div className="font-display text-lg sm:text-xl font-bold leading-none tracking-wide text-[#F8FAFC] whitespace-nowrap">
              AB DRIVE <span className="text-[#FF8A00]">CITY</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
              <span className="font-mono-num font-bold text-[#FFC93C]">
                {t(lang, 'level')} {save.level}
              </span>
              <div className="w-20 sm:w-28 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-[#14B8A6]" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="font-mono-num text-[11px] text-slate-400 hidden sm:inline">
                {save.xp}/{xpReq} XP
              </span>
            </div>
          </div>
        </div>

        {/* Currencies & Install */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-3 bg-[#0F172A]/85 border border-white/10 rounded-2xl px-3.5 py-2 font-mono-num text-xs sm:text-sm font-bold">
            <span className="text-[#FFC93C] whitespace-nowrap">
              {save.coins.toLocaleString()} <span className="text-[11px] font-normal text-slate-300">{t(lang, 'coins')}</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-[#14B8A6] whitespace-nowrap">
              {save.gems.toLocaleString()} <span className="text-[11px] font-normal text-slate-300">{t(lang, 'gems')}</span>
            </span>
          </div>
          <button
            onClick={() => click(onOpenSettings)}
            aria-label="Settings"
            className="p-2.5 rounded-2xl bg-[#0F172A]/85 border border-white/10 text-slate-200 hover:text-[#FFC93C] hover:border-[#FF8A00]/50 transition active:scale-95 cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Middle-Right Quick Events & Active Car */}
      <div className="flex items-end justify-between gap-4 my-auto">
        {/* Left Navigation Column */}
        <nav className="pointer-events-auto flex flex-col gap-2 w-52 sm:w-60">
          <button
            onClick={() => click(onOpenCareer)}
            className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] px-4 py-3 text-[#0F172A] font-display text-lg font-bold tracking-wide shadow-lg hover:brightness-105 active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <span className="flex items-center gap-2">
              <Play className="w-5 h-5 fill-current" />
              {t(lang, 'play')}
            </span>
            <span className="font-mono-num text-xs bg-[#0F172A]/15 px-2 py-0.5 rounded-lg">
              {save.stats.totalStarsEarned}/180 ★
            </span>
          </button>

          <button
            onClick={() => click(onOpenModes)}
            className="flex items-center justify-between rounded-2xl bg-[#0F172A]/88 border border-white/15 px-4 py-2.5 text-[#F8FAFC] font-display text-base font-bold hover:border-[#14B8A6] active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <span className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-[#14B8A6]" />
              {t(lang, 'modes')}
            </span>
            <span className="text-xs text-slate-400 font-sans">10 Modes</span>
          </button>

          <button
            onClick={() => click(onOpenGarage)}
            className="flex items-center justify-between rounded-2xl bg-[#0F172A]/88 border border-white/15 px-4 py-2.5 text-[#F8FAFC] font-display text-base font-bold hover:border-[#FF8A00] active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <span className="flex items-center gap-2">
              <Car className="w-4 h-4 text-[#FF8A00]" />
              {t(lang, 'garage')}
            </span>
            <span className="text-xs text-slate-400 font-sans truncate max-w-[90px]">{car.name}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => click(onOpenShop)}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#0F172A]/88 border border-white/15 px-3 py-2.5 text-xs sm:text-sm font-bold text-[#F8FAFC] hover:border-[#FFC93C] active:scale-95 transition cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4 text-[#FFC93C]" />
              {t(lang, 'shop')}
            </button>
            <button
              onClick={() => click(onOpenDaily)}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#0F172A]/88 border border-white/15 px-3 py-2.5 text-xs sm:text-sm font-bold text-[#F8FAFC] hover:border-[#14B8A6] active:scale-95 transition cursor-pointer whitespace-nowrap"
            >
              <Calendar className="w-4 h-4 text-[#14B8A6]" />
              {t(lang, 'daily')}
            </button>
          </div>

          <button
            onClick={() => click(onOpenAchievements)}
            className="flex items-center justify-between rounded-2xl bg-[#0F172A]/88 border border-white/15 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:border-[#FFC93C] active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <span className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FFC93C]" />
              {t(lang, 'achievements')}
            </span>
            <span className="font-mono-num text-xs text-slate-400">
              {save.achievementsClaimed.length}/40
            </span>
          </button>
        </nav>

        {/* Right Side Event Cards (Compact, leaving center 3D car unobstructed) */}
        <div className="pointer-events-auto hidden sm:flex flex-col gap-2.5 w-60">
          <button
            onClick={() => click(onQuickDaily)}
            className="text-left rounded-2xl bg-[#0F172A]/88 border border-[#14B8A6]/45 p-3 hover:border-[#14B8A6] active:scale-95 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-bold text-[#14B8A6]">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Daily Challenge
              </span>
              <span className="font-mono-num">Streak {save.dailyChallengeStreak}</span>
            </div>
            <div className="mt-1 font-display text-sm font-bold text-[#F8FAFC] truncate">
              {dailySpec.title}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-300">
              {dailyDone ? 'Completed today · Replay for fun' : `+${dailySpec.rewardCoins} Coins · +${dailySpec.rewardGems} Gems`}
            </div>
          </button>

          <button
            onClick={() => click(onQuickWeekly)}
            className="text-left rounded-2xl bg-[#0F172A]/88 border border-[#FFC93C]/45 p-3 hover:border-[#FFC93C] active:scale-95 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-bold text-[#FFC93C]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Weekly Event
              </span>
              <span className="font-mono-num">{weeklySpec.weekStr}</span>
            </div>
            <div className="mt-1 font-display text-sm font-bold text-[#F8FAFC] truncate">
              {weeklySpec.title}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-300">
              {weeklyDone ? 'Event Won · Practice Run' : `+${weeklySpec.rewardCoins} Coins · +${weeklySpec.rewardGems} Gems`}
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Hint Bar */}
      <footer className="flex items-center justify-between text-[11px] text-slate-300">
        <div className="bg-[#0F172A]/80 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
          <Award className="w-3.5 h-3.5 text-[#FF8A00]" />
          <span>Drag 3D Showroom to inspect {car.name} · {car.carClass}</span>
        </div>
        <div className="hidden md:block bg-[#0F172A]/80 border border-white/10 rounded-xl px-3 py-1.5 text-slate-400">
          Keyboard: WASD/Arrows · Space Drift · Shift Nitro · C Cam · 1-4 P-R-N-D
        </div>
      </footer>
    </div>
  );
};
