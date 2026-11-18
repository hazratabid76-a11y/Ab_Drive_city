import { CarDef, UpgradeKey, UpgradeLevels } from '../types/game';

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  description: string;
  maxLevel: number;
  baseCostCoins: number;
  costMultiplier: number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    key: 'engine',
    name: 'Engine',
    description: 'Boosts top speed and peak horsepower curve.',
    maxLevel: 5,
    baseCostCoins: 600,
    costMultiplier: 1.65,
  },
  {
    key: 'gearbox',
    name: 'Gearbox',
    description: 'Faster shifts and stronger low-end acceleration.',
    maxLevel: 5,
    baseCostCoins: 550,
    costMultiplier: 1.6,
  },
  {
    key: 'brakes',
    name: 'Brakes',
    description: 'Shorter stopping distance and crisp trail-braking.',
    maxLevel: 5,
    baseCostCoins: 450,
    costMultiplier: 1.55,
  },
  {
    key: 'tires',
    name: 'Tires',
    description: 'Higher cornering grip and better rain traction.',
    maxLevel: 5,
    baseCostCoins: 550,
    costMultiplier: 1.6,
  },
  {
    key: 'suspension',
    name: 'Suspension',
    description: 'Tighter body control, stability, and bump absorption.',
    maxLevel: 5,
    baseCostCoins: 500,
    costMultiplier: 1.55,
  },
  {
    key: 'nitro',
    name: 'Nitro System',
    description: 'Stronger boost thrust, larger tank, and faster recharge.',
    maxLevel: 5,
    baseCostCoins: 650,
    costMultiplier: 1.65,
  },
  {
    key: 'armor',
    name: 'Chassis Armor',
    description: 'Reduces collision damage and improves ramming durability.',
    maxLevel: 5,
    baseCostCoins: 500,
    costMultiplier: 1.6,
  },
];

export const DEFAULT_UPGRADES: UpgradeLevels = {
  engine: 0,
  gearbox: 0,
  brakes: 0,
  tires: 0,
  suspension: 0,
  nitro: 0,
  armor: 0,
};

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number {
  if (currentLevel >= def.maxLevel) return 0;
  return Math.round(def.baseCostCoins * Math.pow(def.costMultiplier, currentLevel) / 50) * 50;
}

export interface EffectiveCarSpecs {
  topSpeedKmh: number;
  accelForce: number;
  brakeForce: number;
  handlingGrip: number;
  suspensionStiffness: number;
  nitroPower: number;
  nitroRechargeRate: number;
  maxDurability: number;
  ratings: {
    topSpeed: number;
    acceleration: number;
    handling: number;
    braking: number;
    nitro: number;
    durability: number;
  };
}

export function computeEffectiveSpecs(car: CarDef, upgrades?: UpgradeLevels): EffectiveCarSpecs {
  const u = upgrades || DEFAULT_UPGRADES;

  const topSpeedKmh = car.stats.topSpeed * (1 + u.engine * 0.055 + u.gearbox * 0.015);
  const accelRating = Math.min(115, car.stats.acceleration + u.engine * 3 + u.gearbox * 4.5);
  const handlingRating = Math.min(115, car.stats.handling + u.tires * 4 + u.suspension * 3.5);
  const brakingRating = Math.min(115, car.stats.braking + u.brakes * 5.5 + u.tires * 1.5);
  const nitroRating = Math.min(115, car.stats.nitro + u.nitro * 6);
  const durabilityRating = Math.min(120, car.stats.durability + u.armor * 6.5 + u.suspension * 1.5);

  return {
    topSpeedKmh,
    accelForce: 14 + accelRating * 0.24,
    brakeForce: 22 + brakingRating * 0.32,
    handlingGrip: 0.72 + (handlingRating / 100) * 0.55,
    suspensionStiffness: 0.8 + u.suspension * 0.12,
    nitroPower: 1.28 + u.nitro * 0.08,
    nitroRechargeRate: 3.5 + u.nitro * 1.4,
    maxDurability: 80 + durabilityRating * 1.35,
    ratings: {
      topSpeed: Math.round(topSpeedKmh),
      acceleration: Math.round(accelRating),
      handling: Math.round(handlingRating),
      braking: Math.round(brakingRating),
      nitro: Math.round(nitroRating),
      durability: Math.round(durabilityRating),
    },
  };
}
