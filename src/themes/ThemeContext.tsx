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

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId) || 'casino_green';
  });

  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    return (localStorage.getItem(MODE_STORAGE_KEY) as ColorMode) || 'dark';
  });

  const theme = THEMES[themeId] || THEMES.casino_green;

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  };

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  };

  const toggleColorMode = () => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    const styles = colorMode === 'dark' ? theme.darkStyles : theme.lightStyles;

    root.style.setProperty('--color-bg', styles.bg);
    root.style.setProperty('--color-felt', styles.felt);
    root.style.setProperty('--color-card', styles.card);
    root.style.setProperty('--color-border', styles.border);
    root.style.setProperty('--color-accent', styles.accent);
    root.style.setProperty('--color-text', styles.text);

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
