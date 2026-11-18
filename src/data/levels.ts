import { LevelDef, ModeId, TimeOfDay, WeatherType } from '../types/game';

export interface WorldInfo {
  world: number;
  name: string;
  subtitle: string;
  accent: string;
}

export const WORLDS: WorldInfo[] = [
  { world: 1, name: 'Sunbelt District', subtitle: 'Sunny avenues & driving fundamentals', accent: '#FF8A00' },
  { world: 2, name: 'Harbor Docks', subtitle: 'Port bridges, cargo bays & tight turns', accent: '#14B8A6' },
  { world: 3, name: 'Neon Downtown', subtitle: 'Sunset towers, traffic lights & drift zones', accent: '#FFC93C' },
  { world: 4, name: 'Hillside Ridge', subtitle: 'Foggy switchbacks & high-speed escapes', accent: '#38BDF8' },
  { world: 5, name: 'Industrial Ring', subtitle: 'Rain-slick asphalt & moving roadworks', accent: '#F43F5E' },
  { world: 6, name: 'Apex Metropolis', subtitle: 'Night expressways & elite city showdowns', accent: '#A855F7' },
];

const MODE_SEQUENCE: ModeId[] = [
  'rush_hour',
  'taxi_master',
  'parking_challenge',
  'time_trial',
  'drift_zone',
  'delivery_run',
  'rush_hour',
  'chase_escape',
  'time_trial',
  'chase_escape', // 10 = Boss
];

const LEVEL_TITLES: string[][] = [
  [
    'First Ignition',
    'Nitro & Gears',
    'Precision Bay',
    'Morning Commute',
    'Sunbelt Drift',
    'Parcel Express',
    'Avenue Sprint',
    'Interceptor Alert',
    'Golden Lap',
    'BOSS: Sunbelt Breakout',
  ],
  [
    'Pier Rush',
    'Dockside Taxi',
    'Container Squeeze',
    'Bridge Blitz',
    'Tire Smoke Pier',
    'Fragile Freight',
    'Harbor Loop',
    'Port Pursuit',
    'Crane Alley Run',
    'BOSS: Harbor Lockdown',
  ],
  [
    'Sunset Gridlock',
    'VIP Cab Shift',
    'Plaza Parallel',
    'Skyline Checkpoints',
    'Neon Apex Drift',
    'Glassware Courier',
    'Downtown Scramble',
    'Midnight Evasion',
    'Tower Circuit',
    'BOSS: Neon Interceptor',
  ],
  [
    'Misty Ascent',
    'Ridge Fare',
    'Cliffside Park',
    'Switchback Trial',
    'Foggy Hairpins',
    'Highland Cargo',
    'Canyon Dash',
    'Outrun the Patrol',
    'Summit Time Attack',
    'BOSS: Ridge Blitz',
  ],
  [
    'Wet Asphalt Rush',
    'Monsoon Taxi',
    'Depot Reverse Bay',
    'Slick Circuit',
    'Rain Slide Show',
    'Steelworks Freight',
    'Roadwork Dodge',
    'Storm Pursuit',
    'Highway Ring Dash',
    'BOSS: Storm Convoy',
  ],
  [
    'Midnight Grid',
    'Executive Night Cab',
    'Apex Underground Bay',
    'Hyper Checkpoint',
    'Metropolis Drift King',
    'Volatile Cargo',
    'Cross-City Gauntlet',
    'Heat Level Max',
    'Grand Ring Sprint',
    'BOSS: City Showdown',
  ],
];

