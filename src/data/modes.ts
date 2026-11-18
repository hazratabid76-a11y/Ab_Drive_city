import { ModeId } from '../types/game';

export interface ModeMeta {
  id: ModeId;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  bestLabel: string;
}

export const GAME_MODES: ModeMeta[] = [
  {
    id: 'career',
    name: 'Career Campaign',
    tagline: '60 Levels · 6 Worlds',
    description: 'Progress from Sunbelt District to Apex Metropolis across 60 handcrafted challenges and 6 world bosses.',
    accent: '#FF8A00',
    bestLabel: 'Stars',
  },
  {
    id: 'rush_hour',
    name: 'Rush Hour',
    tagline: 'Heavy Traffic Sprint',
    description: 'Weave through dense city traffic and reach the extraction beacon before the clock expires.',
    accent: '#FFC93C',
    bestLabel: 'Best Score',
  },
  {
    id: 'taxi_master',
    name: 'Taxi Master',
    tagline: 'Pickups & Smooth Tips',
    description: 'Pick up passengers at glowing stops and deliver them cleanly. Smooth driving earns 5-star tips.',
    accent: '#F59E0B',
    bestLabel: 'Best Score',
  },
  {
    id: 'parking_challenge',
    name: 'Parking Challenge',
    tagline: 'Precision Bay Maneuver',
    description: 'Navigate barriers and reverse or angle-park cleanly inside the sensor bay with strict damage limits.',
    accent: '#14B8A6',
    bestLabel: 'Best Score',
  },
  {
    id: 'time_trial',
    name: 'Time Trial',
    tagline: 'Checkpoints + Ghost Car',
    description: 'Race through sequential checkpoint gates and beat your locally saved Ghost Car personal best.',
    accent: '#38BDF8',
    bestLabel: 'Best Score',
  },
  {
    id: 'chase_escape',
    name: 'Chase / Escape',
    tagline: 'Outrun Interceptors',
    description: 'Evade relentless city interceptor units and survive until extraction without getting boxed in.',
    accent: '#EF4444',
    bestLabel: 'Best Score',
  },
  {
    id: 'delivery_run',
    name: 'Delivery Run',
    tagline: 'Fragile Cargo Haul',
    description: 'Transport delicate cargo across the city. Every bump and collision drains cargo integrity.',
    accent: '#10B981',
    bestLabel: 'Best Score',
  },
  {
    id: 'drift_zone',
    name: 'Drift Zone',
    tagline: 'Angle & Combo Multiplier',
    description: 'Chain high-angle drifts at speed to build massive combo multipliers before time runs out.',
    accent: '#A855F7',
    bestLabel: 'Best Drift',
  },
  {
    id: 'endless_traffic',
    name: 'Endless Traffic Racer',
    tagline: 'Near-Miss Survival',
    description: 'Endless highway & city survival. Thread near-misses for multipliers as traffic accelerates.',
    accent: '#FB7185',
    bestLabel: 'High Score',
  },
  {
    id: 'daily_challenge',
    name: 'Daily Challenge',
    tagline: 'Fixed Daily Seed + Streak',
    description: 'One seeded challenge every day with streak bonuses for consecutive daily completions.',
    accent: '#22D3EE',
    bestLabel: 'Streak',
  },
];
