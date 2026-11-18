// Thin wrapper around Capacitor so the same code runs in the Android app and in a normal browser.
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

type Unsub = () => void;

/** Android hardware/gesture back button. No-op in the browser. */
export function onNativeBack(cb: () => void): Unsub {
  if (!isNative) return () => {};
  const handle = CapApp.addListener('backButton', () => cb());
  return () => {
    void handle.then((h) => h.remove());
  };
}

/** Fires when the app goes to background (false) or returns (true). */
export function onAppActiveChange(cb: (active: boolean) => void): Unsub {
  const onVis = () => cb(!document.hidden);
  document.addEventListener('visibilitychange', onVis);
  let handle: Promise<{ remove: () => Promise<void> }> | null = null;
  if (isNative) handle = CapApp.addListener('appStateChange', (s) => cb(s.isActive));
  return () => {
    document.removeEventListener('visibilitychange', onVis);
    void handle?.then((h) => h.remove());
  };
}

export function exitNativeApp(): void {
  if (isNative) void CapApp.exitApp();
}
