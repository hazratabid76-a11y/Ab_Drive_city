import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './core/audio';
import { requestLandscapeAndFullscreen } from './core/device';
import { exitNativeApp, onAppActiveChange, onNativeBack } from './core/native';
import {
  addXpAndCheckLevelUp,
  createDefaultSave,
  evaluateAchievements,
  importSaveJson,
  loadSave,
  persistSave,
  restoreFromIndexedDBIfEmpty,
  updateModeBest,
} from './core/save';
import { getCarById } from './data/cars';
import { getDailyChallengeSpec, getTodayDateString, getWeeklyEventSpec } from './data/economy';
import { getCareerLevel } from './data/levels';
import { DEFAULT_UPGRADES } from './data/upgrades';
import { GameEngine } from './engine/GameEngine';
import { ActiveSessionConfig } from './modes/modeController';
import {
  CameraMode,
  CarCustomization,
  DifficultyId,
  HUDState,
  LevelDef,
  ModeId,
  RunResult,
  SaveData,
  SettingsData,
  SpoilerStyle,
  TimeOfDay,
  UpgradeKey,
  WeatherType,
  WheelStyle,
} from './types/game';
import { CareerMap } from './ui/CareerMap';
import { DrivingHUD } from './ui/DrivingHUD';
import { PauseModal, RunResultModal } from './ui/EndScreens';
import { Garage } from './ui/Garage';
import { MainMenu } from './ui/MainMenu';
import { ModeSelect } from './ui/ModeSelect';
import { RotateOverlay, WebGLContextBanner } from './ui/RotateOverlay';
import { SettingsModal } from './ui/SettingsModal';
import { AchievementsModal, DailyRewardModal, ShopModal } from './ui/ShopAndDaily';
import { SplashLoading } from './ui/SplashLoading';

type ScreenName =
  | 'splash'
  | 'menu'
  | 'career'
  | 'modes'
  | 'garage'
  | 'shop'
  | 'daily'
  | 'achievements'
  | 'settings'
  | 'driving';

