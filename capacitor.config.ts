import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.abdrive.city',
  appName: 'AB Drive City',
  webDir: 'dist',
  backgroundColor: '#0F172A',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0F172A',
  },
};

export default config;
