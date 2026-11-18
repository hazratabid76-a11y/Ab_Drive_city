import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ActiveQuality, TimeOfDay, WeatherType } from '../types/game';

export interface WeatherController {
  hemiLight: THREE.HemisphereLight;
  sunLight: THREE.DirectionalLight;
  skyMesh: THREE.Mesh;
  rainPoints: THREE.LineSegments | null;
  apply: (timeOfDay: TimeOfDay, weather: WeatherType, roadMat: THREE.MeshStandardMaterial) => void;
  update: (dt: number, playerX: number, playerZ: number, timeOfDay: TimeOfDay, weather: WeatherType) => void;
  setShadowQuality: (q: ActiveQuality) => void;
  dispose: () => void;
}

function createSkyTexture(topHex: string, midHex: string, horizonHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topHex);
  grad.addColorStop(0.5, midHex);
  grad.addColorStop(0.85, horizonHex);
  grad.addColorStop(1, horizonHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function initEnvironmentAndWeather(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): WeatherController {
  // Mandatory Studio/Sky PMREM Environment for crisp car reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x334155, 0.85);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.85);
  sunLight.position.set(45, 70, 35);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.width = isSoftwareGl ? 512 : 1024;
  sunLight.shadow.mapSize.height = isSoftwareGl ? 512 : 1024;
  const d = 42;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Gradient Sky Dome
  const skyGeo = new THREE.SphereGeometry(420, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  // Rain Streak Pool
  const rainCount = 450;
  const rainPositions = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.random() - 0.5) * 90;
    const ry = Math.random() * 32;
    const rz = (Math.random() - 0.5) * 90;
    rainPositions[i * 6 + 0] = rx;
    rainPositions[i * 6 + 1] = ry;
    rainPositions[i * 6 + 2] = rz;
    rainPositions[i * 6 + 3] = rx - 0.35;
    rainPositions[i * 6 + 4] = ry - 1.4;
    rainPositions[i * 6 + 5] = rz;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xcbd5e1,
    transparent: true,
    opacity: 0.48,
  });
  const rainPoints = new THREE.LineSegments(rainGeo, rainMat);
  rainPoints.visible = false;
  rainPoints.frustumCulled = false;
  scene.add(rainPoints);

  let currentSkyTex: THREE.CanvasTexture | null = null;
  let sunOffset: [number, number, number] = [45, 70, 35];

  interface TimePreset {
    sky: [string, string, string];
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    sunColor: number;
    sunIntensity: number;
    sunPos: [number, number, number];
    fog: number;
    exposure: number;
  }

  // Natural light rig for every time of day. Sunrise/sunset use a low warm sun, noon a high neutral one.
  const PRESETS: Record<TimeOfDay, TimePreset> = {
    sunrise: {
      sky: ['#27456B', '#E8957A', '#FFD7A1'],
      hemiSky: 0xffc9a8, hemiGround: 0x2b3648, hemiIntensity: 0.72,
      sunColor: 0xffb27a, sunIntensity: 1.55, sunPos: [70, 20, -55], fog: 0xf3c9a4, exposure: 1.08,
    },
    morning: {
      sky: ['#1B78BC', '#7EC4EF', '#FFF0D2'],
      hemiSky: 0xcfe9fb, hemiGround: 0x4b5668, hemiIntensity: 0.9,
      sunColor: 0xfff1d6, sunIntensity: 1.6, sunPos: [60, 42, 30], fog: 0xe6f0f7, exposure: 1.1,
    },
    day: {
      sky: ['#0284C7', '#38BDF8', '#FEF3C7'],
      hemiSky: 0xbae6fd, hemiGround: 0x475569, hemiIntensity: 0.95,
      sunColor: 0xfff7ed, sunIntensity: 1.75, sunPos: [50, 75, 40], fog: 0xe0f2fe, exposure: 1.12,
    },
    afternoon: {
      sky: ['#0A78C2', '#58B5EA', '#FCE9BC'],
      hemiSky: 0xd6e8f5, hemiGround: 0x4a4f5c, hemiIntensity: 0.9,
      sunColor: 0xffedd0, sunIntensity: 1.8, sunPos: [-45, 52, 45], fog: 0xefe6d2, exposure: 1.12,
    },
    sunset: {
      sky: ['#1E293B', '#FF8A00', '#FFC93C'],
      hemiSky: 0xfdba74, hemiGround: 0x1e293b, hemiIntensity: 0.85,
      sunColor: 0xff9e2c, sunIntensity: 1.95, sunPos: [-70, 24, -60], fog: 0xfdba74, exposure: 1.12,
    },
    night: {
      sky: ['#020617', '#0F172A', '#1E293B'],
      hemiSky: 0x334155, hemiGround: 0x020617, hemiIntensity: 0.55,
      sunColor: 0x93c5fd, sunIntensity: 0.72, sunPos: [35, 65, -45], fog: 0x0f172a, exposure: 1.2,
    },
  };

  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();
  const mixHex = (a: string, b: string, t: number): string =>
    tmpA.set(a).lerp(tmpB.set(b), t).getStyle();

  const apply = (timeOfDay: TimeOfDay, weather: WeatherType, roadMat: THREE.MeshStandardMaterial) => {
    if (currentSkyTex) currentSkyTex.dispose();
    const p = PRESETS[timeOfDay] || PRESETS.day;
    const isNight = timeOfDay === 'night';
    const isGolden = timeOfDay === 'sunrise' || timeOfDay === 'sunset';

    // Overcast sky: pull colours toward flat grey, strongest in full daylight.
    const overcast = weather === 'cloudy' ? (isNight ? 0.2 : isGolden ? 0.4 : 0.65) : weather === 'rain' ? (isNight ? 0.3 : 0.75) : weather === 'fog' ? 0.5 : 0;
    const grey = ['#5B6677', '#8D98A8', '#C5CCD6'];
    const sky: [string, string, string] = [
      mixHex(p.sky[0], grey[0], overcast),
      mixHex(p.sky[1], grey[1], overcast),
      mixHex(p.sky[2], grey[2], overcast),
    ];
    currentSkyTex = createSkyTexture(sky[0], sky[1], sky[2]);

    const sunDim = weather === 'cloudy' ? 0.55 : weather === 'rain' ? 0.6 : weather === 'fog' ? 0.7 : 1;
    const hemiDim = weather === 'cloudy' ? 0.92 : weather === 'rain' ? 0.75 : 1;
    hemiLight.color.setHex(p.hemiSky);
    hemiLight.groundColor.setHex(p.hemiGround);
    hemiLight.intensity = p.hemiIntensity * hemiDim;
    sunLight.color.setHex(p.sunColor);
    sunLight.intensity = p.sunIntensity * sunDim;
    sunOffset = [...p.sunPos] as [number, number, number];
    sunLight.position.set(sunOffset[0], sunOffset[1], sunOffset[2]);
    if (renderer.toneMappingExposure !== undefined) renderer.toneMappingExposure = p.exposure;

    let fogHex = '#' + new THREE.Color(p.fog).getHexString();
    if (weather === 'fog') fogHex = mixHex(fogHex, isNight ? '#1e293b' : '#cbd5e1', 0.65);
    else if (weather === 'rain') fogHex = mixHex(fogHex, isNight ? '#0f172a' : '#94a3b8', 0.55);
    else if (weather === 'cloudy') fogHex = mixHex(fogHex, isNight ? '#0f172a' : '#b6bec9', 0.5);

    let fogDensity: number;
    if (weather === 'fog') fogDensity = 0.0115;
    else if (weather === 'rain') fogDensity = 0.0068;
    else if (weather === 'cloudy') fogDensity = 0.0052;
    else fogDensity = isNight ? 0.0052 : 0.0038;

    skyMat.map = currentSkyTex;
    skyMat.needsUpdate = true;
    const fogColor = new THREE.Color(fogHex);
    scene.background = fogColor.clone();
    scene.fog = new THREE.FogExp2(fogColor, fogDensity);

    // Wet road specular reflection during rain, slightly damp when cloudy
    if (weather === 'rain') {
      roadMat.roughness = 0.18;
      roadMat.metalness = 0.35;
    } else {
      roadMat.roughness = 0.82;
      roadMat.metalness = 0.06;
    }
    roadMat.needsUpdate = true;
    rainPoints.visible = weather === 'rain';
  };

  const update = (dt: number, playerX: number, playerZ: number, _timeOfDay: TimeOfDay, weather: WeatherType) => {
    skyMesh.position.set(playerX, 0, playerZ);
    sunLight.position.set(playerX + sunOffset[0], sunOffset[1], playerZ + sunOffset[2]);
    sunLight.target.position.set(playerX, 0, playerZ);
    sunLight.target.updateMatrixWorld();

    if (weather === 'rain' && rainPoints) {
      rainPoints.position.set(playerX, 0, playerZ);
      const posAttr = rainGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const fall = 36 * dt;
      for (let i = 0; i < rainCount; i++) {
        const idx = i * 6;
        arr[idx + 1] -= fall;
        arr[idx + 4] -= fall;
        if (arr[idx + 1] < 0) {
          const ny = 28 + Math.random() * 6;
          arr[idx + 1] = ny;
          arr[idx + 4] = ny - 1.4;
        }
      }
      posAttr.needsUpdate = true;
    }
  };

  const setShadowQuality = (q: ActiveQuality) => {
    const size = q === 'ultra' || q === 'high' ? 2048 : 1024;
    if (isSoftwareGl || sunLight.shadow.mapSize.width === size) return;
    sunLight.shadow.mapSize.set(size, size);
    sunLight.shadow.map?.dispose();
    sunLight.shadow.map = null;
  };

  const dispose = () => {
    currentSkyTex?.dispose();
    skyGeo.dispose();
    skyMat.dispose();
    rainGeo.dispose();
    rainMat.dispose();
  };

  return { hemiLight, sunLight, skyMesh, rainPoints, apply, update, setShadowQuality, dispose };
}
