import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Gift, RotateCw, ShoppingBag, Trophy } from 'lucide-react';
import { soundEngine } from '../core/audio';
import { ACHIEVEMENTS } from '../data/achievements';
import { BODY_COLORS, SPOILER_STYLES, WHEEL_STYLES } from '../data/cars';
import {
  DAILY_REWARD_CALENDAR,
  ENABLE_REWARDED_AD_PLACEHOLDER,
  getTodayDateString,
  SPIN_WHEEL_SLOTS,
} from '../data/economy';
import { SaveData, SpoilerStyle, WheelStyle } from '../types/game';

interface ShopModalProps {
  save: SaveData;
  onExchangeGemsForCoins: (gemsCost: number, coinsGain: number) => void;
  onUnlockColor: (hex: string, cost: number) => void;
  onUnlockWheel: (id: WheelStyle, cost: number) => void;
  onUnlockSpoiler: (id: SpoilerStyle, cost: number) => void;
  onRewardedAdGrant: () => void;
  onBack: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  save,
  onExchangeGemsForCoins,
  onUnlockColor,
  onUnlockWheel,
  onUnlockSpoiler,
  onRewardedAdGrant,
  onBack,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[#0F172A]/95 p-3 sm:p-5 safe-pad">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onBack();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="font-display text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#FFC93C]" /> City Tuning Shop
          </h2>
        </div>
        <div className="flex items-center gap-3 bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 font-mono-num text-xs sm:text-sm font-bold">
          <span className="text-[#FFC93C]">{save.coins.toLocaleString()} Coins</span>
          <span className="text-slate-600">|</span>
          <span className="text-[#14B8A6]">{save.gems.toLocaleString()} Gems</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coin Bundles (In-Game Gem Exchange Only - No Real Payments) */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-[#FFC93C]">Coin Vault (Gem Exchange)</h3>
          <p className="text-xs text-slate-400">Trade earned Gems for Garage upgrade Coins. 100% offline in-game economy.</p>
          {[
            { gems: 5, coins: 1200, label: 'Starter Crate' },
            { gems: 15, coins: 4000, label: 'Street Tuners Pack' },
            { gems: 35, coins: 11000, label: 'Apex Motorsport Chest' },
          ].map((b) => (
            <div key={b.label} className="flex items-center justify-between bg-slate-950 rounded-xl p-3 border border-white/10">
              <div>
                <div className="text-sm font-bold text-white">{b.label}</div>
                <div className="font-mono-num text-xs text-[#FFC93C]">+{b.coins.toLocaleString()} Coins</div>
              </div>
              <button
                disabled={save.gems < b.gems}
                onClick={() => {
                  soundEngine.playCoin();
                  onExchangeGemsForCoins(b.gems, b.coins);
                }}
                className={`px-3 py-1.5 rounded-lg font-mono-num text-xs font-bold cursor-pointer ${
                  save.gems >= b.gems ? 'bg-[#14B8A6] text-[#0F172A]' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {b.gems} Gems
              </button>
            </div>
          ))}

          {ENABLE_REWARDED_AD_PLACEHOLDER && (
            <div className="rounded-xl border border-dashed border-[#FFC93C]/50 p-3 bg-slate-950">
              <div className="text-xs font-bold text-[#FFC93C]">REWARDED-AD PLACEHOLDER</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Optional placeholder reward (+300 Coins).</p>
              <button
                onClick={onRewardedAdGrant}
                className="mt-2 w-full py-1.5 rounded-lg bg-[#FFC93C] text-[#0F172A] text-xs font-bold cursor-pointer"
              >
                Claim Placeholder Bonus
              </button>
            </div>
          )}
        </div>

        {/* Paints */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-[#FF8A00]">Custom Paints</h3>
          <div className="space-y-2">
            {BODY_COLORS.filter((c) => c.priceCoins > 0).map((c) => {
              const owned = save.unlockedColors.includes(c.hex);
              return (
                <div key={c.hex} className="flex items-center justify-between bg-slate-950 rounded-xl p-2.5 border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg border border-white/20" style={{ backgroundColor: c.hex }} />
                    <span className="text-xs font-bold text-white">{c.name}</span>
                  </div>
                  <button
                    disabled={owned || save.coins < c.priceCoins}
                    onClick={() => {
                      soundEngine.playChime(true);
                      onUnlockColor(c.hex, c.priceCoins);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-mono-num text-xs font-bold cursor-pointer ${
                      owned
                        ? 'bg-slate-800 text-[#14B8A6]'
                        : save.coins >= c.priceCoins
                          ? 'bg-[#FF8A00] text-[#0F172A]'
                          : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {owned ? 'Owned' : `${c.priceCoins}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wheels & Spoilers */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-[#14B8A6]">Aero & Rims</h3>
          {WHEEL_STYLES.filter((w) => w.priceCoins > 0).map((w) => {
            const owned = save.unlockedWheels.includes(w.id);
            return (
              <div key={w.id} className="flex items-center justify-between bg-slate-950 rounded-xl p-2.5 border border-white/10">
                <span className="text-xs font-bold text-white">{w.name}</span>
                <button
                  disabled={owned || save.coins < w.priceCoins}
                  onClick={() => {
                    soundEngine.playChime(true);
                    onUnlockWheel(w.id, w.priceCoins);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono-num text-xs font-bold cursor-pointer ${
                    owned
                      ? 'bg-slate-800 text-[#14B8A6]'
                      : save.coins >= w.priceCoins
                        ? 'bg-[#FF8A00] text-[#0F172A]'
                        : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {owned ? 'Owned' : `${w.priceCoins}`}
                </button>
              </div>
            );
          })}
          {SPOILER_STYLES.filter((s) => s.priceCoins > 0).map((s) => {
            const owned = save.unlockedSpoilers.includes(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between bg-slate-950 rounded-xl p-2.5 border border-white/10">
                <span className="text-xs font-bold text-white">{s.name}</span>
                <button
                  disabled={owned || save.coins < s.priceCoins}
                  onClick={() => {
                    soundEngine.playChime(true);
                    onUnlockSpoiler(s.id, s.priceCoins);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono-num text-xs font-bold cursor-pointer ${
                    owned
                      ? 'bg-slate-800 text-[#14B8A6]'
                      : save.coins >= s.priceCoins
                        ? 'bg-[#FF8A00] text-[#0F172A]'
                        : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {owned ? 'Owned' : `${s.priceCoins}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface DailyRewardModalProps {
  save: SaveData;
  onClaimDaily: (coins: number, gems: number) => void;
  onSpinReward: (coins: number, gems: number) => void;
  onBack: () => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
  save,
  onClaimDaily,
  onSpinReward,
  onBack,
}) => {
  const today = getTodayDateString();
  const canClaimDaily = save.lastDailyRewardDate !== today;
  const canSpin = save.lastSpinDate !== today;
  const [spinning, setSpinning] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinResult, setSpinResult] = useState<string | null>(null);

  const handleSpin = () => {
    if (!canSpin || spinning) return;
    soundEngine.playUiClick();
    setSpinning(true);
    const slotIdx = Math.floor(Math.random() * SPIN_WHEEL_SLOTS.length);
    const slot = SPIN_WHEEL_SLOTS[slotIdx];
    const targetDeg = 360 * 5 + (360 - slotIdx * (360 / SPIN_WHEEL_SLOTS.length));
    setWheelAngle((prev) => prev + targetDeg);
    window.setTimeout(() => {
      setSpinning(false);
      setSpinResult(slot.label);
      soundEngine.playWinFanfare();
      onSpinReward(slot.coins, slot.gems);
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[#0F172A]/95 p-3 sm:p-5 safe-pad">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onBack();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="font-display text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#14B8A6]" /> Daily Rewards & Spin Wheel
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll pt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* 7-Day Calendar */}
        <div className="md:col-span-7 rounded-2xl border border-white/10 bg-slate-900/90 p-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-[#FFC93C]">7-Day Login Calendar</h3>
            <p className="text-xs text-slate-400">Come back daily to progress toward the Day 7 Jackpot.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
              {DAILY_REWARD_CALENDAR.map((item, idx) => {
                const claimed = idx < save.dailyRewardDay;
                const isToday = idx === save.dailyRewardDay && canClaimDaily;
                return (
                  <div
                    key={item.day}
                    className={`rounded-xl border p-3 text-center ${
                      isToday
                        ? 'bg-[#FF8A00]/20 border-[#FF8A00]'
                        : claimed
                          ? 'bg-[#14B8A6]/15 border-[#14B8A6]/40 opacity-75'
                          : 'bg-slate-950 border-white/10'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-300">{item.label}</div>
                    <div className="mt-1 font-mono-num text-sm font-bold text-[#FFC93C]">+{item.coins}</div>
                    {item.gems > 0 && (
                      <div className="font-mono-num text-xs text-[#14B8A6]">+{item.gems} Gems</div>
                    )}
                    {claimed && <div className="mt-1 text-[10px] text-[#14B8A6] font-bold">Claimed</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            disabled={!canClaimDaily}
            onClick={() => {
              const item = DAILY_REWARD_CALENDAR[save.dailyRewardDay % 7];
              soundEngine.playCoin();
              onClaimDaily(item.coins, item.gems);
            }}
            className={`mt-4 w-full py-3 rounded-xl font-display text-lg font-bold cursor-pointer ${
              canClaimDaily
                ? 'bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] text-[#0F172A]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {canClaimDaily ? `Claim Day ${(save.dailyRewardDay % 7) + 1} Reward` : 'Already Claimed Today'}
          </button>
        </div>

        {/* Spin Wheel */}
        <div className="md:col-span-5 rounded-2xl border border-white/10 bg-slate-900/90 p-4 flex flex-col items-center justify-between">
          <div className="text-center">
            <h3 className="font-display text-lg font-bold text-[#14B8A6]">Daily Lucky Wheel</h3>
            <p className="text-xs text-slate-400">One free spin every day!</p>
          </div>

          <div className="relative my-3 flex items-center justify-center">
            <div className="absolute -top-2 z-10 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[14px] border-l-transparent border-r-transparent border-t-[#F8FAFC]" />
            <div
              className="w-40 h-40 rounded-full border-4 border-[#FFC93C] flex items-center justify-center transition-transform duration-[2200ms] ease-out shadow-xl"
              style={{
                transform: `rotate(${wheelAngle}deg)`,
                background:
                  'conic-gradient(#FF8A00 0deg 45deg, #14B8A6 45deg 90deg, #FFC93C 90deg 135deg, #1E293B 135deg 180deg, #FF8A00 180deg 225deg, #14B8A6 225deg 270deg, #FFC93C 270deg 315deg, #EF4444 315deg 360deg)',
              }}
            >
              <div className="w-10 h-10 rounded-full bg-[#0F172A] border-2 border-white flex items-center justify-center">
                <RotateCw className="w-4 h-4 text-[#FFC93C]" />
              </div>
            </div>
          </div>

          {spinResult && (
            <div className="text-xs font-bold text-[#FFC93C] mb-2">Won: {spinResult}!</div>
          )}

          <button
            disabled={!canSpin || spinning}
            onClick={handleSpin}
            className={`w-full py-2.5 rounded-xl font-display text-base font-bold cursor-pointer ${
              canSpin && !spinning
                ? 'bg-[#14B8A6] text-[#0F172A]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {spinning ? 'Spinning...' : canSpin ? 'SPIN FREE' : 'Come Back Tomorrow'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AchievementsModal: React.FC<{ save: SaveData; onBack: () => void }> = ({ save, onBack }) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[#0F172A]/95 p-3 sm:p-5 safe-pad">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onBack();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="font-display text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FFC93C]" /> Achievements ({save.achievementsClaimed.length}/40)
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 content-start">
        {ACHIEVEMENTS.map((ach) => {
          const unlocked = save.achievementsClaimed.includes(ach.id);
          const cur = Math.min(ach.target, Math.floor(save.stats[ach.statKey]));
          const pct = Math.min(100, Math.round((cur / ach.target) * 100));
          return (
            <div
              key={ach.id}
              className={`rounded-2xl border p-3 flex flex-col justify-between ${
                unlocked ? 'bg-slate-800/90 border-[#14B8A6]/60' : 'bg-slate-900/80 border-white/10'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-bold text-[#F8FAFC]">{ach.title}</span>
                  {unlocked && <CheckCircle2 className="w-4 h-4 text-[#14B8A6]" />}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{ach.description}</p>
              </div>
              <div className="mt-2.5">
                <div className="flex justify-between font-mono-num text-[11px] text-slate-300">
                  <span>
                    {cur.toLocaleString()} / {ach.target.toLocaleString()}
                  </span>
                  <span className="text-[#FFC93C]">
                    +{ach.rewardCoins}C {ach.rewardGems > 0 ? `+${ach.rewardGems}G` : ''}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className={`h-full ${unlocked ? 'bg-[#14B8A6]' : 'bg-[#FF8A00]'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
