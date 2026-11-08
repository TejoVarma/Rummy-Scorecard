import React, { useState } from 'react';
import { GameRules, Player, PlayerId } from '../../domain/types';
import { DEFAULT_RULES, POOL_PRESETS } from '../../domain/scoring';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Crown } from 'lucide-react';
import { SelectPlayersModal } from '../players/SelectPlayersModal';
import { loadPlayerRoster } from '../../storage/localStorageAdapter';

interface GameSetupWizardProps {
  onBack: () => void;
  onStartGame: (config: {
    title: string;
    rules: GameRules;
    players: Player[];
    initialSeats: PlayerId[];
    initialDealerIndex: number;
  }) => void;
}

export const GameSetupWizard: React.FC<GameSetupWizardProps> = ({ onBack, onStartGame }) => {
  const [title, setTitle] = useState(
    'Nov ' + new Date().getDate().toString().padStart(2, '0') + ', ' + new Date().getFullYear() + ' - ' +
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [poolLimit, setPoolLimit] = useState<number>(201);
  const [customPool, setCustomPool] = useState<string>('');
  const [openDrop, setOpenDrop] = useState<number>(DEFAULT_RULES.openDrop);
  const [middleDrop, setMiddleDrop] = useState<number>(DEFAULT_RULES.middleDrop);
  const [fullCount, setFullCount] = useState<number>(DEFAULT_RULES.fullCount);
  const [adjustReEntry, setAdjustReEntry] = useState(true);

  // Load initial players from roster
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const saved = loadPlayerRoster();
    return saved.slice(0, 4).map(p => p.id);
  });

  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);

  const roster = loadPlayerRoster();
  const selectedPlayers = selectedIds.map(id => {
    const found = roster.find(r => r.id === id);
    return found || { id, name: 'Player' };
  });

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedIds.length) return;

    setSelectedIds(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const removePlayer = (id: string) => {
    if (selectedIds.length <= 2) {
      alert('A rummy game requires at least 2 players.');
      return;
    }
    setSelectedIds(prev => prev.filter(item => item !== id));
  };

  const handleStart = () => {
    if (selectedIds.length < 2) {
      alert('Please select at least 2 players.');
      return;
    }

    const finalPool = customPool ? parseInt(customPool, 10) || poolLimit : poolLimit;
    const rules: GameRules = {
      poolLimit: finalPool,
      openDrop,
      middleDrop,
      fullCount,
      allowReEntry: adjustReEntry,
      reEntryScoreMode: 'highest_plus_one',
    };

    const playerObjs: Player[] = selectedPlayers.map((p, idx) => ({
      id: p.id,
      name: p.name,
      avatarColor: ['#00a2ed', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'][idx % 6],
      reEntryCount: 0,
    }));

    // The least person (last in the list) deals Round 1!
    const leastPersonIndex = selectedPlayers.length - 1;

    onStartGame({
      title,
      rules,
      players: playerObjs,
      initialSeats: selectedIds,
      initialDealerIndex: leastPersonIndex,
    });
  };

  return (
    <div className="min-h-screen bg-[#111113] text-[#f4f4f5] flex flex-col font-sans select-none pb-12">
      {/* Top App Bar matching Screenshot 3 */}
      <div className="px-4 py-3.5 bg-[#00a2ed] text-white shadow flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded hover:bg-black/10 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg tracking-normal">New Game</h1>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto p-4 space-y-3.5">
        {/* Card 1: Game Name */}
        <div className="p-4 rounded-xl bg-[#27272a] border border-[#3f3f46]/60 space-y-1">
          <label className="block text-xs font-medium text-[#a1a1aa]">Game Name</label>
          <input
            type="text"
            value={title}
            maxLength={50}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-sm font-semibold bg-transparent border-none text-white focus:outline-none placeholder-zinc-500"
            placeholder="Auto generate"
          />
        </div>

        {/* Card 2: Game Scores */}
        <div className="p-4 rounded-xl bg-[#27272a] border border-[#3f3f46]/60 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Game Scores</h2>
            <div className="flex gap-1.5">
              {POOL_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setPoolLimit(preset);
                    setCustomPool('');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    poolLimit === preset && !customPool
                      ? 'bg-[#00a2ed] text-white'
                      : 'bg-[#1e1e24] text-[#a1a1aa] hover:bg-[#333]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Oval Drop Inputs matching Screenshot 3 */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="relative border border-[#52525b] rounded-full px-4 py-1.5 bg-[#1f1f23]">
              <span className="text-[10px] text-[#a1a1aa] block text-center">Game total score</span>
              <input
                type="number"
                value={customPool || poolLimit}
                onChange={e => setCustomPool(e.target.value)}
                className="w-full text-center text-sm font-mono font-medium text-white bg-transparent focus:outline-none"
              />
            </div>
            <div className="relative border border-[#52525b] rounded-full px-4 py-1.5 bg-[#1f1f23]">
              <span className="text-[10px] text-[#a1a1aa] block text-center">Open drop</span>
              <input
                type="number"
                value={openDrop}
                onChange={e => setOpenDrop(Number(e.target.value))}
                className="w-full text-center text-sm font-mono font-medium text-white bg-transparent focus:outline-none"
              />
            </div>
            <div className="relative border border-[#52525b] rounded-full px-4 py-1.5 bg-[#1f1f23]">
              <span className="text-[10px] text-[#a1a1aa] block text-center">Middle Drop</span>
              <input
                type="number"
                value={middleDrop}
                onChange={e => setMiddleDrop(Number(e.target.value))}
                className="w-full text-center text-sm font-mono font-medium text-white bg-transparent focus:outline-none"
              />
            </div>
            <div className="relative border border-[#52525b] rounded-full px-4 py-1.5 bg-[#1f1f23]">
              <span className="text-[10px] text-[#a1a1aa] block text-center">Full count</span>
              <input
                type="number"
                value={fullCount}
                onChange={e => setFullCount(Number(e.target.value))}
                className="w-full text-center text-sm font-mono font-medium text-white bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Re-entry Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 text-xs text-[#d4d4d8] cursor-pointer">
              <input
                type="checkbox"
                checked={adjustReEntry}
                onChange={e => setAdjustReEntry(e.target.checked)}
                className="w-4 h-4 rounded text-[#00a2ed] focus:ring-0 cursor-pointer"
              />
              <span>Adjust re-entry score to highest player score +1</span>
            </label>
          </div>
        </div>

        {/* Card 3: Select Players matching Screenshot 3 */}
        <div className="p-4 rounded-xl bg-[#27272a] border border-[#3f3f46]/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Select Players</h2>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                Seating order is Highest (#1) to Least (Last).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSelectModalOpen(true)}
              className="text-xs font-semibold text-[#00a2ed] hover:underline"
            >
              SELECT PLAYERS
            </button>
          </div>

          {/* Selected Players list */}
          <div className="space-y-1.5 pt-1">
            {selectedPlayers.map((player, idx) => {
              const isHighest = idx === 0;
              const isLeast = idx === selectedPlayers.length - 1;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                    isLeast
                      ? 'bg-[#00a2ed]/10 border-[#00a2ed]/40'
                      : 'bg-[#1e1e24] border-[#383842]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono text-[#71717a] w-5">#{idx + 1}</span>
                    <span className="font-medium text-xs text-white">{player.name}</span>
                    {isHighest && (
                      <span className="text-[10px] text-[#cbd5e1] bg-white/10 px-1.5 py-0.2 rounded">
                        Highest Card
                      </span>
                    )}
                    {isLeast && (
                      <span className="text-[10px] font-semibold text-[#00a2ed] bg-[#00a2ed]/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Deals (Least Card)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => movePlayer(idx, 'up')}
                      disabled={idx === 0}
                      title="Move up"
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlayer(idx, 'down')}
                      disabled={idx === selectedPlayers.length - 1}
                      title="Move down"
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePlayer(player.id)}
                      disabled={selectedPlayers.length <= 2}
                      title="Remove"
                      className="p-1 rounded text-rose-400 hover:text-rose-300 disabled:opacity-20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Game Button matching Screenshot 3 */}
        <button
          type="button"
          onClick={handleStart}
          className="w-full py-3.5 rounded-full font-bold text-sm bg-[#00a2ed] hover:bg-[#008fcf] text-white shadow-md transition active:scale-[0.99] tracking-wide"
        >
          START GAME
        </button>
      </div>

      {/* Select Players Modal */}
      {isSelectModalOpen && (
        <SelectPlayersModal
          isOpen={isSelectModalOpen}
          onClose={() => setIsSelectModalOpen(false)}
          selectedPlayerIds={selectedIds}
          onConfirmSelection={newSelection => setSelectedIds(newSelection)}
        />
      )}
    </div>
  );
};
