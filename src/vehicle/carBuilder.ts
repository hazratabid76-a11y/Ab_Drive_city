import * as THREE from 'three';
import { PAINT_FINISHES } from '../data/cars';
import { CarClass, CarCustomization, CarDef, SpoilerStyle, WheelStyle } from '../types/game';

export interface BuiltCarMesh {
  root: THREE.Group;
  bodyGroup: THREE.Group; // Rolls/pitches on suspension
  wheelSteerPivots: [THREE.Group, THREE.Group]; // FL, FR
  wheelSpinMeshes: [THREE.Group, THREE.Group, THREE.Group, THREE.Group]; // FL, FR, RL, RR
  brakeLightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  headlights: THREE.SpotLight[];
  underglowMesh: THREE.Mesh | null;
  paintMat: THREE.MeshPhysicalMaterial;
  frontBumper: THREE.Mesh;
  hoodMesh: THREE.Mesh;
  dispose: () => void;
}

const WHEEL_GEO_TIRE = new THREE.CylinderGeometry(0.35, 0.35, 0.24, 16);
WHEEL_GEO_TIRE.rotateZ(Math.PI / 2);

const WHEEL_GEO_RIM = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12);
WHEEL_GEO_RIM.rotateZ(Math.PI / 2);

const CONTACT_SHADOW_TEX = (() => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.65)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

function buildWheelMesh(style: WheelStyle, radius: number, width: number): THREE.Group {
  const grp = new THREE.Group();
  const scaleR = radius / 0.35;
  const scaleW = width / 0.24;

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.88, metalness: 0.08 });
  const tire = new THREE.Mesh(WHEEL_GEO_TIRE, tireMat);
  tire.scale.set(scaleW, scaleR, scaleR);
  tire.castShadow = true;
  grp.add(tire);

  const rimColor =
    style === 'aero_disc' ? 0xf8fafc : style === 'offroad_bead' ? 0xff8a00 : style === 'sport_5' ? 0xdbeafe : 0xcbd5e1;
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    roughness: 0.25,
    metalness: 0.82,
  });
  const rim = new THREE.Mesh(WHEEL_GEO_RIM, rimMat);
  rim.scale.set(scaleW, scaleR, scaleR);
  grp.add(rim);

  // Spoke bar so rotation is visibly readable at any speed
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.7 });
  const spokeCount = style === 'sport_5' ? 3 : style === 'aero_disc' ? 2 : 2;
  for (let i = 0; i < spokeCount; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.26 * scaleW, radius * 1.45, 0.055), spokeMat);
    spoke.rotation.x = (i * Math.PI) / spokeCount;
    grp.add(spoke);
  }

  return grp;
}

function buildSpoiler(style: SpoilerStyle, length: number, width: number, paintMat: THREE.Material): THREE.Group | null {
  if (style === 'none') return null;
  const g = new THREE.Group();
  const zPos = length * 0.44;
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.65 });

  if (style === 'lip') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.08, 0.18), paintMat);
    lip.position.set(0, 0.06, zPos);
    lip.rotation.x = -0.25;
    g.add(lip);
  } else if (style === 'gt_wing') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.06, 0.28), carbonMat);
    wing.position.set(0, 0.24, zPos + 0.05);
    wing.rotation.x = 0.14;
    g.add(wing);

    [-width * 0.32, width * 0.32].forEach((x) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.12), carbonMat);
      strut.position.set(x, 0.12, zPos);
      g.add(strut);
    });
  } else if (style === 'twin_aero') {
    const wing1 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, 0.05, 0.22), paintMat);
    wing1.position.set(0, 0.22, zPos);
    g.add(wing1);
    const wing2 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.05, 0.18), carbonMat);
    wing2.position.set(0, 0.32, zPos + 0.08);
    wing2.rotation.x = 0.18;
    g.add(wing2);

    [-width * 0.38, width * 0.38].forEach((x) => {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.32), carbonMat);
      endplate.position.set(x, 0.24, zPos + 0.04);
      g.add(endplate);
    });
  }
  return g;
}


// ---------------------------------------------------------------------------
// Sculpted car body: extruded side silhouettes (hood / A-pillar / roof / C-pillar / trunk)
// instead of stacked boxes. Pickup and Truck-lite keep their functional box layout.
// ---------------------------------------------------------------------------

interface BodyProfile {
  ua0: number; // windshield base, fraction of length from front
  ua1: number; // windshield top
  ur1: number; // roof end
  uc1: number; // rear glass base
  roofF: number; // roof height as fraction of car height
  rearDrop: number; // trunk / tailgate edge height relative to belt line
}

