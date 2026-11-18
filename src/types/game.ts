export type CarClass =
  | 'Hatchback'
  | 'Sedan'
  | 'Taxi'
  | 'SUV'
  | 'Pickup'
  | 'Sports'
  | 'Supercar'
  | 'Truck-lite';

export type PaintFinish = 'gloss' | 'metallic' | 'matte' | 'pearl';
export type WheelStyle = 'stock' | 'sport_5' | 'aero_disc' | 'offroad_bead';
export type SpoilerStyle = 'none' | 'lip' | 'gt_wing' | 'twin_aero';

export type UpgradeKey =
  | 'engine'
  | 'gearbox'
  | 'brakes'
  | 'tires'
  | 'suspension'
  | 'nitro'
  | 'armor';

export type UpgradeLevels = Record<UpgradeKey, number>;

export interface CarCustomization {
  color: string;
  finish: PaintFinish;
  wheelStyle: WheelStyle;
  spoiler: SpoilerStyle;
  underglow: string; // 'none' or hex color
}

export interface CarStats {
  topSpeed: number; // km/h base
  acceleration: number; // 0-100 rating & m/s^2 factor
  handling: number; // 0-100 rating
  braking: number; // 0-100 rating
  nitro: number; // 0-100 rating
  durability: number; // 0-100 rating (max HP scale)
}

export interface CarDef {
  id: string;
  name: string;
  carClass: CarClass;
  tagline: string;
  priceCoins: number;
  priceGems: number;
  unlockLevel: number;
  defaultColor: string;
  dimensions: { width: number; height: number; length: number };
  stats: CarStats;
}

export type ModeId =
  | 'career'
  | 'rush_hour'
  | 'taxi_master'
  | 'parking_challenge'
  | 'time_trial'
  | 'chase_escape'
  | 'delivery_run'
  | 'drift_zone'
  | 'endless_traffic'
  | 'daily_challenge';

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'extreme';

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'fog';
export type TimeOfDay = 'sunrise' | 'morning' | 'afternoon' | 'day' | 'sunset' | 'night';

export type GearMode = 'P' | 'R' | 'N' | 'D';
export type CameraMode = 'chase' | 'bumper' | 'topdown';
export type ControlScheme = 'wheel' | 'tilt' | 'arrows';
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra' | 'auto';
export type ActiveQuality = 'low' | 'medium' | 'high' | 'ultra';
export type SpeedUnit = 'kmh' | 'mph';
export type LanguageCode = 'en' | 'ur';

export interface StarRules {
  oneStar: string;
  twoStarTimeSec?: number;
  threeStarTimeSec?: number;
  twoStarMaxDamagePct?: number;
  threeStarMaxDamagePct?: number;
  twoStarMinScore?: number;
  threeStarMinScore?: number;
  threeStarCoinsRequired?: number;
  description2: string;
  description3: string;
}

export interface LevelDef {
  id: number; // 1..60
  world: number; // 1..6
  worldName: string;
  indexInWorld: number; // 1..10
  isBoss: boolean;
  title: string;
  objectiveText: string;
  mode: ModeId;
  seed: number;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  trafficDensity: number; // 0..1
  timeLimitSec: number;
  targetCount: number; // checkpoints, passengers, drift points, distance, etc.
  routeLength: number; // meters
  hasMovingHazards: boolean;
  pursuerCount: number;
  tutorialTip?: string;
  starRules: StarRules;
  rewardCoins: number;
  rewardGems: number;
  rewardXp: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: 'driving' | 'career' | 'modes' | 'garage' | 'mastery';
  target: number;
  rewardCoins: number;
  rewardGems: number;
  statKey: keyof PlayerLifetimeStats;
}

