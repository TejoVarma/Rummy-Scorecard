import React, { createContext, useContext, useEffect, useState } from 'react';
import { ColorMode, THEMES, ThemeId, ThemeOption } from './themeConfig';

interface ThemeContextValue {
  themeId: ThemeId;
  colorMode: ColorMode;
  theme: ThemeOption;
  setThemeId: (id: ThemeId) => void;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
}

const THEME_STORAGE_KEY = 'rummy_theme_id';
const MODE_STORAGE_KEY = 'rummy_color_mode';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const isValidThemeId = (id: unknown): id is ThemeId =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(THEMES, id);

const isValidColorMode = (mode: unknown): mode is ColorMode =>
  mode === 'dark' || mode === 'light';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      return isValidThemeId(raw) ? raw : 'slate_dark';
    } catch (err) {
      console.warn('Failed to read theme preference from storage:', err);
      return 'slate_dark';
    }
  });

  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY);
      return isValidColorMode(raw) ? raw : 'dark';
    } catch (err) {
      console.warn('Failed to read color mode preference from storage:', err);
      return 'dark';
    }
  });

  const theme = THEMES[themeId] || THEMES.slate_dark;

  const setThemeId = (id: ThemeId) => {
    if (!isValidThemeId(id)) return;
    setThemeIdState(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch (err) {
      console.warn(`Failed to persist theme ID "${id}" to localStorage:`, err);
    }
  };

  const setColorMode = (mode: ColorMode) => {
    if (!isValidColorMode(mode)) return;
    setColorModeState(mode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch (err) {
      console.warn(`Failed to persist color mode "${mode}" to localStorage:`, err);
    }
  };

  const toggleColorMode = () => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    const styles = colorMode === 'dark' ? theme.darkStyles : theme.lightStyles;

    root.style.setProperty('--color-bg', styles.bg);
    root.style.setProperty('--color-card', styles.card);
    root.style.setProperty('--color-border', styles.border);
    root.style.setProperty('--color-primary', styles.primary);
    root.style.setProperty('--color-text', styles.text);
    root.style.setProperty('--color-muted', styles.muted);
    root.style.setProperty('--color-subtle', styles.subtle);

    if (colorMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeId, colorMode, theme]);

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        colorMode,
        theme,
        setThemeId,
        setColorMode,
        toggleColorMode,
      }}
    >
      <div
        className="min-h-screen w-full transition-colors duration-200"
        style={{
          backgroundColor: colorMode === 'dark' ? theme.darkStyles.bg : theme.lightStyles.bg,
          color: colorMode === 'dark' ? theme.darkStyles.text : theme.lightStyles.text,
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
