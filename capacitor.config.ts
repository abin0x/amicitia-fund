import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amicitia.app',
  appName: 'Amicitia',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