function getBodyProfile(cls: CarClass): BodyProfile {
  switch (cls) {
    case 'Hatchback':
      return { ua0: 0.31, ua1: 0.44, ur1: 0.82, uc1: 0.96, roofF: 0.93, rearDrop: -0.02 };
    case 'SUV':
      return { ua0: 0.30, ua1: 0.42, ur1: 0.86, uc1: 0.97, roofF: 0.95, rearDrop: 0.0 };
    case 'Sports':
      return { ua0: 0.33, ua1: 0.49, ur1: 0.68, uc1: 0.86, roofF: 0.90, rearDrop: -0.06 };
    case 'Supercar':
      return { ua0: 0.35, ua1: 0.50, ur1: 0.66, uc1: 0.86, roofF: 0.90, rearDrop: -0.08 };
    default: // Sedan, Taxi
      return { ua0: 0.30, ua1: 0.45, ur1: 0.70, uc1: 0.80, roofF: 0.92, rearDrop: 0.02 };
  }
}

/**
 * Extrudes a side silhouette drawn in (x_s = length axis, front = negative; y_s = height)
 * so that world X = width, Y = height, Z = length with the nose pointing to -Z.
 * Result is centred on X = 0.
 */
function extrudeSideProfile(
  shape: THREE.Shape,
  width: number,
  bevel: { thickness: number; size: number } | null,
): THREE.ExtrudeGeometry {
  const depth = bevel ? Math.max(0.01, width - bevel.thickness * 2) : width;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: !!bevel,
    bevelThickness: bevel ? bevel.thickness : 0,
    bevelSize: bevel ? bevel.size : 0,
    bevelSegments: bevel ? 2 : 0,
    curveSegments: 6,
  });
  // rotateY(-90deg): x' = -z, z' = x  ->  shape front (x_s < 0) lands on -Z, extrusion runs along -X
  geo.rotateY(-Math.PI / 2);
  geo.translate(depth * 0.5, 0, 0);
  return geo;
}

/** Dashboard, steering wheel and two front seats, visible through the glass. */
function buildCockpitInterior(
  w: number,
  floorY: number,
  dashZ: number,
  headroom: number, // vertical space between floor and roof glass
): { group: THREE.Group; steeringWheel: THREE.Mesh } {
  const grp = new THREE.Group();
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.65, metalness: 0.1 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.2 });

  const dash = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.36, 0.42), dashMat);
  dash.position.set(0, floorY + 0.18, dashZ);
  grp.add(dash);

  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 18), leatherMat);
  steeringWheel.position.set(-w * 0.21, floorY + 0.42, dashZ + 0.3);
  steeringWheel.rotation.x = -0.45;
  grp.add(steeringWheel);

  [-w * 0.21, w * 0.21].forEach((sx) => {
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.42), leatherMat);
    seatBase.position.set(sx, floorY + 0.14, dashZ + 0.95);
    const backH = Math.min(0.52, Math.max(0.2, headroom - 0.2));
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, backH, 0.11), leatherMat);
    seatBack.position.set(sx, floorY + 0.14 + backH * 0.5, dashZ + 1.17);
    seatBack.rotation.x = -0.18;
    grp.add(seatBase, seatBack);
  });

  return { group: grp, steeringWheel };
}

interface SculptedBodyResult {
  hoodMesh: THREE.Mesh;
  rearDeckY: number; // for spoiler placement
  roofY: number;
  beltY: number;
}

