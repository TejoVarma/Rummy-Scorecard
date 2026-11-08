import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rummyscoreboard.pro',
  appName: 'Rummy Scoreboard Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#022c22',
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