export interface PlayerLifetimeStats {
  totalDistanceKm: number;
  totalRacesFinished: number;
  totalWins: number;
  totalDriftPoints: number;
  totalNearMisses: number;
  totalCoinsCollected: number;
  totalPassengersDropped: number;
  totalDeliveriesCompleted: number;
  totalPursuitsEscaped: number;
  totalParkingCleared: number;
  totalNitroUsedSec: number;
  totalUpgradesBought: number;
  carsOwnedCount: number;
  totalStarsEarned: number;
  highestSpeedKmh: number;
  extremeWins: number;
  dailyChallengesDone: number;
  maxCombo: number;
  cleanRaces: number;
  bossLevelsCleared: number;
}

export interface SettingsData {
  graphics: GraphicsQuality;
  resolutionScale: number; // 0.6 .. 1.0
  showFps: boolean;
  controls: ControlScheme;
  sensitivity: number; // 0.5 .. 2.0
  buttonSize: number; // 0.8 .. 1.3
  buttonOpacity: number; // 0.4 .. 1.0
  tiltOffset: number; // radians calibration
  units: SpeedUnit;
  musicVolume: number; // 0 .. 1
  sfxVolume: number; // 0 .. 1
  engineVolume: number; // 0 .. 1
  vibration: boolean;
  language: LanguageCode;
}

export interface GhostSample {
  t: number;
  x: number;
  y: number;
  z: number;
  ry: number;
}

export interface SaveData {
  version: number;
  coins: number;
  gems: number;
  xp: number;
  level: number;
  selectedCarId: string;
  ownedCars: string[];
  unlockedColors: string[];
  unlockedWheels: WheelStyle[];
  unlockedSpoilers: SpoilerStyle[];
  carUpgrades: Record<string, UpgradeLevels>;
  carCustomizations: Record<string, CarCustomization>;
  careerUnlockedLevel: number; // 1..60
  careerStars: Record<number, number>; // levelId -> 1..3
  modeBests: Partial<Record<ModeId, number>>;
  unlockedModes: ModeId[];
  achievementsClaimed: string[];
  stats: PlayerLifetimeStats;
  settings: SettingsData;
  dailyRewardDay: number; // 0..6
  lastDailyRewardDate: string; // YYYY-MM-DD
  lastSpinDate: string;
  dailyChallengeCompletedDate: string;
  dailyChallengeStreak: number;
  weeklyEventCompletedWeek: string;
  ghosts: Record<string, GhostSample[]>;
}

export interface FloatingPopup {
  id: number;
  text: string;
  color: string;
  subtext?: string;
}

export interface MinimapBlip {
  x: number;
  z: number;
  type: 'target' | 'checkpoint' | 'traffic' | 'pursuer' | 'pickup' | 'hazard';
}

export interface HUDState {
  speedKmh: number;
  rpm: number; // 800..8000
  gear: GearMode;
  autoGearNum: number; // 1..5
  nitro: number; // 0..100
  health: number; // 0..100
  cargoHealth?: number; // 0..100
  timeRemaining: number;
  elapsedTime: number;
  objectiveLabel: string;
  objectiveProgress: string;
  score: number;
  coinsInRun: number;
  comboCount: number;
  comboTimer: number; // 0..1
  wrongWay: boolean;
  collisionFlash: number; // 0..1
  cameraMode: CameraMode;
  fps: number;
  activeQuality: ActiveQuality;
  tutorialBanner?: string;
  parkingSensors?: {
    front: number;
    rear: number;
    left: number;
    right: number;
    aligned: boolean;
    inside: boolean;
  };
  playerX: number;
  playerZ: number;
  playerHeading: number;
  targetX: number;
  targetZ: number;
  blips: MinimapBlip[];
  popups: FloatingPopup[];
  countdown: number; // 3, 2, 1, 0 (GO), -1 (active)
}

export interface RunResult {
  victory: boolean;
  mode: ModeId;
  levelId?: number;
  difficulty: DifficultyId;
  stars: number; // 0..3
  reason: string;
  tip: string;
  elapsedTime: number;
  score: number;
  damageTakenPct: number;
  coinsEarned: number;
  gemsEarned: number;
  xpEarned: number;
  nearMisses: number;
  driftPoints: number;
  isNewBest: boolean;
  newlyUnlockedAchievements: string[];
}