function buildCareerLevels(): LevelDef[] {
  const levels: LevelDef[] = [];

  for (let w = 1; w <= 6; w++) {
    const worldMeta = WORLDS[w - 1];
    for (let i = 1; i <= 10; i++) {
      const id = (w - 1) * 10 + i;
      const isBoss = i === 10;

      // Levels 1-3 are guided tutorial levels
      let mode: ModeId = MODE_SEQUENCE[i - 1];
      if (id === 1) mode = 'rush_hour';
      if (id === 2) mode = 'time_trial';
      if (id === 3) mode = 'parking_challenge';

      let weather: WeatherType = 'clear';
      if (w === 2 && i % 4 === 3) weather = 'cloudy';
      if (w === 3 && i % 4 === 1) weather = 'cloudy';
      if (w === 4 && (i % 2 === 1 || isBoss)) weather = 'fog';
      if (w === 5 && (i >= 2)) weather = 'rain';
      if (w === 6 && (i % 3 === 0 || isBoss)) weather = 'rain';
      if (w === 6 && i % 3 === 2) weather = 'fog';

      let timeOfDay: TimeOfDay = 'day';
      if (w === 1) timeOfDay = i <= 3 ? 'morning' : i >= 8 ? 'afternoon' : 'day';
      if (w === 2) timeOfDay = i <= 2 ? 'sunrise' : 'day';
      if (w === 2 && i >= 6) timeOfDay = 'sunset';
      if (w === 3) timeOfDay = i >= 5 ? 'night' : 'sunset';
      if (w === 4) timeOfDay = i >= 7 ? 'sunset' : 'day';
      if (w === 5) timeOfDay = i >= 6 ? 'night' : 'sunset';
      if (w === 6) timeOfDay = 'night';

      const trafficDensity = Math.min(0.95, 0.22 + (w - 1) * 0.11 + i * 0.025);
      const routeLength = isBoss ? 1800 + w * 220 : 650 + w * 140 + i * 45;
      const baseTime = isBoss ? 125 + w * 8 : mode === 'parking_challenge' ? 55 + w * 3 : 68 + w * 6 + i * 2;
      const timeLimitSec = Math.round(baseTime);

      let targetCount = 5;
      if (mode === 'taxi_master') targetCount = Math.min(5, 1 + Math.ceil(w / 2) + (i > 6 ? 1 : 0));
      if (mode === 'drift_zone') targetCount = 1200 + w * 650 + i * 180;
      if (mode === 'time_trial') targetCount = 5 + Math.floor(w / 2);
      if (mode === 'chase_escape') targetCount = isBoss ? 55 + w * 5 : 35 + w * 4;
      if (mode === 'delivery_run') targetCount = 1;
      if (mode === 'parking_challenge') targetCount = 1;
      if (mode === 'rush_hour') targetCount = 1;

      const pursuerCount = isBoss ? 2 + Math.floor(w / 2) : mode === 'chase_escape' ? 1 + Math.floor(w / 2) : 0;
      const hasMovingHazards = w >= 3 && (i >= 5 || isBoss);

      let tutorialTip: string | undefined;
      if (id === 1) {
        tutorialTip = 'Drive to the green beacon! Use Gas/Steer (or W/A/S/D) and tap Nitro for a burst of speed.';
      } else if (id === 2) {
        tutorialTip = 'Hit every glowing checkpoint gate! Shift to R to reverse if needed and press Camera to switch views.';
      } else if (id === 3) {
        tutorialTip = 'Park cleanly inside the glowing bay! Use Handbrake or R gear, keep sensors green, and stop completely.';
      }

      const objectiveMap: Record<ModeId, string> = {
        career: 'Complete the city objective',
        rush_hour: `Reach the destination (${routeLength}m) through traffic before time runs out.`,
        taxi_master: `Pick up and drop off ${targetCount} passenger${targetCount > 1 ? 's' : ''} smoothly.`,
        parking_challenge: 'Steer into the marked parking bay and stop cleanly without crashing.',
        time_trial: `Pass all ${targetCount} checkpoints before the clock hits zero.`,
        chase_escape: isBoss
          ? `BOSS ESCAPE: Evade ${pursuerCount} interceptors and reach the extraction zone!`
          : `Outrun the ${pursuerCount} interceptor${pursuerCount > 1 ? 's' : ''} until the timer completes.`,
        delivery_run: 'Deliver fragile cargo to the drop-off zone above 40% cargo health.',
        drift_zone: `Score ${targetCount.toLocaleString()} drift points before the timer expires.`,
        endless_traffic: 'Survive traffic as long as possible.',
        daily_challenge: 'Complete today’s fixed-seed city challenge.',
      };

      const twoStarTime = Math.round(timeLimitSec * 0.8);
      const threeStarTime = Math.round(timeLimitSec * 0.62);

      const starRules =
        mode === 'drift_zone'
          ? {
              oneStar: `Reach ${targetCount.toLocaleString()} drift pts`,
              twoStarMinScore: Math.round(targetCount * 1.35),
              threeStarMinScore: Math.round(targetCount * 1.75),
              description2: `Score ${Math.round(targetCount * 1.35).toLocaleString()}+ pts`,
              description3: `Score ${Math.round(targetCount * 1.75).toLocaleString()}+ pts`,
            }
          : {
              oneStar: 'Complete the mission',
              twoStarTimeSec: twoStarTime,
              threeStarTimeSec: threeStarTime,
              twoStarMaxDamagePct: 45,
              threeStarMaxDamagePct: 20,
              description2: `Finish under ${twoStarTime}s & <45% damage`,
              description3: `Finish under ${threeStarTime}s & <20% damage`,
            };

      levels.push({
        id,
        world: w,
        worldName: worldMeta.name,
        indexInWorld: i,
        isBoss,
        title: LEVEL_TITLES[w - 1][i - 1],
        objectiveText: objectiveMap[mode],
        mode,
        seed: 1000 + id * 7919,
        weather,
        timeOfDay,
        trafficDensity,
        timeLimitSec,
        targetCount,
        routeLength,
        hasMovingHazards,
        pursuerCount,
        tutorialTip,
        starRules,
        rewardCoins: (isBoss ? 1200 : 320) + w * 140 + i * 45,
        rewardGems: isBoss ? 6 + w : i === 5 ? 2 : 0,
        rewardXp: (isBoss ? 280 : 90) + w * 25 + i * 8,
      });
    }
  }

  return levels;
}

export const CAREER_LEVELS: LevelDef[] = buildCareerLevels();

export function getCareerLevel(id: number): LevelDef {
  return CAREER_LEVELS.find((l) => l.id === id) || CAREER_LEVELS[0];
}
