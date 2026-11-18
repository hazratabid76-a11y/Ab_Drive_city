import * as THREE from 'three';

interface ParticleItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorHex: number;
}

export class ParticlePool {
  private mesh: THREE.InstancedMesh;
  private skidMesh: THREE.InstancedMesh;
  private items: ParticleItem[] = [];
  private skids: { active: boolean; x: number; z: number; ry: number; life: number }[] = [];
  private cursor = 0;
  private skidCursor = 0;
  private maxParticles = 180;
  private maxSkids = 160;
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.DodecahedronGeometry(0.35, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.maxParticles; i++) {
      this.items.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        colorHex: 0xffffff,
      });
      this.dummy.position.set(0, -50, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.tmpColor.setHex(0xffffff));
    }
    scene.add(this.mesh);

    // Skid marks pool
    const skidGeo = new THREE.PlaneGeometry(0.28, 1.35);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, this.maxSkids);
    this.skidMesh.frustumCulled = false;
    for (let i = 0; i < this.maxSkids; i++) {
      this.skids.push({ active: false, x: 0, z: -50, ry: 0, life: 0 });
      this.dummy.position.set(0, -50, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.skidMesh.setMatrixAt(i, this.dummy.matrix);
    }
    scene.add(this.skidMesh);
  }

  public spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    maxLife: number,
    colorHex: number,
  ): void {
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.maxParticles;
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.size = size;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.colorHex = colorHex;
  }

  public spawnSkid(x: number, z: number, ry: number): void {
    const s = this.skids[this.skidCursor];
    this.skidCursor = (this.skidCursor + 1) % this.maxSkids;
    s.active = true;
    s.x = x;
    s.z = z;
    s.ry = ry;
    s.life = 8.0;
  }

  public update(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -50, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      const scale = p.size * (0.4 + (1 - t) * 0.9) * Math.min(1, t * 2.5);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(t * 2, t * 3, 0);
      this.dummy.scale.setScalar(Math.max(0.01, scale));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.tmpColor.setHex(p.colorHex));
    }
    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    let skidDirty = false;
    for (let i = 0; i < this.maxSkids; i++) {
      const s = this.skids[i];
      if (!s.active) continue;
      skidDirty = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        this.dummy.position.set(0, -50, 0);
        this.dummy.scale.setScalar(0.001);
      } else {
        this.dummy.position.set(s.x, 0.035, s.z);
        this.dummy.rotation.set(0, s.ry, 0);
        this.dummy.scale.set(1, 1, 1);
      }
      this.dummy.updateMatrix();
      this.skidMesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (skidDirty) {
      this.skidMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public clear(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.items[i].active = false;
      this.dummy.position.set(0, -50, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.maxSkids; i++) {
      this.skids[i].active = false;
      this.dummy.position.set(0, -50, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.skidMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.skidMesh.geometry.dispose();
    (this.skidMesh.material as THREE.Material).dispose();
  }
}
