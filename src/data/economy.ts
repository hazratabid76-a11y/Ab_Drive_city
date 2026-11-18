import { DifficultyId, ModeId, TimeOfDay, WeatherType } from '../types/game';

/**
 * Config flag for Rewarded-Ad Placeholder in Shop.
 * Disabled (OFF) by default per requirements; no real ads or payments exist.
 */
export const ENABLE_REWARDED_AD_PLACEHOLDER = false;

export interface DailyRewardItem {
  day: number;
  label: string;
  coins: number;
  gems: number;
}

export const DAILY_REWARD_CALENDAR: DailyRewardItem[] = [
  { day: 1, label: 'Day 1', coins: 400, gems: 0 },
  { day: 2, label: 'Day 2', coins: 650, gems: 2 },
  { day: 3, label: 'Day 3', coins: 900, gems: 3 },
  { day: 4, label: 'Day 4', coins: 1200, gems: 5 },
  { day: 5, label: 'Day 5', coins: 1600, gems: 6 },
  { day: 6, label: 'Day 6', coins: 2200, gems: 8 },
  { day: 7, label: 'Day 7 Jackpot', coins: 4000, gems: 20 },
];

export interface SpinWheelSlot {
  id: string;
  label: string;
  coins: number;
  gems: number;
  color: string;
}

export const SPIN_WHEEL_SLOTS: SpinWheelSlot[] = [
  { id: 's1', label: '300 Coins', coins: 300, gems: 0, color: '#FF8A00' },
  { id: 's2', label: '3 Gems', coins: 0, gems: 3, color: '#14B8A6' },
  { id: 's3', label: '750 Coins', coins: 750, gems: 0, color: '#FFC93C' },
  { id: 's4', label: '5 Gems', coins: 0, gems: 5, color: '#0F172A' },
  { id: 's5', label: '1,200 Coins', coins: 1200, gems: 0, color: '#FF8A00' },
  { id: 's6', label: '10 Gems', coins: 0, gems: 10, color: '#14B8A6' },
  { id: 's7', label: '500 Coins', coins: 500, gems: 0, color: '#FFC93C' },
  { id: 's8', label: '2,500 Jackpot', coins: 2500, gems: 8, color: '#EF4444' },
];

export const DIFFICULTY_CONFIG: Record<
  DifficultyId,
  {
    label: string;
    timerMult: number;
    trafficMult: number;
    damageMult: number;
    rewardMult: number;
    checkpointRefill: boolean;
    oneLife: boolean;
    description: string;
  }
> = {
  easy: {
    label: 'Easy',
    timerMult: 1.25,
    trafficMult: 0.7,
    damageMult: 0.7,
    rewardMult: 0.85,
    checkpointRefill: true,
    oneLife: false,
    description: 'Generous timers, light traffic, forgiving damage.',
  },
  normal: {
    label: 'Normal',
    timerMult: 1.0,
    trafficMult: 1.0,
    damageMult: 1.0,
    rewardMult: 1.0,
    checkpointRefill: true,
    oneLife: false,
    description: 'Balanced urban traffic and standard challenge timers.',
  },
  hard: {
    label: 'Hard',
    timerMult: 0.85,
    trafficMult: 1.35,
    damageMult: 1.35,
    rewardMult: 1.45,
    checkpointRefill: true,
    oneLife: false,
    description: 'Dense rush-hour traffic, tighter clocks, +45% rewards.',
  },
  extreme: {
    label: 'Extreme',
    timerMult: 0.72,
    trafficMult: 1.75,
    damageMult: 1.85,
    rewardMult: 2.2,
    checkpointRefill: false,
    oneLife: true,
    description: 'Very tight timers, no checkpoint refills, 1-life wreck, 2.2x rewards.',
  },
};

export function getXpForLevel(level: number): number {
  return Math.round(250 * Math.pow(level, 1.35));
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getIsoWeekString(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const week = Math.ceil((diff + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface DailyChallengeSpec {
  dateStr: string;
  seed: number;
  title: string;
  mode: ModeId;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  timeLimitSec: number;
  targetCount: number;
  routeLength: number;
  rewardCoins: number;
  rewardGems: number;
}

export function getDailyChallengeSpec(dateStr = getTodayDateString()): DailyChallengeSpec {
  let hash = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const seed = Math.abs(hash) % 1000000;
  const modes: ModeId[] = ['rush_hour', 'taxi_master', 'time_trial', 'chase_escape', 'delivery_run', 'drift_zone'];
  const weathers: WeatherType[] = ['clear', 'clear', 'cloudy', 'rain', 'fog'];
  const times: TimeOfDay[] = ['sunrise', 'morning', 'afternoon', 'day', 'sunset', 'night'];

  const mode = modes[seed % modes.length];
  const weather = weathers[(seed >> 3) % weathers.length];
  const timeOfDay = times[(seed >> 5) % times.length];

  return {
    dateStr,
    seed,
    title: `Daily Circuit · ${dateStr}`,
    mode,
    weather,
    timeOfDay,
    timeLimitSec: 95,
    targetCount: mode === 'drift_zone' ? 2800 : mode === 'taxi_master' ? 3 : 6,
    routeLength: 1400,
    rewardCoins: 1800,
    rewardGems: 12,
  };
}

export interface WeeklyEventSpec {
  weekStr: string;
  title: string;
  subtitle: string;
  mode: ModeId;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  seed: number;
  rewardCoins: number;
  rewardGems: number;
}

export function getWeeklyEventSpec(): WeeklyEventSpec {
  const weekStr = getIsoWeekString();
  let hash = 0;
  for (let i = 0; i < weekStr.length; i++) {
    hash = (hash * 31 + weekStr.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash) % 900000 + 10000;
  const titles = [
    'Harbor Midnight Blitz',
    'Golden Hour Drift Grand Prix',
    'Monsoon Express Delivery',
    'Metro Interceptor Showdown',
  ];
  const modes: ModeId[] = ['time_trial', 'drift_zone', 'delivery_run', 'chase_escape'];
  const idx = seed % titles.length;
  return {
    weekStr,
    title: titles[idx],
    subtitle: 'Limited-time weekly championship event',
    mode: modes[idx],
    weather: idx === 2 ? 'rain' : 'clear',
    timeOfDay: idx === 0 ? 'night' : idx === 1 ? 'sunset' : 'day',
    seed,
    rewardCoins: 3500,
    rewardGems: 25,
  };
}
