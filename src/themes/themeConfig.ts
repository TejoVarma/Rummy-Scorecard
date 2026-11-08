export type ThemeId = 'slate_dark' | 'midnight_navy' | 'classic_charcoal' | 'forest_felt';
export type ColorMode = 'dark' | 'light';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  previewColor: string;
  darkStyles: {
    bg: string;
    card: string;
    border: string;
    primary: string;
    text: string;
    muted: string;
  };
  lightStyles: {
    bg: string;
    card: string;
    border: string;
    primary: string;
    text: string;
    muted: string;
  };
}

export const THEMES: Record<ThemeId, ThemeOption> = {
  slate_dark: {
    id: 'slate_dark',
    name: 'Classic Dark (Original App)',
    previewColor: '#0284c7',
    darkStyles: {
      bg: '#121214',
      card: '#1e1e24',
      border: '#2e2e38',
      primary: '#0284c7',
      text: '#f4f4f5',
      muted: '#9ca3af',
    },
    lightStyles: {
      bg: '#f8fafc',
      card: '#ffffff',
      border: '#e2e8f0',
      primary: '#0284c7',
      text: '#0f172a',
      muted: '#64748b',
    },
  },
  midnight_navy: {
    id: 'midnight_navy',
    name: 'Midnight Navy',
    previewColor: '#2563eb',
    darkStyles: {
      bg: '#0f172a',
      card: '#1e293b',
      border: '#334155',
      primary: '#3b82f6',
      text: '#f8fafc',
      muted: '#94a3b8',
    },
    lightStyles: {
      bg: '#f1f5f9',
      card: '#ffffff',
      border: '#cbd5e1',
      primary: '#2563eb',
      text: '#0f172a',
      muted: '#64748b',
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
    },
    lightStyles: {
      bg: '#fafafa',
      card: '#ffffff',
      border: '#e4e4e7',
      primary: '#27272a',
      text: '#18181b',
      muted: '#71717a',
    },
  },
  forest_felt: {
    id: 'forest_felt',
    name: 'Muted Forest',
    previewColor: '#059669',
    darkStyles: {
      bg: '#0f1715',
      card: '#16231f',
      border: '#233832',
      primary: '#059669',
      text: '#f0fdf4',
      muted: '#86efac',
    },
    lightStyles: {
      bg: '#f0fdf4',
      card: '#ffffff',
      border: '#bbf7d0',
      primary: '#059669',
      text: '#064e3b',
      muted: '#15803d',
    },
  },
};
