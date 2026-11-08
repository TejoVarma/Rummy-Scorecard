export type ThemeId = 'slate_dark' | 'midnight_navy' | 'classic_charcoal' | 'forest_felt';
export type ColorMode = 'dark' | 'light';

export interface ThemeStyles {
  bg: string;
  card: string;
  border: string;
  primary: string;
  text: string;
  muted: string;
  subtle: string;
}

export interface ThemeOption {
  id: ThemeId;
  name: string;
  previewColor: string;
  darkStyles: ThemeStyles;
  lightStyles: ThemeStyles;
}

export const THEMES: Record<ThemeId, ThemeOption> = {
  slate_dark: {
    id: 'slate_dark',
    name: 'Classic (Original App)',
    previewColor: '#00a2ed',
    darkStyles: {
      bg: '#111113',
      card: '#222226',
      border: '#33333d',
      primary: '#00a2ed',
      text: '#f4f4f5',
      muted: '#a1a1aa',
      subtle: '#18181e',
    },
    lightStyles: {
      bg: '#f8fafc',
      card: '#ffffff',
      border: '#e2e8f0',
      primary: '#00a2ed',
      text: '#0f172a',
      muted: '#64748b',
      subtle: '#f1f5f9',
    },
  },
  midnight_navy: {
    id: 'midnight_navy',
    name: 'Midnight Navy',
    previewColor: '#2563eb',
    darkStyles: {
      bg: '#0a0f1d',
      card: '#151e32',
      border: '#23304a',
      primary: '#3b82f6',
      text: '#f8fafc',
      muted: '#94a3b8',
      subtle: '#101726',
    },
    lightStyles: {
      bg: '#f0f4f9',
      card: '#ffffff',
      border: '#cbd5e1',
      primary: '#2563eb',
      text: '#0f172a',
      muted: '#64748b',
      subtle: '#e2e8f0',
    },
  },
  classic_charcoal: {
    id: 'classic_charcoal',
    name: 'Minimal Charcoal',
    previewColor: '#52525b',
    darkStyles: {
      bg: '#18181b',
      card: '#27272a',
      border: '#3f3f46',
      primary: '#71717a',
      text: '#fafafa',
      muted: '#a1a1aa',
      subtle: '#202024',
    },
    lightStyles: {
      bg: '#fafafa',
      card: '#ffffff',
      border: '#e4e4e7',
      primary: '#27272a',
      text: '#18181b',
      muted: '#71717a',
      subtle: '#f4f4f5',
    },
  },
  forest_felt: {
    id: 'forest_felt',
    name: 'Muted Forest',
    previewColor: '#059669',
    darkStyles: {
      bg: '#0b1613',
      card: '#142520',
      border: '#1f3830',
      primary: '#059669',
      text: '#f0fdf4',
      muted: '#86efac',
      subtle: '#0e1c18',
    },
    lightStyles: {
      bg: '#f0fdf4',
      card: '#ffffff',
      border: '#bbf7d0',
      primary: '#059669',
      text: '#064e3b',
      muted: '#15803d',
      subtle: '#dcfce7',
    },
  },
};
