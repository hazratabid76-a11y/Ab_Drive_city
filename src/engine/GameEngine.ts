import * as THREE from 'three';
import { soundEngine } from '../core/audio';
import { InputManager } from '../core/input';
import { getCarById } from '../data/cars';
import { DIFFICULTY_CONFIG } from '../data/economy';
import { computeEffectiveSpecs } from '../data/upgrades';
import {
  ActiveQuality,
  CameraMode,
  CarCustomization,
  GhostSample,
  GraphicsQuality,
  HUDState,
  RunResult,
  SaveData,
  UpgradeLevels,
} from '../types/game';
import { buildProceduralCar, BuiltCarMesh } from '../vehicle/carBuilder';
import { createInitialVehicleState, stepVehiclePhysics, VehiclePhysicsState } from '../vehicle/physics';
import { CityWorldManager } from '../world/cityGenerator';
import { WorldMarkersManager } from '../world/collectibles';
import { ParticlePool } from '../world/particles';
import { TrafficAndAIManager } from '../world/traffic';
import { initEnvironmentAndWeather, WeatherController } from '../world/weather';
import { ActiveSessionConfig, ModeController } from '../modes/modeController';

export type EngineViewMode = 'showroom' | 'driving';

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private weatherCtrl: WeatherController;
  private cityMgr: CityWorldManager;
  private trafficMgr: TrafficAndAIManager;
  private markersMgr: WorldMarkersManager;
  private particles: ParticlePool;
  private modeCtrl = new ModeController();
  public input = new InputManager();

  private showroomGroup = new THREE.Group();
  private showroomCar: BuiltCarMesh | null = null;
  private showroomTurntable: THREE.Mesh | null = null;
  private showroomAngle = 0.65;
  private showroomPitch = 0.22;
  private showroomDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private playerCar: BuiltCarMesh | null = null;
  private ghostCar: BuiltCarMesh | null = null;
  private activeGhostSamples: GhostSample[] = [];
  private physicsState: VehiclePhysicsState = createInitialVehicleState();
  private prevPhysicsX = 0;
  private prevPhysicsZ = 0;
  private prevPhysicsHeading = 0;

  private viewMode: EngineViewMode = 'showroom';
  private paused = false;
  private cameraMode: CameraMode = 'chase';
  private countdownTimer = -1;
  private lastCountdownBeep = -1;

  private frameId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedDt = 1 / 60;

  // Dynamic resolution & FPS monitoring
  private fpsSamples: number[] = [];
  private currentFps = 60;
  private activeQuality: ActiveQuality = 'medium';
  private requestedQuality: GraphicsQuality = 'auto';
  private userResScale = 1.0;
  private dynamicScale = 1.0;
  private lowFpsTimer = 0;

  // Camera smooth state
  private camPos = new THREE.Vector3(0, 5, 10);
  private camLook = new THREE.Vector3(0, 1, 0);
  private shakeAmp = 0;
  private collisionFlash = 0;

  // Callbacks to React UI
  private onHudUpdate: (hud: HUDState) => void;
  private onRunEnd: (result: RunResult) => void;
  private onContextLostCb: (lost: boolean) => void;
  private saveSnapshot!: SaveData;
  private popupCounter = 1;
  private popups: { id: number; text: string; color: string; subtext?: string; ttl: number }[] = [];
  private hudEmitTimer = 0;

  constructor(
    container: HTMLElement,
    save: SaveData,
    callbacks: {
      onHudUpdate: (hud: HUDState) => void;
      onRunEnd: (result: RunResult) => void;
      onContextLost: (lost: boolean) => void;
      onCameraChange: (cam: CameraMode) => void;
      onPauseToggle: () => void;
    },
  ) {
    this.container = container;
    this.saveSnapshot = save;
    this.onHudUpdate = callbacks.onHudUpdate;
    this.onRunEnd = callbacks.onRunEnd;
    this.onContextLostCb = callbacks.onContextLost;

    // Detect software WebGL per Three.js skill directive
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.appendChild(this.renderer.domElement);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('resize', this.handleResize);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight),
      0.2,
      480,
    );

    this.weatherCtrl = initEnvironmentAndWeather(this.scene, this.renderer, this.isSoftwareGl);
    this.cityMgr = new CityWorldManager(this.scene, this.renderer.capabilities.getMaxAnisotropy());
    this.trafficMgr = new TrafficAndAIManager(this.scene);
    this.markersMgr = new WorldMarkersManager(this.scene);
    this.particles = new ParticlePool(this.scene);

    this.setupShowroomStage();
    this.applySettings(save);

    this.input.attach();
    this.input.onCameraToggle = () => {
      const order: CameraMode[] = ['chase', 'bumper', 'topdown'];
      this.cameraMode = order[(order.indexOf(this.cameraMode) + 1) % order.length];
      callbacks.onCameraChange(this.cameraMode);
      soundEngine.playUiClick();
    };
    this.input.onPauseToggle = () => {
      if (this.viewMode === 'driving') callbacks.onPauseToggle();
    };
    this.input.onHorn = () => {
      soundEngine.playHorn();
    };

    this.enterShowroom(save.selectedCarId, save.carCustomizations[save.selectedCarId]);
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTime = performance.now();
    this.scheduleNextTick();
  }

  private setupShowroomStage(): void {
    const padGeo = new THREE.CylinderGeometry(3.8, 4.1, 0.28, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.25,
      metalness: 0.75,
    });
    this.showroomTurntable = new THREE.Mesh(padGeo, padMat);
    this.showroomTurntable.position.y = -0.14;
    this.showroomTurntable.receiveShadow = true;

    const ringGeo = new THREE.RingGeometry(3.85, 4.05, 48).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff8a00, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(28, 36).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.35 }),
    );
    floor.position.y = -0.25;
    floor.receiveShadow = true;

    this.showroomGroup.add(this.showroomTurntable, ring, floor);
    this.scene.add(this.showroomGroup);
  }

  public applySettings(save: SaveData): void {
    this.saveSnapshot = save;
    const s = save.settings;
    this.requestedQuality = s.graphics;
    this.userResScale = s.resolutionScale;
    this.activeQuality =
      s.graphics === 'auto' ? (this.isSoftwareGl ? 'low' : 'high') : s.graphics;
    this.updatePixelRatio();
    this.input.configure(s.controls, s.sensitivity, s.tiltOffset, s.vibration);
    soundEngine.applySettings(s);
  }

  private updatePixelRatio(): void {
    const base = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const qualScale =
      this.activeQuality === 'low' ? 0.72 : this.activeQuality === 'medium' ? 0.88 : this.activeQuality === 'high' ? 1.0 : 1.15;
    this.renderer.setPixelRatio(Math.min(2, Math.max(0.5, base * this.userResScale * qualScale * this.dynamicScale)));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.activeQuality !== 'low';
    this.weatherCtrl?.setShadowQuality(this.activeQuality);
  }

  public enterShowroom(carId: string, customization?: CarCustomization): void {
    this.viewMode = 'showroom';
    this.paused = false;
    soundEngine.stopDrivingAudio();

    this.cityMgr.clearAllChunks();
    this.trafficMgr.clear();
    this.markersMgr.clear();
    this.particles.clear();

    if (this.playerCar) {
      this.scene.remove(this.playerCar.root);
      this.playerCar.dispose();
      this.playerCar = null;
    }
    if (this.ghostCar) {
      this.scene.remove(this.ghostCar.root);
      this.ghostCar.dispose();
      this.ghostCar = null;
    }

    this.showroomGroup.visible = true;
    this.weatherCtrl.apply('sunset', 'clear', this.cityMgr.roadMat);
    this.weatherCtrl.update(0.016, 0, 0, 'sunset', 'clear');

    this.updateShowroomCar(carId, customization);
  }

  public updateShowroomCar(carId: string, customization?: CarCustomization): void {
    if (this.showroomCar) {
      this.showroomGroup.remove(this.showroomCar.root);
      this.showroomCar.dispose();
      this.showroomCar = null;
    }
    const car = getCarById(carId);
    const cust = customization || {
      color: car.defaultColor,
      finish: 'gloss',
      wheelStyle: 'stock',
      spoiler: 'none',
      underglow: 'none',
    };
    this.showroomCar = buildProceduralCar({ car, customization: cust, isNight: false, showInterior: true });
    this.showroomGroup.add(this.showroomCar.root);
  }

  public startDrivingSession(
    config: ActiveSessionConfig,
    carId: string,
    customization: CarCustomization,
    upgrades: UpgradeLevels,
    savedGhost?: GhostSample[],
  ): void {
    this.viewMode = 'driving';
    this.paused = false;
    this.showroomGroup.visible = false;
    this.particles.clear();
    this.popups = [];
    this.input.resetInputs();

    if (this.playerCar) {
      this.scene.remove(this.playerCar.root);
      this.playerCar.dispose();
    }
    if (this.ghostCar) {
      this.scene.remove(this.ghostCar.root);
      this.ghostCar.dispose();
      this.ghostCar = null;
    }

    const carDef = getCarById(carId);
    const isNight = config.timeOfDay === 'night';
    this.playerCar = buildProceduralCar({
      car: carDef,
      customization,
      isPlayer: true,
      isNight,
    });
    this.scene.add(this.playerCar.root);

    // Ghost Car for Time Trial
    this.activeGhostSamples = savedGhost || [];
    if (config.mode === 'time_trial' && this.activeGhostSamples.length > 2) {
      this.ghostCar = buildProceduralCar({
        car: carDef,
        customization,
        isGhost: true,
      });
      this.scene.add(this.ghostCar.root);
    }

    // Spawn on right lane of avenue x=0
    this.physicsState = createInitialVehicleState(3.2, 0, 0);
    this.prevPhysicsX = 3.2;
    this.prevPhysicsZ = 0;
    this.prevPhysicsHeading = 0;
    this.shakeAmp = 0;
    this.collisionFlash = 0;

    this.weatherCtrl.apply(config.timeOfDay, config.weather, this.cityMgr.roadMat);
    this.cityMgr.configure(config.seed, config.timeOfDay, this.activeQuality);
    this.cityMgr.update(0.016, 3.2, 0);

    const diff = DIFFICULTY_CONFIG[config.difficulty];
    this.trafficMgr.setup(
      config.trafficDensity * diff.trafficMult,
      config.pursuerCount,
      config.hasMovingHazards,
      isNight,
      3.2,
      0,
    );
    this.modeCtrl.start(config, this.markersMgr);

    this.countdownTimer = 2.8;
    this.lastCountdownBeep = 4;
    this.camPos.set(3.2, 4.5, 11);
    this.camLook.set(3.2, 1.0, -6);

    soundEngine.startDrivingAudio(config.weather === 'rain');
    void upgrades; // specs read each step from saveSnapshot or passed upgrades
    this.activeUpgrades = upgrades;
    this.activeCarDef = carDef;
  }

  private activeUpgrades?: UpgradeLevels;
  private activeCarDef = getCarById('solis_hatch');

  public setPaused(p: boolean): void {
    this.paused = p;
    if (p) {
      soundEngine.updateDrivingAudio(800, 0, 0, false);
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  private pushPopup(text: string, color: string, subtext?: string): void {
    this.popups.push({ id: this.popupCounter++, text, color, subtext, ttl: 1.5 });
    if (this.popups.length > 4) this.popups.shift();
  }

  private scheduleNextTick(): void {
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    const now = performance.now();
    const rawDt = Math.min(0.08, (now - this.lastTime) / 1000);
    this.lastTime = now;

    // FPS tracking & Auto Quality downgrading (< 45 FPS)
    if (rawDt > 0.001) {
      const instFps = 1 / rawDt;
      this.fpsSamples.push(instFps);
      if (this.fpsSamples.length > 20) this.fpsSamples.shift();
      this.currentFps = Math.round(this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length);

      if (!this.isSoftwareGl && this.requestedQuality === 'auto' && this.viewMode === 'driving') {
        if (this.currentFps < 45) {
          this.lowFpsTimer += rawDt;
          if (this.lowFpsTimer > 2.0) {
            this.lowFpsTimer = 0;
            if (this.activeQuality === 'ultra') {
              this.activeQuality = 'high';
              this.dynamicScale = 0.92;
              this.updatePixelRatio();
            } else if (this.activeQuality === 'high') {
              this.activeQuality = 'medium';
              this.dynamicScale = 0.85;
              this.updatePixelRatio();
            } else if (this.activeQuality === 'medium') {
              this.activeQuality = 'low';
              this.dynamicScale = 0.72;
              this.updatePixelRatio();
            }
          }
        } else {
          this.lowFpsTimer = Math.max(0, this.lowFpsTimer - rawDt * 0.5);
        }
      }
    }

    if (this.viewMode === 'showroom') {
      this.updateShowroom(rawDt);
    } else if (!this.paused) {
      this.updateDriving(rawDt, now / 1000);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  }

  private updateShowroom(dt: number): void {
    if (!this.showroomDragging) {
      this.showroomAngle += dt * 0.35;
    }
    const radius = 6.2;
    this.camera.fov = 46;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(
      Math.sin(this.showroomAngle) * radius,
      1.6 + this.showroomPitch * 3.0,
      Math.cos(this.showroomAngle) * radius,
    );
    this.camera.lookAt(0, 0.72, 0);
  }

  private updateDriving(dt: number, elapsedSec: number): void {
    // Countdown 3..2..1..GO
    if (this.countdownTimer > -0.6) {
      this.countdownTimer -= dt;
      const ceilSec = Math.ceil(this.countdownTimer);
      if (ceilSec >= 1 && ceilSec <= 3 && ceilSec !== this.lastCountdownBeep) {
        this.lastCountdownBeep = ceilSec;
        soundEngine.playCountdown(false);
      } else if (this.countdownTimer <= 0 && this.lastCountdownBeep !== 0) {
        this.lastCountdownBeep = 0;
        soundEngine.playCountdown(true);
      }
    }

    const canMove = this.countdownTimer <= 0;
    const specs = computeEffectiveSpecs(this.activeCarDef, this.activeUpgrades);
    const diff = DIFFICULTY_CONFIG[this.modeCtrl.config.difficulty];

    // Fixed-timestep physics accumulator
    this.accumulator += dt;
    let frameImpact = 0;
    let vehicleColliders = this.trafficMgr.update(
      dt,
      elapsedSec,
      this.physicsState.x,
      this.physicsState.z,
      this.physicsState.speedMs,
      this.cityMgr.signalPhase,
      () => {
        const popup = this.modeCtrl.addNearMiss(this.physicsState);
        this.pushPopup(popup.text, popup.color, popup.subtext);
        soundEngine.playChime(true);
      },
      () => {
        soundEngine.playHorn();
      },
    );

    const staticColliders = this.cityMgr.update(dt, this.physicsState.x, this.physicsState.z);
    const allColliders = staticColliders.concat(vehicleColliders.hazardColliders);

    while (this.accumulator >= this.fixedDt) {
      this.accumulator -= this.fixedDt;
      this.prevPhysicsX = this.physicsState.x;
      this.prevPhysicsZ = this.physicsState.z;
      this.prevPhysicsHeading = this.physicsState.heading;

      const input = this.input.poll(this.fixedDt);
      if (canMove) {
        const colRes = stepVehiclePhysics(
          this.physicsState,
          input,
          specs,
          this.modeCtrl.config.weather,
          diff.damageMult,
          allColliders,
          vehicleColliders.vehicleColliders,
          this.fixedDt,
        );
        if (colRes.impactForce > frameImpact) frameImpact = colRes.impactForce;
      }
    }

    if (frameImpact > 4.5) {
      soundEngine.playCollision(frameImpact / 20);
      this.input.vibrate(frameImpact > 14 ? [45, 30, 60] : 35);
      this.shakeAmp = Math.min(0.65, frameImpact * 0.025);
      this.collisionFlash = 0.85;
      for (let k = 0; k < 6; k++) {
        this.particles.spawn(
          this.physicsState.x,
          0.6,
          this.physicsState.z,
          (Math.random() - 0.5) * 9,
          2 + Math.random() * 4,
          (Math.random() - 0.5) * 9,
          0.4,
          0.35,
          0xffc93c,
        );
      }
    }

    // Interpolated render transform
    const alpha = Math.min(1, this.accumulator / this.fixedDt);
    const renderX = this.prevPhysicsX + (this.physicsState.x - this.prevPhysicsX) * alpha;
    const renderZ = this.prevPhysicsZ + (this.physicsState.z - this.prevPhysicsZ) * alpha;
    const renderH = this.prevPhysicsHeading + (this.physicsState.heading - this.prevPhysicsHeading) * alpha;

    if (this.playerCar) {
      this.playerCar.root.position.set(renderX, this.physicsState.suspBounce, renderZ);
      this.playerCar.root.rotation.y = renderH;
      this.playerCar.bodyGroup.rotation.z = this.physicsState.bodyRoll;
      this.playerCar.bodyGroup.rotation.x = this.physicsState.bodyPitch;

      // Wheel steer & spin
      this.playerCar.wheelSteerPivots[0].rotation.y = -this.physicsState.steerAngle;
      this.playerCar.wheelSteerPivots[1].rotation.y = -this.physicsState.steerAngle;
      this.playerCar.wheelSpinMeshes.forEach((w) => {
        w.rotation.x = -this.physicsState.wheelRotation;
      });

      // Brake lights
      const braking = this.input.state.brake > 0.1 || this.input.state.handbrake || this.input.state.gear === 'R';
      this.playerCar.brakeLightMat.emissiveIntensity = braking ? 3.2 : 0.7;

      // Visible damage denting on hood/bumper at low health
      const dmgRatio = 1 - this.physicsState.health / 100;
      this.playerCar.frontBumper.rotation.y = dmgRatio * 0.18;
      this.playerCar.hoodMesh.rotation.x = 0.05 - dmgRatio * 0.22;
    }

    // Ghost car playback in Time Trial
    if (this.ghostCar && this.activeGhostSamples.length > 1) {
      const t = this.modeCtrl.elapsedTime;
      const samples = this.activeGhostSamples;
      let idx = 0;
      while (idx < samples.length - 2 && samples[idx + 1].t < t) idx++;
      const a = samples[idx];
      const b = samples[idx + 1];
      const span = Math.max(0.01, b.t - a.t);
      const frac = Math.max(0, Math.min(1, (t - a.t) / span));
      this.ghostCar.root.position.set(
        a.x + (b.x - a.x) * frac,
        0,
        a.z + (b.z - a.z) * frac,
      );
      this.ghostCar.root.rotation.y = a.ry + (b.ry - a.ry) * frac;
    }

    // Tire smoke, skid marks, nitro flame, low-health smoke
    if (this.physicsState.isDrifting || this.physicsState.slipRatio > 0.35) {
      const rearX = renderX + Math.sin(renderH) * 1.4;
      const rearZ = renderZ + Math.cos(renderH) * 1.4;
      this.particles.spawn(rearX, 0.25, rearZ, (Math.random() - 0.5) * 2, 0.8, (Math.random() - 0.5) * 2, 0.7, 0.55, 0xe2e8f0);
      this.particles.spawnSkid(rearX, rearZ, renderH);
    }
    if (this.physicsState.isNitroActive) {
      const rearX = renderX + Math.sin(renderH) * 2.1;
      const rearZ = renderZ + Math.cos(renderH) * 2.1;
      this.particles.spawn(rearX, 0.35, rearZ, 0, 0.3, 0, 0.5, 0.2, 0x14b8a6);
      this.input.vibrate(15);
    }
    if (this.physicsState.health < 35 && Math.random() < 0.35) {
      const frontX = renderX - Math.sin(renderH) * 1.4;
      const frontZ = renderZ - Math.cos(renderH) * 1.4;
      this.particles.spawn(frontX, 0.9, frontZ, (Math.random() - 0.5) * 1.5, 2.5, (Math.random() - 0.5) * 1.5, 0.8, 0.8, 0x334155);
    }

    this.particles.update(dt);
    this.markersMgr.update(elapsedSec);
    this.weatherCtrl.update(
      dt,
      renderX,
      renderZ,
      this.modeCtrl.config.timeOfDay,
      this.modeCtrl.config.weather,
    );

    soundEngine.updateDrivingAudio(
      this.physicsState.rpm,
      this.input.state.throttle,
      this.physicsState.slipRatio,
      this.physicsState.isNitroActive,
    );

    // Camera Choreography (Chase / Bumper / Topdown) + Speed FOV widening + Shake
    this.shakeAmp *= Math.exp(-8 * dt);
    this.collisionFlash = Math.max(0, this.collisionFlash - dt * 2.2);
    const speedKmh = this.physicsState.speedMs * 3.6;

    const sx = (Math.random() - 0.5) * this.shakeAmp;
    const sy = (Math.random() - 0.5) * this.shakeAmp;

    if (this.cameraMode === 'chase') {
      const dist = 7.8 + Math.min(2.2, speedKmh / 140);
      const height = 3.1 + Math.min(0.8, speedKmh / 200);
      const targetCamX = renderX + Math.sin(renderH) * dist;
      const targetCamZ = renderZ + Math.cos(renderH) * dist;
      const damp = 1 - Math.exp(-9 * dt);
      this.camPos.x += (targetCamX - this.camPos.x) * damp;
      this.camPos.y += (height - this.camPos.y) * damp;
      this.camPos.z += (targetCamZ - this.camPos.z) * damp;

      const lookX = renderX - Math.sin(renderH) * 6;
      const lookZ = renderZ - Math.cos(renderH) * 6;
      this.camLook.lerp(new THREE.Vector3(lookX, 1.15, lookZ), damp);
      this.camera.fov += (60 + Math.min(18, speedKmh * 0.065) + (this.physicsState.isNitroActive ? 6 : 0) - this.camera.fov) * 0.12;
    } else if (this.cameraMode === 'bumper') {
      const frontX = renderX - Math.sin(renderH) * 1.9;
      const frontZ = renderZ - Math.cos(renderH) * 1.9;
      this.camPos.set(frontX, 1.05, frontZ);
      this.camLook.set(renderX - Math.sin(renderH) * 20, 0.9, renderZ - Math.cos(renderH) * 20);
      this.camera.fov += (68 + Math.min(16, speedKmh * 0.06) - this.camera.fov) * 0.15;
    } else {
      // topdown
      this.camPos.set(renderX, 26 + Math.min(10, speedKmh * 0.05), renderZ + 8);
      this.camLook.set(renderX, 0, renderZ - 4);
      this.camera.fov = 55;
    }

    this.camera.updateProjectionMatrix();
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);

    // Update Mode Controller
    const prevCoins = this.modeCtrl.coinsInRun;
    const closestPursuer = this.trafficMgr.getClosestPursuerDistance(renderX, renderZ);
    const modeRes = canMove
      ? this.modeCtrl.update(dt, this.physicsState, this.markersMgr, closestPursuer)
      : {
          finished: false,
          victory: false,
          reason: '',
          tip: '',
          objectiveLabel: this.modeCtrl.config.title,
          objectiveProgress: 'Get Ready...',
          targetX: this.modeCtrl.waypoints[0]?.x || 0,
          targetZ: this.modeCtrl.waypoints[0]?.z || -150,
          wrongWay: false,
        };

    if (this.modeCtrl.coinsInRun > prevCoins) {
      soundEngine.playCoin();
    }
    if (modeRes.eventPopup) {
      this.pushPopup(modeRes.eventPopup.text, modeRes.eventPopup.color, modeRes.eventPopup.subtext);
      soundEngine.playChime(true);
    }

    // Expire popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].ttl -= dt;
      if (this.popups[i].ttl <= 0) this.popups.splice(i, 1);
    }

    // Check Finish
    if (modeRes.finished) {
      this.paused = true;
      soundEngine.stopDrivingAudio();
      if (modeRes.victory) soundEngine.playWinFanfare();
      else soundEngine.playFailSting();

      this.finalizeRun(modeRes.victory, modeRes.reason, modeRes.tip);
      return;
    }

    // Emit HUD state at ~25Hz to React without starving frames
    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.04) {
      this.hudEmitTimer = 0;
      const blips: HUDState['blips'] = [
        { x: modeRes.targetX, z: modeRes.targetZ, type: 'target' },
      ];
      for (const tb of this.trafficMgr.getTrafficBlips()) {
        blips.push({ x: tb.x, z: tb.z, type: tb.isPursuer ? 'pursuer' : 'traffic' });
      }
      for (const c of this.markersMgr.collectibles) {
        if (c.active) blips.push({ x: c.x, z: c.z, type: 'pickup' });
      }

      this.onHudUpdate({
        speedKmh: Math.round(speedKmh),
        rpm: Math.round(this.physicsState.rpm),
        gear: this.input.state.gear,
        autoGearNum: this.physicsState.autoGearNum,
        nitro: Math.round(this.physicsState.nitro),
        health: Math.round(this.physicsState.health),
        cargoHealth: this.modeCtrl.config.mode === 'delivery_run' ? Math.round(this.physicsState.cargoHealth) : undefined,
        timeRemaining: this.modeCtrl.timeRemaining,
        elapsedTime: this.modeCtrl.elapsedTime,
        objectiveLabel: modeRes.objectiveLabel,
        objectiveProgress: modeRes.objectiveProgress,
        score: Math.round(this.modeCtrl.score),
        coinsInRun: this.modeCtrl.coinsInRun,
        comboCount: this.modeCtrl.comboCount,
        comboTimer: this.modeCtrl.comboTimer / 3.2,
        wrongWay: modeRes.wrongWay,
        collisionFlash: this.collisionFlash,
        cameraMode: this.cameraMode,
        fps: this.currentFps,
        activeQuality: this.activeQuality,
        tutorialBanner: this.modeCtrl.config.tutorialTip,
        parkingSensors: modeRes.parkingSensors,
        playerX: renderX,
        playerZ: renderZ,
        playerHeading: renderH,
        targetX: modeRes.targetX,
        targetZ: modeRes.targetZ,
        blips,
        popups: this.popups.map(({ id, text, color, subtext }) => ({ id, text, color, subtext })),
        countdown: this.countdownTimer > 0 ? Math.ceil(this.countdownTimer) : this.countdownTimer > -0.55 ? 0 : -1,
      });
    }
  }

  public endEndlessRunEarly(): void {
    if (this.viewMode !== 'driving') return;
    this.paused = true;
    soundEngine.stopDrivingAudio();
    this.finalizeRun(true, 'Endless Run Banked!', '');
  }

  private finalizeRun(victory: boolean, reason: string, tip: string): void {
    const cfg = this.modeCtrl.config;
    const diff = DIFFICULTY_CONFIG[cfg.difficulty];
    const dmgPct = Math.round(100 - this.physicsState.health);

    let stars = 0;
    if (victory) {
      stars = 1;
      if (cfg.levelDef) {
        const sr = cfg.levelDef.starRules;
        if (cfg.mode === 'drift_zone') {
          if (this.modeCtrl.driftPoints >= (sr.twoStarMinScore || 0)) stars = 2;
          if (this.modeCtrl.driftPoints >= (sr.threeStarMinScore || 0)) stars = 3;
        } else {
          if (
            this.modeCtrl.elapsedTime <= (sr.twoStarTimeSec || 999) &&
            dmgPct <= (sr.twoStarMaxDamagePct || 100)
          ) {
            stars = 2;
          }
          if (
            this.modeCtrl.elapsedTime <= (sr.threeStarTimeSec || 999) &&
            dmgPct <= (sr.threeStarMaxDamagePct || 100)
          ) {
            stars = 3;
          }
        }
      } else {
        if (dmgPct <= 45) stars = 2;
        if (dmgPct <= 20) stars = 3;
      }
    }

    const baseCoins = cfg.levelDef ? cfg.levelDef.rewardCoins : Math.round(250 + this.modeCtrl.score * 0.18);
    const coinsEarned = victory
      ? Math.round((baseCoins * (0.7 + stars * 0.2) * diff.rewardMult) + this.modeCtrl.coinsInRun)
      : Math.round(this.modeCtrl.coinsInRun + Math.min(180, this.physicsState.distanceMeters * 0.08));

    const gemsEarned = victory
      ? (cfg.levelDef?.rewardGems || (cfg.isDailyChallenge ? 12 : cfg.isWeeklyEvent ? 25 : 2)) +
        (stars === 3 ? 2 : 0)
      : 0;

    const xpEarned = victory
      ? Math.round((cfg.levelDef?.rewardXp || 110) * diff.rewardMult + stars * 30)
      : Math.round(30 + this.physicsState.distanceMeters * 0.02);

    this.onRunEnd({
      victory,
      mode: cfg.mode,
      levelId: cfg.levelDef?.id,
      difficulty: cfg.difficulty,
      stars,
      reason,
      tip,
      elapsedTime: this.modeCtrl.elapsedTime,
      score: Math.round(this.modeCtrl.score),
      damageTakenPct: dmgPct,
      coinsEarned,
      gemsEarned,
      xpEarned,
      nearMisses: this.modeCtrl.nearMisses,
      driftPoints: Math.round(this.modeCtrl.driftPoints),
      isNewBest: false,
      newlyUnlockedAchievements: [],
    });
  }

  public getLatestGhostSamples(): GhostSample[] {
    return this.modeCtrl.ghostSamples;
  }

  public getDistanceDrivenKm(): number {
    return this.physicsState.distanceMeters / 1000;
  }

  public getMaxComboInRun(): number {
    return this.modeCtrl.maxCombo;
  }

  public getPassengersDroppedInRun(): number {
    return this.modeCtrl.passengersDropped;
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (this.viewMode !== 'showroom') return;
    this.showroomDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.showroomDragging || this.viewMode !== 'showroom') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.showroomAngle -= dx * 0.009;
    this.showroomPitch = Math.max(0.02, Math.min(0.45, this.showroomPitch + dy * 0.003));
  };

  private handlePointerUp = () => {
    this.showroomDragging = false;
  };

  private handleResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.updatePixelRatio();
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLostCb(true);
  };

  private handleContextRestored = () => {
    this.onContextLostCb(false);
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  };

  public dispose(): void {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.input.detach();
    soundEngine.dispose();

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('resize', this.handleResize);

    this.showroomCar?.dispose();
    this.playerCar?.dispose();
    this.ghostCar?.dispose();
    this.cityMgr.dispose();
    this.trafficMgr.clear();
    this.markersMgr.clear();
    this.particles.dispose();
    this.weatherCtrl.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
