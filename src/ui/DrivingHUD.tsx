import React, { useEffect, useRef, useState } from 'react';
import { Camera, Flag, Pause, Volume2, Zap } from 'lucide-react';
import { soundEngine } from '../core/audio';
import { InputManager } from '../core/input';
import { t } from '../data/i18n';
import { GearMode, HUDState, ModeId, SettingsData } from '../types/game';

interface DrivingHUDProps {
  hud: HUDState;
  mode: ModeId;
  settings: SettingsData;
  inputMgr: InputManager;
  onCameraToggle: () => void;
  onPause: () => void;
  onBankEndless: () => void;
}

export const DrivingHUD: React.FC<DrivingHUDProps> = ({
  hud,
  mode,
  settings,
  inputMgr,
  onCameraToggle,
  onPause,
  onBankEndless,
}) => {
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const wheelPointerId = useRef<number | null>(null);
  const [wheelAngleDeg, setWheelAngleDeg] = useState(0);

  const lang = settings.language;
  const speedDisplay = settings.units === 'mph' ? Math.round(hud.speedKmh * 0.621371) : hud.speedKmh;
  const unitLabel = settings.units === 'mph' ? 'MPH' : 'KM/H';
  const highSpeedRatio = Math.max(0, Math.min(1, (hud.speedKmh - 140) / 140));

  // Render Minimap
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.36; // meters -> px

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    // Subtle road grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.22)';
    ctx.lineWidth = 2;
    const gridSpacing = 120;
    const startGx = Math.floor((hud.playerX - 180) / gridSpacing) * gridSpacing;
    const startGz = Math.floor((hud.playerZ - 180) / gridSpacing) * gridSpacing;
    for (let gx = startGx; gx <= hud.playerX + 180; gx += gridSpacing) {
      const sx = cx + (gx - hud.playerX) * scale;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    for (let gz = startGz; gz <= hud.playerZ + 180; gz += gridSpacing) {
      const sy = cy + (gz - hud.playerZ) * scale;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }

    // Blips
    for (const b of hud.blips) {
      const bx = cx + (b.x - hud.playerX) * scale;
      const by = cy + (b.z - hud.playerZ) * scale;
      if (b.type === 'target') {
        // Clamp to edge if off-map so route arrow always shows direction
        const dx = bx - cx;
        const dy = by - cy;
        const maxR = w * 0.43;
        const dist = Math.hypot(dx, dy) || 1;
        const px = dist > maxR ? cx + (dx / dist) * maxR : bx;
        const py = dist > maxR ? cy + (dy / dist) * maxR : by;
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (bx >= 2 && bx <= w - 2 && by >= 2 && by <= h - 2) {
        ctx.fillStyle =
          b.type === 'pursuer' ? '#EF4444' : b.type === 'pickup' ? '#FFC93C' : 'rgba(248,250,252,0.55)';
        ctx.beginPath();
        ctx.arc(bx, by, b.type === 'pursuer' ? 3.5 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player Arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-hud.playerHeading);
    ctx.fillStyle = '#FF8A00';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [hud.playerX, hud.playerZ, hud.playerHeading, hud.blips]);

  // Draggable Steering Wheel Logic
  const updateWheelFromPointer = (clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // Angle relative to top (0 = straight up, +right, -left)
    let angle = Math.atan2(dx, -dy);
    const maxRad = (115 * Math.PI) / 180;
    angle = Math.max(-maxRad, Math.min(maxRad, angle));
    setWheelAngleDeg((angle * 180) / Math.PI);
    inputMgr.setWheelSteer(angle / maxRad);
  };

  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const btnScale = settings.buttonSize;
  const btnAlpha = settings.buttonOpacity;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 safe-pad">
      {/* Collision Red Flash */}
      {hud.collisionFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none border-8 border-[#EF4444]"
          style={{ opacity: hud.collisionFlash * 0.6 }}
        />
      )}

      {/* High-Speed Edge Vignette */}
      {highSpeedRatio > 0.05 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 ${Math.round(55 + highSpeedRatio * 55)}px rgba(255,138,0,${0.18 * highSpeedRatio})`,
          }}
        />
      )}

      {/* TOP HUD ROW */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left: Minimap + FPS */}
        <div className="flex items-start gap-2">
          <div className="rounded-2xl border border-white/20 bg-[#0F172A]/85 p-1 shadow-lg">
            <canvas ref={minimapRef} width={96} height={96} className="rounded-xl block w-20 h-20 sm:w-24 sm:h-24" />
          </div>
          {settings.showFps && (
            <div className="rounded-xl bg-[#0F172A]/85 border border-white/10 px-2.5 py-1 font-mono-num text-[11px] font-bold text-[#14B8A6]">
              {hud.fps} FPS · {hud.activeQuality.toUpperCase()}
            </div>
          )}
        </div>

        {/* Top-Center: Objective, Tutorial, Wrong Way */}
        <div className="flex flex-col items-center gap-1.5 max-w-xs sm:max-w-md text-center">
          <div className="rounded-2xl bg-[#0F172A]/85 border border-white/15 px-4 py-1.5">
            <div className="text-[11px] font-bold text-[#14B8A6] uppercase tracking-wider">
              {hud.objectiveLabel}
            </div>
            <div className="font-display text-sm sm:text-base font-bold text-[#F8FAFC]">
              {hud.objectiveProgress}
            </div>
          </div>

          {hud.tutorialBanner && hud.elapsedTime < 12 && (
            <div className="rounded-xl bg-[#FF8A00] text-[#0F172A] px-3 py-1 text-xs font-bold shadow-md">
              {hud.tutorialBanner}
            </div>
          )}

          {hud.wrongWay && (
            <div className="rounded-xl bg-[#EF4444] text-white px-4 py-1 font-display text-base font-bold tracking-wider">
              {t(lang, 'wrongWay')}
            </div>
          )}
        </div>

        {/* Top-Right: Timer, Score, Coins, Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-2xl bg-[#0F172A]/85 border border-white/15 px-3 py-1.5 text-right font-mono-num">
            <div className="text-sm sm:text-base font-bold text-[#FFC93C]">
              {mode === 'endless_traffic' ? formatTime(hud.elapsedTime) : formatTime(hud.timeRemaining)}
            </div>
            <div className="text-[11px] text-slate-300">
              {hud.score.toLocaleString()} pts · +{hud.coinsInRun} C
            </div>
          </div>

          {mode === 'endless_traffic' && (
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onBankEndless();
              }}
              className="p-2.5 rounded-xl bg-[#14B8A6] text-[#0F172A] font-bold text-xs flex items-center gap-1 cursor-pointer"
              title="Finish & Bank Score"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              soundEngine.playHorn();
            }}
            className="p-2.5 rounded-xl bg-[#0F172A]/85 border border-white/15 text-[#FFC93C] hover:border-[#FFC93C] active:scale-95 cursor-pointer"
            aria-label="Horn"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          <button
            onClick={onCameraToggle}
            className="p-2.5 rounded-xl bg-[#0F172A]/85 border border-white/15 text-[#14B8A6] hover:border-[#14B8A6] active:scale-95 cursor-pointer"
            aria-label="Switch Camera"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              soundEngine.playUiClick();
              onPause();
            }}
            className="p-2.5 rounded-xl bg-[#0F172A]/85 border border-white/15 text-white hover:border-[#FF8A00] active:scale-95 cursor-pointer"
            aria-label="Pause"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTER OVERLAYS: Countdown, Popups, Parking Sensors */}
      <div className="flex flex-col items-center justify-center my-auto gap-2">
        {hud.countdown >= 0 && (
          <div className="font-display text-6xl sm:text-7xl font-bold text-[#FFC93C] drop-shadow-lg">
            {hud.countdown === 0 ? 'GO!' : hud.countdown}
          </div>
        )}

        {hud.comboCount > 1 && (
          <div className="rounded-xl bg-[#FF8A00] text-[#0F172A] px-3 py-0.5 font-display text-sm font-bold">
            {hud.comboCount}x COMBO
          </div>
        )}

        {hud.popups.map((p) => (
          <div
            key={p.id}
            className="rounded-xl bg-[#0F172A]/90 border border-white/15 px-3 py-1 text-center shadow-lg"
          >
            <div className="font-display text-sm sm:text-base font-bold" style={{ color: p.color }}>
              {p.text}
            </div>
            {p.subtext && <div className="text-[10px] text-slate-300">{p.subtext}</div>}
          </div>
        ))}

        {hud.parkingSensors && (
          <div className="rounded-2xl bg-[#0F172A]/90 border border-[#FF8A00]/60 px-4 py-2 text-xs font-mono-num">
            <div className="text-center font-bold text-[#FFC93C] mb-1">
              PARKING SENSORS · {hud.parkingSensors.inside ? 'INSIDE BAY' : 'APPROACH'}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
              <span>Front: {hud.parkingSensors.front.toFixed(1)}m</span>
              <span>Rear: {hud.parkingSensors.rear.toFixed(1)}m</span>
              <span>Align: {hud.parkingSensors.aligned ? 'OK' : 'TURN'}</span>
              <span>Speed: {hud.speedKmh < 3 ? 'HOLD' : 'SLOW'}</span>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS & TELEMETRY */}
      <div className="flex items-end justify-between gap-2">
        {/* Bottom-Left: Gas / Brake Pedals + P-R-N-D Gear Shifter */}
        <div
          className="pointer-events-auto flex items-end gap-2"
          style={{ transform: `scale(${btnScale})`, transformOrigin: 'bottom left', opacity: btnAlpha }}
        >
          {/* P-R-N-D Selector */}
          <div className="flex flex-col gap-1 bg-[#0F172A]/85 border border-white/15 rounded-xl p-1">
            {(['P', 'R', 'N', 'D'] as GearMode[]).map((g) => (
              <button
                key={g}
                onClick={() => {
                  soundEngine.playUiClick();
                  inputMgr.setGear(g);
                }}
                className={`w-8 h-6 rounded-lg font-mono-num text-xs font-bold cursor-pointer ${
                  hud.gear === g
                    ? g === 'R'
                      ? 'bg-[#EF4444] text-white'
                      : 'bg-[#FF8A00] text-[#0F172A]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Brake & Gas Pedals */}
          <button
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              inputMgr.setTouchBrake(1);
            }}
            onPointerUp={() => inputMgr.setTouchBrake(0)}
            onPointerCancel={() => inputMgr.setTouchBrake(0)}
            className="w-16 h-24 sm:w-20 sm:h-28 rounded-2xl bg-[#EF4444]/85 border-2 border-white/25 text-white font-display text-xs font-bold flex flex-col items-center justify-end pb-2 active:scale-95 cursor-pointer"
          >
            BRAKE
          </button>

          <button
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              inputMgr.setTouchThrottle(1);
            }}
            onPointerUp={() => inputMgr.setTouchThrottle(0)}
            onPointerCancel={() => inputMgr.setTouchThrottle(0)}
            className="w-16 h-28 sm:w-20 sm:h-32 rounded-2xl bg-[#14B8A6]/90 border-2 border-white/30 text-[#0F172A] font-display text-xs font-bold flex flex-col items-center justify-end pb-2 active:scale-95 cursor-pointer"
          >
            GAS
          </button>
        </div>

        {/* Bottom-Center: Speedometer, RPM, Nitro, Health */}
        <div className="rounded-2xl bg-[#0F172A]/88 border border-white/15 px-3.5 py-2 flex items-center gap-3 sm:gap-4">
          <div className="text-center">
            <div className="font-mono-num text-2xl sm:text-3xl font-bold leading-none text-[#F8FAFC]">
              {speedDisplay}
            </div>
            <div className="text-[10px] font-bold text-[#FF8A00]">
              {unitLabel} · {hud.gear === 'D' ? `D${hud.autoGearNum}` : hud.gear}
            </div>
          </div>

          <div className="w-28 sm:w-36 space-y-1.5 text-[10px] font-mono-num">
            {/* RPM */}
            <div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#14B8A6] via-[#FFC93C] to-[#EF4444]"
                  style={{ width: `${Math.min(100, (hud.rpm / 8000) * 100)}%` }}
                />
              </div>
            </div>
            {/* Nitro */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#14B8A6] w-6">N2O</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-[#14B8A6]" style={{ width: `${hud.nitro}%` }} />
              </div>
            </div>
            {/* Vehicle Health */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#FFC93C] w-6">HP</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${hud.health}%`,
                    backgroundColor: hud.health > 50 ? '#22C55E' : hud.health > 25 ? '#FFC93C' : '#EF4444',
                  }}
                />
              </div>
            </div>
            {/* Cargo Health if Delivery */}
            {hud.cargoHealth !== undefined && (
              <div className="flex items-center gap-1.5">
                <span className="text-[#FF8A00] w-6">CRG</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-[#FF8A00]" style={{ width: `${hud.cargoHealth}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom-Right: Nitro, Handbrake + Steering (Wheel / Tilt / Arrows) */}
        <div
          className="pointer-events-auto flex items-end gap-2.5"
          style={{ transform: `scale(${btnScale})`, transformOrigin: 'bottom right', opacity: btnAlpha }}
        >
          <div className="flex flex-col gap-2">
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                inputMgr.setTouchNitro(true);
              }}
              onPointerUp={() => inputMgr.setTouchNitro(false)}
              onPointerCancel={() => inputMgr.setTouchNitro(false)}
              className="w-14 h-14 rounded-2xl bg-[#14B8A6] border-2 border-white/30 text-[#0F172A] font-display text-xs font-bold flex flex-col items-center justify-center active:scale-95 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              N2O
            </button>

            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                inputMgr.setTouchHandbrake(true);
              }}
              onPointerUp={() => inputMgr.setTouchHandbrake(false)}
              onPointerCancel={() => inputMgr.setTouchHandbrake(false)}
              className="w-14 h-14 rounded-2xl bg-[#FF8A00] border-2 border-white/30 text-[#0F172A] font-display text-[11px] font-bold flex items-center justify-center active:scale-95 cursor-pointer"
            >
              DRIFT
            </button>
          </div>

          {settings.controls === 'wheel' && (
            <div
              ref={wheelRef}
              onPointerDown={(e) => {
                wheelPointerId.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                updateWheelFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (wheelPointerId.current === e.pointerId) {
                  updateWheelFromPointer(e.clientX, e.clientY);
                }
              }}
              onPointerUp={(e) => {
                if (wheelPointerId.current === e.pointerId) {
                  wheelPointerId.current = null;
                  setWheelAngleDeg(0);
                  inputMgr.setWheelSteer(0);
                }
              }}
              onPointerCancel={() => {
                wheelPointerId.current = null;
                setWheelAngleDeg(0);
                inputMgr.setWheelSteer(0);
              }}
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#FF8A00] bg-[#0F172A]/85 flex items-center justify-center cursor-grab active:cursor-grabbing"
              style={{ transform: `rotate(${wheelAngleDeg}deg)` }}
            >
              {/* Steering wheel spokes */}
              <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                <div className="w-full h-3 bg-slate-600/80 rounded-full" />
                <div className="absolute bottom-2 w-3 h-1/2 bg-slate-600/80 rounded-full" />
                <div className="absolute top-1 w-3 h-4 bg-[#FFC93C] rounded-full" />
                <div className="w-9 h-9 rounded-full bg-[#1E293B] border-2 border-[#FF8A00] flex items-center justify-center font-display text-xs font-bold text-[#F8FAFC]">
                  AB
                </div>
              </div>
            </div>
          )}

          {settings.controls === 'arrows' && (
            <div className="flex items-center gap-2">
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  inputMgr.setTouchArrowLeft(true);
                }}
                onPointerUp={() => inputMgr.setTouchArrowLeft(false)}
                onPointerCancel={() => inputMgr.setTouchArrowLeft(false)}
                className="w-16 h-20 rounded-2xl bg-[#0F172A]/90 border-2 border-white/25 text-white font-display text-2xl font-bold active:bg-[#FF8A00] active:text-[#0F172A] cursor-pointer"
              >
                ◀
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  inputMgr.setTouchArrowRight(true);
                }}
                onPointerUp={() => inputMgr.setTouchArrowRight(false)}
                onPointerCancel={() => inputMgr.setTouchArrowRight(false)}
                className="w-16 h-20 rounded-2xl bg-[#0F172A]/90 border-2 border-white/25 text-white font-display text-2xl font-bold active:bg-[#FF8A00] active:text-[#0F172A] cursor-pointer"
              >
                ▶
              </button>
            </div>
          )}

          {settings.controls === 'tilt' && (
            <button
              onClick={() => inputMgr.calibrateTilt()}
              className="px-3 py-4 rounded-2xl bg-[#0F172A]/88 border border-[#14B8A6]/60 text-[11px] font-bold text-[#14B8A6] cursor-pointer"
            >
              TILT ACTIVE
              <br />
              Tap to Zero
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
