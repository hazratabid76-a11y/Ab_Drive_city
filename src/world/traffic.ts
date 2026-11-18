import * as THREE from 'three';
import { BODY_COLORS, CARS } from '../data/cars';
import { ColliderBox, MovingVehicleCollider } from '../vehicle/physics';
import { buildProceduralCar, BuiltCarMesh } from '../vehicle/carBuilder';
import { CHUNK_SIZE, ROAD_HALF_WIDTH, TrafficSignalPhase } from './cityGenerator';
import { animatePedestrianWalk, ArticulatedPedestrian, buildRealisticPedestrian } from './pedestrian';

interface TrafficCar {
  mesh: BuiltCarMesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  axis: 'NS' | 'EW';
  dir: 1 | -1; // +1 or -1 along axis
  laneOffset: number;
  baseSpeed: number;
  currentSpeed: number;
  nearMissCooldown: number;
}

interface PursuerCar {
  mesh: BuiltCarMesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
}

interface Pedestrian {
  group: THREE.Group;
  rig: ArticulatedPedestrian;
  anchorX: number;
  anchorZ: number;
  axis: 'X' | 'Z';
  phase: number;
}

interface MovingHazard {
  mesh: THREE.Group;
  baseX: number;
  baseZ: number;
  axis: 'X' | 'Z';
  range: number;
  speed: number;
  phase: number;
  collider: ColliderBox;
}

