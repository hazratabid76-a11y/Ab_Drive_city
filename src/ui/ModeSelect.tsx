import React, { useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { soundEngine } from '../core/audio';
import { DIFFICULTY_CONFIG } from '../data/economy';
import { t } from '../data/i18n';
import { GAME_MODES } from '../data/modes';
import { DifficultyId, ModeId, SaveData, TimeOfDay, WeatherType } from '../types/game';

interface ModeSelectProps {
  save: SaveData;
  difficulty: DifficultyId;
  onChangeDifficulty: (d: DifficultyId) => void;
  onLaunchMode: (mode: ModeId, weather: WeatherType, timeOfDay: TimeOfDay) => void;
  onOpenCareer: () => void;
  onBack: () => void;
}

export const ModeSelect: React.FC<ModeSelectProps> = ({
  save,
  difficulty,
  onChangeDifficulty,
  onLaunchMode,
  onOpenCareer,
  onBack,
}) => {
  const lang = save.settings.language;
  const [selectedMode, setSelectedMode] = useState<ModeId>('rush_hour');
  const [weather, setWeather] = useState<WeatherType>('clear');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('sunset');

  const meta = GAME_MODES.find((m) => m.id === selectedMode) || GAME_MODES[0];
  const bestVal =
    selectedMode === 'career'
      ? `${save.stats.totalStarsEarned}/180 ★`
      : selectedMode === 'daily_challenge'
        ? `Streak ${save.dailyChallengeStreak}`
        : `${(save.modeBests[selectedMode] || 0).toLocaleString()}`;

  return (
    <div
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-20 flex flex-col bg-[#0F172A]/95 p-3 sm:p-5 safe-pad"
    >
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
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F8FAFC]">All 10 Game Modes</h2>
            <p className="text-xs text-slate-400">Pick any mode, weather, and difficulty tier</p>
          </div>
        </div>

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

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 pt-3">
        {/* Mode Cards */}
        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 overflow-y-auto custom-scroll pr-1 content-start">
          {GAME_MODES.map((m) => {
            const active = selectedMode === m.id;
            const pb =
              m.id === 'career'
                ? `${save.stats.totalStarsEarned} ★`
                : m.id === 'daily_challenge'
                  ? `${save.dailyChallengeStreak}d`
                  : `${(save.modeBests[m.id] || 0).toLocaleString()}`;
            return (
              <button
                key={m.id}
                onClick={() => {
                  soundEngine.playUiClick();
                  setSelectedMode(m.id);
                }}
                className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition cursor-pointer min-h-[112px] ${
                  active
                    ? 'bg-slate-800 border-[#FF8A00] ring-1 ring-[#FF8A00]'
                    : 'bg-slate-900/90 border-white/10 hover:border-white/30'
                }`}
              >
                <div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: m.accent }} />
                <div>
                  <div className="font-display text-sm sm:text-base font-bold text-[#F8FAFC] leading-tight mt-2">
                    {m.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{m.tagline}</div>
                </div>
                <div className="mt-2 font-mono-num text-[11px] text-[#FFC93C]">
                  {m.bestLabel}: {pb}
                </div>
              </button>
            );
          })}
        </div>

        {/* Mode Config & Launch */}
        <div className="md:col-span-4 flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/90 p-4 overflow-y-auto custom-scroll">
          <div>
            <div className="text-xs font-bold text-[#14B8A6]">{meta.tagline}</div>
            <h3 className="mt-1 font-display text-2xl font-bold text-[#F8FAFC]">{meta.name}</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">{meta.description}</p>

            <div className="mt-3 flex items-center justify-between bg-slate-950/70 rounded-xl px-3 py-2 border border-white/10 text-xs">
              <span className="text-slate-400">Personal Best</span>
              <span className="font-mono-num font-bold text-[#FFC93C]">{bestVal}</span>
            </div>

            {selectedMode !== 'career' && selectedMode !== 'daily_challenge' && (
              <div className="mt-3 space-y-2.5">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">Time of Day</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['sunrise', 'morning', 'day', 'afternoon', 'sunset', 'night'] as TimeOfDay[]).map((tod) => (
                      <button
                        key={tod}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setTimeOfDay(tod);
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer border ${
                          timeOfDay === tod
                            ? 'bg-[#FF8A00] text-[#0F172A] border-[#FF8A00]'
                            : 'bg-slate-950 text-slate-300 border-white/10'
                        }`}
                      >
                        {tod}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">Weather</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['clear', 'cloudy', 'rain', 'fog'] as WeatherType[]).map((w) => (
                      <button
                        key={w}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setWeather(w);
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer border ${
                          weather === w
                            ? 'bg-[#14B8A6] text-[#0F172A] border-[#14B8A6]'
                            : 'bg-slate-950 text-slate-300 border-white/10'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="mt-3 text-[11px] text-slate-400">
              Difficulty ({DIFFICULTY_CONFIG[difficulty].label}): {DIFFICULTY_CONFIG[difficulty].description}
            </p>
          </div>

          <button
            onClick={() => {
              soundEngine.playUiClick();
              if (selectedMode === 'career') onOpenCareer();
              else onLaunchMode(selectedMode, weather, timeOfDay);
            }}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] py-3 font-display text-lg font-bold text-[#0F172A] hover:brightness-105 active:scale-95 transition cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            {selectedMode === 'career' ? 'Open Career Map' : t(lang, 'startRace')}
          </button>
        </div>
      </div>
    </div>
  );
};
