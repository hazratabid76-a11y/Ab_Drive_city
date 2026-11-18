import * as THREE from 'three';

export type CollectibleKind = 'coin' | 'nitro' | 'repair' | 'time' | 'star';

export interface CollectibleItem {
  id: number;
  kind: CollectibleKind;
  x: number;
  z: number;
  active: boolean;
  mesh: THREE.Group;
}

export interface ZoneMarker {
  x: number;
  z: number;
  heading: number;
  radius: number;
  kind: 'checkpoint' | 'destination' | 'pickup' | 'dropoff' | 'parking';
  mesh: THREE.Group;
  active: boolean;
}

export class WorldMarkersManager {
  private scene: THREE.Scene;
  public collectibles: CollectibleItem[] = [];
  public zones: ZoneMarker[] = [];
  private nextId = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public spawnCollectible(kind: CollectibleKind, x: number, z: number): void {
    const grp = new THREE.Group();
    grp.position.set(x, 1.15, z);

    if (kind === 'coin') {
      const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 14).rotateX(Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffc93c,
        emissive: 0xff8a00,
        emissiveIntensity: 0.75,
        metalness: 0.8,
        roughness: 0.2,
      });
      grp.add(new THREE.Mesh(geo, mat));
    } else if (kind === 'nitro') {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        emissive: 0x14b8a6,
        emissiveIntensity: 0.9,
        roughness: 0.25,
      });
      grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 10), mat));
    } else if (kind === 'repair') {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 0.85,
      });
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.45), mat));
    } else if (kind === 'time') {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.9,
      });
      grp.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat));
    } else {
      // Hidden star token
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.2,
        metalness: 0.7,
        roughness: 0.2,
      });
      grp.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), mat));
    }

    this.scene.add(grp);
    this.collectibles.push({ id: this.nextId++, kind, x, z, active: true, mesh: grp });
  }

  public spawnZone(
    kind: ZoneMarker['kind'],
    x: number,
    z: number,
    heading = 0,
    radius = 5.5,
  ): ZoneMarker {
    const grp = new THREE.Group();
    grp.position.set(x, 0.05, z);
    grp.rotation.y = heading;

    const colorMap: Record<ZoneMarker['kind'], number> = {
      checkpoint: 0x38bdf8,
      destination: 0x22c55e,
      pickup: 0xffc93c,
      dropoff: 0x14b8a6,
      parking: 0xff8a00,
    };
    const col = colorMap[kind];

    if (kind === 'parking') {
      // Rectangular parking bay outline + ghost floor
      const bayW = 3.2;
      const bayL = 5.8;
      const borderMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.88 });
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, bayL), borderMat);
      sideL.position.set(-bayW / 2, 0.04, 0);
      const sideR = sideL.clone();
      sideR.position.x = bayW / 2;
      const back = new THREE.Mesh(new THREE.BoxGeometry(bayW, 0.08, 0.18), borderMat);
      back.position.set(0, 0.04, -bayL / 2);
      const front = new THREE.Mesh(new THREE.BoxGeometry(bayW, 0.08, 0.18), borderMat);
      front.position.set(0, 0.04, bayL / 2);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(bayW - 0.3, bayL - 0.3).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false }),
      );
      floor.position.y = 0.02;

      // Corner guide pylons
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff8a00, emissiveIntensity: 0.7 });
      [
        [-bayW / 2, -bayL / 2],
        [bayW / 2, -bayL / 2],
        [-bayW / 2, bayL / 2],
        [bayW / 2, bayL / 2],
      ].forEach(([px, pz]) => {
        const py = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 8), pylonMat);
        py.position.set(px, 0.45, pz);
        grp.add(py);
      });

      grp.add(sideL, sideR, back, front, floor);
    } else {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius * 0.72, radius, 28).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
      );
      grp.add(ring);

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, 8, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      beacon.position.y = 4;
      grp.add(beacon);

      // Original low-poly passenger character for taxi pickup
      if (kind === 'pickup') {
        const passenger = new THREE.Group();
        const torso = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.85, 0.35),
          new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.6 }),
        );
        torso.position.y = 1.1;
        const legs = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 0.7, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
        );
        legs.position.y = 0.35;
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.38, 0.38),
          new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.6 }),
        );
        head.position.y = 1.75;
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.65, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x14b8a6 }),
        );
        arm.position.set(0.42, 1.55, 0);
        arm.rotation.z = -0.6;
        passenger.add(legs, torso, head, arm);
        passenger.position.set(2.4, 0, 0);
        grp.add(passenger);
      }
    }

    this.scene.add(grp);
    const marker: ZoneMarker = { x, z, heading, radius, kind, mesh: grp, active: true };
    this.zones.push(marker);
    return marker;
  }

  public update(t: number): void {
    for (let i = 0; i < this.collectibles.length; i++) {
      const c = this.collectibles[i];
      if (!c.active) continue;
      c.mesh.rotation.y = t * 2.6 + c.id;
      c.mesh.position.y = 1.05 + Math.sin(t * 3.5 + c.id) * 0.22;
    }
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      if (!z.active || z.kind === 'parking') continue;
      const scale = 1 + Math.sin(t * 4) * 0.06;
      z.mesh.scale.set(scale, 1, scale);
    }
  }

  public clear(): void {
    for (const c of this.collectibles) {
      this.scene.remove(c.mesh);
      c.mesh.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh;
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    }
    this.collectibles = [];

    for (const z of this.zones) {
      this.scene.remove(z.mesh);
      z.mesh.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh;
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    }
    this.zones = [];
  }
}
