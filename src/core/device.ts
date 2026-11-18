// Capacitor & Android WebView safe device utilities

let wakeLockSentinel: { release: () => Promise<void> } | null = null;

export async function requestLandscapeAndFullscreen(): Promise<void> {
  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen().catch(() => {});
      }
    }
  } catch {
    // Ignore in iFrame / restricted WebView
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
    };
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape').catch(() => {});
    }
  } catch {
    // Fallback handled by CSS portrait overlay
  }

  await requestWakeLock();
}

export async function requestWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock && !wakeLockSentinel) {
      wakeLockSentinel = await nav.wakeLock.request('screen').catch(() => null);
    }
  } catch {
    // Ignore unsupported wakeLock
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release().catch(() => {});
      wakeLockSentinel = null;
    }
  } catch {
    // Ignore
  }
}
