import { DIFFICULTY_CONFIG } from '../data/economy';
import {
  DifficultyId,
  GhostSample,
  LevelDef,
  ModeId,
  TimeOfDay,
  WeatherType,
} from '../types/game';
import { VehiclePhysicsState } from '../vehicle/physics';
import { CHUNK_SIZE } from '../world/cityGenerator';
import { WorldMarkersManager } from '../world/collectibles';

export interface ActiveSessionConfig {
  mode: ModeId;
  levelDef?: LevelDef;
  difficulty: DifficultyId;
  seed: number;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  trafficDensity: number;
  pursuerCount: number;
  hasMovingHazards: boolean;
  timeLimitSec: number;
  targetCount: number;
  routeLength: number;
  title: string;
  objectiveText: string;
  tutorialTip?: string;
  isWeeklyEvent?: boolean;
  isDailyChallenge?: boolean;
}

export interface ModeUpdateResult {
  finished: boolean;
  victory: boolean;
  reason: string;
  tip: string;
  objectiveLabel: string;
  objectiveProgress: string;
  targetX: number;
  targetZ: number;
  wrongWay: boolean;
  parkingSensors?: {
    front: number;
    rear: number;
    left: number;
    right: number;
    aligned: boolean;
    inside: boolean;
  };
  eventPopup?: { text: string; color: string; subtext?: string };
}