function buildSculptedBody(args: {
  car: CarDef;
  bodyGroup: THREE.Group;
  paintMat: THREE.Material;
  trimMat: THREE.Material;
  darkTrimMat: THREE.Material;
  glassMat: THREE.Material;
  chassisY: number;
  lowerH: number;
  isGhost: boolean;
  isPursuer: boolean;
  withInterior: boolean;
}): SculptedBodyResult {
  const { car, bodyGroup, paintMat, trimMat, darkTrimMat, glassMat, chassisY, lowerH, isGhost, isPursuer, withInterior } = args;
  const { width: w, height: h, length: l } = car.dimensions;
  const prof = getBodyProfile(car.carClass);
  const isSport = car.carClass === 'Sports' || car.carClass === 'Supercar';

  const b = 0.05; // bevel size; outlines are drawn inset by b so the final silhouette equals the nominal one
  const halfL = l * 0.5;
  const y0 = chassisY * 0.8; // underside
  const yb = chassisY + lowerH; // belt line / hood height
  const roofH = h * prof.roofF;
  const cY = yb + (isSport ? 0 : 0.02);
  const rearY = yb + prof.rearDrop;
  const xa0 = -halfL + prof.ua0 * l;
  const xa1 = -halfL + prof.ua1 * l;
  const xr1 = -halfL + prof.ur1 * l;
  const xc1 = -halfL + prof.uc1 * l;
  const noseY = yb - 0.1;

  const mkMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow && !isGhost;
    m.receiveShadow = true;
    bodyGroup.add(m);
    return m;
  };

  // --- Front section: bumper, nose, hood (rounded edges) ---
  const front = new THREE.Shape();
  front.moveTo(-halfL + b, y0 + b);
  front.lineTo(-halfL + b, noseY - b);
  front.quadraticCurveTo(-halfL + b + 0.04, yb - b, -halfL + b + 0.26, yb - b);
  front.lineTo(xa0 - b, yb - b);
  front.lineTo(xa0 - b, y0 + b);
  front.closePath();
  const bevel = { thickness: 0.06, size: b };
  mkMesh(extrudeSideProfile(front, w, bevel), paintMat);

  // --- Rear section: trunk deck / tailgate ---
  const rear = new THREE.Shape();
  rear.moveTo(xc1 + b, y0 + b);
  rear.lineTo(xc1 + b, cY - b);
  rear.lineTo(halfL - b - 0.14, rearY - b);
  rear.lineTo(halfL - b, rearY - 0.1 - b);
  rear.lineTo(halfL - b, y0 + b);
  rear.closePath();
  mkMesh(extrudeSideProfile(rear, w, bevel), paintMat);

  // --- Door sills / side panels (thin slabs so the cabin stays open for the interior) ---
  const door = new THREE.Shape();
  door.moveTo(xa0, y0);
  door.lineTo(xa0, yb);
  door.lineTo(xc1, cY);
  door.lineTo(xc1, y0);
  door.closePath();
  const doorGeo = extrudeSideProfile(door, 0.08, null);
  [-1, 1].forEach((side) => {
    const g = doorGeo.clone();
    g.translate(side * (w * 0.5 - 0.04), 0, 0);
    mkMesh(g, paintMat);
  });
  doorGeo.dispose();

  // Cabin floor
  const floorLen = xc1 - xa0;
  const floorY = y0 + 0.08;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.06, floorLen), darkTrimMat);
  floor.position.set(0, floorY - 0.03, (xa0 + xc1) * 0.5);
  bodyGroup.add(floor);

  // Dark sill band along the lower body
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.1, l * 0.62), darkTrimMat);
  skirt.position.set(0, y0 + 0.06, 0);
  bodyGroup.add(skirt);

  if (isPursuer) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, (yb - y0) * 0.7, floorLen * 0.9), trimMat);
    stripe.position.set(0, (yb + y0) * 0.5, (xa0 + xc1) * 0.5);
    bodyGroup.add(stripe);
  }

  // --- Greenhouse: glass volume + roof panel + pillars ---
  const gh = new THREE.Shape();
  gh.moveTo(xa0, yb);
  gh.lineTo(xa1, roofH - 0.07);
  gh.lineTo(xr1, roofH - 0.07);
  gh.lineTo(xc1, cY);
  gh.closePath();
  const glass = new THREE.Mesh(extrudeSideProfile(gh, w * 0.84, null), glassMat);
  bodyGroup.add(glass);

  const roofLen = xr1 - xa1 + 0.16;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.07, roofLen), paintMat);
  roof.position.set(0, roofH - 0.035, (xa1 + xr1) * 0.5);
  roof.castShadow = !isGhost;
  bodyGroup.add(roof);

  const addPillar = (x0: number, y0p: number, x1: number, y1p: number, thick: number) => {
    const dz = x1 - x0;
    const dy = y1p - y0p;
    const len = Math.hypot(dz, dy);
    [-1, 1].forEach((side) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.07, len, thick), paintMat);
      pillar.position.set(side * w * 0.43, (y0p + y1p) * 0.5, (x0 + x1) * 0.5);
      pillar.rotation.x = Math.atan2(dz, dy);
      bodyGroup.add(pillar);
    });
  };
  addPillar(xa0, yb, xa1, roofH - 0.03, 0.08); // A-pillar
  addPillar(xr1, roofH - 0.03, xc1, cY, 0.13); // C-pillar
  // B-pillar
  const bz = (xa1 + xr1) * 0.5 + 0.1;
  [-1, 1].forEach((side) => {
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.07, roofH - 0.05 - yb, 0.09), darkTrimMat);
    bp.position.set(side * w * 0.43, (yb + roofH - 0.05) * 0.5, bz);
    bodyGroup.add(bp);
  });

  // Cabin: real interior for the player / showroom, a cheap dark block for traffic
  if (withInterior && !isGhost) {
    const { group } = buildCockpitInterior(w, floorY, xa0 + 0.26, roofH - 0.08 - floorY);
    bodyGroup.add(group);
  } else if (!isGhost) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, roofH - 0.12 - yb, floorLen * 0.9), darkTrimMat);
    block.position.set(0, (yb + roofH - 0.12) * 0.5, (xa0 + xc1) * 0.5);
    bodyGroup.add(block);
  }

  // Separate thin hood panel so crash damage can still bend it
  const hoodLen = (xa0 - (-halfL + 0.26)) * 0.96;
  const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.035, hoodLen), paintMat);
  hoodMesh.position.set(0, yb + 0.012, (-halfL + 0.26 + xa0) * 0.5);
  hoodMesh.rotation.x = isSport ? 0.03 : 0.015;
  hoodMesh.castShadow = !isGhost;
  bodyGroup.add(hoodMesh);

  return { hoodMesh, rearDeckY: rearY, roofY: roofH, beltY: yb };
}

