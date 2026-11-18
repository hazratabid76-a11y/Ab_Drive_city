import React, { useRef, useState } from 'react';
import { ArrowLeft, Download, RotateCcw, Upload } from 'lucide-react';
import { soundEngine } from '../core/audio';
import { InputManager } from '../core/input';
import { exportSaveJson } from '../core/save';
import { t } from '../data/i18n';
import {
  ControlScheme,
  GraphicsQuality,
  LanguageCode,
  SaveData,
  SettingsData,
  SpeedUnit,
} from '../types/game';

interface SettingsModalProps {
  save: SaveData;
  inputMgr: InputManager;
  onUpdateSettings: (next: SettingsData) => void;
  onImportSave: (json: string) => void;
  onResetProgress: () => void;
  onBack: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  save,
  inputMgr,
  onUpdateSettings,
  onImportSave,
  onResetProgress,
  onBack,
}) => {
  const s = save.settings;
  const lang = s.language;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const patch = (partial: Partial<SettingsData>) => {
    onUpdateSettings({ ...s, ...partial });
  };

  const handleExport = () => {
    const json = exportSaveJson(save);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ab-drive-city-save.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Save exported!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImportSave(String(reader.result || ''));
        setStatusMsg('Save imported successfully!');
      } catch {
        setStatusMsg('Invalid save file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 flex flex-col bg-[#0F172A]/96 p-3 sm:p-5 safe-pad"
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onBack();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {t(lang, 'back')}
          </button>
          <h2 className="font-display text-2xl font-bold text-[#F8FAFC]">{t(lang, 'settings')}</h2>
        </div>
        {statusMsg && <span className="text-xs font-semibold text-[#14B8A6]">{statusMsg}</span>}
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Controls */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 space-y-3">
          <h3 className="font-display text-lg font-bold text-[#FF8A00]">Controls & Units</h3>
          <div>
            <div className="text-xs text-slate-400 mb-1.5">Touch Steering Layout</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'wheel', label: 'Wheel' },
                  { id: 'tilt', label: 'Tilt' },
                  { id: 'arrows', label: 'Arrows' },
                ] as { id: ControlScheme; label: string }[]
              ).map((c) => (
                <button
                  key={c.id}
                  onClick={async () => {
                    soundEngine.playUiClick();
                    if (c.id === 'tilt') {
                      const ok = await inputMgr.requestTiltPermission();
                      if (!ok) setStatusMsg('Tilt permission denied or unavailable.');
                    }
                    patch({ controls: c.id });
                  }}
                  className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                    s.controls === c.id
                      ? 'bg-[#FF8A00] text-[#0F172A] border-[#FF8A00]'
                      : 'bg-slate-950 text-slate-300 border-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {s.controls === 'tilt' && (
            <button
              onClick={() => {
                const offset = inputMgr.calibrateTilt();
                patch({ tiltOffset: offset });
                setStatusMsg('Tilt calibrated to current angle.');
              }}
              className="w-full py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
            >
              Calibrate Tilt Neutral
            </button>
          )}

          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Steering Sensitivity</span>
              <span className="font-mono-num">{s.sensitivity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={s.sensitivity}
              onChange={(e) => patch({ sensitivity: Number(e.target.value) })}
              className="w-full accent-[#FF8A00]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Touch Button Size</span>
              <span className="font-mono-num">{Math.round(s.buttonSize * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.05}
              value={s.buttonSize}
              onChange={(e) => patch({ buttonSize: Number(e.target.value) })}
              className="w-full accent-[#FF8A00]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Touch HUD Opacity</span>
              <span className="font-mono-num">{Math.round(s.buttonOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.4}
              max={1.0}
              step={0.05}
              value={s.buttonOpacity}
              onChange={(e) => patch({ buttonOpacity: Number(e.target.value) })}
              className="w-full accent-[#14B8A6]"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-300">Speed Units</span>
            <div className="flex gap-1">
              {(['kmh', 'mph'] as SpeedUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => patch({ units: u })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                    s.units === u ? 'bg-[#14B8A6] text-[#0F172A]' : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {u === 'kmh' ? 'km/h' : 'mph'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Haptic Vibration</span>
            <button
              onClick={() => patch({ vibration: !s.vibration })}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                s.vibration ? 'bg-[#14B8A6] text-[#0F172A]' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {s.vibration ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Graphics & Audio */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 space-y-3">
          <h3 className="font-display text-lg font-bold text-[#14B8A6]">Graphics & Audio</h3>
          <div>
            <div className="text-xs text-slate-400 mb-1.5">Graphics Quality</div>
            <div className="grid grid-cols-5 gap-1.5">
              {(['low', 'medium', 'high', 'ultra', 'auto'] as GraphicsQuality[]).map((g) => (
                <button
                  key={g}
                  onClick={() => patch({ graphics: g })}
                  className={`py-1.5 rounded-lg text-xs font-bold capitalize border cursor-pointer ${
                    s.graphics === g
                      ? 'bg-[#14B8A6] text-[#0F172A] border-[#14B8A6]'
                      : 'bg-slate-950 text-slate-300 border-white/10'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Resolution Scale</span>
              <span className="font-mono-num">{Math.round(s.resolutionScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.0}
              step={0.05}
              value={s.resolutionScale}
              onChange={(e) => patch({ resolutionScale: Number(e.target.value) })}
              className="w-full accent-[#14B8A6]"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Show FPS Counter</span>
            <button
              onClick={() => patch({ showFps: !s.showFps })}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                s.showFps ? 'bg-[#FFC93C] text-[#0F172A]' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {s.showFps ? 'ON' : 'OFF'}
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Music Volume</span>
              <span className="font-mono-num">{Math.round(s.musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.musicVolume}
              onChange={(e) => patch({ musicVolume: Number(e.target.value) })}
              className="w-full accent-[#FF8A00]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>SFX Volume</span>
              <span className="font-mono-num">{Math.round(s.sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.sfxVolume}
              onChange={(e) => patch({ sfxVolume: Number(e.target.value) })}
              className="w-full accent-[#FF8A00]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Engine Volume</span>
              <span className="font-mono-num">{Math.round(s.engineVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.engineVolume}
              onChange={(e) => patch({ engineVolume: Number(e.target.value) })}
              className="w-full accent-[#FF8A00]"
            />
          </div>
        </div>

        {/* Language, Save Data & Info */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="font-display text-lg font-bold text-[#FFC93C]">Language & Data</h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Language</span>
              <div className="flex gap-1.5">
                {(
                  [
                    { id: 'en', label: 'English' },
                    { id: 'ur', label: 'اردو (RTL)' },
                  ] as { id: LanguageCode; label: string }[]
                ).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => patch({ language: l.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      s.language === l.id ? 'bg-[#FF8A00] text-[#0F172A]' : 'bg-slate-950 text-slate-300'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#14B8A6]" /> Export Save
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#FFC93C]" /> Import Save
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#EF4444]/40 text-[#EF4444] text-xs font-bold hover:bg-[#EF4444]/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset All Progress
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                    setStatusMsg('Progress reset.');
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#EF4444] text-white text-xs font-bold cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 border-t border-white/10 pt-2.5 space-y-1">
            <div className="font-semibold text-slate-300">AB Drive City · Original 3D Driving Game</div>
            <div>Privacy: All saves, ghosts, and settings stay 100% locally on your device. No tracking or external servers.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
