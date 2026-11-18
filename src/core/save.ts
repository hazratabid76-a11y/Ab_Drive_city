import { ACHIEVEMENTS } from '../data/achievements';
import { CARS } from '../data/cars';
import { getXpForLevel } from '../data/economy';
import { DEFAULT_UPGRADES } from '../data/upgrades';
import { CarCustomization, ModeId, SaveData, SettingsData } from '../types/game';

const STORAGE_KEY = 'ab_drive_city_save_v1';
const IDB_NAME = 'ab_drive_city_db';
const IDB_STORE = 'saves';
const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS: SettingsData = {
  graphics: 'auto',
  resolutionScale: 1.0,
  showFps: false,
  controls: 'wheel',
  sensitivity: 1.0,
  buttonSize: 1.0,
  buttonOpacity: 0.85,
  tiltOffset: 0,
  units: 'kmh',
  musicVolume: 0.45,
  sfxVolume: 0.75,
  engineVolume: 0.65,
  vibration: true,
  language: 'en',
};

export function createDefaultSave(): SaveData {
  const starterCar = CARS[0];
  const customizations: Record<string, CarCustomization> = {};
  const upgrades: Record<string, typeof DEFAULT_UPGRADES> = {};
  for (const c of CARS) {
    customizations[c.id] = {
      color: c.defaultColor,
      finish: 'gloss',
      wheelStyle: 'stock',
      spoiler: 'none',
      underglow: 'none',
    };
    upgrades[c.id] = { ...DEFAULT_UPGRADES };
  }

  return {
    version: SAVE_VERSION,
    coins: 1200,
    gems: 10,
    xp: 0,
    level: 1,
    selectedCarId: starterCar.id,
    ownedCars: [starterCar.id],
    unlockedColors: ['#FF8A00', '#FFC93C', '#14B8A6', '#F8FAFC'],
    unlockedWheels: ['stock'],
    unlockedSpoilers: ['none'],
    carUpgrades: upgrades,
    carCustomizations: customizations,
    careerUnlockedLevel: 1,
    careerStars: {},
    modeBests: {},
    unlockedModes: [
      'career',
      'rush_hour',
      'taxi_master',
      'parking_challenge',
      'time_trial',
      'chase_escape',
      'delivery_run',
      'drift_zone',
      'endless_traffic',
      'daily_challenge',
    ],
    achievementsClaimed: [],
    stats: {
      totalDistanceKm: 0,
      totalRacesFinished: 0,
      totalWins: 0,
      totalDriftPoints: 0,
      totalNearMisses: 0,
      totalCoinsCollected: 0,
      totalPassengersDropped: 0,
      totalDeliveriesCompleted: 0,
      totalPursuitsEscaped: 0,
      totalParkingCleared: 0,
      totalNitroUsedSec: 0,
      totalUpgradesBought: 0,
      carsOwnedCount: 1,
      totalStarsEarned: 0,
      highestSpeedKmh: 0,
      extremeWins: 0,
      dailyChallengesDone: 0,
      maxCombo: 0,
      cleanRaces: 0,
      bossLevelsCleared: 0,
    },
    settings: { ...DEFAULT_SETTINGS },
    dailyRewardDay: 0,
    lastDailyRewardDate: '',
    lastSpinDate: '',
    dailyChallengeCompletedDate: '',
    dailyChallengeStreak: 0,
    weeklyEventCompletedWeek: '',
    ghosts: {},
  };
}

function migrateSave(raw: Partial<SaveData>): SaveData {
  const def = createDefaultSave();
  const merged: SaveData = {
    ...def,
    ...raw,
    version: SAVE_VERSION,
    stats: { ...def.stats, ...(raw.stats || {}) },
    settings: { ...def.settings, ...(raw.settings || {}) },
    carUpgrades: { ...def.carUpgrades, ...(raw.carUpgrades || {}) },
    carCustomizations: { ...def.carCustomizations, ...(raw.carCustomizations || {}) },
    careerStars: { ...(raw.careerStars || {}) },
    modeBests: { ...(raw.modeBests || {}) },
    ghosts: { ...(raw.ghosts || {}) },
  };
  if (!merged.ownedCars.length) merged.ownedCars = [CARS[0].id];
  if (!merged.ownedCars.includes(merged.selectedCarId)) {
    merged.selectedCarId = merged.ownedCars[0];
  }
  merged.stats.carsOwnedCount = merged.ownedCars.length;
  merged.stats.totalStarsEarned = Object.values(merged.careerStars).reduce((a, b) => a + b, 0);
  return merged;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return migrateSave(JSON.parse(raw));
    }
  } catch {
    // Fallback to default
  }
  return createDefaultSave();
}

export function persistSave(data: SaveData): void {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    void mirrorToIndexedDB(json);
  } catch {
    // Ignore storage quota errors
  }
}

async function mirrorToIndexedDB(json: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(json, 'latest');
    };
  } catch {
    // Non-fatal
  }
}

export async function restoreFromIndexedDBIfEmpty(): Promise<SaveData | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return null;
    return await new Promise((resolve) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readonly');
        const getReq = tx.objectStore(IDB_STORE).get('latest');
        getReq.onsuccess = () => {
          if (typeof getReq.result === 'string') {
            try {
              const parsed = migrateSave(JSON.parse(getReq.result));
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
              resolve(parsed);
              return;
            } catch {
              resolve(null);
            }
          }
          resolve(null);
        };
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function exportSaveJson(save: SaveData): string {
  return JSON.stringify(save, null, 2);
}

export function importSaveJson(jsonText: string): SaveData {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ownedCars)) {
    throw new Error('Invalid AB Drive City save file');
  }
  const migrated = migrateSave(parsed);
  persistSave(migrated);
  return migrated;
}

export function addXpAndCheckLevelUp(save: SaveData, xpGain: number): { save: SaveData; leveledUp: boolean } {
  let xp = save.xp + Math.max(0, Math.round(xpGain));
  let level = save.level;
  let coins = save.coins;
  let gems = save.gems;
  let leveledUp = false;

  while (level < 50 && xp >= getXpForLevel(level)) {
    xp -= getXpForLevel(level);
    level += 1;
    leveledUp = true;
    coins += 250 + level * 40;
    if (level % 5 === 0) gems += 5;
  }

  return {
    save: { ...save, xp, level, coins, gems },
    leveledUp,
  };
}

export function evaluateAchievements(save: SaveData): { save: SaveData; newlyUnlocked: string[] } {
  const newlyUnlocked: string[] = [];
  let coins = save.coins;
  let gems = save.gems;
  const claimed = [...save.achievementsClaimed];

  for (const ach of ACHIEVEMENTS) {
    if (claimed.includes(ach.id)) continue;
    const val = save.stats[ach.statKey];
    if (val >= ach.target) {
      claimed.push(ach.id);
      newlyUnlocked.push(ach.id);
      coins += ach.rewardCoins;
      gems += ach.rewardGems;
    }
  }

  if (newlyUnlocked.length === 0) return { save, newlyUnlocked };

  return {
    save: {
      ...save,
      coins,
      gems,
      achievementsClaimed: claimed,
    },
    newlyUnlocked,
  };
}

export function updateModeBest(save: SaveData, mode: ModeId, score: number): { save: SaveData; isNewBest: boolean } {
  const prev = save.modeBests[mode] || 0;
  if (score > prev) {
    return {
      save: {
        ...save,
        modeBests: { ...save.modeBests, [mode]: Math.round(score) },
      },
      isNewBest: true,
    };
  }
  return { save, isNewBest: false };
}
