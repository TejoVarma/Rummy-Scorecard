export type ThemeId = 'slate_dark' | 'forest_felt' | 'midnight_navy' | 'classic_charcoal';
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
    name: 'Sky Classic',
    previewColor: '#0284c7',
    darkStyles: {
      bg: '#0f172a',
      card: '#1e293b',
      border: '#334155',
      primary: '#0284c7',
      text: '#f8fafc',
      muted: '#94a3b8',
      subtle: '#141f36',
    },
    lightStyles: {
      bg: '#f0f9ff',
      card: '#ffffff',
      border: '#bae6fd',
      primary: '#0284c7',
      text: '#0c4a6e',
      muted: '#0369a1',
      subtle: '#e0f2fe',
    },
  },
  forest_felt: {
    id: 'forest_felt',
    name: 'Emerald Felt',
    previewColor: '#059669',
    darkStyles: {
      bg: '#041f17',
      card: '#0a3325',
      border: '#134e3a',
      primary: '#059669',
      text: '#ecfdf5',
      muted: '#6ee7b7',
      subtle: '#02140e',
    },
    lightStyles: {
      bg: '#f0fdf4',
      card: '#ffffff',
      border: '#a7f3d0',
      primary: '#059669',
      text: '#064e3b',
      muted: '#047857',
      subtle: '#dcfce7',
    },
  },
  midnight_navy: {
    id: 'midnight_navy',
    name: 'Royal Velvet',
    previewColor: '#8b5cf6',
    darkStyles: {
      bg: '#160b29',
      card: '#241242',
      border: '#432070',
      primary: '#8b5cf6',
      text: '#faf5ff',
      muted: '#d8b4fe',
      subtle: '#0f071c',
    },
    lightStyles: {
      bg: '#faf5ff',
      card: '#ffffff',
      border: '#ddd6fe',
      primary: '#7c3aed',
      text: '#3b0764',
      muted: '#7e22ce',
      subtle: '#f3e8ff',
    },
  },
  classic_charcoal: {
    id: 'classic_charcoal',
    name: 'Crimson Ruby',
    previewColor: '#ef4444',
    darkStyles: {
      bg: '#240a0d',
      card: '#381116',
      border: '#591a22',
      primary: '#ef4444',
      text: '#fef2f2',
      muted: '#fca5a5',
      subtle: '#170507',
    },
    lightStyles: {
      bg: '#fff1f2',
      card: '#ffffff',
      border: '#fecdd3',
      primary: '#e11d48',
      text: '#881337',
      muted: '#be123c',
      subtle: '#ffe4e6',
    },
  },
};
