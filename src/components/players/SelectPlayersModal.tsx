import React, { useState } from 'react';
import { Check, UserPlus, X, MoreVertical } from 'lucide-react';
import { SavedRosterPlayer, loadPlayerRoster, savePlayerRoster } from '../../storage/localStorageAdapter';

interface SelectPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlayerIds: string[];
  onConfirmSelection: (selectedIdsInOrder: string[]) => void;
}

export const SelectPlayersModal: React.FC<SelectPlayersModalProps> = ({
  isOpen,
  onClose,
  selectedPlayerIds,
  onConfirmSelection,
}) => {
  const [roster, setRoster] = useState<SavedRosterPlayer[]>(() => loadPlayerRoster());
  // Preserve selection order!
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedPlayerIds);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  if (!isOpen) return null;

  const togglePlayer = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      // Append so that order of selection corresponds to seating order!
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleAddNewPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    const newPlayer: SavedRosterPlayer = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      name: trimmed,
    };
    const updated = [...roster, newPlayer];
    setRoster(updated);
    savePlayerRoster(updated);
    setSelectedIds(prev => [...prev, newPlayer.id]);
    setNewPlayerName('');
    setIsAddOpen(false);
  };

  const handleDone = () => {
    if (selectedIds.length < 2) {
      alert('Please select at least 2 players to start a game.');
      return;
    }
    onConfirmSelection(selectedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 select-none">
      <div className="w-full max-w-sm bg-[var(--color-card)] rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-[var(--color-border)] text-[var(--color-text)] transition-colors duration-200">
        {/* Top App Bar matching Screenshot 4 */}
        <div className="px-4 py-3 bg-[#00a2ed] text-white shadow flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-black/10 transition"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="font-semibold text-base tracking-normal">Select Players</h2>
          </div>
          <button
            type="button"
            title="Options"
            className="p-1 rounded hover:bg-black/10 transition"
          >
            <MoreVertical className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Informational Subtext */}
        <div className="px-4 py-2 bg-[var(--color-subtle)] border-b border-[var(--color-border)] text-[11px] text-[var(--color-muted)]">
          Tap in seating order (Highest card to Least card). Last selected player deals Round 1.
        </div>

        {/* Players List with Circular Checkboxes */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {roster.map(player => {
            const isSelected = selectedIds.includes(player.id);
            const selectionOrderIndex = selectedIds.indexOf(player.id);

            return (
              <div
                key={player.id}
                onClick={() => togglePlayer(player.id)}
                className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#00a2ed]/10 border-[#00a2ed]'
                    : 'bg-[var(--color-subtle)] border-[var(--color-border)] hover:opacity-90'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition border ${
                      isSelected
                        ? 'bg-[#00a2ed] border-[#00a2ed] text-white'
                        : 'border-[#52525e] bg-transparent text-transparent'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="font-medium text-sm text-[var(--color-text)]">{player.name}</span>
                </div>

                {isSelected && (
                  <span className="text-[11px] font-mono text-[#00a2ed] px-2 py-0.5 rounded bg-[#00a2ed]/10">
                    #{selectionOrderIndex + 1}
                    {selectionOrderIndex === selectedIds.length - 1 && selectedIds.length > 1
                      ? ' (Deals)'
                      : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating Add Player quick form or button */}
        {isAddOpen ? (
          <form onSubmit={handleAddNewPlayer} className="p-3 bg-[var(--color-card)] border-t border-[var(--color-border)] flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Player name"
              maxLength={25}
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded bg-[var(--color-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[#00a2ed]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-[#00a2ed] text-white text-xs font-semibold"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-2 py-1.5 text-xs text-[var(--color-muted)]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="p-3 bg-[var(--color-card)] border-t border-[var(--color-border)] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[#00a2ed] font-medium hover:underline"
            >
              <UserPlus className="w-4 h-4" /> Add New Player
            </button>

            <button
              type="button"
              onClick={handleDone}
              className="px-5 py-2 rounded-lg bg-[#00a2ed] hover:bg-[#008fcf] text-white font-semibold text-xs transition"
            >
              Done ({selectedIds.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
