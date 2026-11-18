# AB Drive City — Android 3D Driving Game

React + Three.js game packaged for **Android** with Capacitor. Landscape, fullscreen, touch/tilt controls, offline (everything is bundled, including fonts).

## چلانے کا طریقہ (Quick start)

Requirements: Node 20+, JDK 21, Android Studio (with Android SDK).

```bash
npm install
npm run dev              # browser test at http://localhost:3000
npm run build            # production web build -> dist/
npm run android:setup    # first time: creates android/, icons, landscape/fullscreen patches
npm run android:open     # open in Android Studio -> Run ▶ on phone, or Build > Build APK
npm run android:apk      # or build a debug APK from the terminal
                         #  -> android/app/build/outputs/apk/debug/app-debug.apk
```

After changing game code: `npm run android:sync` (rebuilds web + syncs + re-applies patches).

Release/Play Store: in Android Studio use *Build > Generate Signed Bundle / APK*. App id: `com.abdrive.city` (change in `capacitor.config.ts` **and** `scripts/setup-android.mjs` before the first `android:setup`).

## What the Android setup does
- Locks **landscape** (`sensorLandscape`), hardware acceleration on, vibration permission.
- **Immersive fullscreen** + screen stays awake (custom `MainActivity`).
- **Back button**: pauses in game, goes back in menus, exits from main menu.
- **Auto-pause** + audio suspend when the app goes to background.
- Adaptive launcher icon + splash generated from `assets/` (AB car artwork).
- Removed the web/PWA layer (service worker, install button) and AI Studio leftovers (express, Gemini SDK, env file) — not needed in a native app.
- Fonts bundled locally (`@fontsource`) instead of Google Fonts, so the UI works offline.

## Project layout
```
src/
  App.tsx            screens/navigation, save wiring, Android back/pause hooks
  main.tsx           entry (fonts, CSS)
  core/              save, input (touch/tilt), audio, device, native (Capacitor bridge)
  data/              cars, levels, modes, upgrades, economy, achievements, i18n (EN/UR)
  engine/GameEngine  renderer, loop, cameras, quality scaling
  vehicle/           carBuilder (procedural cars), physics
  world/             cityGenerator, weather (time-of-day + weather), traffic, pedestrian,
                     pbrTextures, collectibles, particles
  modes/             mode controller (10 game modes)
  ui/                menu, HUD, garage, shop, settings, career map …
scripts/setup-android.mjs   Android project creation + patches
assets/                      icon / splash sources
```

## Graphics changes in this version
Implemented in code:
- **Cars**: sculpted side-profile bodies (hood → windshield rake → roof → fastback/trunk) with rounded edges, glass greenhouse, pillars, roof, and a real **interior** (dashboard, steering wheel, two seats) for the player and garage view. Traffic cars use a cheaper dark cabin block. Pickup and Truck-lite keep their box layout.
- **Pedestrians**: articulated humans with natural proportions and walk animation (arms/legs), facing their walking direction.
- **Roads & buildings**: procedural **PBR** textures (albedo + normal + roughness) for asphalt, curtain-glass / limestone / brick facades. Facade UVs scale by building height so floor height looks right.
- **Time of day**: sunrise, morning, afternoon, day, sunset, night — each with its own sun/sky/fog/exposure. **Weather**: clear, cloudy (new), rain (wet road), fog.
- **Graphics presets**: Low / Medium / High / **Ultra** / Auto (auto steps down Ultra → High → Medium → Low if FPS drops). Shadow-map size follows the preset.
- New levels/daily challenges use the new times and cloudy weather.

## Honest limitations
- **No downloaded GLB/GLTF models or photo textures are included** — the build environment had no internet. All cars, buildings and people are still procedural (generated in code). Realistic licensed GLB assets (e.g. from Kenney, Quaternius, Poly Pizza, Sketchfab CC0) would be the next step and can be loaded with `GLTFLoader`.
- Not implemented: screen-space reflections, ambient-occlusion post-processing, weather transitions (weather is fixed per run), LOD/instancing rewrite of the city.
- This package was edited and checked **without running `npm install` or the production build** (no network in the sandbox). Please run `npm install && npm run lint && npm run build` first and report any error. The new car body geometry in particular should be eyeballed in the Garage screen.
