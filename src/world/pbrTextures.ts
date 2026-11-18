import * as THREE from 'three';

export interface PBRMapSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function createAsphaltPBR(anisotropy: number): PBRMapSet {
  const size = 512;
  const [albC, alb] = makeCanvas(size, size);
  const [nrmC, nrm] = makeCanvas(size, size);
  const [rghC, rgh] = makeCanvas(size, size);

  // Base worn asphalt albedo
  alb.fillStyle = '#23272e';
  alb.fillRect(0, 0, size, size);

  // Base flat normal (128, 128, 255)
  nrm.fillStyle = 'rgb(128,128,255)';
  nrm.fillRect(0, 0, size, size);

  // Base dry asphalt roughness (~0.84 -> 214)
  rgh.fillStyle = 'rgb(214,214,214)';
  rgh.fillRect(0, 0, size, size);

  // Aggregate stone micro-grain + subtle tire wear tracks
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 26 + Math.floor(Math.random() * 28);
    alb.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    alb.fillRect(x, y, 2, 2);

    const nx = 112 + Math.floor(Math.random() * 32);
    const ny = 112 + Math.floor(Math.random() * 32);
    nrm.fillStyle = `rgb(${nx},${ny},248)`;
    nrm.fillRect(x, y, 2, 2);
  }

  // Darker, smoother tire-polished wheel paths in each of the 4 lanes
  const laneCenters = [64, 184, 328, 448];
  for (const lx of laneCenters) {
    const grad = rgh.createLinearGradient(lx - 26, 0, lx + 26, 0);
    grad.addColorStop(0, 'rgba(165,165,165,0)');
    grad.addColorStop(0.5, 'rgba(155,155,155,0.55)');
    grad.addColorStop(1, 'rgba(165,165,165,0)');
    rgh.fillStyle = grad;
    rgh.fillRect(lx - 26, 0, 52, size);
  }

  // Thermoplastic road markings (high-visibility matte paint)
  alb.fillStyle = '#d99b26';
  alb.fillRect(250, 0, 4, size);
  alb.fillRect(258, 0, 4, size);

  alb.fillStyle = '#e2e8f0';
  for (let y = 12; y < size; y += 64) {
    alb.fillRect(124, y, 5, 32);
    alb.fillRect(383, y, 5, 32);
  }
  alb.fillRect(10, 0, 5, size);
  alb.fillRect(size - 15, 0, 5, size);

  const map = new THREE.CanvasTexture(albC);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(nrmC);
  const roughnessMap = new THREE.CanvasTexture(rghC);

  [map, normalMap, roughnessMap].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 6);
    t.anisotropy = Math.min(16, anisotropy);
  });

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

export function createArchitecturalFacadePBR(
  wallHex: string,
  isNight: boolean,
  style: 'curtain_glass' | 'limestone_office' | 'brick_residential',
): PBRMapSet {
  const w = 256;
  const h = 512;
  const [albC, alb] = makeCanvas(w, h);
  const [nrmC, nrm] = makeCanvas(w, h);
  const [rghC, rgh] = makeCanvas(w, h);

  alb.fillStyle = wallHex;
  alb.fillRect(0, 0, w, h);
  nrm.fillStyle = 'rgb(128,128,255)';
  nrm.fillRect(0, 0, w, h);
  rgh.fillStyle = style === 'curtain_glass' ? 'rgb(65,65,65)' : 'rgb(205,205,205)';
  rgh.fillRect(0, 0, w, h);

  const cols = 6;
  const rows = 14;
  const padX = 8;
  const padY = 8;
  const cellW = (w - padX * 2) / cols;
  const cellH = (h - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    // Horizontal floor slab spandrel band
    const sy = padY + r * cellH;
    alb.fillStyle = 'rgba(15,23,42,0.45)';
    alb.fillRect(0, sy, w, 4);
    nrm.fillStyle = 'rgb(128,158,255)';
    nrm.fillRect(0, sy, w, 4);

    for (let c = 0; c < cols; c++) {
      const wx = padX + c * cellW + 4;
      const wy = sy + 6;
      const ww = cellW - 8;
      const wh = cellH - 10;

      const litProb = isNight ? 0.48 : 0.14;
      const isLit = Math.random() < litProb;

      if (isLit) {
        alb.fillStyle = Math.random() > 0.35 ? '#fde68a' : '#bae6fd';
      } else {
        alb.fillStyle = style === 'curtain_glass' ? '#0f172a' : '#1e293b';
      }
      alb.fillRect(wx, wy, ww, wh);

      // Recessed window frame normal bevel & low roughness glass
      nrm.fillStyle = 'rgb(128,104,250)';
      nrm.fillRect(wx, wy, ww, 2);
      nrm.fillStyle = 'rgb(128,152,250)';
      nrm.fillRect(wx, wy + wh - 2, ww, 2);

      rgh.fillStyle = 'rgb(24,24,24)'; // Smooth reflective glass
      rgh.fillRect(wx, wy, ww, wh);
    }
  }

  const map = new THREE.CanvasTexture(albC);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(nrmC);
  const roughnessMap = new THREE.CanvasTexture(rghC);
  [map, normalMap, roughnessMap].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  });

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}