export class TrafficAndAIManager {
  private scene: THREE.Scene;
  private traffic: TrafficCar[] = [];
  private pursuers: PursuerCar[] = [];
  private pedestrians: Pedestrian[] = [];
  private hazards: MovingHazard[] = [];
  private collidersOut: MovingVehicleCollider[] = [];
  private hazardCollidersOut: ColliderBox[] = [];
  private hornCooldown = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public setup(
    trafficDensity: number,
    pursuerCount: number,
    hasMovingHazards: boolean,
    isNight: boolean,
    playerX: number,
    playerZ: number,
  ): void {
    this.clear();

    // 1. Spawn Smart AI Traffic Pool
    const count = Math.round(8 + trafficDensity * 18);
    for (let i = 0; i < count; i++) {
      const carDef = CARS[i % 7]; // everyday city cars
      const color = BODY_COLORS[i % BODY_COLORS.length].hex;
      const built = buildProceduralCar({
        car: carDef,
        customization: { color, finish: 'gloss', wheelStyle: 'stock', spoiler: 'none', underglow: 'none' },
        isNight,
      });

      const axis: 'NS' | 'EW' = i % 2 === 0 ? 'NS' : 'EW';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const laneIdx = i % 2 === 0 ? 3.2 : 6.8;
      const laneOffset = dir === 1 ? -laneIdx : laneIdx;
      const gridLine = (Math.floor(i / 4) - 2) * CHUNK_SIZE;
      const along = ((i * 53) % 320) - 160;

      const x = axis === 'NS' ? gridLine + laneOffset : along;
      const z = axis === 'NS' ? along : gridLine + laneOffset;
      built.root.position.set(x, 0, z);
      this.scene.add(built.root);

      this.traffic.push({
        mesh: built,
        x,
        z,
        vx: 0,
        vz: 0,
        axis,
        dir,
        laneOffset,
        baseSpeed: 10 + (i % 5) * 2.4,
        currentSpeed: 10,
        nearMissCooldown: 0,
      });
    }

    // 2. Spawn Pursuers ("Chase" AI)
    for (let i = 0; i < pursuerCount; i++) {
      const built = buildProceduralCar({
        car: CARS[9], // Monarch V8 interceptor chassis
        customization: { color: '#0F172A', finish: 'gloss', wheelStyle: 'sport_5', spoiler: 'lip', underglow: 'none' },
        isNight,
        isPursuer: true,
      });
      const angle = (i * Math.PI * 0.7) + Math.PI * 0.85;
      const dist = 48 + i * 24;
      const px = playerX + Math.sin(angle) * dist;
      const pz = playerZ + Math.cos(angle) * dist;
      built.root.position.set(px, 0, pz);
      this.scene.add(built.root);
      this.pursuers.push({ mesh: built, x: px, z: pz, vx: 0, vz: 0, heading: 0 });
    }

    // 3. Pedestrians (articulated, natural proportions) near crosswalks
    for (let i = 0; i < 10; i++) {
      const rig = buildRealisticPedestrian(i);
      const grp = rig.root;
      const gx = ((i % 3) - 1) * CHUNK_SIZE + (i % 2 === 0 ? ROAD_HALF_WIDTH + 2.2 : -ROAD_HALF_WIDTH - 2.2);
      const gz = (Math.floor(i / 3) - 1) * CHUNK_SIZE;
      grp.position.set(gx, 0, gz);
      this.scene.add(grp);
      this.pedestrians.push({
        group: grp,
        rig,
        anchorX: gx,
        anchorZ: gz,
        axis: i % 2 === 0 ? 'X' : 'Z',
        phase: i * 1.3,
      });
    }

    // 4. Moving Hazards (roadwork barriers & barrels)
    if (hasMovingHazards) {
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff8a00, roughness: 0.4 });
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
      for (let i = 0; i < 6; i++) {
        const grp = new THREE.Group();
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.05, 0.7), barrierMat);
        bar.position.y = 0.55;
        const top = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 0.75), stripeMat);
        top.position.y = 0.95;
        grp.add(bar, top);

        const bx = (i % 2 === 0 ? 0 : CHUNK_SIZE) + (i % 3 === 0 ? -3.5 : 3.5);
        const bz = -75 - i * 85;
        grp.position.set(bx, 0, bz);
        this.scene.add(grp);
        this.hazards.push({
          mesh: grp,
          baseX: bx,
          baseZ: bz,
          axis: 'X',
          range: 5.2,
          speed: 1.4 + (i % 3) * 0.45,
          phase: i * 1.1,
          collider: { minX: bx - 1.9, maxX: bx + 1.9, minZ: bz - 0.4, maxZ: bz + 0.4, kind: 'hazard' },
        });
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    playerX: number,
    playerZ: number,
    playerSpeedMs: number,
    signalPhase: TrafficSignalPhase,
    onNearMiss: () => void,
    onTrafficHonk: () => void,
  ): { vehicleColliders: MovingVehicleCollider[]; hazardColliders: ColliderBox[] } {
    this.collidersOut.length = 0;
    this.hazardCollidersOut.length = 0;
    this.hornCooldown = Math.max(0, this.hornCooldown - dt);

    // 1. Update Traffic
    for (let i = 0; i < this.traffic.length; i++) {
      const car = this.traffic[i];
      car.nearMissCooldown = Math.max(0, car.nearMissCooldown - dt);

      // Recycle far cars around player
      const dxP = car.x - playerX;
      const dzP = car.z - playerZ;
      if (Math.abs(dxP) > 220 || Math.abs(dzP) > 220) {
        if (car.axis === 'NS') {
          const nearGridX = Math.round(playerX / CHUNK_SIZE) * CHUNK_SIZE;
          car.x = nearGridX + car.laneOffset;
          car.z = playerZ + (car.dir === 1 ? -180 : 180);
        } else {
          const nearGridZ = Math.round(playerZ / CHUNK_SIZE) * CHUNK_SIZE;
          car.z = nearGridZ + car.laneOffset;
          car.x = playerX + (car.dir === 1 ? -180 : 180);
        }
      }

      // Check traffic light stop line before intersection
      let shouldStop = false;
      const posAlong = car.axis === 'NS' ? car.z : car.x;
      const nearestInter = Math.round(posAlong / CHUNK_SIZE) * CHUNK_SIZE;
      const distToStop = (nearestInter - posAlong) * car.dir - (ROAD_HALF_WIDTH + 3.5);

      if (distToStop > 0 && distToStop < 14) {
        if (car.axis === 'NS' && signalPhase !== 'NS_GREEN') shouldStop = true;
        if (car.axis === 'EW' && signalPhase !== 'EW_GREEN') shouldStop = true;
      }

      // Brake for player ahead
      const distSqPlayer = (car.x - playerX) ** 2 + (car.z - playerZ) ** 2;
      if (distSqPlayer < 170) {
        const aheadDot =
          car.axis === 'NS' ? (playerZ - car.z) * car.dir : (playerX - car.x) * car.dir;
        const latDist = car.axis === 'NS' ? Math.abs(playerX - car.x) : Math.abs(playerZ - car.z);
        if (aheadDot > 0 && aheadDot < 13 && latDist < 2.6) {
          shouldStop = true;
          if (this.hornCooldown <= 0 && aheadDot < 8) {
            this.hornCooldown = 2.5;
            onTrafficHonk();
          }
        }
      }

      // Near-miss detection at high speed
      if (playerSpeedMs > 16 && distSqPlayer < 13.5 && distSqPlayer > 4.2 && car.nearMissCooldown <= 0) {
        car.nearMissCooldown = 2.2;
        onNearMiss();
      }

      const targetSpd = shouldStop ? 0 : car.baseSpeed;
      car.currentSpeed += (targetSpd - car.currentSpeed) * Math.min(1, 5 * dt);

      if (car.axis === 'NS') {
        car.vx = 0;
        car.vz = car.dir * car.currentSpeed;
        car.z += car.vz * dt;
        car.mesh.root.rotation.y = car.dir === 1 ? Math.PI : 0;
      } else {
        car.vx = car.dir * car.currentSpeed;
        car.vz = 0;
        car.x += car.vx * dt;
        car.mesh.root.rotation.y = car.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
      }

      car.mesh.root.position.set(car.x, 0, car.z);
      car.mesh.brakeLightMat.emissiveIntensity = shouldStop ? 2.4 : 0.55;
      car.mesh.wheelSpinMeshes.forEach((w) => {
        w.rotation.x += (car.currentSpeed / 0.35) * dt;
      });

      this.collidersOut.push({ x: car.x, z: car.z, radius: 1.45, vx: car.vx, vz: car.vz });
    }

    // 2. Update Pursuers ("Chase" AI)
    for (let i = 0; i < this.pursuers.length; i++) {
      const p = this.pursuers[i];
      const dx = playerX - p.x;
      const dz = playerZ - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const desiredHeading = Math.atan2(-dx, -dz);

      // Shortest angle difference
      let diff = desiredHeading - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));

      const chaseSpeed = dist > 55 ? 36 : 28.5; // rubberband slightly when far
      p.vx = -Math.sin(p.heading) * chaseSpeed;
      p.vz = -Math.cos(p.heading) * chaseSpeed;
      p.x += p.vx * dt;
      p.z += p.vz * dt;

      p.mesh.root.position.set(p.x, 0, p.z);
      p.mesh.root.rotation.y = p.heading;
      p.mesh.wheelSpinMeshes.forEach((w) => {
        w.rotation.x += (chaseSpeed / 0.35) * dt;
      });

      this.collidersOut.push({
        x: p.x,
        z: p.z,
        radius: 1.5,
        vx: p.vx,
        vz: p.vz,
        isPursuer: true,
      });
    }

    // 3. Pedestrians walking gently along sidewalks/crosswalks
    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i];
      const arg = elapsed * 0.9 + ped.phase;
      const walk = Math.sin(arg) * 7.5;
      const forward = Math.cos(arg) >= 0 ? 1 : -1; // direction of travel along the axis
      if (ped.axis === 'X') {
        ped.group.position.set(ped.anchorX + walk, 0, ped.anchorZ);
        ped.group.rotation.y = forward > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.group.position.set(ped.anchorX, 0, ped.anchorZ + walk);
        ped.group.rotation.y = forward > 0 ? 0 : Math.PI;
      }
      animatePedestrianWalk(ped.rig, elapsed, 1.0);
    }

    // 4. Moving Hazards
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      const offset = Math.sin(elapsed * h.speed + h.phase) * h.range;
      const hx = h.baseX + (h.axis === 'X' ? offset : 0);
      const hz = h.baseZ + (h.axis === 'Z' ? offset : 0);
      h.mesh.position.set(hx, 0, hz);
      h.collider.minX = hx - 1.9;
      h.collider.maxX = hx + 1.9;
      h.collider.minZ = hz - 0.45;
      h.collider.maxZ = hz + 0.45;
      this.hazardCollidersOut.push(h.collider);
    }

    return { vehicleColliders: this.collidersOut, hazardColliders: this.hazardCollidersOut };
  }

  public getTrafficBlips(): { x: number; z: number; isPursuer: boolean }[] {
    const out: { x: number; z: number; isPursuer: boolean }[] = [];
    for (const c of this.traffic) out.push({ x: c.x, z: c.z, isPursuer: false });
    for (const p of this.pursuers) out.push({ x: p.x, z: p.z, isPursuer: true });
    return out;
  }

  public getClosestPursuerDistance(px: number, pz: number): number {
    let min = Infinity;
    for (const p of this.pursuers) {
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < min) min = d;
    }
    return min;
  }

  public clear(): void {
    for (const t of this.traffic) {
      this.scene.remove(t.mesh.root);
      t.mesh.dispose();
    }
    this.traffic = [];

    for (const p of this.pursuers) {
      this.scene.remove(p.mesh.root);
      p.mesh.dispose();
    }
    this.pursuers = [];

    for (const ped of this.pedestrians) {
      this.scene.remove(ped.group);
      ped.rig.dispose();
    }
    this.pedestrians = [];

    for (const h of this.hazards) {
      this.scene.remove(h.mesh);
      h.mesh.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).geometry.dispose();
          ((o as THREE.Mesh).material as THREE.Material).dispose();
        }
      });
    }
    this.hazards = [];
  }
}
