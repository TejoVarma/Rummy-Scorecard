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
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="space-y-4">
        {/* Color Mode (Dark / Light) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#a1a1aa]">Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleColorMode()}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium border transition ${
                colorMode === 'dark'
                  ? 'bg-[#0284c7] text-white border-[#0284c7]'
                  : 'bg-[#18181f] text-[#a1a1aa] border-[#33333f] hover:bg-white/5'
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
            <button
              type="button"
              onClick={() => toggleColorMode()}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium border transition ${
                colorMode === 'light'
                  ? 'bg-[#0284c7] text-white border-[#0284c7]'
                  : 'bg-[#18181f] text-[#a1a1aa] border-[#33333f] hover:bg-white/5'
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
          </div>
        </div>

        {/* Theme Palette */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1 text-xs font-semibold text-[#a1a1aa]">
            <Palette className="w-3.5 h-3.5" /> Palette
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
                  className={`flex items-center gap-2 p-2.5 rounded border text-left transition ${
                    isSelected
                      ? 'border-[#0284c7] bg-[#0284c7]/10'
                      : 'border-[#33333f] bg-[#18181f] hover:bg-white/5'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: theme.previewColor }}
                  />
                  <span className="text-xs text-white truncate">{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start New Game */}
        <div className="pt-3 border-t border-[#2e2e38]">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Start a new match? Current scores will be cleared.')) {
                onResetGame();
                onClose();
              }
            }}
            className="w-full py-2.5 px-3 rounded font-medium text-xs bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/40 transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Start New Match
          </button>
        </div>
      </div>
    </Modal>
  );
};
