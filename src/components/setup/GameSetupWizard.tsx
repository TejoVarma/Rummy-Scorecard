import React, { useState } from 'react';
import { GameRules, Player, PlayerId } from '../../domain/types';
import { DEFAULT_RULES, POOL_PRESETS } from '../../domain/scoring';
import { UserPlus, ArrowUp, ArrowDown, Trash2, Crown } from 'lucide-react';

interface GameSetupWizardProps {
  onStartGame: (config: {
    title: string;
    rules: GameRules;
    players: Player[];
    initialSeats: PlayerId[];
    initialDealerIndex: number;
  }) => void;
}

const AVATAR_COLORS = [
  '#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#64748b', '#6366f1', '#e11d48'
];

export const GameSetupWizard: React.FC<GameSetupWizardProps> = ({ onStartGame }) => {
  const [title, setTitle] = useState('Nov ' + new Date().getDate() + ', ' + new Date().getFullYear());
  const [poolLimit, setPoolLimit] = useState<number>(201);
  const [customPool, setCustomPool] = useState<string>('');
  const [openDrop, setOpenDrop] = useState<number>(DEFAULT_RULES.openDrop);
  const [middleDrop, setMiddleDrop] = useState<number>(DEFAULT_RULES.middleDrop);
  const [fullCount, setFullCount] = useState<number>(DEFAULT_RULES.fullCount);
  const [adjustReEntry, setAdjustReEntry] = useState(true);

  const [players, setPlayers] = useState<Array<{ id: string; name: string; avatarColor: string }>>([
    { id: 'p1', name: 'Tejo', avatarColor: AVATAR_COLORS[0] },
    { id: 'p2', name: 'Bava', avatarColor: AVATAR_COLORS[1] },
    { id: 'p3', name: 'Rohini', avatarColor: AVATAR_COLORS[2] },
    { id: 'p4', name: 'Pavan', avatarColor: AVATAR_COLORS[3] },
  ]);

  const [newPlayerName, setNewPlayerName] = useState('');
  const [dealerIndex, setDealerIndex] = useState(0);

  const handleAddPlayer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    const newId = 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const color = AVATAR_COLORS[players.length % AVATAR_COLORS.length];
    setPlayers(prev => [...prev, { id: newId, name: trimmed, avatarColor: color }]);
    setNewPlayerName('');
  };

  const handleRemovePlayer = (id: string) => {
    if (players.length <= 2) return;
    setPlayers(prev => prev.filter(p => p.id !== id));
    setDealerIndex(0);
  };

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= players.length) return;

    setPlayers(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });

    if (dealerIndex === index) {
      setDealerIndex(targetIndex);
    } else if (dealerIndex === targetIndex) {
      setDealerIndex(index);
    }
  };

  const handleStart = () => {
    const finalPool = customPool ? parseInt(customPool, 10) || poolLimit : poolLimit;
    const rules: GameRules = {
      poolLimit: finalPool,
      openDrop,
      middleDrop,
      fullCount,
      allowReEntry: adjustReEntry,
      reEntryScoreMode: 'highest_plus_one',
    };

    const playerObjs: Player[] = players.map(p => ({
      id: p.id,
      name: p.name,
      avatarColor: p.avatarColor,
      reEntryCount: 0,
    }));

    onStartGame({
      title,
      rules,
      players: playerObjs,
      initialSeats: players.map(p => p.id),
      initialDealerIndex: dealerIndex,
    });
  };

  return (
    <div className="min-h-screen bg-[#121214] text-[#f4f4f5]">
      {/* Top App Bar (matching original app) */}
      <div className="px-4 py-3 bg-[#0284c7] text-white font-bold text-base shadow-sm flex items-center justify-between">
        <span>New Game</span>
        <span className="text-xs opacity-80 font-normal">Rummy Score Board</span>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-16">
        {/* Game Name */}
        <div className="p-3.5 rounded-lg border border-[#2e2e38] bg-[#1e1e24] space-y-1.5">
          <label className="block text-xs font-semibold text-[#a1a1aa]">Game Name</label>
          <input
            type="text"
            value={title}
            maxLength={50}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded bg-[#18181f] border border-[#33333f] text-white focus:outline-none focus:border-[#0284c7]"
          />
        </div>

        {/* Game Scores Card */}
        <div className="p-3.5 rounded-lg border border-[#2e2e38] bg-[#1e1e24] space-y-3">
          <label className="block text-sm font-semibold text-white">Game Scores</label>

          {/* Quick presets for Pool Limit */}
          <div className="grid grid-cols-4 gap-2">
            {POOL_PRESETS.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setPoolLimit(preset);
                  setCustomPool('');
                }}
                className={`py-1.5 px-2 rounded font-semibold text-xs border transition ${
                  poolLimit === preset && !customPool
                    ? 'bg-[#0284c7] text-white border-[#0284c7]'
                    : 'bg-[#18181f] text-[#a1a1aa] border-[#33333f] hover:bg-white/5'
                }`}
              >
                {preset} Pool
              </button>
            ))}
          </div>

          {/* Drop Inputs matching original oval inputs */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <span className="block text-xs text-[#a1a1aa]">Game total score</span>
              <input
                type="number"
                value={customPool || poolLimit}
                onChange={e => setCustomPool(e.target.value)}
                className="w-full px-3 py-2 rounded-full text-center font-mono text-sm bg-[#18181f] border border-[#3f3f4e] focus:outline-none focus:border-[#0284c7]"
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-[#a1a1aa]">Open drop</span>
              <input
                type="number"
                value={openDrop}
                onChange={e => setOpenDrop(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-full text-center font-mono text-sm bg-[#18181f] border border-[#3f3f4e] focus:outline-none focus:border-[#0284c7]"
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-[#a1a1aa]">Middle Drop</span>
              <input
                type="number"
                value={middleDrop}
                onChange={e => setMiddleDrop(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-full text-center font-mono text-sm bg-[#18181f] border border-[#3f3f4e] focus:outline-none focus:border-[#0284c7]"
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-[#a1a1aa]">Full count</span>
              <input
                type="number"
                value={fullCount}
                onChange={e => setFullCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-full text-center font-mono text-sm bg-[#18181f] border border-[#3f3f4e] focus:outline-none focus:border-[#0284c7]"
              />
            </div>
          </div>

          {/* Checkbox matching original app */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 text-xs text-[#cbd5e1] cursor-pointer">
              <input
                type="checkbox"
                checked={adjustReEntry}
                onChange={e => setAdjustReEntry(e.target.checked)}
                className="w-4 h-4 rounded text-[#0284c7] focus:ring-0 cursor-pointer"
              />
              <span>Adjust re-entry score to highest player score +1</span>
            </label>
          </div>
        </div>

        {/* Players & Seating Order */}
        <div className="p-3.5 rounded-lg border border-[#2e2e38] bg-[#1e1e24] space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-white">
              Players ({players.length}) & Table Seating
            </label>
            <span className="text-[11px] text-[#38bdf8]">Tap 🎴 to pick starting Dealer</span>
          </div>

          {/* Add player field */}
          <form onSubmit={handleAddPlayer} className="flex gap-2">
            <input
              type="text"
              placeholder="Add player name"
              maxLength={25}
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded bg-[#18181f] border border-[#33333f] text-white focus:outline-none focus:border-[#0284c7]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-xs transition flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
          </form>

          {/* Player list */}
          <div className="space-y-1.5 pt-1">
            {players.map((player, idx) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2 rounded border transition ${
                  dealerIndex === idx
                    ? 'border-[#0284c7] bg-[#0284c7]/10'
                    : 'border-[#2e2e38] bg-[#18181f]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-mono text-[#71717a] w-4">#{idx + 1}</span>
                  <span className="font-medium text-xs text-white">{player.name}</span>
                  {dealerIndex === idx && (
                    <span className="text-[10px] font-semibold text-[#38bdf8] bg-[#0284c7]/20 px-1.5 py-0.2 rounded border border-[#0284c7]/30 flex items-center gap-0.5">
                      <Crown className="w-2.5 h-2.5" /> Dealer
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDealerIndex(idx)}
                    className={`px-2 py-0.5 text-[11px] rounded font-semibold border transition ${
                      dealerIndex === idx
                        ? 'bg-[#0284c7] text-white border-[#0284c7]'
                        : 'border-[#3f3f4e] text-[#a1a1aa] hover:bg-white/5'
                    }`}
                  >
                    🎴 Deal
                  </button>
                  <button
                    type="button"
                    onClick={() => movePlayer(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePlayer(idx, 'down')}
                    disabled={idx === players.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePlayer(player.id)}
                    disabled={players.length <= 2}
                    className="p-1 rounded text-rose-400 hover:text-rose-300 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Start Button matching original app */}
        <button
          type="button"
          onClick={handleStart}
          className="w-full py-3.5 rounded-lg font-bold text-sm bg-[#0284c7] hover:bg-[#0369a1] text-white shadow transition active:scale-[0.99]"
        >
          START GAME
        </button>
      </div>
    </div>
  );
};