export interface BuildCarOptions {
  car: CarDef;
  customization: CarCustomization;
  isPlayer?: boolean;
  isNight?: boolean;
  isPursuer?: boolean;
  isGhost?: boolean;
  showInterior?: boolean; // showroom / garage preview
}

export function buildProceduralCar(opts: BuildCarOptions): BuiltCarMesh {
  const { car, customization, isPlayer = false, isNight = false, isPursuer = false, isGhost = false } = opts;
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const { width: w, height: h, length: l } = car.dimensions;
  const finish = PAINT_FINISHES.find((f) => f.id === customization.finish) || PAINT_FINISHES[0];

  const paintColor = isPursuer ? '#0F172A' : customization.color;
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintColor),
    roughness: finish.roughness,
    metalness: finish.metalness,
    clearcoat: finish.clearcoat,
    clearcoatRoughness: 0.12,
    transparent: isGhost,
    opacity: isGhost ? 0.38 : 1.0,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: isPursuer ? 0xf8fafc : 0x1e293b,
    roughness: 0.6,
    metalness: 0.3,
    transparent: isGhost,
    opacity: isGhost ? 0.35 : 1,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.72,
    metalness: 0.25,
    transparent: isGhost,
    opacity: isGhost ? 0.35 : 1,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: isGhost ? 0x38bdf8 : 0x0f172a,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
    transparent: true,
    opacity: isGhost ? 0.32 : 0.6,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: new THREE.Color(0xfef08a),
    emissiveIntensity: isNight ? 2.8 : 1.2,
    roughness: 0.2,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 0.65,
    roughness: 0.25,
  });

  // Ground clearance & wheel size by car class
  const cls: CarClass = car.carClass;
  const isTruck = cls === 'Truck-lite';
  const isSuvOrPickup = cls === 'SUV' || cls === 'Pickup';
  const isSport = cls === 'Sports' || cls === 'Supercar';
  const wheelR = isTruck ? 0.42 : isSuvOrPickup ? 0.39 : 0.34;
  const wheelW = isSport ? 0.28 : 0.24;
  const chassisY = wheelR * 0.95;

  const useSculpted = !isTruck && cls !== 'Pickup';
  const lowerH = isTruck ? 0.56 : isSuvOrPickup ? 0.52 : isSport ? 0.40 : 0.46;

  let hoodMesh: THREE.Mesh;
  let deckHeight = chassisY + lowerH;
  let spoilerY = chassisY + lowerH;
  let cabinY = chassisY + lowerH;
  let roofTopY = 0;

  if (useSculpted) {
    const sc = buildSculptedBody({
      car,
      bodyGroup,
      paintMat,
      trimMat,
      darkTrimMat,
      glassMat,
      chassisY,
      lowerH,
      isGhost,
      isPursuer,
      withInterior: isPlayer || !!opts.showInterior,
    });
    hoodMesh = sc.hoodMesh;
    cabinY = sc.beltY;
    roofTopY = sc.roofY;
    deckHeight = sc.roofY - 0.45;
    spoilerY =
      cls === 'Hatchback' || cls === 'SUV' ? sc.rearDeckY + (sc.roofY - sc.rearDeckY) * 0.3 : sc.rearDeckY;
  }

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.18, 0.22), darkTrimMat);
  frontBumper.position.set(0, chassisY + 0.14, -l * 0.5 + 0.05);
  bodyGroup.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.18, 0.2), darkTrimMat);
  rearBumper.position.set(0, chassisY + 0.14, l * 0.5 - 0.05);
  bodyGroup.add(rearBumper);

  if (!useSculpted) {
    // 1. Box-built body (Pickup / Truck-lite)
    const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(w, lowerH, l), paintMat);
    lowerHull.position.set(0, chassisY + lowerH * 0.5, 0);
    lowerHull.castShadow = !isGhost;
    lowerHull.receiveShadow = true;
    bodyGroup.add(lowerHull);

    // Side Skirts / Accent Stripe
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.11, l * 0.68), darkTrimMat);
    skirt.position.set(0, chassisY + 0.07, 0);
    bodyGroup.add(skirt);

    // Pursuer white door panel stripe
    if (isPursuer) {
      const doorStripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, lowerH * 0.78, l * 0.42), trimMat);
      doorStripe.position.set(0, chassisY + lowerH * 0.5, 0);
      bodyGroup.add(doorStripe);
    }

    // 2. Hood & Front Bumper (also deformable on damage)
    hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.12, l * 0.32), paintMat);
    hoodMesh.position.set(0, chassisY + lowerH + 0.02, -l * 0.29);
    hoodMesh.rotation.x = isSport ? 0.08 : 0.04;
    hoodMesh.castShadow = !isGhost;
    bodyGroup.add(hoodMesh);

    // 3. Secondary Cabin / Roof Silhouette by Car Class
    deckHeight = cabinY;

    if (cls === 'Pickup') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, h * 0.44, l * 0.34), paintMat);
      cab.position.set(0, cabinY + h * 0.21, -l * 0.08);
      cab.castShadow = !isGhost;
      bodyGroup.add(cab);

      const glassBand = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, h * 0.30, l * 0.30), glassMat);
      glassBand.position.set(0, cabinY + h * 0.20, -l * 0.08);
      bodyGroup.add(glassBand);

      // Open pickup bed walls
      const bedSideL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, l * 0.38), paintMat);
      bedSideL.position.set(-w * 0.44, cabinY + 0.11, l * 0.29);
      const bedSideR = bedSideL.clone();
      bedSideR.position.x = w * 0.44;
      const bedBack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.22, 0.1), paintMat);
      bedBack.position.set(0, cabinY + 0.11, l * 0.47);
      bodyGroup.add(bedSideL, bedSideR, bedBack);
      deckHeight = cabinY;
    } else if (cls === 'Truck-lite') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, h * 0.48, l * 0.28), paintMat);
      cab.position.set(0, cabinY + h * 0.23, -l * 0.30);
      cab.castShadow = !isGhost;
      bodyGroup.add(cab);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.90, h * 0.28, l * 0.22), glassMat);
      windshield.position.set(0, cabinY + h * 0.26, -l * 0.32);
      bodyGroup.add(windshield);

      const cargoBox = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.96, h * 0.66, l * 0.60),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.55, metalness: 0.15 }),
      );
      cargoBox.position.set(0, cabinY + h * 0.32, l * 0.18);
      cargoBox.castShadow = !isGhost;
      bodyGroup.add(cargoBox);
      deckHeight = cabinY + 0.05;
    }
  }

  if (useSculpted && !isGhost) {
    if (cls === 'Taxi') {
      const signMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: new THREE.Color(0xfacc15),
        emissiveIntensity: 1.4,
      });
      const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.24), signMat);
      taxiSign.position.set(0, roofTopY + 0.08, -0.05);
      bodyGroup.add(taxiSign);
    }
    if (cls === 'Supercar') {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.55), darkTrimMat);
      scoop.position.set(0, roofTopY + 0.03, l * 0.12);
      bodyGroup.add(scoop);
    }
  }

  // Pursuer Lightbar (original amber/cyan split bar)
  if (isPursuer) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.22), darkTrimMat);
    barBase.position.set(0, deckHeight + 0.48, -0.05);
    const barL = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.11, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x14b8a6, emissive: 0x14b8a6, emissiveIntensity: 2.5 }),
    );
    barL.position.set(-0.24, deckHeight + 0.52, -0.05);
    const barR = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.11, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff8a00, emissiveIntensity: 2.5 }),
    );
    barR.position.set(0.24, deckHeight + 0.52, -0.05);
    bodyGroup.add(barBase, barL, barR);
  }

  // 4. Headlights, Grille & Tail/Brake Lights
  const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.44, 0.16, 0.06), darkTrimMat);
  grille.position.set(0, chassisY + 0.24, -l * 0.5 - 0.01);
  bodyGroup.add(grille);

  [-w * 0.34, w * 0.34].forEach((lx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), headlightMat);
    hl.position.set(lx, chassisY + 0.30, -l * 0.5 - 0.01);
    bodyGroup.add(hl);

    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.06), brakeLightMat);
    bl.position.set(lx, chassisY + 0.32, l * 0.5 + 0.01);
    bodyGroup.add(bl);
  });

  // Exhaust Pipes
  [-w * 0.24, w * 0.24].forEach((ex) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.16, 8).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 }),
    );
    pipe.position.set(ex, chassisY + 0.1, l * 0.5 + 0.03);
    bodyGroup.add(pipe);
  });

  // 5. Optional Spoiler
  const spoiler = buildSpoiler(isGhost ? 'none' : customization.spoiler, l, w, paintMat);
  if (spoiler) {
    spoiler.position.y = useSculpted ? spoilerY : cabinY;
    bodyGroup.add(spoiler);
  }

  // 6. Optional Neon Underglow
  let underglowMesh: THREE.Mesh | null = null;
  if (!isGhost && !isPursuer && customization.underglow && customization.underglow !== 'none') {
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(customization.underglow),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    underglowMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.15, l * 1.04), glowMat);
    underglowMesh.rotation.x = -Math.PI / 2;
    underglowMesh.position.y = 0.035;
    root.add(underglowMesh);
  }

  // 7. Contact Shadow Grounding
  if (!isGhost && CONTACT_SHADOW_TEX) {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.35, l * 1.25),
      new THREE.MeshBasicMaterial({
        map: CONTACT_SHADOW_TEX,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    root.add(shadowPlane);
  }

  // 8. Real Night Headlight Cones (for Player Car)
  const headlights: THREE.SpotLight[] = [];
  if (isPlayer && !isGhost) {
    [-w * 0.34, w * 0.34].forEach((lx) => {
      const spot = new THREE.SpotLight(0xfffbeb, isNight ? 45 : 0, 52, Math.PI / 5.5, 0.45, 1.4);
      spot.position.set(lx, chassisY + 0.38, -l * 0.48);
      const target = new THREE.Object3D();
      target.position.set(lx * 0.8, 0.1, -18);
      bodyGroup.add(target);
      spot.target = target;
      bodyGroup.add(spot);
      headlights.push(spot);
    });
  }

  // 9. Four Wheels (Front 2 with steering pivots)
  const wheelX = w * 0.47;
  const wheelFrontZ = -l * 0.31;
  const wheelRearZ = l * 0.31;
  const wStyle: WheelStyle = isGhost || isPursuer ? 'stock' : customization.wheelStyle;

  const flPivot = new THREE.Group();
  flPivot.position.set(-wheelX, wheelR, wheelFrontZ);
  const flSpin = buildWheelMesh(wStyle, wheelR, wheelW);
  flPivot.add(flSpin);
  root.add(flPivot);

  const frPivot = new THREE.Group();
  frPivot.position.set(wheelX, wheelR, wheelFrontZ);
  const frSpin = buildWheelMesh(wStyle, wheelR, wheelW);
  frPivot.add(frSpin);
  root.add(frPivot);

  const rlSpin = buildWheelMesh(wStyle, wheelR, wheelW);
  rlSpin.position.set(-wheelX, wheelR, wheelRearZ);
  root.add(rlSpin);

  const rrSpin = buildWheelMesh(wStyle, wheelR, wheelW);
  rrSpin.position.set(wheelX, wheelR, wheelRearZ);
  root.add(rrSpin);

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry !== WHEEL_GEO_TIRE && m.geometry !== WHEEL_GEO_RIM) {
          m.geometry.dispose();
        }
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
  };

  return {
    root,
    bodyGroup,
    wheelSteerPivots: [flPivot, frPivot],
    wheelSpinMeshes: [flSpin, frSpin, rlSpin, rrSpin],
    brakeLightMat,
    headlightMat,
    headlights,
    underglowMesh,
    paintMat,
    frontBumper,
    hoodMesh,
    dispose,
  };
}
