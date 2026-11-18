import { DrivingInputState } from '../core/input';
import { EffectiveCarSpecs } from '../data/upgrades';
import { WeatherType } from '../types/game';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: 'building' | 'barrier' | 'hazard';
}

export interface MovingVehicleCollider {
  x: number;
  z: number;
  radius: number;
  vx: number;
  vz: number;
  isPursuer?: boolean;
}

export interface VehiclePhysicsState {
  x: number;
  y: number;
  z: number;
  heading: number; // radians, 0 = facing -Z
  vx: number; // world X velocity m/s
  vz: number; // world Z velocity m/s
  speedMs: number;
  forwardSpeedMs: number;
  lateralSpeedMs: number;
  rpm: number;
  autoGearNum: number; // 1..5
  nitro: number; // 0..100
  isNitroActive: boolean;
  health: number; // 0..100
  cargoHealth: number; // 0..100
  steerAngle: number;
  wheelRotation: number;
  bodyRoll: number;
  bodyPitch: number;
  suspBounce: number;
  slipRatio: number;
  isDrifting: boolean;
  driftScoreRate: number;
  distanceMeters: number;
  lastImpactForce: number;
}

export function createInitialVehicleState(x = 0, z = 0, heading = 0): VehiclePhysicsState {
  return {
    x,
    y: 0,
    z,
    heading,
    vx: 0,
    vz: 0,
    speedMs: 0,
    forwardSpeedMs: 0,
    lateralSpeedMs: 0,
    rpm: 900,
    autoGearNum: 1,
    nitro: 100,
    isNitroActive: false,
    health: 100,
    cargoHealth: 100,
    steerAngle: 0,
    wheelRotation: 0,
    bodyRoll: 0,
    bodyPitch: 0,
    suspBounce: 0,
    slipRatio: 0,
    isDrifting: false,
    driftScoreRate: 0,
    distanceMeters: 0,
    lastImpactForce: 0,
  };
}

