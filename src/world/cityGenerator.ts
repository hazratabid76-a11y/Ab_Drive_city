import * as THREE from 'three';
import { ActiveQuality, TimeOfDay } from '../types/game';
import { ColliderBox } from '../vehicle/physics';
import { createArchitecturalFacadePBR, createAsphaltPBR, PBRMapSet } from './pbrTextures';

export const CHUNK_SIZE = 120;
export const ROAD_HALF_WIDTH = 10; // 20m wide 4-lane roads

export type TrafficSignalPhase = 'NS_GREEN' | 'NS_YELLOW' | 'EW_GREEN' | 'EW_YELLOW';

export interface ActiveChunk {
  key: string;
  cx: number;
  cz: number;
  group: THREE.Group;
  colliders: ColliderBox[];
  nsLightMat: THREE.MeshBasicMaterial;
  ewLightMat: THREE.MeshBasicMaterial;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createBillboardTexture(brand: string, bgHex: string, fgHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 240, 112);
  ctx.fillStyle = fgHex;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(brand, 128, 64);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const BRANDS = [
  { name: 'AB COLA', bg: '#0F172A', fg: '#FF8A00' },
  { name: 'VOLTMAX', bg: '#14B8A6', fg: '#0F172A' },
  { name: 'TURBOTEA', bg: '#FFC93C', fg: '#0F172A' },
  { name: 'APEX TIRES', bg: '#1E293B', fg: '#F8FAFC' },
  { name: 'SUNGRID', bg: '#FF8A00', fg: '#0F172A' },
];

const FACADE_STYLES = ['curtain_glass', 'limestone_office', 'brick_residential'] as const;

const BUILDING_COLORS = ['#334155', '#475569', '#1E3A5F', '#7C2D12', '#134E4A', '#3B0764', '#3F3F46'];

export class CityWorldManager {
  private scene: THREE.Scene;
  private chunks = new Map<string, ActiveChunk>();
  private collidersCache: ColliderBox[] = [];
  private baseSeed = 1000;
  private timeOfDay: TimeOfDay = 'day';
  private radiusChunks = 2; // 5x5 grid around player

  public roadMat: THREE.MeshStandardMaterial;
  private sidewalkMat: THREE.MeshStandardMaterial;
  private groundMat: THREE.MeshStandardMaterial;
  private waterMat: THREE.MeshStandardMaterial;
  private trunkMat: THREE.MeshStandardMaterial;
  private leafMat: THREE.MeshStandardMaterial;
  private poleMat: THREE.MeshStandardMaterial;
  private facadeSets: PBRMapSet[] = [];
  private billboardMaterials: THREE.MeshBasicMaterial[] = [];
  private roadPBR: PBRMapSet;
  private horizonGround: THREE.Mesh;

  private signalTimer = 0;
  public signalPhase: TrafficSignalPhase = 'NS_GREEN';

