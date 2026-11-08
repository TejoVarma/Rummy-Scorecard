import React, { useRef } from 'react';
import { Modal } from '../common/Modal';
import { useTheme } from '../../themes/ThemeContext';
import { THEMES, ThemeId } from '../../themes/themeConfig';
import { Sun, Moon, RefreshCw, Palette, Download, Upload, ShieldCheck } from 'lucide-react';
import { exportAllData, importAllData } from '../../storage/localStorageAdapter';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportData = async () => {
    try {
      const dataStr = exportAllData();
      const fileName = `rummy_scorecard_backup_${new Date().toISOString().slice(0, 10)}.json`;

      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'Rummy Scorecard Backup',
          text: dataStr,
          dialogTitle: 'Save Rummy Backup',
        });
        return;
      }

      // Web download
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data backup.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (!content) return;

      const result = importAllData(content);
      if (result.success) {
        alert(result.message);
        window.location.reload();
      } else {
        alert(`Restore failed: ${result.message}`);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="space-y-4">
        {/* Color Mode (Dark / Light) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--color-muted)]">Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleColorMode()}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium border transition ${
                colorMode === 'dark'
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-[var(--color-subtle)] text-[var(--color-muted)] border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
            <button
              type="button"
              onClick={() => toggleColorMode()}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium border transition ${
                colorMode === 'light'
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-[var(--color-subtle)] text-[var(--color-muted)] border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
          </div>
        </div>

        {/* Theme Palette */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1 text-xs font-semibold text-[var(--color-muted)]">
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
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-semibold'
                      : 'border-[var(--color-border)] bg-[var(--color-subtle)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full border border-black/20 dark:border-white/20 shrink-0"
                    style={{ backgroundColor: theme.previewColor }}
                  />
                  <span className="text-xs text-[var(--color-text)] truncate">{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Data Backup & Restore */}
        <div className="pt-3 border-t border-[var(--color-border)] space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-muted)]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Data Safety & Backup
            </label>
            <span className="text-[10px] text-[var(--color-muted)]">JSON format</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportData}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium border border-[var(--color-border)] bg-[var(--color-subtle)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text)] transition active:scale-98"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" /> Export Backup
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium border border-[var(--color-border)] bg-[var(--color-subtle)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text)] transition active:scale-98"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" /> Restore Data
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {/* Start New Game */}
        <div className="pt-3 border-t border-[var(--color-border)]">
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