export function stepVehiclePhysics(
  state: VehiclePhysicsState,
  input: DrivingInputState,
  specs: EffectiveCarSpecs,
  weather: WeatherType,
  damageMult: number,
  colliders: ColliderBox[],
  vehicles: MovingVehicleCollider[],
  dt: number,
): { impactForce: number; hitPursuer: boolean; hitTraffic: boolean; hitBuilding: boolean } {
  const maxSpeedMs = specs.topSpeedKmh / 3.6;
  const rainGrip = weather === 'rain' ? 0.72 : weather === 'fog' ? 0.92 : 1.0;

  // Forward & Right unit vectors (heading=0 points toward -Z, +heading turns left or right)
  // Let's use standard right-handed: heading=0 -> forward = (0, -1), right = (1, 0)
  // Turning right (input.steer > 0) decreases heading (clockwise around Y)
  const sinH = Math.sin(state.heading);
  const cosH = Math.cos(state.heading);
  const fwdX = -sinH;
  const fwdZ = -cosH;
  const rightX = cosH;
  const rightZ = -sinH;

  let vFwd = state.vx * fwdX + state.vz * fwdZ;
  let vLat = state.vx * rightX + state.vz * rightZ;

  // Nitro consumption & thrust
  const wantNitro = input.nitro && input.gear === 'D' && input.throttle > 0.1 && state.nitro > 2;
  state.isNitroActive = wantNitro;
  if (wantNitro) {
    state.nitro = Math.max(0, state.nitro - 24 * dt);
  } else {
    state.nitro = Math.min(100, state.nitro + specs.nitroRechargeRate * dt);
  }

  const effectiveTopSpeed = wantNitro ? maxSpeedMs * specs.nitroPower : maxSpeedMs;
  const nitroBoostAccel = wantNitro ? 1.55 : 1.0;

  // Longitudinal forces by Gear P-R-N-D
  let longAccel = 0;
  const gear = input.gear;

  if (gear === 'P') {
    // Parking brake lock
    const parkBrake = Math.min(Math.abs(vFwd) / dt, 35);
    longAccel = -Math.sign(vFwd) * parkBrake;
  } else if (gear === 'N') {
    // Coasting + brake pedal
    longAccel = -vFwd * 0.4;
    if (input.brake > 0) {
      longAccel -= Math.sign(vFwd) * specs.brakeForce * input.brake;
    }
  } else if (gear === 'R') {
    const maxRevMs = 15; // ~54 km/h
    if (input.throttle > 0) {
      const revFactor = Math.max(0.2, 1 - Math.abs(vFwd) / maxRevMs);
      longAccel -= specs.accelForce * 0.72 * input.throttle * revFactor;
    }
    if (input.brake > 0) {
      longAccel -= Math.sign(vFwd) * specs.brakeForce * input.brake;
    }
    if (vFwd < -maxRevMs) {
      vFwd = -maxRevMs;
    }
  } else {
    // Gear D (5-speed automatic torque curve)
    const speedRatio = Math.max(0, vFwd / effectiveTopSpeed);
    state.autoGearNum = Math.min(5, Math.max(1, Math.floor(speedRatio * 4.8) + 1));
    const torqueMult = Math.max(0.18, 1.15 - speedRatio * 0.92);

    if (input.throttle > 0) {
      longAccel += specs.accelForce * torqueMult * nitroBoostAccel * input.throttle;
    }
    if (input.brake > 0) {
      if (vFwd > 0.5) {
        longAccel -= specs.brakeForce * input.brake;
      } else {
        // Gentle reverse creep if braking at standstill
        longAccel -= specs.accelForce * 0.35 * input.brake;
      }
    }
  }

  if (input.handbrake) {
    longAccel -= Math.sign(vFwd) * specs.brakeForce * 0.65;
  }

  // Rolling resistance & aerodynamic drag
  longAccel -= vFwd * 0.22 + vFwd * Math.abs(vFwd) * 0.0045;
  vFwd += longAccel * dt;
  if (vFwd > effectiveTopSpeed) {
    vFwd += (effectiveTopSpeed - vFwd) * Math.min(1, 3 * dt);
  }
  if (gear === 'P' && Math.abs(vFwd) < 0.25) vFwd = 0;

  // Steering & Lateral Drift Physics
  const speedAbs = Math.hypot(vFwd, vLat);
  const steerSpeedFactor = Math.min(1, speedAbs / 4.5) * (1 - Math.min(0.45, speedAbs / 110));
  const targetSteerAngle = input.steer * 0.44;
  state.steerAngle += (targetSteerAngle - state.steerAngle) * Math.min(1, 14 * dt);

  const reverseSign = vFwd < -0.5 ? -1 : 1;
  const turnRate = -input.steer * (2.6 + specs.handlingGrip * 0.75) * steerSpeedFactor * reverseSign;
  const driftTurnBoost = input.handbrake ? 1.32 : 1.0;
  state.heading += turnRate * driftTurnBoost * dt;

  // Lateral grip vs drift slip
  const baseLatGrip = (input.handbrake ? 2.4 : 7.8 * specs.handlingGrip) * rainGrip;
  const latDecay = Math.exp(-baseLatGrip * dt);
  vLat *= latDecay;

  // Centrifugal push during tight high-speed turns creates natural oversteer
  if (Math.abs(input.steer) > 0.2 && speedAbs > 11) {
    const oversteerPush = input.steer * (speedAbs * 0.14) * (input.handbrake ? 1.85 : 0.72) / specs.handlingGrip;
    vLat += oversteerPush * dt;
  }

  // Reconstruct world velocity
  const nSin = Math.sin(state.heading);
  const nCos = Math.cos(state.heading);
  const nFwdX = -nSin;
  const nFwdZ = -nCos;
  const nRightX = nCos;
  const nRightZ = -nSin;

  state.vx = nFwdX * vFwd + nRightX * vLat;
  state.vz = nFwdZ * vFwd + nRightZ * vLat;

  const prevX = state.x;
  const prevZ = state.z;
  state.x += state.vx * dt;
  state.z += state.vz * dt;

  // Collision Detection & Resolution
  let impactForce = 0;
  let hitBuilding = false;
  let hitTraffic = false;
  let hitPursuer = false;

  const carHalfW = 1.02;
  const carHalfL = 2.05;
  const carR = 1.38;

  // 1. Static AABB colliders (buildings, roadwork barriers)
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    // Quick broadphase
    if (
      state.x + carR < box.minX ||
      state.x - carR > box.maxX ||
      state.z + carR < box.minZ ||
      state.z - carR > box.maxZ
    ) {
      continue;
    }

    const closestX = Math.max(box.minX, Math.min(state.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(state.z, box.maxZ));
    const dx = state.x - closestX;
    const dz = state.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < carR * carR) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = distSq > 0.0001 ? dx / dist : (state.x > (box.minX + box.maxX) * 0.5 ? 1 : -1);
      const nz = distSq > 0.0001 ? dz / dist : 0;
      const pen = carR - dist;

      state.x += nx * pen;
      state.z += nz * pen;

      const vn = state.vx * nx + state.vz * nz;
      if (vn < 0) {
        const restitution = 0.38;
        const j = -(1 + restitution) * vn;
        state.vx += nx * j;
        state.vz += nz * j;
        impactForce = Math.max(impactForce, Math.abs(vn));
        hitBuilding = true;
      }
    }
  }

  // 2. Dynamic Vehicle colliders (traffic & pursuers)
  for (let i = 0; i < vehicles.length; i++) {
    const other = vehicles[i];
    const dx = state.x - other.x;
    const dz = state.z - other.z;
    const minDist = carR + other.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      const pen = minDist - dist;

      state.x += nx * pen * 0.65;
      state.z += nz * pen * 0.65;
      other.x -= nx * pen * 0.35;
      other.z -= nz * pen * 0.35;

      const rvx = state.vx - other.vx;
      const rvz = state.vz - other.vz;
      const vn = rvx * nx + rvz * nz;
      if (vn < 0) {
        const j = -1.35 * vn * 0.65;
        state.vx += nx * j;
        state.vz += nz * j;
        other.vx -= nx * j * 0.6;
        other.vz -= nz * j * 0.6;
        impactForce = Math.max(impactForce, Math.abs(vn));
        if (other.isPursuer) hitPursuer = true;
        else hitTraffic = true;
      }
    }
  }

  // Apply crash damage & cargo bumps
  if (impactForce > 4.5) {
    const rawDmg = (impactForce - 3.5) * 2.1 * damageMult;
    const armorFactor = 100 / Math.max(60, specs.maxDurability);
    state.health = Math.max(0, state.health - rawDmg * armorFactor);
    state.cargoHealth = Math.max(0, state.cargoHealth - rawDmg * 1.45);
    state.suspBounce = Math.min(0.18, impactForce * 0.012);
  } else {
    state.suspBounce *= Math.exp(-9 * dt);
  }

  // Update telemetry & visual suspension roll/pitch
  state.speedMs = Math.hypot(state.vx, state.vz);
  state.forwardSpeedMs = state.vx * nFwdX + state.vz * nFwdZ;
  state.lateralSpeedMs = state.vx * nRightX + state.vz * nRightZ;
  state.distanceMeters += Math.hypot(state.x - prevX, state.z - prevZ);

  const gearMax = (effectiveTopSpeed / 5) * state.autoGearNum;
  const gearFrac = gear === 'N' ? input.throttle * 0.8 : Math.min(1, Math.abs(state.forwardSpeedMs) / Math.max(8, gearMax));
  const targetRpm = 900 + gearFrac * 6800 + (wantNitro ? 600 : 0);
  state.rpm += (targetRpm - state.rpm) * Math.min(1, 10 * dt);

  state.wheelRotation += (state.forwardSpeedMs / 0.35) * dt;

  // Suspension body roll & pitch
  const targetRoll = THREE_CLAMP(-state.lateralSpeedMs * 0.014 / specs.suspensionStiffness, -0.09, 0.09);
  const targetPitch = THREE_CLAMP(longAccel * 0.0032 / specs.suspensionStiffness, -0.06, 0.06);
  state.bodyRoll += (targetRoll - state.bodyRoll) * Math.min(1, 9 * dt);
  state.bodyPitch += (targetPitch - state.bodyPitch) * Math.min(1, 9 * dt);

  // Slip ratio & drift detection
  const slip = state.speedMs > 5 ? Math.min(1, Math.abs(state.lateralSpeedMs) / (state.speedMs * 0.75)) : 0;
  state.slipRatio = slip;
  state.isDrifting = state.speedMs > 9.5 && Math.abs(state.lateralSpeedMs) > 3.2;
  state.driftScoreRate = state.isDrifting ? Math.round(state.speedMs * 8.5 * Math.min(2.5, slip * 2.2)) : 0;
  state.lastImpactForce = impactForce;

  // Keep carHeight unused warning clear
  void carHalfW;
  void carHalfL;

  return { impactForce, hitPursuer, hitTraffic, hitBuilding };
}

function THREE_CLAMP(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
