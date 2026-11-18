import * as THREE from 'three';

export interface ArticulatedPedestrian {
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  dispose: () => void;
}

const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const JACKET_COLORS = [0x1e293b, 0x334155, 0x7c2d12, 0x0f766e, 0x374151, 0x991b1b];
const TROUSER_COLORS = [0x0f172a, 0x1e3a5f, 0x3f3f46, 0x292524];

export function buildRealisticPedestrian(seedIdx: number): ArticulatedPedestrian {
  const root = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN_TONES[seedIdx % SKIN_TONES.length],
    roughness: 0.62,
    metalness: 0.02,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: JACKET_COLORS[seedIdx % JACKET_COLORS.length],
    roughness: 0.78,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: TROUSER_COLORS[seedIdx % TROUSER_COLORS.length],
    roughness: 0.85,
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });

  // Natural 1.75m human proportions (~7.5 heads tall)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 4, 10), topMat);
  torso.scale.set(1.18, 1.0, 0.72);
  torso.position.y = 1.14;
  torso.castShadow = true;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 8), skinMat);
  neck.position.y = 1.44;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skinMat);
  head.scale.set(0.92, 1.08, 0.98);
  head.position.y = 1.58;
  head.castShadow = true;

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.114, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  hair.position.set(0, 1.59, -0.01);

  const makeLimb = (radius: number, len: number, mat: THREE.Material, yPivot: number, xOffset: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, yPivot, 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 4, 8), mat);
    mesh.position.y = -len * 0.5 - radius * 0.5;
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  };

  const leftLeg = makeLimb(0.068, 0.68, pantsMat, 0.86, -0.095);
  const rightLeg = makeLimb(0.068, 0.68, pantsMat, 0.86, 0.095);
  const leftArm = makeLimb(0.048, 0.48, topMat, 1.34, -0.23);
  const rightArm = makeLimb(0.048, 0.48, topMat, 1.34, 0.23);

  root.add(torso, neck, head, hair, leftLeg, rightLeg, leftArm, rightArm);

  return {
    root,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    dispose: () => {
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
      [skinMat, topMat, pantsMat, hairMat].forEach((m) => m.dispose());
    },
  };
}

export function animatePedestrianWalk(ped: ArticulatedPedestrian, time: number, speed = 1.0): void {
  const swing = Math.sin(time * 4.5 * speed) * 0.48;
  ped.leftLeg.rotation.x = swing;
  ped.rightLeg.rotation.x = -swing;
  ped.leftArm.rotation.x = -swing * 0.75;
  ped.rightArm.rotation.x = swing * 0.75;
}