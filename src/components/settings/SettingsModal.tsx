import React, { useRef } from 'react';
import { Modal } from '../common/Modal';
import { useTheme } from '../../themes/ThemeContext';
import { THEMES, ThemeId } from '../../themes/themeConfig';
import { Sun, Moon, RefreshCw, Palette, Download, Upload, ShieldCheck, Volume2 } from 'lucide-react';
import { exportAllData, readBackup, restoreBackup, MAX_BACKUP_BYTES } from '../../storage/localStorageAdapter';
import { isShareCancelled, shareTextFile } from '../../services/share';
import { GameState } from '../../domain/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The match on screen, so a backup includes rounds the phone couldn't save. */
  currentGame?: GameState | null;
  announceAfterRound: boolean;
  onToggleAnnounce: (on: boolean) => void;
  // Left undefined when there's no match in progress, which hides the button.
  onStartNewMatch?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentGame,
  announceAfterRound,
  onToggleAnnounce,
  onStartNewMatch,
}) => {
  const { themeId, setThemeId, colorMode, setColorMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportData = async () => {
    const fileName = `rummy_scorecard_backup_${new Date().toISOString().slice(0, 10)}.json`;
    try {
      await shareTextFile(exportAllData(currentGame), fileName, 'Save Rummy Backup');
    } catch (err) {
      if (isShareCancelled(err)) return;
      console.error('Export failed:', err);
      alert("Couldn't create the backup file. Please try again.");
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      alert('That file is too big to be a Rummy Scorecard backup.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => alert("Couldn't read that file. Please pick the backup again.");
    reader.onload = async () => {
      const result = readBackup(String(reader.result ?? ''));
      if (!result.ok) {
        alert(result.message);
        return;
      }
      const { games, players, skippedGames } = result.backup;
      if (games.length === 0 && players.length === 0) {
        alert('This backup has no matches or players to restore.');
        return;
      }

      const skippedNote = skippedGames > 0 ? `\n\n${skippedGames} damaged match(es) in the file will be skipped.` : '';
      const ok = window.confirm(
        `Restore ${games.length} match${games.length === 1 ? '' : 'es'} and ${players.length} player${players.length === 1 ? '' : 's'} from this backup?\n\n` +
          `Nothing you already have will be deleted. If a match is in both, the copy with more rounds is kept.${skippedNote}`
      );
      if (!ok) return;

      try {
        const { added, updated, playersAdded, playersSaved } = await restoreBackup(result.backup);
        alert(
          `Restored ${added} new and ${updated} updated matches, and ${playersAdded} new players.` +
            (playersSaved ? '' : " The players couldn't be saved; your phone may be out of space.")
        );
        window.location.reload();
      } catch (err) {
        console.error('Restore failed:', err);
        alert("Couldn't restore the backup. Nothing was changed on screen; please try again.");
      }
    };
    reader.readAsText(file);
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
              onClick={() => setColorMode('dark')}
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
              onClick={() => setColorMode('light')}
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

        <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
          <span className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <Volume2 className="w-4 h-4 text-[var(--color-primary)]" />
            <span>
              Announce scores after each round
              <span className="block text-[11px] text-[var(--color-muted)]">Reads the totals aloud in English</span>
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={announceAfterRound}
            onChange={e => onToggleAnnounce(e.target.checked)}
            className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer"
          />
        </label>

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

        {onStartNewMatch && (
          <div className="pt-3 border-t border-[var(--color-border)] space-y-1.5">
            <button
              type="button"
              onClick={() => {
                onStartNewMatch();
                onClose();
              }}
              className="w-full py-2.5 px-3 rounded font-medium text-xs bg-[var(--color-primary)] text-white hover:opacity-90 transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Start New Match
            </button>
            <p className="text-[11px] text-[var(--color-muted)] text-center">
              Your current match stays in Continue Game.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
