import React, { useState } from 'react';
import { GameRules, Player, PlayerId } from '../../domain/types';
import { DEFAULT_RULES, POOL_PRESETS } from '../../domain/scoring';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Crown } from 'lucide-react';
import { SelectPlayersModal } from '../players/SelectPlayersModal';
import { loadPlayerRoster } from '../../storage/localStorageAdapter';
import { validateRules } from '../../domain/rules';

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

/** "03 Dec 2026 - 21:05" */
export function defaultGameTitle(now: Date): string {
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} - ${time}`;
}

const digitsOnly = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

export const GameSetupWizard: React.FC<GameSetupWizardProps> = ({ onBack, onStartGame }) => {
  const [title, setTitle] = useState(() => defaultGameTitle(new Date()));
  const [pool, setPool] = useState<string>(String(DEFAULT_RULES.poolLimit));
  const [openDrop, setOpenDrop] = useState<string>(String(DEFAULT_RULES.openDrop));
  const [middleDrop, setMiddleDrop] = useState<string>(String(DEFAULT_RULES.middleDrop));
  const [fullCount, setFullCount] = useState<string>(String(DEFAULT_RULES.fullCount));
  const [adjustReEntry, setAdjustReEntry] = useState(true);
  const [entryAmount, setEntryAmount] = useState<string>('100');

  // No players selected by default
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);

  const [roster, setRoster] = useState(loadPlayerRoster);
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
    setSelectedIds(prev => prev.filter(item => item !== id));
  };

  const handleStart = () => {
    if (selectedIds.length < 2) {
      alert('Please select at least 2 players.');
      return;
    }

    // Boxes hold exactly what was typed; an empty required box is pointed out, not replaced.
    const required: Array<[string, string]> = [
      ['Game total score', pool],
      ['Open drop', openDrop],
      ['Middle Drop', middleDrop],
      ['Full count', fullCount],
    ];
    const missing = required.find(([, value]) => value === '');
    if (missing) {
      alert(`Please fill in ${missing[0]}.`);
      return;
    }
    const finalPool = Number(pool);
    const finalOpenDrop = Number(openDrop);
    const finalMiddleDrop = Number(middleDrop);
    const finalFullCount = Number(fullCount);
    const finalEntryAmount = entryAmount === '' ? 0 : Number(entryAmount);

    const rules: GameRules = {
      poolLimit: finalPool,
      openDrop: finalOpenDrop,
      middleDrop: finalMiddleDrop,
      fullCount: finalFullCount,
      allowReEntry: adjustReEntry,
      entryAmount: finalEntryAmount,
    };

    const problem = validateRules(rules);
    if (problem) {
      alert(problem);
      return;
    }

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
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col font-sans select-none pb-12 transition-colors duration-200">
      {/* Top App Bar matching Screenshot 3 */}
      <div className="px-4 py-3.5 bg-[var(--color-primary)] text-white shadow flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-black/10 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg tracking-normal">New Game</h1>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto p-4 space-y-3.5">
        {/* Card 1: Game Name */}
        <div className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] space-y-1 shadow-sm">
          <label htmlFor="setup-title" className="block text-xs font-medium text-[var(--color-muted)]">Game Name</label>
          <input
            id="setup-title"
            type="text"
            value={title}
            maxLength={50}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-sm font-semibold bg-transparent border-none text-[var(--color-text)] focus:outline-none placeholder-zinc-500"
            placeholder="Auto generate"
          />
        </div>

        {/* Card 2: Game Scores */}
        <div className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Game Scores</h2>
            <div className="flex gap-1.5">
              {POOL_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPool(String(preset))}
                aria-pressed={pool === String(preset)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    pool === String(preset)
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-subtle)] text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Oval Drop Inputs matching Screenshot 3 */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="relative border border-[var(--color-border)] rounded-full px-4 py-1.5 bg-[var(--color-subtle)]">
              <label htmlFor="setup-pool" className="text-[11px] text-[var(--color-muted)] block text-center">Game total score</label>
              <input
                id="setup-pool"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pool}
                onChange={e => setPool(digitsOnly(e.target.value))}
                className="w-full text-center text-sm font-mono font-medium text-[var(--color-text)] bg-transparent focus:outline-none"
              />
            </div>
            <div className="relative border border-[var(--color-border)] rounded-full px-4 py-1.5 bg-[var(--color-subtle)]">
              <label htmlFor="setup-open-drop" className="text-[11px] text-[var(--color-muted)] block text-center">Open drop</label>
              <input
                id="setup-open-drop"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={openDrop}
                onChange={e => setOpenDrop(digitsOnly(e.target.value))}
                className="w-full text-center text-sm font-mono font-medium text-[var(--color-text)] bg-transparent focus:outline-none"
              />
            </div>
            <div className="relative border border-[var(--color-border)] rounded-full px-4 py-1.5 bg-[var(--color-subtle)]">
              <label htmlFor="setup-middle-drop" className="text-[11px] text-[var(--color-muted)] block text-center">Middle Drop</label>
              <input
                id="setup-middle-drop"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={middleDrop}
                onChange={e => setMiddleDrop(digitsOnly(e.target.value))}
                className="w-full text-center text-sm font-mono font-medium text-[var(--color-text)] bg-transparent focus:outline-none"
              />
            </div>
            <div className="relative border border-[var(--color-border)] rounded-full px-4 py-1.5 bg-[var(--color-subtle)]">
              <label htmlFor="setup-full-count" className="text-[11px] text-[var(--color-muted)] block text-center">Full count</label>
              <input
                id="setup-full-count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={fullCount}
                onChange={e => setFullCount(digitsOnly(e.target.value))}
                className="w-full text-center text-sm font-mono font-medium text-[var(--color-text)] bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Entry Amount / Stake */}
          <div className="pt-2 border-t border-[var(--color-border)] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-text)]">
                Entry Amount per Player (₹)
              </label>
              <div className="flex gap-1.5">
                {[50, 100, 200, 500].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEntryAmount(String(val))}
                aria-pressed={entryAmount === String(val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition ${
                      entryAmount === String(val)
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-subtle)] text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    ₹{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 border border-[var(--color-border)] rounded-lg px-3 py-1.5 bg-[var(--color-subtle)] flex items-center gap-2">
                <span className="font-bold text-sm text-[var(--color-primary)] font-mono">₹</span>
                <input
                  aria-label="Stake per player (₹)"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={entryAmount}
                  placeholder="0"
                  onChange={e => setEntryAmount(digitsOnly(e.target.value))}
                  className="w-full text-sm font-mono font-bold text-[var(--color-text)] bg-transparent focus:outline-none"
                />
              </div>

              {selectedPlayers.length > 0 && (
                <div className="text-right px-2.5 py-1 rounded bg-[var(--color-subtle)] border border-[var(--color-border)] text-[11px] shrink-0">
                  <span className="text-[var(--color-muted)] block text-[10px]">Initial Pool</span>
                  <strong className="text-emerald-500 font-mono font-bold text-xs">
                    ₹{(parseInt(entryAmount, 10) || 0) * selectedPlayers.length}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Re-entry Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 text-xs text-[var(--color-text)] cursor-pointer">
              <input
                type="checkbox"
                checked={adjustReEntry}
                onChange={e => setAdjustReEntry(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-0 cursor-pointer"
              />
              <span>Adjust re-entry score to highest player score +1</span>
            </label>
          </div>
        </div>

        {/* Card 3: Select Players matching Screenshot 3 */}
        <div className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Select Players</h2>
              <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                Seating order is Highest (#1) to Least (Last).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSelectModalOpen(true)}
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              SELECT PLAYERS
            </button>
          </div>

          {/* Selected Players list */}
          <div className="space-y-1.5 pt-1">
            {selectedPlayers.length === 0 ? (
              <div
                onClick={() => setIsSelectModalOpen(true)}
                className="py-6 px-4 rounded-lg border border-dashed border-[var(--color-border)] text-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <span className="text-xs text-[var(--color-muted)]">
                  No players selected yet.<br />Tap <strong className="text-[var(--color-primary)]">SELECT PLAYERS</strong> to choose players in seating order.
                </span>
              </div>
            ) : (
              selectedPlayers.map((player, idx) => {
              const isHighest = idx === 0;
              const isLeast = idx === selectedPlayers.length - 1;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                    isLeast
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40'
                      : 'bg-[var(--color-subtle)] border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono text-[var(--color-muted)] w-5">#{idx + 1}</span>
                    <span className="font-medium text-xs text-[var(--color-text)]">{player.name}</span>
                    {isHighest && (
                      <span className="text-[10px] text-[var(--color-muted)] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                        Highest Card
                      </span>
                    )}
                    {isLeast && (
                      <span className="text-[10px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/20 px-1.5 py-0.5 rounded flex items-center gap-1">
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
                      aria-label={`Move ${player.name} up`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlayer(idx, 'down')}
                      disabled={idx === selectedPlayers.length - 1}
                      title="Move down"
                      aria-label={`Move ${player.name} down`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePlayer(player.id)}
                      disabled={selectedPlayers.length <= 2}
                      title="Remove"
                      aria-label={`Remove ${player.name}`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-rose-400 hover:text-rose-300 disabled:opacity-20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Start Game Button matching Screenshot 3 */}
        <button
          type="button"
          onClick={handleStart}
          className="w-full py-3.5 rounded-full font-bold text-sm bg-[var(--color-primary)] hover:opacity-90 text-white shadow-md transition active:scale-[0.99] tracking-wide"
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
          onConfirmSelection={newSelection => {
            setRoster(loadPlayerRoster());
            setSelectedIds(newSelection);
          }}
        />
      )}
    </div>
  );
};