function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ModeController {
  public config!: ActiveSessionConfig;
  public waypoints: { x: number; z: number; heading: number }[] = [];
  public currentWpIdx = 0;

  public timeRemaining = 60;
  public elapsedTime = 0;
  public score = 0;
  public coinsInRun = 0;
  public nearMisses = 0;
  public driftPoints = 0;
  public comboCount = 1;
  public comboTimer = 0;
  public maxCombo = 1;
  public passengersDropped = 0;
  public passengerOnBoard = false;
  public parkingHoldTimer = 0;
  public ghostSamples: GhostSample[] = [];
  private lastGhostSampleTime = 0;
  private comboDecayDelay = 3.2;

  public start(config: ActiveSessionConfig, markers: WorldMarkersManager): void {
    this.config = config;
    const diff = DIFFICULTY_CONFIG[config.difficulty];

    this.timeRemaining = config.mode === 'endless_traffic' ? 9999 : Math.round(config.timeLimitSec * diff.timerMult);
    this.elapsedTime = 0;
    this.score = 0;
    this.coinsInRun = 0;
    this.nearMisses = 0;
    this.driftPoints = 0;
    this.comboCount = 1;
    this.comboTimer = 0;
    this.maxCombo = 1;
    this.passengersDropped = 0;
    this.passengerOnBoard = false;
    this.parkingHoldTimer = 0;
    this.currentWpIdx = 0;
    this.waypoints = [];
    this.ghostSamples = [];
    this.lastGhostSampleTime = 0;

    markers.clear();
    const rand = seededRand(config.seed);

    // Build road-aligned route waypoints
    if (config.mode === 'parking_challenge') {
      // Precision bay along avenue or side street
      const bayType = config.seed % 3; // 0: straight, 1: parallel, 2: angled
      const bx = bayType === 0 ? -4.5 : bayType === 1 ? 6.5 : 0;
      const bz = -68 - (config.seed % 4) * 14;
      const bHead = bayType === 2 ? Math.PI / 6 : bayType === 1 ? 0 : Math.PI;
      this.waypoints.push({ x: bx, z: bz, heading: bHead });
      markers.spawnZone('parking', bx, bz, bHead, 4.5);
    } else if (config.mode === 'taxi_master') {
      // Alternating pickup and dropoff zones on intersections
      let gx = 0;
      let gz = -1;
      for (let i = 0; i < config.targetCount * 2; i++) {
        const wx = gx * CHUNK_SIZE + 4;
        const wz = gz * CHUNK_SIZE + 4;
        this.waypoints.push({ x: wx, z: wz, heading: 0 });
        if (rand() > 0.45) gx += rand() > 0.5 ? 1 : -1;
        else gz -= 1;
      }
      const first = this.waypoints[0];
      markers.spawnZone('pickup', first.x, first.z, 0, 6);
    } else if (config.mode === 'time_trial' || config.mode === 'rush_hour' || config.mode === 'delivery_run') {
      const count = config.mode === 'time_trial' ? config.targetCount : Math.max(3, Math.round(config.routeLength / 200));
      let gx = 0;
      let gz = -1;
      for (let i = 0; i < count; i++) {
        const wx = gx * CHUNK_SIZE + (i % 2 === 0 ? 3.2 : -3.2);
        const wz = gz * CHUNK_SIZE;
        this.waypoints.push({ x: wx, z: wz, heading: 0 });
        if (i < count - 1) {
          if (rand() > 0.58 && i > 0) gx += rand() > 0.5 ? 1 : -1;
          else gz -= 1;
        }
      }
      if (config.mode === 'time_trial') {
        const wp = this.waypoints[0];
        markers.spawnZone('checkpoint', wp.x, wp.z, 0, 7.5);
      } else {
        const last = this.waypoints[this.waypoints.length - 1];
        markers.spawnZone('destination', last.x, last.z, 0, 8.0);
      }
    } else if (config.mode === 'chase_escape') {
      const lastZ = -Math.max(480, config.routeLength * 0.6);
      const wx = ((config.seed % 3) - 1) * CHUNK_SIZE;
      this.waypoints.push({ x: wx, z: lastZ, heading: 0 });
      markers.spawnZone('destination', wx, lastZ, 0, 9.0);
    }

    // Spawn Collectible Coins, Nitro Cans, Repair Kits, Time Clocks, Hidden Star
    const collectibleCount = config.mode === 'parking_challenge' ? 6 : 28;
    for (let i = 0; i < collectibleCount; i++) {
      const laneX = (Math.floor(rand() * 3) - 1) * CHUNK_SIZE + (rand() > 0.5 ? 3.2 : -3.2);
      const zPos = -24 - i * 28 - rand() * 14;
      const r = rand();
      const kind =
        i === 12
          ? 'star'
          : r < 0.64
            ? 'coin'
            : r < 0.80
              ? 'nitro'
              : r < 0.92
                ? 'repair'
                : 'time';
      markers.spawnCollectible(kind, laneX, zPos);
    }
  }

  public addNearMiss(physics: VehiclePhysicsState): { text: string; color: string; subtext?: string } {
    this.nearMisses += 1;
    this.comboCount = Math.min(20, this.comboCount + 1);
    this.maxCombo = Math.max(this.maxCombo, this.comboCount);
    this.comboTimer = this.comboDecayDelay;
    const pts = 50 * this.comboCount;
    this.score += pts;
    physics.nitro = Math.min(100, physics.nitro + 12);
    return {
      text: `Near Miss +${pts}`,
      color: '#FFC93C',
      subtext: this.comboCount > 1 ? `${this.comboCount}x Combo · +Nitro` : '+Nitro',
    };
  }

  public update(
    dt: number,
    physics: VehiclePhysicsState,
    markers: WorldMarkersManager,
    closestPursuerDist: number,
  ): ModeUpdateResult {
    const diff = DIFFICULTY_CONFIG[this.config.difficulty];
    this.elapsedTime += dt;
    if (this.config.mode !== 'endless_traffic') {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    }

    // Record ghost samples for Time Trial
    if (this.config.mode === 'time_trial' && this.elapsedTime - this.lastGhostSampleTime >= 0.1) {
      this.lastGhostSampleTime = this.elapsedTime;
      this.ghostSamples.push({
        t: Number(this.elapsedTime.toFixed(2)),
        x: Number(physics.x.toFixed(2)),
        y: Number(physics.y.toFixed(2)),
        z: Number(physics.z.toFixed(2)),
        ry: Number(physics.heading.toFixed(3)),
      });
    }

    // Decay combo timer
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.comboCount = 1;
    }

    // Accumulate drift points
    if (physics.isDrifting) {
      const gained = physics.driftScoreRate * dt * (this.config.mode === 'drift_zone' ? this.comboCount : 1);
      this.driftPoints += gained;
      if (this.config.mode === 'drift_zone') {
        this.score += gained;
        this.comboTimer = this.comboDecayDelay;
        if (this.driftPoints > 0 && Math.floor(this.driftPoints / 300) + 1 > this.comboCount) {
          this.comboCount = Math.min(15, this.comboCount + 1);
          this.maxCombo = Math.max(this.maxCombo, this.comboCount);
        }
      }
    }

    if (this.config.mode === 'endless_traffic') {
      this.score += physics.speedMs * dt * 1.4;
    }

    let eventPopup: ModeUpdateResult['eventPopup'];

    // Collectibles collision
    for (let i = 0; i < markers.collectibles.length; i++) {
      const c = markers.collectibles[i];
      if (!c.active) continue;
      const distSq = (physics.x - c.x) ** 2 + (physics.z - c.z) ** 2;
      if (distSq < 9.5) {
        c.active = false;
        c.mesh.visible = false;
        if (c.kind === 'coin') {
          this.coinsInRun += 25;
          this.score += 50;
          eventPopup = { text: '+25 Coins', color: '#FFC93C' };
        } else if (c.kind === 'nitro') {
          physics.nitro = Math.min(100, physics.nitro + 40);
          eventPopup = { text: 'Nitro +40%', color: '#14B8A6' };
        } else if (c.kind === 'repair') {
          physics.health = Math.min(100, physics.health + 30);
          eventPopup = { text: 'Repair +30%', color: '#22C55E' };
        } else if (c.kind === 'time') {
          this.timeRemaining += 8;
          eventPopup = { text: '+8s Time', color: '#38BDF8' };
        } else if (c.kind === 'star') {
          this.coinsInRun += 100;
          this.score += 500;
          eventPopup = { text: 'Hidden Star +100', color: '#FACC15' };
        }
      }
    }

    // Check failure conditions first
    if (physics.health <= 0) {
      return {
        finished: true,
        victory: false,
        reason: diff.oneLife ? 'Vehicle Wrecked (Extreme 1-Life)' : 'Vehicle Wrecked',
        tip: 'Slow down before tight turns and upgrade Chassis Armor in the Garage.',
        objectiveLabel: this.config.title,
        objectiveProgress: 'Wrecked',
        targetX: 0,
        targetZ: 0,
        wrongWay: false,
      };
    }

    if (this.config.mode === 'delivery_run' && physics.cargoHealth < 40) {
      return {
        finished: true,
        victory: false,
        reason: 'Fragile Cargo Damaged Below 40%',
        tip: 'Brake smoothly before traffic and avoid sidewalks to protect cargo.',
        objectiveLabel: 'Delivery Run',
        objectiveProgress: `Cargo ${Math.round(physics.cargoHealth)}%`,
        targetX: 0,
        targetZ: 0,
        wrongWay: false,
      };
    }

    if (this.timeRemaining <= 0 && this.config.mode !== 'drift_zone' && this.config.mode !== 'chase_escape') {
      return {
        finished: true,
        victory: false,
        reason: 'Time Expired',
        tip: 'Use Nitro on long straight avenues and upgrade Engine & Gearbox.',
        objectiveLabel: this.config.title,
        objectiveProgress: '0.0s',
        targetX: 0,
        targetZ: 0,
        wrongWay: false,
      };
    }

    // Mode-Specific Progression
    const targetWp = this.waypoints[this.currentWpIdx] || { x: 0, z: -200, heading: 0 };
    const distToTarget = Math.hypot(physics.x - targetWp.x, physics.z - targetWp.z);

    // Wrong-way indicator (only for directional destination modes)
    let wrongWay = false;
    if (this.waypoints.length > 0 && this.config.mode !== 'parking_challenge' && physics.speedMs > 6) {
      const toX = (targetWp.x - physics.x) / Math.max(1, distToTarget);
      const toZ = (targetWp.z - physics.z) / Math.max(1, distToTarget);
      const fwdX = -Math.sin(physics.heading);
      const fwdZ = -Math.cos(physics.heading);
      if (toX * fwdX + toZ * fwdZ < -0.45 && distToTarget > 35) {
        wrongWay = true;
      }
    }

    // 1. Rush Hour & Delivery Run
    if (this.config.mode === 'rush_hour' || this.config.mode === 'delivery_run') {
      const finalWp = this.waypoints[this.waypoints.length - 1];
      const finalDist = Math.hypot(physics.x - finalWp.x, physics.z - finalWp.z);
      if (finalDist < 9.0) {
        this.score += Math.round(this.timeRemaining * 40 + physics.health * 15);
        return {
          finished: true,
          victory: true,
          reason: this.config.mode === 'delivery_run' ? 'Cargo Delivered Intact!' : 'Destination Reached!',
          tip: '',
          objectiveLabel: this.config.title,
          objectiveProgress: 'Arrived',
          targetX: finalWp.x,
          targetZ: finalWp.z,
          wrongWay: false,
        };
      }
      return {
        finished: false,
        victory: false,
        reason: '',
        tip: '',
        objectiveLabel: this.config.mode === 'delivery_run' ? 'Deliver Fragile Cargo' : 'Reach Destination',
        objectiveProgress: `${Math.round(finalDist)}m left`,
        targetX: finalWp.x,
        targetZ: finalWp.z,
        wrongWay,
        eventPopup,
      };
    }

    // 2. Time Trial (Checkpoints)
    if (this.config.mode === 'time_trial') {
      if (distToTarget < 9.0) {
        this.currentWpIdx += 1;
        if (diff.checkpointRefill) {
          this.timeRemaining += 9;
          physics.nitro = Math.min(100, physics.nitro + 25);
        }
        markers.zones.forEach((z) => {
          z.active = false;
          z.mesh.visible = false;
        });

        if (this.currentWpIdx >= this.waypoints.length) {
          this.score += Math.round(this.timeRemaining * 60 + 1000);
          return {
            finished: true,
            victory: true,
            reason: 'All Checkpoints Cleared!',
            tip: '',
            objectiveLabel: 'Time Trial',
            objectiveProgress: `${this.waypoints.length}/${this.waypoints.length}`,
            targetX: targetWp.x,
            targetZ: targetWp.z,
            wrongWay: false,
          };
        } else {
          const next = this.waypoints[this.currentWpIdx];
          const isFinal = this.currentWpIdx === this.waypoints.length - 1;
          markers.spawnZone(isFinal ? 'destination' : 'checkpoint', next.x, next.z, 0, 8);
          eventPopup = { text: `Checkpoint ${this.currentWpIdx}/${this.waypoints.length}`, color: '#38BDF8' };
        }
      }
      const cur = this.waypoints[this.currentWpIdx];
      return {
        finished: false,
        victory: false,
        reason: '',
        tip: '',
        objectiveLabel: 'Checkpoints',
        objectiveProgress: `${this.currentWpIdx}/${this.waypoints.length} (${Math.round(distToTarget)}m)`,
        targetX: cur.x,
        targetZ: cur.z,
        wrongWay,
        eventPopup,
      };
    }

    // 3. Taxi Master
    if (this.config.mode === 'taxi_master') {
      if (distToTarget < 7.5 && physics.speedMs < 9.5) {
        markers.zones.forEach((z) => {
          z.active = false;
          z.mesh.visible = false;
        });

        if (!this.passengerOnBoard) {
          this.passengerOnBoard = true;
          this.currentWpIdx += 1;
          const drop = this.waypoints[this.currentWpIdx];
          markers.spawnZone('dropoff', drop.x, drop.z, 0, 6.5);
          eventPopup = { text: 'Passenger Picked Up!', color: '#FFC93C', subtext: 'Drive smoothly for a big tip' };
        } else {
          this.passengerOnBoard = false;
          this.passengersDropped += 1;
          this.currentWpIdx += 1;
          const tip = Math.round(250 * (physics.health / 100) + this.timeRemaining * 5);
          this.score += tip;
          this.coinsInRun += Math.round(tip / 5);
          if (diff.checkpointRefill) this.timeRemaining += 15;

          if (this.passengersDropped >= this.config.targetCount || this.currentWpIdx >= this.waypoints.length) {
            return {
              finished: true,
              victory: true,
              reason: `All ${this.passengersDropped} Fares Completed!`,
              tip: '',
              objectiveLabel: 'Taxi Master',
              objectiveProgress: `${this.passengersDropped}/${this.config.targetCount}`,
              targetX: targetWp.x,
              targetZ: targetWp.z,
              wrongWay: false,
            };
          } else {
            const pick = this.waypoints[this.currentWpIdx];
            markers.spawnZone('pickup', pick.x, pick.z, 0, 6.5);
            eventPopup = { text: `Fare Dropped +$${tip}`, color: '#14B8A6' };
          }
        }
      }
      const cur = this.waypoints[this.currentWpIdx] || targetWp;
      return {
        finished: false,
        victory: false,
        reason: '',
        tip: '',
        objectiveLabel: this.passengerOnBoard ? 'Drop Off Passenger' : 'Pick Up Passenger',
        objectiveProgress: `${this.passengersDropped}/${this.config.targetCount} · ${Math.round(distToTarget)}m`,
        targetX: cur.x,
        targetZ: cur.z,
        wrongWay,
        eventPopup,
      };
    }

    // 4. Parking Challenge
    if (this.config.mode === 'parking_challenge') {
      const bay = this.waypoints[0];
      const dx = physics.x - bay.x;
      const dz = physics.z - bay.z;
      const dist = Math.hypot(dx, dz);
      // Alignment angle mod PI (front-in or reverse-in both valid)
      let angDiff = Math.abs((physics.heading - bay.heading) % Math.PI);
      if (angDiff > Math.PI / 2) angDiff = Math.PI - angDiff;

      const inside = dist < 1.85;
      const aligned = angDiff < 0.28;
      const stopped = physics.speedMs < 0.7;

      const sensors = {
        front: Math.max(0, Math.min(5, dist + 0.5)),
        rear: Math.max(0, Math.min(5, dist + 0.3)),
        left: Math.max(0, Math.min(5, Math.abs(dx) + 0.4)),
        right: Math.max(0, Math.min(5, Math.abs(dx) + 0.4)),
        aligned,
        inside,
      };

      if (inside && aligned && stopped) {
        this.parkingHoldTimer += dt;
        if (this.parkingHoldTimer >= 0.75) {
          this.score = Math.round(1200 + this.timeRemaining * 35 + physics.health * 10);
          return {
            finished: true,
            victory: true,
            reason: 'Precision Park Complete!',
            tip: '',
            objectiveLabel: 'Parking Bay',
            objectiveProgress: 'Parked!',
            targetX: bay.x,
            targetZ: bay.z,
            wrongWay: false,
            parkingSensors: sensors,
          };
        }
      } else {
        this.parkingHoldTimer = 0;
      }

      return {
        finished: false,
        victory: false,
        reason: '',
        tip: '',
        objectiveLabel: inside ? (aligned ? 'Hold Still to Park' : 'Straighten Angle') : 'Enter Orange Bay',
        objectiveProgress: `${Math.round(dist)}m away`,
        targetX: bay.x,
        targetZ: bay.z,
        wrongWay: false,
        parkingSensors: sensors,
        eventPopup,
      };
    }

    // 5. Chase / Escape
    if (this.config.mode === 'chase_escape') {
      const extractWp = this.waypoints[0];
      const extractDist = Math.hypot(physics.x - extractWp.x, physics.z - extractWp.z);
      if (extractDist < 10.5 || this.timeRemaining <= 0) {
        this.score += Math.round(1500 + physics.health * 20 + closestPursuerDist * 8);
        return {
          finished: true,
          victory: true,
          reason: extractDist < 10.5 ? 'Extraction Reached!' : 'Pursuit Timer Survived!',
          tip: '',
          objectiveLabel: 'Chase / Escape',
          objectiveProgress: 'Escaped!',
          targetX: extractWp.x,
          targetZ: extractWp.z,
          wrongWay: false,
        };
      }
      return {
        finished: false,
        victory: false,
        reason: '',
        tip: '',
        objectiveLabel: 'Escape to Beacon or Survive',
        objectiveProgress: `${Math.round(extractDist)}m · Threat ${Math.round(closestPursuerDist)}m`,
        targetX: extractWp.x,
        targetZ: extractWp.z,
        wrongWay,
        eventPopup,
      };
    }

    // 6. Drift Zone
    if (this.config.mode === 'drift_zone') {
      if (this.timeRemaining <= 0) {
        const won = this.driftPoints >= this.config.targetCount;
        return {
          finished: true,
          victory: won,
          reason: won ? `Target ${this.config.targetCount.toLocaleString()} Drift Pts Beaten!` : 'Drift Score Too Low',
          tip: 'Use Handbrake while steering into corners to hold longer drift combos.',
          objectiveLabel: 'Drift Zone',
          objectiveProgress: `${Math.round(this.driftPoints).toLocaleString()} / ${this.config.targetCount.toLocaleString()}`,
          targetX: 0,
          targetZ: physics.z - 60,
          wrongWay: false,
        };
      }
      return {
        finished: false,
        victory: false,
        reason: '',
        tip: '',
        objectiveLabel: `Target: ${this.config.targetCount.toLocaleString()} Drift Pts`,
        objectiveProgress: `${Math.round(this.driftPoints).toLocaleString()} pts`,
        targetX: 0,
        targetZ: physics.z - 80,
        wrongWay: false,
        eventPopup,
      };
    }

    // 7. Endless Traffic Racer
    return {
      finished: false,
      victory: false,
      reason: '',
      tip: '',
      objectiveLabel: 'Endless Survival',
      objectiveProgress: `${Math.round(this.score).toLocaleString()} pts · ${this.nearMisses} Near Misses`,
      targetX: 0,
      targetZ: physics.z - 120,
      wrongWay: false,
      eventPopup,
    };
  }
}
