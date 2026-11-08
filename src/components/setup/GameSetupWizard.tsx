import React, { useState } from 'react';
import { GameRules, Player, PlayerId } from '../../domain/types';
import { DEFAULT_RULES, POOL_PRESETS } from '../../domain/scoring';
import { UserPlus, ArrowUp, ArrowDown, Trash2, Play, Crown } from 'lucide-react';

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
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#e11d48'
];

export const GameSetupWizard: React.FC<GameSetupWizardProps> = ({ onStartGame }) => {
  const [title, setTitle] = useState('Match ' + new Date().toLocaleDateString());
  const [poolLimit, setPoolLimit] = useState<number>(201);
  const [customPool, setCustomPool] = useState<string>('');
  const [openDrop, setOpenDrop] = useState<number>(DEFAULT_RULES.openDrop);
  const [middleDrop, setMiddleDrop] = useState<number>(DEFAULT_RULES.middleDrop);
  const [fullCount, setFullCount] = useState<number>(DEFAULT_RULES.fullCount);

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
      allowReEntry: true,
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
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-16">
      {/* Header & Title */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Rummy Scoreboard</h1>
        <p className="text-sm opacity-75">Pool Rummy with Indian defaults (24 / 48 / 80)</p>
        <div className="pt-2 max-w-xs mx-auto">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Match Title"
            className="w-full px-3 py-1.5 text-center text-xs font-semibold rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Target Pool Presets */}
      <div className="p-4 rounded-xl border border-white/10 bg-black/20 space-y-3">
        <label className="block text-sm font-semibold tracking-wide">Target Pool Limit</label>
        <div className="grid grid-cols-4 gap-2">
          {POOL_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setPoolLimit(preset);
                setCustomPool('');
              }}
              className={`py-2 px-3 rounded-lg font-bold text-sm border transition-all ${
                poolLimit === preset && !customPool
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              {preset} Pool
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            placeholder="Custom Limit (e.g. 250, 300)"
            value={customPool}
            onChange={e => setCustomPool(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Drop Rules */}
      <div className="p-4 rounded-xl border border-white/10 bg-black/20 space-y-3">
        <label className="block text-sm font-semibold tracking-wide">Drop Presets (Points)</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className="block text-xs opacity-75 mb-1">Open Drop</span>
            <input
              type="number"
              value={openDrop}
              onChange={e => setOpenDrop(Number(e.target.value))}
              className="w-full px-3 py-2 text-center font-bold text-sm rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <span className="block text-xs opacity-75 mb-1">Middle Drop</span>
            <input
              type="number"
              value={middleDrop}
              onChange={e => setMiddleDrop(Number(e.target.value))}
              className="w-full px-3 py-2 text-center font-bold text-sm rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <span className="block text-xs opacity-75 mb-1">Full Count</span>
            <input
              type="number"
              value={fullCount}
              onChange={e => setFullCount(Number(e.target.value))}
              className="w-full px-3 py-2 text-center font-bold text-sm rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Players & Seating Order */}
      <div className="p-4 rounded-xl border border-white/10 bg-black/20 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-semibold">Table Seating Order ({players.length} Players)</label>
            <p className="text-xs opacity-60">Tap 🎴 to pick starting Distributor (Dealer)</p>
          </div>
        </div>

        {/* Add player form */}
        <form onSubmit={handleAddPlayer} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter player name"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition"
          >
            <UserPlus className="w-4 h-4" /> Add
          </button>
        </form>

        {/* Player List */}
        <div className="space-y-2 pt-2">
          {players.map((player, idx) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                dealerIndex === idx
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold opacity-60 w-5">#{idx + 1}</span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow"
                  style={{ backgroundColor: player.avatarColor }}
                >
                  {player.name[0]?.toUpperCase()}
                </div>
                <span className="font-semibold text-sm">{player.name}</span>
                {dealerIndex === idx && (
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Dealer
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Pick dealer */}
                <button
                  type="button"
                  title="Make starting dealer"
                  onClick={() => setDealerIndex(idx)}
                  className={`px-2 py-1 text-xs rounded font-bold border transition ${
                    dealerIndex === idx
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'border-white/20 hover:bg-white/10'
                  }`}
                >
                  🎴 Deal
                </button>
                {/* Reorder */}
                <button
                  type="button"
                  onClick={() => movePlayer(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => movePlayer(idx, 'down')}
                  disabled={idx === players.length - 1}
                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleRemovePlayer(player.id)}
                  disabled={players.length <= 2}
                  className="p-1 rounded text-rose-400 hover:text-rose-300 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 rounded-xl font-extrabold text-base bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2"
      >
        <Play className="w-5 h-5 fill-current" /> START GAME ({players.length} PLAYERS)
      </button>
    </div>
  );
};
