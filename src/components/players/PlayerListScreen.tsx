import React, { useState } from 'react';
import { ArrowLeft, User, UserPlus, Trash2, Edit2, MoreVertical, X } from 'lucide-react';
import { SavedRosterPlayer, loadPlayerRoster, savePlayerRoster } from '../../storage/localStorageAdapter';

interface PlayerListScreenProps {
  onBack: () => void;
}

export const PlayerListScreen: React.FC<PlayerListScreenProps> = ({ onBack }) => {
  const [roster, setRoster] = useState<SavedRosterPlayer[]>(() => loadPlayerRoster());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<SavedRosterPlayer | null>(null);
  const [editName, setEditName] = useState('');

  const handleSaveRoster = (updated: SavedRosterPlayer[]) => {
    setRoster(updated);
    savePlayerRoster(updated);
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    const newPlayer: SavedRosterPlayer = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      name: trimmed,
    };
    const updated = [...roster, newPlayer];
    handleSaveRoster(updated);
    setNewPlayerName('');
    setIsAddModalOpen(false);
  };

  const handleEditPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    const updated = roster.map(p => (p.id === editingPlayer.id ? { ...p, name: trimmed } : p));
    handleSaveRoster(updated);
    setEditingPlayer(null);
  };

  const handleDeletePlayer = (id: string) => {
    const updated = roster.filter(p => p.id !== id);
    handleSaveRoster(updated);
  };

  return (
    <div className="min-h-screen bg-[#121214] text-[#f4f4f5] flex flex-col font-sans select-none">
      {/* Top App Bar matching Screenshot 2 */}
      <div className="px-4 py-3.5 bg-[#00a2ed] text-white shadow flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded hover:bg-black/10 active:bg-black/20 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-medium text-lg tracking-normal">Player List</h1>
        </div>
        <button
          type="button"
          title="More options"
          className="p-1 rounded hover:bg-black/10 active:bg-black/20 transition"
        >
          <MoreVertical className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Player List matching Screenshot 2 */}
      <div className="flex-1 max-w-md w-full mx-auto p-3 space-y-2 pb-24 overflow-y-auto">
        {roster.map(player => (
          <div
            key={player.id}
            className="flex items-center justify-between p-3.5 rounded-lg bg-[#333333] border border-[#3e3e3e] shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#00a2ed] flex items-center justify-center text-white shrink-0">
                <User className="w-5 h-5 fill-current" />
              </div>
              <span className="font-normal text-base text-[#e4e4e7]">{player.name}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditingPlayer(player);
                  setEditName(player.name);
                }}
                className="p-2 rounded text-slate-400 hover:text-white transition"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeletePlayer(player.id)}
                className="p-2 rounded text-rose-400 hover:text-rose-300 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {roster.length === 0 && (
          <div className="text-center py-12 text-[#71717a] text-sm">
            No players saved. Tap the + button to add players!
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) matching Screenshot 2 */}
      <button
        type="button"
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#00a2ed] hover:bg-[#008fcf] active:scale-95 text-white flex items-center justify-center shadow-lg transition z-20"
        title="Add Player"
      >
        <UserPlus className="w-6 h-6" />
      </button>

      {/* Add Player Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#242429] rounded-xl p-5 border border-[#3e3e48] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white text-base">Add New Player</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddPlayer} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Enter player name"
                maxLength={25}
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded bg-[#18181f] border border-[#3f3f4e] text-white focus:outline-none focus:border-[#00a2ed]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded text-[#a1a1aa] hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-[#00a2ed] text-white hover:bg-[#008fcf]"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#242429] rounded-xl p-5 border border-[#3e3e48] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white text-base">Edit Player Name</h2>
              <button
                type="button"
                onClick={() => setEditingPlayer(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditPlayer} className="space-y-3">
              <input
                type="text"
                autoFocus
                maxLength={25}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded bg-[#18181f] border border-[#3f3f4e] text-white focus:outline-none focus:border-[#00a2ed]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="px-3 py-1.5 text-xs rounded text-[#a1a1aa] hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-[#00a2ed] text-white hover:bg-[#008fcf]"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
