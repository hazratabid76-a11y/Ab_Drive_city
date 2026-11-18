// One-shot Android project setup / patch for AB Drive City.
//
//   npm run android:setup      -> build web, create android/ (first time), icons, patch, sync
//   npm run android:sync       -> rebuild web + sync + re-apply patches (used after code changes)
//
// Needs: Node 20+, JDK 21 and Android Studio (Android SDK). Run `npm install` first.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const patchOnly = process.argv.includes('--patch-only');

const APP_ID = 'com.abdrive.city';
const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

if (!patchOnly) {
  run('npm run build');
  if (!fs.existsSync('android')) run('npx cap add android');
  // App icon (adaptive) + splash for all densities from /assets
  try {
    run('npx capacitor-assets generate --android --assetPath assets');
  } catch {
    console.warn('! Icon generation failed - default Capacitor icon will be used. See README.');
  }
  run('npx cap sync android');
}

// ---------------------------------------------------------------- patches (idempotent)
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
if (fs.existsSync(manifestPath)) {
  let m = fs.readFileSync(manifestPath, 'utf8');
  if (!m.includes('android:screenOrientation')) {
    m = m.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"');
  }
  if (!m.includes('android:hardwareAccelerated')) {
    m = m.replace('<application', '<application\n        android:hardwareAccelerated="true"');
  }
  if (!m.includes('android.permission.VIBRATE')) {
    m = m.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
  }
  fs.writeFileSync(manifestPath, m);
  console.log('Patched AndroidManifest.xml (landscape, hardware acceleration, vibration).');
}

const javaDir = path.join('android/app/src/main/java', ...APP_ID.split('.'));
if (fs.existsSync(javaDir)) {
  fs.writeFileSync(
    path.join(javaDir, 'MainActivity.java'),
    `package ${APP_ID};

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/** Full-screen immersive game activity that keeps the screen awake while playing. */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    enterImmersive();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) enterImmersive();
  }

  private void enterImmersive() {
    WindowInsetsControllerCompat c =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    c.hide(WindowInsetsCompat.Type.systemBars());
  }
}
`,
  );
  console.log('Wrote MainActivity.java (immersive fullscreen + keep screen on).');
}

console.log('\nDone. Next: `npm run android:open` (Android Studio) or `npm run android:apk` (debug APK).');
