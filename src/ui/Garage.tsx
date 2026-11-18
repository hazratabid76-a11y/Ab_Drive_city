import React, { useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Lock, Wrench } from 'lucide-react';
import { soundEngine } from '../core/audio';
import {
  BODY_COLORS,
  CARS,
  PAINT_FINISHES,
  SPOILER_STYLES,
  UNDERGLOW_COLORS,
  WHEEL_STYLES,
} from '../data/cars';
import { t } from '../data/i18n';
import { computeEffectiveSpecs, DEFAULT_UPGRADES, getUpgradeCost, UPGRADES } from '../data/upgrades';
import { CarCustomization, PaintFinish, SaveData, SpoilerStyle, UpgradeKey, WheelStyle } from '../types/game';

interface GarageProps {
  save: SaveData;
  previewCarId: string;
  onSelectPreviewCar: (carId: string, cust: CarCustomization) => void;
  onEquipCar: (carId: string) => void;
  onBuyCar: (carId: string) => void;
  onUpdateCustomization: (carId: string, cust: CarCustomization, costCoins?: number, costGems?: number) => void;
  onBuyUpgrade: (carId: string, key: UpgradeKey, costCoins: number) => void;
  onBack: () => void;
}

export const Garage: React.FC<GarageProps> = ({
  save,
  previewCarId,
  onSelectPreviewCar,
  onEquipCar,
  onBuyCar,
  onUpdateCustomization,
  onBuyUpgrade,
  onBack,
}) => {
  const lang = save.settings.language;
  const [tab, setTab] = useState<'vehicles' | 'upgrades' | 'style'>('vehicles');

  const carIdx = Math.max(0, CARS.findIndex((c) => c.id === previewCarId));
  const car = CARS[carIdx];
  const isOwned = save.ownedCars.includes(car.id);
  const isEquipped = save.selectedCarId === car.id;
  const upgrades = save.carUpgrades[car.id] || DEFAULT_UPGRADES;
  const cust = save.carCustomizations[car.id] || {
    color: car.defaultColor,
    finish: 'gloss' as PaintFinish,
    wheelStyle: 'stock' as WheelStyle,
    spoiler: 'none' as SpoilerStyle,
    underglow: 'none',
  };
  const specs = computeEffectiveSpecs(car, upgrades);

  const cycleCar = (dir: -1 | 1) => {
    soundEngine.playUiClick();
    const nextIdx = (carIdx + dir + CARS.length) % CARS.length;
    const nextCar = CARS[nextIdx];
    const nextCust = save.carCustomizations[nextCar.id] || {
      color: nextCar.defaultColor,
      finish: 'gloss',
      wheelStyle: 'stock',
      spoiler: 'none',
      underglow: 'none',
    };
    onSelectPreviewCar(nextCar.id, nextCust);
  };

  const canAffordCar =
    save.coins >= car.priceCoins && save.gems >= car.priceGems && save.level >= car.unlockLevel;

  return (
    <div
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5 safe-pad"
    >
      {/* Top Bar */}
      <div className="pointer-events-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onBack();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#0F172A]/90 border border-white/15 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:border-[#FF8A00] cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            {t(lang, 'back')}
          </button>
          <div className="bg-[#0F172A]/85 border border-white/10 rounded-xl px-3 py-1.5">
            <div className="font-display text-lg font-bold text-[#F8FAFC] leading-none">{car.name}</div>
            <div className="text-[11px] text-[#14B8A6] font-semibold">
              {car.carClass} · {carIdx + 1}/{CARS.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#0F172A]/90 border border-white/10 rounded-xl px-3.5 py-2 font-mono-num text-xs sm:text-sm font-bold">
          <span className="text-[#FFC93C]">{save.coins.toLocaleString()} Coins</span>
          <span className="text-slate-600">|</span>
          <span className="text-[#14B8A6]">{save.gems.toLocaleString()} Gems</span>
        </div>
      </div>

      {/* Left Stats & Car Switcher + Right Tuning Drawer (3D center remains open!) */}
      <div className="flex-1 min-h-0 flex items-center justify-between gap-3 my-2">
        {/* Left Car Specs */}
        <div className="pointer-events-auto hidden sm:flex flex-col justify-between w-60 rounded-2xl bg-[#0F172A]/88 border border-white/10 p-3.5">
          <div>
            <p className="text-xs text-slate-300 leading-snug">{car.tagline}</p>
            <div className="mt-3 space-y-2 text-xs">
              {[
                { label: 'Top Speed', val: `${specs.ratings.topSpeed} km/h`, pct: (specs.ratings.topSpeed / 360) * 100, col: '#FF8A00' },
                { label: 'Accel', val: `${specs.ratings.acceleration}`, pct: specs.ratings.acceleration, col: '#FFC93C' },
                { label: 'Handling', val: `${specs.ratings.handling}`, pct: specs.ratings.handling, col: '#14B8A6' },
                { label: 'Braking', val: `${specs.ratings.braking}`, pct: specs.ratings.braking, col: '#38BDF8' },
                { label: 'Nitro', val: `${specs.ratings.nitro}`, pct: specs.ratings.nitro, col: '#A855F7' },
                { label: 'Armor', val: `${specs.ratings.durability}`, pct: specs.ratings.durability, col: '#22C55E' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">{s.label}</span>
                    <span className="font-mono-num font-bold text-[#F8FAFC]">{s.val}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, s.pct)}%`, backgroundColor: s.col }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => cycleCar(-1)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              aria-label="Previous Car"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => cycleCar(1)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              aria-label="Next Car"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {isOwned ? (
              <button
                onClick={() => {
                  soundEngine.playUiClick();
                  onEquipCar(car.id);
                }}
                disabled={isEquipped}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  isEquipped
                    ? 'bg-[#14B8A6]/20 text-[#14B8A6] border border-[#14B8A6]/50'
                    : 'bg-[#FF8A00] text-[#0F172A]'
                }`}
              >
                {isEquipped ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Selected
                  </>
                ) : (
                  'Select Car'
                )}
              </button>
            ) : (
              <button
                disabled={!canAffordCar}
                onClick={() => {
                  soundEngine.playCoin();
                  onBuyCar(car.id);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                  canAffordCar
                    ? 'bg-gradient-to-r from-[#FF8A00] to-[#FFC93C] text-[#0F172A]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {save.level < car.unlockLevel
                  ? `Req LVL ${car.unlockLevel}`
                  : `Buy ${car.priceCoins.toLocaleString()}${car.priceGems ? ` + ${car.priceGems}G` : ''}`}
              </button>
            )}
          </div>
        </div>

        {/* Right Panel: Tabs for Fleet / Upgrades / Styling */}
        <div className="pointer-events-auto flex flex-col w-72 sm:w-80 h-full max-h-[380px] rounded-2xl bg-[#0F172A]/90 border border-white/10 p-3">
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl shrink-0">
            {(['vehicles', 'upgrades', 'style'] as const).map((tKey) => (
              <button
                key={tKey}
                onClick={() => {
                  soundEngine.playUiClick();
                  setTab(tKey);
                }}
                className={`py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer transition ${
                  tab === tKey ? 'bg-[#FF8A00] text-[#0F172A]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tKey}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll mt-2.5 pr-1 space-y-2">
            {tab === 'vehicles' &&
              CARS.map((c) => {
                const owned = save.ownedCars.includes(c.id);
                const selected = c.id === car.id;
                const equipped = c.id === save.selectedCarId;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      const cCust = save.carCustomizations[c.id] || {
                        color: c.defaultColor,
                        finish: 'gloss',
                        wheelStyle: 'stock',
                        spoiler: 'none',
                        underglow: 'none',
                      };
                      onSelectPreviewCar(c.id, cCust);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border p-2.5 text-left transition cursor-pointer ${
                      selected
                        ? 'bg-slate-800 border-[#FF8A00]'
                        : 'bg-slate-950/70 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div>
                      <div className="font-display text-sm font-bold text-[#F8FAFC] flex items-center gap-1.5">
                        {c.name}
                        {equipped && <span className="text-[10px] text-[#14B8A6] font-sans">(Active)</span>}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {c.carClass} · {c.stats.topSpeed} km/h
                      </div>
                    </div>
                    <div className="text-right font-mono-num text-xs">
                      {owned ? (
                        <span className="text-[#14B8A6] font-bold">Owned</span>
                      ) : save.level < c.unlockLevel ? (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> L{c.unlockLevel}
                        </span>
                      ) : (
                        <span className="text-[#FFC93C] font-bold">
                          {c.priceCoins.toLocaleString()}
                          {c.priceGems ? ` +${c.priceGems}G` : ''}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

            {tab === 'upgrades' &&
              (isOwned ? (
                UPGRADES.map((u) => {
                  const lvl = upgrades[u.key] || 0;
                  const cost = getUpgradeCost(u, lvl);
                  const maxed = lvl >= u.maxLevel;
                  const canBuy = !maxed && save.coins >= cost;
                  return (
                    <div
                      key={u.key}
                      className="rounded-xl border border-white/10 bg-slate-950/75 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#F8FAFC]">
                          <Wrench className="w-3.5 h-3.5 text-[#FF8A00]" />
                          {u.name}
                          <span className="font-mono-num text-[#FFC93C]">Lv.{lvl}/5</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{u.description}</div>
                        <div className="mt-1 flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className={`h-1.5 w-5 rounded-full ${n <= lvl ? 'bg-[#14B8A6]' : 'bg-slate-800'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        disabled={!canBuy}
                        onClick={() => {
                          soundEngine.playChime(true);
                          onBuyUpgrade(car.id, u.key, cost);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg font-mono-num text-xs font-bold shrink-0 cursor-pointer ${
                          maxed
                            ? 'bg-slate-800 text-[#14B8A6]'
                            : canBuy
                              ? 'bg-[#FF8A00] text-[#0F172A]'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {maxed ? 'MAX' : `${cost}`}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 p-3 text-center">Purchase this vehicle first to install upgrades.</div>
              ))}

            {tab === 'style' &&
              (isOwned ? (
                <div className="space-y-3 text-xs">
                  {/* Body Colors */}
                  <div>
                    <div className="text-slate-400 font-semibold mb-1.5">Body Color (8 Shades)</div>
                    <div className="grid grid-cols-4 gap-2">
                      {BODY_COLORS.map((bc) => {
                        const unlocked = save.unlockedColors.includes(bc.hex) || bc.priceCoins === 0;
                        const active = cust.color === bc.hex;
                        return (
                          <button
                            key={bc.hex}
                            onClick={() => {
                              if (!unlocked && save.coins < bc.priceCoins) return;
                              soundEngine.playUiClick();
                              onUpdateCustomization(
                                car.id,
                                { ...cust, color: bc.hex },
                                unlocked ? 0 : bc.priceCoins,
                              );
                            }}
                            className={`h-9 rounded-xl border-2 flex items-center justify-center font-mono-num text-[10px] font-bold cursor-pointer ${
                              active ? 'border-white scale-105' : 'border-white/20'
                            }`}
                            style={{ backgroundColor: bc.hex, color: bc.hex === '#F8FAFC' ? '#0F172A' : '#FFFFFF' }}
                          >
                            {!unlocked ? bc.priceCoins : active ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Paint Finish */}
                  <div>
                    <div className="text-slate-400 font-semibold mb-1.5">Paint Finish</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PAINT_FINISHES.map((pf) => (
                        <button
                          key={pf.id}
                          onClick={() => {
                            soundEngine.playUiClick();
                            onUpdateCustomization(car.id, { ...cust, finish: pf.id });
                          }}
                          className={`py-1.5 rounded-lg font-bold cursor-pointer border ${
                            cust.finish === pf.id
                              ? 'bg-[#14B8A6] text-[#0F172A] border-[#14B8A6]'
                              : 'bg-slate-950 text-slate-300 border-white/10'
                          }`}
                        >
                          {pf.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Wheels */}
                  <div>
                    <div className="text-slate-400 font-semibold mb-1.5">Wheel Rims</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {WHEEL_STYLES.map((ws) => {
                        const unlocked = save.unlockedWheels.includes(ws.id) || ws.priceCoins === 0;
                        return (
                          <button
                            key={ws.id}
                            onClick={() => {
                              if (!unlocked && save.coins < ws.priceCoins) return;
                              soundEngine.playUiClick();
                              onUpdateCustomization(
                                car.id,
                                { ...cust, wheelStyle: ws.id },
                                unlocked ? 0 : ws.priceCoins,
                              );
                            }}
                            className={`py-1.5 px-2 rounded-lg text-left border cursor-pointer flex justify-between ${
                              cust.wheelStyle === ws.id
                                ? 'bg-[#FF8A00] text-[#0F172A] border-[#FF8A00] font-bold'
                                : 'bg-slate-950 text-slate-300 border-white/10'
                            }`}
                          >
                            <span className="truncate">{ws.name}</span>
                            {!unlocked && <span className="font-mono-num">{ws.priceCoins}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Spoiler */}
                  <div>
                    <div className="text-slate-400 font-semibold mb-1.5">Rear Spoiler</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SPOILER_STYLES.map((sp) => {
                        const unlocked = save.unlockedSpoilers.includes(sp.id) || sp.priceCoins === 0;
                        return (
                          <button
                            key={sp.id}
                            onClick={() => {
                              if (!unlocked && save.coins < sp.priceCoins) return;
                              soundEngine.playUiClick();
                              onUpdateCustomization(
                                car.id,
                                { ...cust, spoiler: sp.id },
                                unlocked ? 0 : sp.priceCoins,
                              );
                            }}
                            className={`py-1.5 px-2 rounded-lg text-left border cursor-pointer flex justify-between ${
                              cust.spoiler === sp.id
                                ? 'bg-[#FF8A00] text-[#0F172A] border-[#FF8A00] font-bold'
                                : 'bg-slate-950 text-slate-300 border-white/10'
                            }`}
                          >
                            <span className="truncate">{sp.name}</span>
                            {!unlocked && <span className="font-mono-num">{sp.priceCoins}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Neon Underglow */}
                  <div>
                    <div className="text-slate-400 font-semibold mb-1.5">Neon Underglow</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {UNDERGLOW_COLORS.map((ug) => (
                        <button
                          key={ug.hex}
                          onClick={() => {
                            if (ug.priceGems > 0 && save.gems < ug.priceGems && cust.underglow !== ug.hex) return;
                            soundEngine.playUiClick();
                            const payGems = cust.underglow === ug.hex ? 0 : ug.priceGems;
                            onUpdateCustomization(car.id, { ...cust, underglow: ug.hex }, 0, payGems);
                          }}
                          className={`py-1.5 px-2 rounded-lg border text-center cursor-pointer ${
                            cust.underglow === ug.hex
                              ? 'bg-[#14B8A6] text-[#0F172A] border-[#14B8A6] font-bold'
                              : 'bg-slate-950 text-slate-300 border-white/10'
                          }`}
                        >
                          {ug.name} {ug.priceGems > 0 && cust.underglow !== ug.hex ? `(${ug.priceGems}G)` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 p-3 text-center">Purchase this vehicle first to customize it.</div>
              ))}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Quick Buy/Select Bar */}
      <div className="pointer-events-auto sm:hidden flex items-center justify-between gap-2 bg-[#0F172A]/90 border border-white/10 rounded-2xl p-2">
        <button onClick={() => cycleCar(-1)} className="p-2 rounded-xl bg-slate-800 text-white">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {isOwned ? (
          <button
            onClick={() => onEquipCar(car.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold ${
              isEquipped ? 'bg-[#14B8A6]/25 text-[#14B8A6]' : 'bg-[#FF8A00] text-[#0F172A]'
            }`}
          >
            {isEquipped ? 'Selected' : 'Select Car'}
          </button>
        ) : (
          <button
            disabled={!canAffordCar}
            onClick={() => onBuyCar(car.id)}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#FFC93C] text-[#0F172A]"
          >
            {save.level < car.unlockLevel ? `Req LVL ${car.unlockLevel}` : `Buy ${car.priceCoins}`}
          </button>
        )}
        <button onClick={() => cycleCar(1)} className="p-2 rounded-xl bg-slate-800 text-white">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
