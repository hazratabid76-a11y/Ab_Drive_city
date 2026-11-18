import { ControlScheme, GearMode } from '../types/game';

export interface DrivingInputState {
  steer: number; // -1 (left) to +1 (right)
  throttle: number; // 0..1
  brake: number; // 0..1
  handbrake: boolean;
  nitro: boolean;
  hornPressed: boolean;
  gear: GearMode;
}

export class InputManager {
  public state: DrivingInputState = {
    steer: 0,
    throttle: 0,
    brake: 0,
    handbrake: false,
    nitro: false,
    hornPressed: false,
    gear: 'D',
  };

  private keys = new Set<string>();
  private touchThrottle = 0;
  private touchBrake = 0;
  private touchSteerLeft = false;
  private touchSteerRight = false;
  private wheelSteer = 0;
  private tiltSteer = 0;
  private touchHandbrake = false;
  private touchNitro = false;

  private scheme: ControlScheme = 'wheel';
  private sensitivity = 1.0;
  private tiltOffset = 0;
  private rawTiltBeta = 0;
  private tiltListening = false;
  private vibrationEnabled = true;

  public onCameraToggle?: () => void;
  public onPauseToggle?: () => void;
  public onHorn?: () => void;
  public onGearChange?: (gear: GearMode) => void;

  private keyDownHandler = (e: KeyboardEvent) => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }
    if (!this.keys.has(code)) {
      this.keys.add(code);
      if (code === 'KeyC') this.onCameraToggle?.();
      if (code === 'Escape') this.onPauseToggle?.();
      if (code === 'KeyH') this.onHorn?.();
      if (code === 'Digit1') this.setGear('P');
      if (code === 'Digit2') this.setGear('R');
      if (code === 'Digit3') this.setGear('N');
      if (code === 'Digit4') this.setGear('D');
    }
  };

  private keyUpHandler = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private orientationHandler = (e: DeviceOrientationEvent) => {
    // In landscape, beta is typically tilt left/right (or gamma depending on orientation)
    const isLandscapePrimary = window.innerWidth >= window.innerHeight;
    const angleDeg = isLandscapePrimary ? (e.beta ?? 0) : (e.gamma ?? 0);
    this.rawTiltBeta = (angleDeg * Math.PI) / 180;
    const delta = this.rawTiltBeta - this.tiltOffset;
    const maxAngle = 0.55 / Math.max(0.5, this.sensitivity);
    this.tiltSteer = Math.max(-1, Math.min(1, delta / maxAngle));
  };

  public attach(): void {
    window.addEventListener('keydown', this.keyDownHandler, { passive: false });
    window.addEventListener('keyup', this.keyUpHandler);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    if (this.tiltListening) {
      window.removeEventListener('deviceorientation', this.orientationHandler);
      this.tiltListening = false;
    }
  }

  public configure(scheme: ControlScheme, sensitivity: number, tiltOffset: number, vibration: boolean): void {
    this.scheme = scheme;
    this.sensitivity = sensitivity;
    this.tiltOffset = tiltOffset;
    this.vibrationEnabled = vibration;
    if (scheme === 'tilt' && !this.tiltListening) {
      window.addEventListener('deviceorientation', this.orientationHandler);
      this.tiltListening = true;
    }
  }

  public async requestTiltPermission(): Promise<boolean> {
    const devOrient = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof devOrient?.requestPermission === 'function') {
      try {
        const res = await devOrient.requestPermission();
        if (res === 'granted' && !this.tiltListening) {
          window.addEventListener('deviceorientation', this.orientationHandler);
          this.tiltListening = true;
        }
        return res === 'granted';
      } catch {
        return false;
      }
    }
    if (!this.tiltListening) {
      window.addEventListener('deviceorientation', this.orientationHandler);
      this.tiltListening = true;
    }
    return true;
  }

  public calibrateTilt(): number {
    this.tiltOffset = this.rawTiltBeta;
    return this.tiltOffset;
  }

  public setGear(g: GearMode): void {
    if (this.state.gear !== g) {
      this.state.gear = g;
      this.onGearChange?.(g);
    }
  }

  public setTouchThrottle(val: number): void {
    this.touchThrottle = val;
  }

  public setTouchBrake(val: number): void {
    this.touchBrake = val;
  }

  public setWheelSteer(val: number): void {
    this.wheelSteer = Math.max(-1, Math.min(1, val));
  }

  public setTouchArrowLeft(down: boolean): void {
    this.touchSteerLeft = down;
  }

  public setTouchArrowRight(down: boolean): void {
    this.touchSteerRight = down;
  }

  public setTouchHandbrake(down: boolean): void {
    this.touchHandbrake = down;
  }

  public setTouchNitro(down: boolean): void {
    this.touchNitro = down;
  }

  public resetInputs(): void {
    this.keys.clear();
    this.touchThrottle = 0;
    this.touchBrake = 0;
    this.touchSteerLeft = false;
    this.touchSteerRight = false;
    this.wheelSteer = 0;
    this.touchHandbrake = false;
    this.touchNitro = false;
    this.state.throttle = 0;
    this.state.brake = 0;
    this.state.steer = 0;
    this.state.handbrake = false;
    this.state.nitro = false;
    this.state.gear = 'D';
  }

  public vibrate(pattern: number | number[]): void {
    if (!this.vibrationEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore in unsupported browsers
    }
  }

  public poll(dt: number): DrivingInputState {
    // Keyboard
    const kbThrottle = this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0;
    const kbBrake = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0;
    const kbLeft = this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0;
    const kbRight = this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0;
    const kbHandbrake = this.keys.has('Space');
    const kbNitro = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // Gamepad API
    let gpSteer = 0;
    let gpThrottle = 0;
    let gpBrake = 0;
    let gpHandbrake = false;
    let gpNitro = false;
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      const pads = navigator.getGamepads();
      const pad = pads?.[0];
      if (pad) {
        const ax0 = Math.abs(pad.axes[0] || 0) > 0.12 ? pad.axes[0] : 0;
        gpSteer = ax0;
        gpThrottle = pad.buttons[7]?.value || 0; // RT
        gpBrake = pad.buttons[6]?.value || 0; // LT
        gpHandbrake = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
        gpNitro = Boolean(pad.buttons[2]?.pressed || pad.buttons[5]?.pressed);
      }
    }

    // Touch steering
    let touchSteer = 0;
    if (this.scheme === 'wheel') {
      touchSteer = this.wheelSteer;
    } else if (this.scheme === 'tilt') {
      touchSteer = this.tiltSteer;
    } else {
      touchSteer = (this.touchSteerRight ? 1 : 0) - (this.touchSteerLeft ? 1 : 0);
    }

    const kbSteer = kbRight - kbLeft;
    const targetSteer = Math.max(-1, Math.min(1, (kbSteer + touchSteer + gpSteer) * this.sensitivity));
    const lerpRate = 1 - Math.exp(-14 * dt);
    this.state.steer += (targetSteer - this.state.steer) * lerpRate;

    this.state.throttle = Math.max(kbThrottle, this.touchThrottle, gpThrottle);
    this.state.brake = Math.max(kbBrake, this.touchBrake, gpBrake);
    this.state.handbrake = kbHandbrake || this.touchHandbrake || gpHandbrake;
    this.state.nitro = kbNitro || this.touchNitro || gpNitro;
    return this.state;
  }
}
