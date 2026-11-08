export type ThemeId = 'casino_green' | 'royal_blue' | 'oled_velvet' | 'crimson_poker';
export type ColorMode = 'dark' | 'light';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  previewColor: string;
  darkStyles: {
    bg: string;
    felt: string;
    card: string;
    border: string;
    accent: string;
    text: string;
  };
  lightStyles: {
    bg: string;
    felt: string;
    card: string;
    border: string;
    accent: string;
    text: string;
  };
}

export const THEMES: Record<ThemeId, ThemeOption> = {
  casino_green: {
    id: 'casino_green',
    name: 'Casino Green',
    previewColor: '#059669',
    darkStyles: {
      bg: '#022c22',
      felt: '#064e3b',
      card: '#042f2e',
      border: '#0d9488',
      accent: '#10b981',
      text: '#ecfdf5',
    },
    lightStyles: {
      bg: '#f0fdf4',
      felt: '#dcfce7',
      card: '#ffffff',
      border: '#86efac',
      accent: '#059669',
      text: '#064e3b',
    },
  },
  royal_blue: {
    id: 'royal_blue',
    name: 'Royal Sapphire',
    previewColor: '#2563eb',
    darkStyles: {
      bg: '#0a0f1d',
      felt: '#0f172a',
      card: '#1e293b',
      border: '#3b82f6',
      accent: '#60a5fa',
      text: '#f8fafc',
    },
    lightStyles: {
      bg: '#eff6ff',
      felt: '#dbeafe',
      card: '#ffffff',
      border: '#93c5fd',
      accent: '#2563eb',
      text: '#1e3a8a',
    },
  },
  oled_velvet: {
    id: 'oled_velvet',
    name: 'OLED Black & Gold',
    previewColor: '#f59e0b',
    darkStyles: {
      bg: '#000000',
      felt: '#121212',
      card: '#1e1e1e',
      border: '#f59e0b',
      accent: '#fbbf24',
      text: '#fef3c7',
    },
    lightStyles: {
      bg: '#fffbeb',
      felt: '#fef3c7',
      card: '#ffffff',
      border: '#fde68a',
      accent: '#d97706',
      text: '#451a03',
    },
  },
  crimson_poker: {
    id: 'crimson_poker',
    name: 'Crimson Poker',
    previewColor: '#dc2626',
    darkStyles: {
      bg: '#1f0404',
      felt: '#380909',
      card: '#450a0a',
      border: '#ef4444',
      accent: '#f87171',
      text: '#fef2f2',
    },
    lightStyles: {
      bg: '#fef2f2',
      felt: '#fee2e2',
      card: '#ffffff',
      border: '#fca5a5',
      accent: '#dc2626',
      text: '#7f1d1d',
    },
  },
};