  constructor(scene: THREE.Scene, maxAnisotropy: number) {
    this.scene = scene;
    this.roadPBR = createAsphaltPBR(maxAnisotropy);

    // Albedo + normal + roughness maps. Rain scales `roughness` (see weather.ts) on top of the map.
    this.roadMat = new THREE.MeshStandardMaterial({
      map: this.roadPBR.map,
      normalMap: this.roadPBR.normalMap,
      roughnessMap: this.roadPBR.roughnessMap,
      roughness: 0.82,
      metalness: 0.06,
    });
    this.sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, metalness: 0.05 });
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15, metalness: 0.4 });
    this.trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    this.leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.82 });
    this.poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });

    for (const b of BRANDS) {
      const tex = createBillboardTexture(b.name, b.bg, b.fg);
      this.billboardMaterials.push(new THREE.MeshBasicMaterial({ map: tex }));
    }

    // Endless horizon ground plane beneath everything to eliminate void edges
    this.horizonGround = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 }),
    );
    this.horizonGround.position.y = -0.15;
    this.horizonGround.receiveShadow = true;
    scene.add(this.horizonGround);

    this.rebuildFacadeTextures('day');
  }

  private rebuildFacadeTextures(timeOfDay: TimeOfDay): void {
    this.facadeSets.forEach((t) => t.dispose());
    this.facadeSets = BUILDING_COLORS.map((c, i) =>
      createArchitecturalFacadePBR(c, timeOfDay === 'night', FACADE_STYLES[i % FACADE_STYLES.length]),
    );
  }

  public configure(seed: number, timeOfDay: TimeOfDay, quality: ActiveQuality): void {
    this.clearAllChunks();
    this.baseSeed = seed;
    this.timeOfDay = timeOfDay;
    this.radiusChunks = quality === 'low' ? 1 : 2;
    this.rebuildFacadeTextures(timeOfDay);
  }

  public update(dt: number, playerX: number, playerZ: number): ColliderBox[] {
    // Update cycling traffic lights (Green 7s -> Yellow 2s -> Red/Green)
    this.signalTimer = (this.signalTimer + dt) % 18;
    if (this.signalTimer < 7) this.signalPhase = 'NS_GREEN';
    else if (this.signalTimer < 9) this.signalPhase = 'NS_YELLOW';
    else if (this.signalTimer < 16) this.signalPhase = 'EW_GREEN';
    else this.signalPhase = 'EW_YELLOW';

    const nsColor =
      this.signalPhase === 'NS_GREEN' ? 0x22c55e : this.signalPhase === 'NS_YELLOW' ? 0xfacc15 : 0xef4444;
    const ewColor =
      this.signalPhase === 'EW_GREEN' ? 0x22c55e : this.signalPhase === 'EW_YELLOW' ? 0xfacc15 : 0xef4444;

    this.horizonGround.position.x = Math.round(playerX / 60) * 60;
    this.horizonGround.position.z = Math.round(playerZ / 60) * 60;

    const pCx = Math.floor(playerX / CHUNK_SIZE);
    const pCz = Math.floor(playerZ / CHUNK_SIZE);

    const neededKeys = new Set<string>();
    for (let dx = -this.radiusChunks; dx <= this.radiusChunks; dx++) {
      for (let dz = -this.radiusChunks; dz <= this.radiusChunks; dz++) {
        const cx = pCx + dx;
        const cz = pCz + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);
        if (!this.chunks.has(key)) {
          this.chunks.set(key, this.generateChunk(cx, cz, key));
        }
      }
    }

    // Recycle distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        this.disposeChunk(chunk);
        this.chunks.delete(key);
      } else {
        chunk.nsLightMat.color.setHex(nsColor);
        chunk.ewLightMat.color.setHex(ewColor);
      }
    }

    // Rebuild active collider list from nearby chunks
    this.collidersCache.length = 0;
    for (const chunk of this.chunks.values()) {
      for (let i = 0; i < chunk.colliders.length; i++) {
        this.collidersCache.push(chunk.colliders[i]);
      }
    }
    return this.collidersCache;
  }

  private generateChunk(cx: number, cz: number, key: string): ActiveChunk {
    const group = new THREE.Group();
    const colliders: ColliderBox[] = [];
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;

    const chunkSeed = (this.baseSeed ^ Math.imul(cx + 500, 73856093) ^ Math.imul(cz + 500, 19349663)) >>> 0;
    const rand = mulberry32(chunkSeed);

    // 1. Roads along x = ox and z = oz
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, CHUNK_SIZE), this.roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(ox, 0.01, oz + CHUNK_SIZE * 0.5);
    nsRoad.receiveShadow = true;
    group.add(nsRoad);

    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, CHUNK_SIZE), this.roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.rotation.z = Math.PI / 2;
    ewRoad.position.set(ox + CHUNK_SIZE * 0.5, 0.012, oz);
    ewRoad.receiveShadow = true;
    group.add(ewRoad);

    // Intersection square + Crosswalks
    const inter = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, ROAD_HALF_WIDTH * 2).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 }),
    );
    inter.position.set(ox, 0.016, oz);
    inter.receiveShadow = true;
    group.add(inter);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    for (let s = -7; s <= 7; s += 3.2) {
      const cwN = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.2).rotateX(-Math.PI / 2), stripeMat);
      cwN.position.set(ox + s, 0.02, oz - ROAD_HALF_WIDTH - 1.8);
      const cwW = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3).rotateX(-Math.PI / 2), stripeMat);
      cwW.position.set(ox - ROAD_HALF_WIDTH - 1.8, 0.02, oz + s);
      group.add(cwN, cwW);
    }

    // 2. Traffic Lights at intersection corner
    const nsLightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const ewLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const tlPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.2, 6), this.poleMat);
    tlPost.position.set(ox + ROAD_HALF_WIDTH + 1.5, 2.6, oz + ROAD_HALF_WIDTH + 1.5);
    const tlArm = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 0.16), this.poleMat);
    tlArm.position.set(ox + ROAD_HALF_WIDTH - 0.5, 5.0, oz + ROAD_HALF_WIDTH + 1.5);
    const nsBulb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.45), nsLightMat);
    nsBulb.position.set(ox + ROAD_HALF_WIDTH - 1.5, 4.9, oz + ROAD_HALF_WIDTH + 1.5);

    const tlPost2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.2, 6), this.poleMat);
    tlPost2.position.set(ox - ROAD_HALF_WIDTH - 1.5, 2.6, oz - ROAD_HALF_WIDTH - 1.5);
    const ewBulb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.65), ewLightMat);
    ewBulb.position.set(ox - ROAD_HALF_WIDTH - 1.5, 4.9, oz - ROAD_HALF_WIDTH + 1.5);
    group.add(tlPost, tlArm, nsBulb, tlPost2, ewBulb);

    // 3. Highway Ring Gantry / Bridge / Tunnel Arch on ring cx==2 or cz==-2
    if (Math.abs(cx) === 2 && cz % 2 === 0) {
      const archL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 8.5, 2.2), this.poleMat);
      archL.position.set(ox - ROAD_HALF_WIDTH - 1.2, 4.25, oz + 55);
      const archR = archL.clone();
      archR.position.x = ox + ROAD_HALF_WIDTH + 1.2;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2 + 4, 1.8, 2.6), this.poleMat);
      beam.position.set(ox, 8.2, oz + 55);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(14, 2.2, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x14b8a6, emissive: 0x0f766e, emissiveIntensity: 0.4 }),
      );
      sign.position.set(ox, 8.2, oz + 53.6);
      group.add(archL, archR, beam, sign);
    }

    // 4. Block Pad & District Content inside [ox+10..ox+110, oz+10..oz+110]
    const blockCenterX = ox + CHUNK_SIZE * 0.5;
    const blockCenterZ = oz + CHUNK_SIZE * 0.5;
    const blockSpan = CHUNK_SIZE - ROAD_HALF_WIDTH * 2; // 100m

    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(blockSpan, 0.24, blockSpan), this.sidewalkMat);
    sidewalk.position.set(blockCenterX, 0.12, blockCenterZ);
    sidewalk.receiveShadow = true;
    group.add(sidewalk);

    // District determination
    const isHarbor = cx <= -2;
    const isIndustrial = cx >= 2 && cz <= -1;
    const isHillside = Math.abs(cx) >= 3 || Math.abs(cz) >= 3;

    if (isHarbor) {
      // Water basin & Shipping containers + Port Crane
      const water = new THREE.Mesh(new THREE.PlaneGeometry(76, 76).rotateX(-Math.PI / 2), this.waterMat);
      water.position.set(blockCenterX, 0.3, blockCenterZ);
      group.add(water);

      const containerColors = [0xff8a00, 0x14b8a6, 0xef4444, 0xffc93c];
      for (let i = 0; i < 4; i++) {
        const cw = 8;
        const cl = 18;
        const ch = 4.5 + (i % 2) * 4;
        const px = ox + 22 + i * 16;
        const pz = oz + 24;
        const cont = new THREE.Mesh(
          new THREE.BoxGeometry(cw, ch, cl),
          new THREE.MeshStandardMaterial({ color: containerColors[i % containerColors.length], roughness: 0.5 }),
        );
        cont.position.set(px, 0.24 + ch / 2, pz);
        cont.castShadow = true;
        group.add(cont);
        colliders.push({
          minX: px - cw / 2,
          maxX: px + cw / 2,
          minZ: pz - cl / 2,
          maxZ: pz + cl / 2,
          kind: 'building',
        });
      }
    } else if (isHillside) {
      // Terraced green hills & pine trees
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
      const h1 = new THREE.Mesh(new THREE.BoxGeometry(72, 6, 72), hillMat);
      h1.position.set(blockCenterX, 3.2, blockCenterZ);
      const h2 = new THREE.Mesh(new THREE.BoxGeometry(44, 9, 44), hillMat);
      h2.position.set(blockCenterX, 7.5, blockCenterZ);
      group.add(h1, h2);
      colliders.push({
        minX: blockCenterX - 36,
        maxX: blockCenterX + 36,
        minZ: blockCenterZ - 36,
        maxZ: blockCenterZ + 36,
        kind: 'building',
      });
    } else {
      // Downtown / Industrial Buildings (2x2 sub-lots inside the 100x100 block)
      for (let bx = 0; bx < 2; bx++) {
        for (let bz = 0; bz < 2; bz++) {
          const lotX = ox + 35 + bx * 50;
          const lotZ = oz + 35 + bz * 50;

          if (rand() < 0.14 && !isIndustrial) {
            // Mini urban park with trees
            const grass = new THREE.Mesh(
              new THREE.BoxGeometry(36, 0.1, 36),
              new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 }),
            );
            grass.position.set(lotX, 0.26, lotZ);
            group.add(grass);
            for (let t = 0; t < 4; t++) {
              const tx = lotX + (t % 2 === 0 ? -9 : 9);
              const tz = lotZ + (t < 2 ? -9 : 9);
              const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3, 6), this.trunkMat);
              trunk.position.set(tx, 1.7, tz);
              const crown = new THREE.Mesh(new THREE.ConeGeometry(2.8, 5.5, 7), this.leafMat);
              crown.position.set(tx, 5.2, tz);
              group.add(trunk, crown);
            }
            continue;
          }

          const bw = 26 + rand() * 12;
          const bd = 26 + rand() * 12;
          const bh = isIndustrial ? 10 + rand() * 12 : 16 + rand() * 38;
          const set = this.facadeSets[Math.floor(rand() * this.facadeSets.length)];
          const mat = new THREE.MeshStandardMaterial({
            map: set.map,
            normalMap: set.normalMap,
            normalScale: new THREE.Vector2(0.8, 0.8),
            roughnessMap: set.roughnessMap,
            roughness: 1.0,
            metalness: 0.12,
            emissive: this.timeOfDay === 'night' ? new THREE.Color(0x1e293b) : new THREE.Color(0x000000),
            emissiveMap: this.timeOfDay === 'night' ? set.map : null,
            emissiveIntensity: this.timeOfDay === 'night' ? 0.55 : 0,
          });
          const bldgGeo = new THREE.BoxGeometry(bw, bh, bd);
          // One facade tile covers ~14 floors (50 m): scale V on the four wall faces so floor height
          // stays realistic for both low and tall buildings (roof/bottom faces keep their UVs).
          const uv = bldgGeo.attributes.uv as THREE.BufferAttribute;
          const vScale = bh / 50;
          for (let vi = 0; vi < uv.count; vi++) {
            const faceIdx = Math.floor(vi / 4); // px,nx,py,ny,pz,nz
            if (faceIdx !== 2 && faceIdx !== 3) uv.setY(vi, uv.getY(vi) * vScale);
          }
          uv.needsUpdate = true;
          const bldg = new THREE.Mesh(bldgGeo, mat);
          bldg.position.set(lotX, 0.24 + bh / 2, lotZ);
          bldg.castShadow = true;
          bldg.receiveShadow = true;
          group.add(bldg);

          // Rooftop cap / smokestack
          if (isIndustrial) {
            const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 9, 8), this.poleMat);
            stack.position.set(lotX + 5, 0.24 + bh + 4.5, lotZ);
            group.add(stack);
          } else if (rand() > 0.45) {
            const cap = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.65, 2.4, bd * 0.65), this.poleMat);
            cap.position.set(lotX, 0.24 + bh + 1.2, lotZ);
            group.add(cap);
          }

          // Fictional brand billboard on corner buildings
          if (bx === 0 && bz === 0 && rand() > 0.35) {
            const bbMat = this.billboardMaterials[Math.floor(rand() * this.billboardMaterials.length)];
            const bb = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.5), bbMat);
            bb.position.set(lotX, 8.5, lotZ - bd / 2 - 0.6);
            group.add(bb);
          }

          colliders.push({
            minX: lotX - bw / 2,
            maxX: lotX + bw / 2,
            minZ: lotZ - bd / 2,
            maxZ: lotZ + bd / 2,
            kind: 'building',
          });
        }
      }
    }

    // 5. Sidewalk Street Lamps & Trees
    const lampBulbColor = this.timeOfDay === 'night' ? 0xfef08a : 0xe2e8f0;
    const lampMat = new THREE.MeshBasicMaterial({ color: lampBulbColor });
    for (let s = 26; s <= 94; s += 34) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.5, 6), this.poleMat);
      lamp.position.set(ox + ROAD_HALF_WIDTH + 1.2, 2.75, oz + s);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.35), lampMat);
      bulb.position.set(ox + ROAD_HALF_WIDTH + 0.7, 5.5, oz + s);
      group.add(lamp, bulb);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 2.4, 6), this.trunkMat);
      trunk.position.set(ox + s, 1.4, oz + ROAD_HALF_WIDTH + 1.8);
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 0), this.leafMat);
      leaf.position.set(ox + s, 3.6, oz + ROAD_HALF_WIDTH + 1.8);
      group.add(trunk, leaf);
    }

    this.scene.add(group);
    return { key, cx, cz, group, colliders, nsLightMat, ewLightMat };
  }

  private disposeChunk(chunk: ActiveChunk): void {
    this.scene.remove(chunk.group);
    chunk.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) {
          mat.forEach((mm) => {
            if (!this.isSharedMat(mm)) mm.dispose();
          });
        } else if (!this.isSharedMat(mat)) {
          mat.dispose();
        }
      }
    });
  }

  private isSharedMat(mat: THREE.Material): boolean {
    return (
      mat === this.roadMat ||
      mat === this.sidewalkMat ||
      mat === this.groundMat ||
      mat === this.waterMat ||
      mat === this.trunkMat ||
      mat === this.leafMat ||
      mat === this.poleMat ||
      this.billboardMaterials.includes(mat as THREE.MeshBasicMaterial)
    );
  }

  public clearAllChunks(): void {
    for (const chunk of this.chunks.values()) {
      this.disposeChunk(chunk);
    }
    this.chunks.clear();
  }

  public dispose(): void {
    this.clearAllChunks();
    this.scene.remove(this.horizonGround);
    this.horizonGround.geometry.dispose();
    (this.horizonGround.material as THREE.Material).dispose();
    this.roadPBR.dispose();
    this.facadeSets.forEach((t) => t.dispose());
    this.billboardMaterials.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  }
}
