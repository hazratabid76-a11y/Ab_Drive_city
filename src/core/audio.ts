import { SettingsData } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineGain: GainNode | null = null;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineRunning = false;

  private screechGain: GainNode | null = null;
  private screechSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private nitroGain: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private isPlayingMusic = false;
  private isHidden = false;
  private noiseBuffer: AudioBuffer | null = null;

  private volumes = {
    music: 0.45,
    sfx: 0.75,
    engine: 0.65,
  };

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.isHidden = document.hidden;
        if (!this.ctx) return;
        if (this.isHidden) {
          void this.ctx.suspend();
        } else {
          void this.ctx.resume();
        }
      });
    }
  }

  /** Called when the app goes to background (Android). */
  public suspend(): void {
    this.isHidden = true;
    if (this.ctx) void this.ctx.suspend();
  }

  /** Called when the app returns to foreground. */
  public resume(): void {
    this.isHidden = false;
    if (this.ctx) void this.ctx.resume();
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.volumes.music;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.volumes.sfx;
      this.sfxGain.connect(this.masterGain);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(this.masterGain);

      this.createNoiseBuffer();
      this.startMusicLoop();
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.isHidden) {
      void this.ctx.resume();
    }
  }

  public applySettings(settings: SettingsData): void {
    this.volumes.music = settings.musicVolume;
    this.volumes.sfx = settings.sfxVolume;
    this.volumes.engine = settings.engineVolume;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(settings.musicVolume * 0.45, now, 0.05);
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(settings.sfxVolume, now, 0.05);
    }
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public startDrivingAudio(isRaining: boolean): void {
    this.unlock();
    if (!this.ctx || !this.engineGain || !this.sfxGain) return;

    if (!this.engineRunning) {
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineFilter.Q.value = 2.5;
      this.engineFilter.connect(this.engineGain);

      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 55;
      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc1.start();

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 110;
      this.engineOsc2.connect(this.engineFilter);
      this.engineOsc2.start();

      // Tire screech loop
      if (this.noiseBuffer) {
        const screechFilter = this.ctx.createBiquadFilter();
        screechFilter.type = 'bandpass';
        screechFilter.frequency.value = 1350;
        screechFilter.Q.value = 4.5;

        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.value = 0;

        this.screechSource = this.ctx.createBufferSource();
        this.screechSource.buffer = this.noiseBuffer;
        this.screechSource.loop = true;
        this.screechSource.connect(screechFilter);
        screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.sfxGain);
        this.screechSource.start();

        // Nitro whoosh loop
        const nitroFilter = this.ctx.createBiquadFilter();
        nitroFilter.type = 'bandpass';
        nitroFilter.frequency.value = 600;
        nitroFilter.Q.value = 1.2;

        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.value = 0;

        const nitroSrc = this.ctx.createBufferSource();
        nitroSrc.buffer = this.noiseBuffer;
        nitroSrc.loop = true;
        nitroSrc.connect(nitroFilter);
        nitroFilter.connect(this.nitroGain);
        this.nitroGain.connect(this.sfxGain);
        nitroSrc.start();

        // Rain ambience
        if (isRaining) {
          const rainFilter = this.ctx.createBiquadFilter();
          rainFilter.type = 'lowpass';
          rainFilter.frequency.value = 1600;
          this.rainGain = this.ctx.createGain();
          this.rainGain.gain.value = 0.14;
          this.rainSource = this.ctx.createBufferSource();
          this.rainSource.buffer = this.noiseBuffer;
          this.rainSource.loop = true;
          this.rainSource.connect(rainFilter);
          rainFilter.connect(this.rainGain);
          this.rainGain.connect(this.sfxGain);
          this.rainSource.start();
        }
      }

      this.engineRunning = true;
    }

    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(this.volumes.engine * 0.22, now, 0.1);
  }

  public updateDrivingAudio(rpm: number, throttle: number, slipRatio: number, isNitro: boolean): void {
    if (!this.ctx || !this.engineRunning) return;
    const now = this.ctx.currentTime;
    const baseFreq = 36 + (rpm / 8000) * 145;
    if (this.engineOsc1) this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.04);
    if (this.engineFilter) {
      const cutoff = 220 + (rpm / 8000) * 900 + throttle * 450;
      this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
    }
    if (this.engineGain) {
      const targetVol = this.volumes.engine * (0.14 + throttle * 0.14);
      this.engineGain.gain.setTargetAtTime(targetVol, now, 0.05);
    }
    if (this.screechGain) {
      const sVol = Math.min(0.28, Math.max(0, (slipRatio - 0.22) * 0.45));
      this.screechGain.gain.setTargetAtTime(sVol, now, 0.04);
    }
    if (this.nitroGain) {
      this.nitroGain.gain.setTargetAtTime(isNitro ? 0.24 : 0, now, 0.06);
    }
  }

  public stopDrivingAudio(): void {
    if (!this.ctx || !this.engineRunning) return;
    const now = this.ctx.currentTime;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.05);
    try {
      this.engineOsc1?.stop(now + 0.1);
      this.engineOsc2?.stop(now + 0.1);
      this.screechSource?.stop(now + 0.1);
      this.rainSource?.stop(now + 0.1);
    } catch {
      // Ignore already stopped
    }
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.screechSource = null;
    this.rainSource = null;
    this.screechGain = null;
    this.nitroGain = null;
    this.rainGain = null;
    this.engineRunning = false;
  }

  public playUiClick(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.055);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playCoin(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      g.gain.setValueAtTime(0.18, now + idx * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.16);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.17);
    });
  }

  public playChime(high = true): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = high ? [523.25, 659.25, 783.99] : [440, 554.37];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      g.gain.setValueAtTime(0.16, now + idx * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.26);
    });
  }

  public playCountdown(isGo: boolean): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.35 : 0.18));
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.36 : 0.19));
  }

  public playCollision(intensity: number): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.45, Math.max(0.08, intensity * 0.4));

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.21);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.7, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(ng);
      ng.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.15);
    }
  }

  public playHorn(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [349.23, 440].forEach((freq) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      g.gain.setValueAtTime(0.14, now);
      g.gain.setValueAtTime(0.14, now + 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.31);
    });
  }

  public playWinFanfare(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.09);
      g.gain.setValueAtTime(0.2, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.46);
    });
  }

  public playFailSting(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [311.13, 277.18, 220].forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + i * 0.14);
      g.gain.setValueAtTime(0.14, now + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.32);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.34);
    });
  }

  private startMusicLoop(): void {
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    const bassNotes = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42];
    const arpNotes = [220, 261.63, 329.63, 440, 329.63, 261.63, 293.66, 392];

    const stepMs = 185;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.ctx.state !== 'running' || this.volumes.music <= 0.01) {
        return;
      }
      const now = this.ctx.currentTime;
      const step = this.musicStep % 16;
      this.musicStep++;

      // Bass pulse on even beats
      if (step % 2 === 0) {
        const bFreq = bassNotes[(step / 2) % bassNotes.length];
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 280;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bFreq, now);
        g.gain.setValueAtTime(0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(f);
        f.connect(g);
        g.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.17);
      }

      // Soft synth arp
      const aFreq = arpNotes[step % arpNotes.length];
      const aOsc = this.ctx.createOscillator();
      const aG = this.ctx.createGain();
      aOsc.type = 'triangle';
      aOsc.frequency.setValueAtTime(aFreq, now);
      aG.gain.setValueAtTime(0.08, now);
      aG.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      aOsc.connect(aG);
      aG.connect(this.musicGain);
      aOsc.start(now);
      aOsc.stop(now + 0.15);

      // Subtle kick on 0, 4, 8, 12
      if (step % 4 === 0) {
        const kOsc = this.ctx.createOscillator();
        const kG = this.ctx.createGain();
        kOsc.type = 'sine';
        kOsc.frequency.setValueAtTime(110, now);
        kOsc.frequency.exponentialRampToValueAtTime(36, now + 0.1);
        kG.gain.setValueAtTime(0.26, now);
        kG.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        kOsc.connect(kG);
        kG.connect(this.musicGain);
        kOsc.start(now);
        kOsc.stop(now + 0.12);
      }
    }, stepMs);
  }

  public dispose(): void {
    this.stopDrivingAudio();
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.isPlayingMusic = false;
  }
}

export const soundEngine = new SoundEngine();