const INITIAL_HUD: HUDState = {
  speedKmh: 0,
  rpm: 900,
  gear: 'D',
  autoGearNum: 1,
  nitro: 100,
  health: 100,
  timeRemaining: 60,
  elapsedTime: 0,
  objectiveLabel: '',
  objectiveProgress: '',
  score: 0,
  coinsInRun: 0,
  comboCount: 1,
  comboTimer: 0,
  wrongWay: false,
  collisionFlash: 0,
  cameraMode: 'chase',
  fps: 60,
  activeQuality: 'medium',
  playerX: 0,
  playerZ: 0,
  playerHeading: 0,
  targetX: 0,
  targetZ: -100,
  blips: [],
  popups: [],
  countdown: 3,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef<SaveData>(save);
  const [screen, setScreen] = useState<ScreenName>('splash');
  const [returnScreen, setReturnScreen] = useState<ScreenName>('menu');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [previewCarId, setPreviewCarId] = useState<string>(save.selectedCarId);

  const [hud, setHud] = useState<HUDState>(INITIAL_HUD);
  const [paused, setPaused] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSessionConfig | null>(null);
  const activeSessionRef = useRef<ActiveSessionConfig | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      saveRef.current = next;
      persistSave(next);
      engineRef.current?.applySettings(next);
      return next;
    });
  }, []);

  // Attempt IndexedDB recovery if localStorage was cleared
  useEffect(() => {
    void restoreFromIndexedDBIfEmpty().then((recovered) => {
      if (recovered) {
        saveRef.current = recovered;
        setSave(recovered);
        setPreviewCarId(recovered.selectedCarId);
        engineRef.current?.applySettings(recovered);
      }
    });
  }, []);

  // Unlock WebAudio on first user gesture anywhere
  useEffect(() => {
    const unlockOnce = () => {
      soundEngine.unlock();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce);
    window.addEventListener('keydown', unlockOnce);
    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
  }, []);

  const handleRunEnd = useCallback(
    (rawResult: RunResult) => {
      const eng = engineRef.current;
      const cfg = activeSessionRef.current;
      const distKm = eng ? eng.getDistanceDrivenKm() : 0;
      const maxCombo = eng ? eng.getMaxComboInRun() : 1;
      const dropped = eng ? eng.getPassengersDroppedInRun() : 0;
      const ghostSamples = eng ? eng.getLatestGhostSamples() : [];

      let finalResult = { ...rawResult };

      updateSave((prev) => {
        let next: SaveData = {
          ...prev,
          coins: prev.coins + rawResult.coinsEarned,
          gems: prev.gems + rawResult.gemsEarned,
          stats: {
            ...prev.stats,
            totalDistanceKm: prev.stats.totalDistanceKm + distKm,
            totalRacesFinished: prev.stats.totalRacesFinished + 1,
            totalWins: prev.stats.totalWins + (rawResult.victory ? 1 : 0),
            totalDriftPoints: prev.stats.totalDriftPoints + rawResult.driftPoints,
            totalNearMisses: prev.stats.totalNearMisses + rawResult.nearMisses,
            totalCoinsCollected: prev.stats.totalCoinsCollected + Math.round(rawResult.coinsEarned / 25),
            totalPassengersDropped: prev.stats.totalPassengersDropped + dropped,
            totalDeliveriesCompleted:
              prev.stats.totalDeliveriesCompleted + (rawResult.victory && rawResult.mode === 'delivery_run' ? 1 : 0),
            totalPursuitsEscaped:
              prev.stats.totalPursuitsEscaped + (rawResult.victory && rawResult.mode === 'chase_escape' ? 1 : 0),
            totalParkingCleared:
              prev.stats.totalParkingCleared + (rawResult.victory && rawResult.mode === 'parking_challenge' ? 1 : 0),
            extremeWins:
              prev.stats.extremeWins + (rawResult.victory && rawResult.difficulty === 'extreme' ? 1 : 0),
            maxCombo: Math.max(prev.stats.maxCombo, maxCombo),
            cleanRaces: prev.stats.cleanRaces + (rawResult.victory && rawResult.damageTakenPct < 10 ? 1 : 0),
            bossLevelsCleared:
              prev.stats.bossLevelsCleared +
              (rawResult.victory && cfg?.levelDef?.isBoss && !(prev.careerStars[cfg.levelDef.id] > 0) ? 1 : 0),
          },
        };

        // Career level progression & stars
        if (rawResult.victory && rawResult.levelId) {
          const prevStars = next.careerStars[rawResult.levelId] || 0;
          const bestStars = Math.max(prevStars, rawResult.stars);
          next.careerStars = { ...next.careerStars, [rawResult.levelId]: bestStars };
          next.stats.totalStarsEarned = Object.values(next.careerStars).reduce((a, b) => a + b, 0);
          if (rawResult.levelId >= next.careerUnlockedLevel && rawResult.levelId < 60) {
            next.careerUnlockedLevel = rawResult.levelId + 1;
          }
        }

        // Daily / Weekly completion
        if (rawResult.victory && cfg?.isDailyChallenge) {
          const today = getTodayDateString();
          if (next.dailyChallengeCompletedDate !== today) {
            next.dailyChallengeCompletedDate = today;
            next.dailyChallengeStreak += 1;
            next.stats.dailyChallengesDone += 1;
          }
        }
        if (rawResult.victory && cfg?.isWeeklyEvent) {
          next.weeklyEventCompletedWeek = getWeeklyEventSpec().weekStr;
        }

        // Mode personal best & Time Trial Ghost saving
        const bestUpd = updateModeBest(next, rawResult.mode, rawResult.score);
        next = bestUpd.save;
        finalResult.isNewBest = bestUpd.isNewBest;

        if (rawResult.victory && rawResult.mode === 'time_trial' && ghostSamples.length > 5) {
          const ghostKey = rawResult.levelId ? `career_${rawResult.levelId}` : 'mode_time_trial';
          if (bestUpd.isNewBest || !next.ghosts[ghostKey]) {
            next.ghosts = { ...next.ghosts, [ghostKey]: ghostSamples };
          }
        }

        const xpRes = addXpAndCheckLevelUp(next, rawResult.xpEarned);
        next = xpRes.save;

        const achRes = evaluateAchievements(next);
        next = achRes.save;
        finalResult.newlyUnlockedAchievements = achRes.newlyUnlocked;

        return next;
      });

      setRunResult(finalResult);
    },
    [updateSave],
  );

  // Initialize Three.js Engine once
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const eng = new GameEngine(el, saveRef.current, {
      onHudUpdate: (h) => {
        setHud(h);
        // Track highest speed live
        if (h.speedKmh > saveRef.current.stats.highestSpeedKmh) {
          saveRef.current.stats.highestSpeedKmh = h.speedKmh;
        }
      },
      onRunEnd: handleRunEnd,
      onContextLost: setContextLost,
      onCameraChange: (cam: CameraMode) => {
        setHud((prev) => ({ ...prev, cameraMode: cam }));
      },
      onPauseToggle: () => {
        setPaused((p) => {
          const next = !p;
          eng.setPaused(next);
          return next;
        });
      },
    });
    engineRef.current = eng;

    return () => {
      eng.dispose();
      engineRef.current = null;
    };
  }, [handleRunEnd]);

  const launchSession = useCallback((cfg: ActiveSessionConfig) => {
    const s = saveRef.current;
    const car = getCarById(s.selectedCarId);
    const cust = s.carCustomizations[car.id] || {
      color: car.defaultColor,
      finish: 'gloss',
      wheelStyle: 'stock',
      spoiler: 'none',
      underglow: 'none',
    };
    const upg = s.carUpgrades[car.id] || DEFAULT_UPGRADES;
    const ghostKey = cfg.levelDef ? `career_${cfg.levelDef.id}` : 'mode_time_trial';
    const savedGhost = s.ghosts[ghostKey];

    setActiveSession(cfg);
    activeSessionRef.current = cfg;
    setRunResult(null);
    setPaused(false);
    setScreen('driving');
    void requestLandscapeAndFullscreen();

    engineRef.current?.startDrivingSession(cfg, car.id, cust, upg, savedGhost);
  }, []);

  const launchCareerLevel = (lvl: LevelDef) => {
    launchSession({
      mode: lvl.mode,
      levelDef: lvl,
      difficulty,
      seed: lvl.seed,
      weather: lvl.weather,
      timeOfDay: lvl.timeOfDay,
      trafficDensity: lvl.trafficDensity,
      pursuerCount: lvl.pursuerCount,
      hasMovingHazards: lvl.hasMovingHazards,
      timeLimitSec: lvl.timeLimitSec,
      targetCount: lvl.targetCount,
      routeLength: lvl.routeLength,
      title: `L${lvl.id}: ${lvl.title}`,
      objectiveText: lvl.objectiveText,
      tutorialTip: lvl.tutorialTip,
    });
  };

  const launchFreeMode = (mode: ModeId, weather: WeatherType, timeOfDay: TimeOfDay) => {
    if (mode === 'daily_challenge') {
      const daily = getDailyChallengeSpec();
      launchSession({
        mode: daily.mode,
        difficulty,
        seed: daily.seed,
        weather: daily.weather,
        timeOfDay: daily.timeOfDay,
        trafficDensity: 0.65,
        pursuerCount: daily.mode === 'chase_escape' ? 2 : 0,
        hasMovingHazards: true,
        timeLimitSec: daily.timeLimitSec,
        targetCount: daily.targetCount,
        routeLength: daily.routeLength,
        title: daily.title,
        objectiveText: 'Complete today’s fixed-seed Daily Challenge!',
        isDailyChallenge: true,
      });
      return;
    }

    const seed = Math.floor(Date.now() % 100000) + 500;
    launchSession({
      mode,
      difficulty,
      seed,
      weather,
      timeOfDay,
      trafficDensity: mode === 'endless_traffic' ? 0.78 : 0.55,
      pursuerCount: mode === 'chase_escape' ? 2 : 0,
      hasMovingHazards: difficulty === 'hard' || difficulty === 'extreme',
      timeLimitSec: mode === 'parking_challenge' ? 60 : mode === 'drift_zone' ? 75 : 95,
      targetCount: mode === 'drift_zone' ? 2400 : mode === 'taxi_master' ? 3 : 6,
      routeLength: 1300,
      title: mode.replace('_', ' ').toUpperCase(),
      objectiveText: 'Free Play Challenge',
    });
  };

  const launchWeeklyEvent = () => {
    const wk = getWeeklyEventSpec();
    launchSession({
      mode: wk.mode,
      difficulty,
      seed: wk.seed,
      weather: wk.weather,
      timeOfDay: wk.timeOfDay,
      trafficDensity: 0.72,
      pursuerCount: wk.mode === 'chase_escape' ? 3 : 0,
      hasMovingHazards: true,
      timeLimitSec: 95,
      targetCount: wk.mode === 'drift_zone' ? 3200 : 6,
      routeLength: 1500,
      title: wk.title,
      objectiveText: wk.subtitle,
      isWeeklyEvent: true,
    });
  };

  const exitToShowroom = (targetScreen: ScreenName) => {
    setPaused(false);
    setRunResult(null);
    setScreen(targetScreen);
    const s = saveRef.current;
    setPreviewCarId(s.selectedCarId);
    engineRef.current?.enterShowroom(s.selectedCarId, s.carCustomizations[s.selectedCarId]);
  };

  // --- Android: back button + auto-pause when app goes to background ---
  const backHandlerRef = useRef<() => void>(() => {});
  const backgroundHandlerRef = useRef<(active: boolean) => void>(() => {});

  useEffect(() => {
    const offBack = onNativeBack(() => backHandlerRef.current());
    const offActive = onAppActiveChange((active) => backgroundHandlerRef.current(active));
    return () => {
      offBack();
      offActive();
    };
  }, []);

  backHandlerRef.current = () => {
    switch (screen) {
      case 'splash':
        return;
      case 'menu':
        exitNativeApp();
        return;
      case 'driving':
        if (!runResult) {
          const next = !paused;
          setPaused(next);
          engineRef.current?.setPaused(next);
        }
        return;
      case 'settings':
        setScreen(returnScreen);
        return;
      case 'garage':
        exitToShowroom('menu');
        return;
      default:
        setScreen('menu');
    }
  };

  backgroundHandlerRef.current = (active: boolean) => {
    if (!active) {
      soundEngine.suspend();
      if (screen === 'driving' && !paused && !runResult) {
        setPaused(true);
        engineRef.current?.setPaused(true);
      }
    } else {
      soundEngine.resume();
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0F172A]">
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {screen === 'splash' && (
        <SplashLoading lang={save.settings.language} onComplete={() => setScreen('menu')} />
      )}

      {screen === 'menu' && (
        <MainMenu
          save={save}
          onOpenCareer={() => setScreen('career')}
          onOpenModes={() => setScreen('modes')}
          onOpenGarage={() => {
            setPreviewCarId(save.selectedCarId);
            engineRef.current?.updateShowroomCar(save.selectedCarId, save.carCustomizations[save.selectedCarId]);
            setScreen('garage');
          }}
          onOpenShop={() => setScreen('shop')}
          onOpenDaily={() => setScreen('daily')}
          onOpenAchievements={() => setScreen('achievements')}
          onOpenSettings={() => {
            setReturnScreen('menu');
            setScreen('settings');
          }}
          onQuickDaily={() => launchFreeMode('daily_challenge', 'clear', 'day')}
          onQuickWeekly={launchWeeklyEvent}
        />
      )}

      {screen === 'career' && (
        <CareerMap
          save={save}
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          onStartLevel={launchCareerLevel}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'modes' && (
        <ModeSelect
          save={save}
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          onLaunchMode={launchFreeMode}
          onOpenCareer={() => setScreen('career')}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'garage' && (
        <Garage
          save={save}
          previewCarId={previewCarId}
          onSelectPreviewCar={(id, cust) => {
            setPreviewCarId(id);
            engineRef.current?.updateShowroomCar(id, cust);
          }}
          onEquipCar={(id) => {
            updateSave((prev) => ({ ...prev, selectedCarId: id }));
          }}
          onBuyCar={(id) => {
            const car = getCarById(id);
            updateSave((prev) => {
              if (prev.ownedCars.includes(id)) return prev;
              if (prev.coins < car.priceCoins || prev.gems < car.priceGems || prev.level < car.unlockLevel) {
                return prev;
              }
              const nextOwned = [...prev.ownedCars, id];
              const next: SaveData = {
                ...prev,
                coins: prev.coins - car.priceCoins,
                gems: prev.gems - car.priceGems,
                ownedCars: nextOwned,
                selectedCarId: id,
                stats: { ...prev.stats, carsOwnedCount: nextOwned.length },
              };
              return evaluateAchievements(next).save;
            });
          }}
          onUpdateCustomization={(carId, cust: CarCustomization, costCoins = 0, costGems = 0) => {
            engineRef.current?.updateShowroomCar(carId, cust);
            updateSave((prev) => {
              if (prev.coins < costCoins || prev.gems < costGems) return prev;
              const unlockedColors = prev.unlockedColors.includes(cust.color)
                ? prev.unlockedColors
                : [...prev.unlockedColors, cust.color];
              const unlockedWheels = prev.unlockedWheels.includes(cust.wheelStyle)
                ? prev.unlockedWheels
                : [...prev.unlockedWheels, cust.wheelStyle];
              const unlockedSpoilers = prev.unlockedSpoilers.includes(cust.spoiler)
                ? prev.unlockedSpoilers
                : [...prev.unlockedSpoilers, cust.spoiler];

              return {
                ...prev,
                coins: prev.coins - costCoins,
                gems: prev.gems - costGems,
                unlockedColors,
                unlockedWheels,
                unlockedSpoilers,
                carCustomizations: { ...prev.carCustomizations, [carId]: cust },
              };
            });
          }}
          onBuyUpgrade={(carId, key: UpgradeKey, costCoins: number) => {
            updateSave((prev) => {
              if (prev.coins < costCoins) return prev;
              const cur = prev.carUpgrades[carId] || { ...DEFAULT_UPGRADES };
              if (cur[key] >= 5) return prev;
              const next: SaveData = {
                ...prev,
                coins: prev.coins - costCoins,
                carUpgrades: {
                  ...prev.carUpgrades,
                  [carId]: { ...cur, [key]: cur[key] + 1 },
                },
                stats: { ...prev.stats, totalUpgradesBought: prev.stats.totalUpgradesBought + 1 },
              };
              return evaluateAchievements(next).save;
            });
          }}
          onBack={() => exitToShowroom('menu')}
        />
      )}

      {screen === 'shop' && (
        <ShopModal
          save={save}
          onExchangeGemsForCoins={(gemsCost, coinsGain) => {
            updateSave((prev) =>
              prev.gems >= gemsCost
                ? { ...prev, gems: prev.gems - gemsCost, coins: prev.coins + coinsGain }
                : prev,
            );
          }}
          onUnlockColor={(hex, cost) => {
            updateSave((prev) =>
              prev.coins >= cost && !prev.unlockedColors.includes(hex)
                ? { ...prev, coins: prev.coins - cost, unlockedColors: [...prev.unlockedColors, hex] }
                : prev,
            );
          }}
          onUnlockWheel={(id: WheelStyle, cost) => {
            updateSave((prev) =>
              prev.coins >= cost && !prev.unlockedWheels.includes(id)
                ? { ...prev, coins: prev.coins - cost, unlockedWheels: [...prev.unlockedWheels, id] }
                : prev,
            );
          }}
          onUnlockSpoiler={(id: SpoilerStyle, cost) => {
            updateSave((prev) =>
              prev.coins >= cost && !prev.unlockedSpoilers.includes(id)
                ? { ...prev, coins: prev.coins - cost, unlockedSpoilers: [...prev.unlockedSpoilers, id] }
                : prev,
            );
          }}
          onRewardedAdGrant={() => {
            updateSave((prev) => ({ ...prev, coins: prev.coins + 300 }));
          }}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'daily' && (
        <DailyRewardModal
          save={save}
          onClaimDaily={(coins, gems) => {
            const today = getTodayDateString();
            updateSave((prev) => ({
              ...prev,
              coins: prev.coins + coins,
              gems: prev.gems + gems,
              dailyRewardDay: (prev.dailyRewardDay + 1) % 7,
              lastDailyRewardDate: today,
            }));
          }}
          onSpinReward={(coins, gems) => {
            const today = getTodayDateString();
            updateSave((prev) => ({
              ...prev,
              coins: prev.coins + coins,
              gems: prev.gems + gems,
              lastSpinDate: today,
            }));
          }}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'achievements' && (
        <AchievementsModal save={save} onBack={() => setScreen('menu')} />
      )}

      {screen === 'settings' && engineRef.current && (
        <SettingsModal
          save={save}
          inputMgr={engineRef.current.input}
          onUpdateSettings={(nextSettings: SettingsData) => {
            updateSave((prev) => ({ ...prev, settings: nextSettings }));
          }}
          onImportSave={(json) => {
            const imported = importSaveJson(json);
            saveRef.current = imported;
            setSave(imported);
            setPreviewCarId(imported.selectedCarId);
            engineRef.current?.applySettings(imported);
            engineRef.current?.updateShowroomCar(
              imported.selectedCarId,
              imported.carCustomizations[imported.selectedCarId],
            );
          }}
          onResetProgress={() => {
            const fresh = createDefaultSave();
            saveRef.current = fresh;
            persistSave(fresh);
            setSave(fresh);
            setPreviewCarId(fresh.selectedCarId);
            engineRef.current?.applySettings(fresh);
            engineRef.current?.updateShowroomCar(fresh.selectedCarId, fresh.carCustomizations[fresh.selectedCarId]);
          }}
          onBack={() => setScreen(returnScreen)}
        />
      )}

      {screen === 'driving' && engineRef.current && (
        <>
          <DrivingHUD
            hud={hud}
            mode={activeSession?.mode || 'rush_hour'}
            settings={save.settings}
            inputMgr={engineRef.current.input}
            onCameraToggle={() => {
              const order: CameraMode[] = ['chase', 'bumper', 'topdown'];
              const next = order[(order.indexOf(hud.cameraMode) + 1) % order.length];
              engineRef.current?.setCameraMode(next);
              setHud((prev) => ({ ...prev, cameraMode: next }));
              soundEngine.playUiClick();
            }}
            onPause={() => {
              setPaused(true);
              engineRef.current?.setPaused(true);
            }}
            onBankEndless={() => engineRef.current?.endEndlessRunEarly()}
          />

          {paused && !runResult && (
            <PauseModal
              lang={save.settings.language}
              onResume={() => {
                setPaused(false);
                engineRef.current?.setPaused(false);
              }}
              onRestart={() => {
                if (activeSession) launchSession(activeSession);
              }}
              onSettings={() => {
                setReturnScreen('driving');
                setScreen('settings');
              }}
              onQuit={() => exitToShowroom('menu')}
            />
          )}

          {runResult && (
            <RunResultModal
              result={runResult}
              lang={save.settings.language}
              hasNextLevel={Boolean(runResult.levelId && runResult.levelId < 60)}
              onNextLevel={() => {
                if (runResult.levelId && runResult.levelId < 60) {
                  launchCareerLevel(getCareerLevel(runResult.levelId + 1));
                }
              }}
              onRetry={() => {
                if (activeSession) launchSession(activeSession);
              }}
              onGarage={() => exitToShowroom('garage')}
              onMenu={() => exitToShowroom('menu')}
            />
          )}
        </>
      )}

      <RotateOverlay lang={save.settings.language} />
      <WebGLContextBanner visible={contextLost} />
    </div>
  );
}
