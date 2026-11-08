import React from 'react';
import { Modal } from '../common/Modal';
import { useTheme } from '../../themes/ThemeContext';
import { THEMES, ThemeId } from '../../themes/themeConfig';
import { Sun, Moon, RefreshCw, Palette } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetGame: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetGame,
}) => {
  const { themeId, setThemeId, colorMode, toggleColorMode } = useTheme();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings & Themes">
      <div className="space-y-6">
        {/* Color Mode (Dark / Light) */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold opacity-75">Appearance Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleColorMode()}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs transition ${
                colorMode === 'dark'
                  ? 'bg-amber-500 text-black border-amber-400 shadow'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <Moon className="w-4 h-4" /> Dark Mode
            </button>
            <button
              type="button"
              onClick={() => toggleColorMode()}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs transition ${
                colorMode === 'light'
                  ? 'bg-amber-500 text-black border-amber-400 shadow'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <Sun className="w-4 h-4" /> Light Mode
            </button>
          </div>
        </div>

        {/* Table Felt Theme */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold opacity-75">
            <Palette className="w-3.5 h-3.5" /> Table Felt Color Theme
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(THEMES) as ThemeId[]).map(id => {
              const theme = THEMES[id];
              const isSelected = themeId === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setThemeId(id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/10 shadow-md ring-1 ring-amber-400'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full border border-white/30 shadow-inner"
                    style={{ backgroundColor: theme.previewColor }}
                  />
                  <span className="font-semibold text-xs">{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Danger zone: Start New Game */}
        <div className="pt-4 border-t border-white/10 space-y-2">
          <label className="block text-xs font-semibold text-rose-400">Match Actions</label>
          <button
            type="button"
            onClick={() => {
              if (confirm('Are you sure you want to exit and start a new match? Current scores will be archived.')) {
                onResetGame();
                onClose();
              }
            }}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Start New Match
          </button>
        </div>
      </div>
    </Modal>
  );
};
