import React, { useState } from 'react';
import { ArrowLeft, Cloud, CloudRain, Lock, Moon, Play, Skull, Star, Sun, Sunrise, Sunset } from 'lucide-react';
import { soundEngine } from '../core/audio';
import { DIFFICULTY_CONFIG } from '../data/economy';
import { CAREER_LEVELS, WORLDS } from '../data/levels';
import { t } from '../data/i18n';
import { DifficultyId, LevelDef, SaveData } from '../types/game';

interface CareerMapProps {
  save: SaveData;
  difficulty: DifficultyId;
  onChangeDifficulty: (d: DifficultyId) => void;
  onStartLevel: (level: LevelDef) => void;
  onBack: () => void;
}

export const CareerMap: React.FC<CareerMapProps> = ({
  save,
  difficulty,
  onChangeDifficulty,
  onStartLevel,
  onBack,
}) => {
  const lang = save.settings.language;
  const currentWorld = Math.min(6, Math.ceil(save.careerUnlockedLevel / 10));
  const [selectedWorld, setSelectedWorld] = useState(currentWorld);
  const worldLevels = CAREER_LEVELS.filter((l) => l.world === selectedWorld);
  const [selectedLevel, setSelectedLevel] = useState<LevelDef>(
    () => CAREER_LEVELS[Math.min(save.careerUnlockedLevel - 1, 59)],
  );

  const unlocked = selectedLevel.id <= save.careerUnlockedLevel;
  const stars = save.careerStars[selectedLevel.id] || 0;

  return (
    <div
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-20 flex flex-col bg-[#0F172A]/95 p-3 sm:p-5 safe-pad"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onBack();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            {t(lang, 'back')}
          </button>
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F8FAFC]">Career Campaign</h2>
            <p className="text-xs text-slate-400">
              {save.stats.totalStarsEarned} / 180 Stars · Unlocked Level {save.careerUnlockedLevel}/60
            </p>
          </div>
        </div>

        {/* Difficulty Selector */}
        <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl p-1">
          {(['easy', 'normal', 'hard', 'extreme'] as DifficultyId[]).map((d) => (
            <button
              key={d}
              onClick={() => {
                soundEngine.playUiClick();
                onChangeDifficulty(d);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                difficulty === d
                  ? d === 'extreme'
                    ? 'bg-[#EF4444] text-white'
                    : 'bg-[#FF8A00] text-[#0F172A]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {DIFFICULTY_CONFIG[d].label}
            </button>
          ))}
        </div>
      </div>

      {/* World Tabs */}
      <div className="flex items-center gap-2 py-2.5 overflow-x-auto custom-scroll shrink-0">
        {WORLDS.map((w) => {
          const worldFirstLvl = (w.world - 1) * 10 + 1;
          const worldLocked = worldFirstLvl > save.careerUnlockedLevel;
          const worldStars = CAREER_LEVELS.filter((l) => l.world === w.world).reduce(
            (acc, l) => acc + (save.careerStars[l.id] || 0),
            0,
          );
          return (
            <button
              key={w.world}
              onClick={() => {
                soundEngine.playUiClick();
                setSelectedWorld(w.world);
                const first = CAREER_LEVELS.find((l) => l.world === w.world)!;
                setSelectedLevel(first);
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-left border transition shrink-0 cursor-pointer ${
                selectedWorld === w.world
                  ? 'bg-slate-800 border-[#FF8A00] text-white'
                  : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {worldLocked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
              <div>
                <div className="font-display text-sm font-bold whitespace-nowrap">
                  W{w.world}: {w.name}
                </div>
                <div className="font-mono-num text-[11px] text-[#FFC93C]">{worldStars}/30 ★</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Split: 10 Level Grid + Selected Level Brief */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
        {/* 10 Levels Grid */}
        <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-5 gap-2.5 overflow-y-auto custom-scroll pr-1 content-start">
          {worldLevels.map((lvl) => {
            const isUnlocked = lvl.id <= save.careerUnlockedLevel;
            const st = save.careerStars[lvl.id] || 0;
            const isSel = selectedLevel.id === lvl.id;
            return (
              <button
                key={lvl.id}
                onClick={() => {
                  soundEngine.playUiClick();
                  setSelectedLevel(lvl);
                }}
                className={`relative flex flex-col justify-between rounded-2xl border p-3 text-left transition cursor-pointer min-h-[104px] ${
                  isSel
                    ? 'bg-slate-800 border-[#FF8A00] ring-1 ring-[#FF8A00]'
                    : isUnlocked
                      ? 'bg-slate-900/90 border-white/10 hover:border-white/30'
                      : 'bg-slate-950/80 border-white/5 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono-num text-xs font-bold text-slate-400">#{lvl.id}</span>
                  {lvl.isBoss && <Skull className="w-4 h-4 text-[#EF4444]" />}
                  {!isUnlocked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                </div>
                <div className="font-display text-sm font-bold text-[#F8FAFC] leading-tight mt-1 line-clamp-2">
                  {lvl.title}
                </div>
                <div className="flex items-center gap-0.5 mt-2">
                  {[1, 2, 3].map((n) => (
                    <Star
                      key={n}
                      className={`w-3.5 h-3.5 ${
                        n <= st ? 'text-[#FFC93C] fill-[#FFC93C]' : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Level Detail Panel */}
        <div className="md:col-span-5 flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/90 p-4 overflow-y-auto custom-scroll">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                World {selectedLevel.world} · Level {selectedLevel.id}
              </span>
              <span className="flex items-center gap-1.5 text-[#14B8A6] font-semibold">
                {(selectedLevel.timeOfDay === 'day' || selectedLevel.timeOfDay === 'morning' || selectedLevel.timeOfDay === 'afternoon') && <Sun className="w-3.5 h-3.5 text-[#FFC93C]" />}
                {selectedLevel.timeOfDay === 'sunrise' && <Sunrise className="w-3.5 h-3.5 text-[#FFC93C]" />}
                {selectedLevel.timeOfDay === 'sunset' && <Sunset className="w-3.5 h-3.5 text-[#FF8A00]" />}
                {selectedLevel.timeOfDay === 'night' && <Moon className="w-3.5 h-3.5 text-sky-400" />}
                {selectedLevel.weather === 'cloudy' && <Cloud className="w-3.5 h-3.5 text-slate-300" />}
                {selectedLevel.weather === 'rain' && <CloudRain className="w-3.5 h-3.5 text-sky-300" />}
                {selectedLevel.timeOfDay.toUpperCase()} / {selectedLevel.weather.toUpperCase()}
              </span>
            </div>

            <h3 className="mt-1 font-display text-2xl font-bold text-[#F8FAFC]">{selectedLevel.title}</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300">{selectedLevel.objectiveText}</p>

            {/* Star Objectives */}
            <div className="mt-4 space-y-1.5 text-xs bg-slate-950/70 rounded-xl p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <span className={stars >= 1 ? 'text-[#FFC93C] font-semibold' : 'text-slate-300'}>
                  ★ 1 Star: {selectedLevel.starRules.oneStar}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={stars >= 2 ? 'text-[#FFC93C] font-semibold' : 'text-slate-400'}>
                  ★★ 2 Stars: {selectedLevel.starRules.description2}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={stars >= 3 ? 'text-[#FFC93C] font-semibold' : 'text-slate-400'}>
                  ★★★ 3 Stars: {selectedLevel.starRules.description3}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-300 font-mono-num">
              <span>Reward: +{Math.round(selectedLevel.rewardCoins * DIFFICULTY_CONFIG[difficulty].rewardMult)} Coins</span>
              <span>+{selectedLevel.rewardXp} XP</span>
              {selectedLevel.rewardGems > 0 && <span className="text-[#14B8A6]">+{selectedLevel.rewardGems} Gems</span>}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{DIFFICULTY_CONFIG[difficulty].description}</p>
          </div>

          <button
            disabled={!unlocked}
            onClick={() => {
              soundEngine.playUiClick();
              onStartLevel(selectedLevel);
            }}
            className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-lg font-bold transition ${
              unlocked
                ? 'bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] text-[#0F172A] hover:brightness-105 active:scale-95 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {unlocked ? (
              <>
                <Play className="w-5 h-5 fill-current" />
                {t(lang, 'startRace')}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Complete Level {selectedLevel.id - 1} First
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
