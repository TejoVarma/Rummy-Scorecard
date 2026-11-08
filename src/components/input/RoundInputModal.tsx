import React, { useState } from 'react';
import { GameState, PlayerId, ScoreInputType } from '../../domain/types';
import { validateRoundScores } from '../../domain/scoring';
import { getDropStatus } from '../../domain/elimination';
import { ArrowLeft, Crown } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../../hooks/useBackButton';

interface RoundInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  isEditingLastRound?: boolean;
  onSubmitRound: (roundScores: Record<PlayerId, { type: ScoreInputType; points: number }>) => void;
}

export const RoundInputModal: React.FC<RoundInputModalProps> = ({
  isOpen,
  onClose,
  state,
  isEditingLastRound = false,
  onSubmitRound,
}) => {
  useBackButton(onClose, isOpen, BACK_PRIORITY.GLOBAL_MODAL);
  const { seats, players, rules, rounds, currentDealerIndex } = state;
  const currentDealerId = seats[currentDealerIndex];
  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;

  // Active players for this round
  const activeSeats = isEditingLastRound && lastRound
    ? Object.keys(lastRound.scores)
    : seats.filter(id => {
        const cumulativeScores = rounds.length > 0 ? rounds[rounds.length - 1].cumulativeScores : {};
        return (cumulativeScores[id] ?? 0) < rules.poolLimit;
      });

  // Cumulative scores up to the round being entered/edited
  const cumulativeScores: Record<PlayerId, number> = isEditingLastRound
    ? (rounds.length > 1 ? rounds[rounds.length - 2].cumulativeScores : Object.fromEntries(seats.map(id => [id, 0])))
    : (rounds.length > 0 ? rounds[rounds.length - 1].cumulativeScores : Object.fromEntries(seats.map(id => [id, 0])));

  // NO default drop score when opening! Start completely empty unless editing
  const [scores, setScores] = useState<Record<PlayerId, { type: ScoreInputType; points: number } | undefined>>(() => {
    if (isEditingLastRound && lastRound) {
      return { ...lastRound.scores };
    }
    return {};
  });

  const [showScoreOptions, setShowScoreOptions] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectType = (playerId: PlayerId, type: ScoreInputType) => {
    setErrorMessage(null);
    let pts = 0;
    if (type === 'show') pts = 0;
    else if (type === 'open_drop') pts = rules.openDrop;
    else if (type === 'middle_drop') pts = rules.middleDrop;
    else if (type === 'full_count') pts = rules.fullCount;
    else if (type === 'out') pts = rules.poolLimit;

    setScores(prev => {
      const next = { ...prev };
      // Exactly one player can have "show" (winner). If another player had show, clear it
      if (type === 'show') {
        for (const id of activeSeats) {
          if (id !== playerId && next[id]?.type === 'show') {
            delete next[id];
          }
        }
      }
      next[playerId] = { type, points: pts };
      return next;
    });
  };

  const handleCustomScoreChange = (playerId: PlayerId, rawVal: string) => {
    setErrorMessage(null);
    // Remove all non-digits
    let clean = rawVal.replace(/\D/g, '');
    // Strip leading zeroes when followed by digits (e.g. "05" -> "5", "056" -> "56")
    clean = clean.replace(/^0+(?=\d)/, '');

    if (clean === '') {
      setScores(prev => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      return;
    }

    const parsed = parseInt(clean, 10);
    const pts = isNaN(parsed) ? 0 : Math.min(Math.max(0, parsed), rules.fullCount);
    setScores(prev => ({
      ...prev,
      [playerId]: { type: 'custom', points: pts },
    }));
  };

  const handleSubmit = () => {
    // Validate that all active players have a score recorded
    for (const id of activeSeats) {
      if (!scores[id]) {
        setErrorMessage(`Please select or enter a score for ${players[id]?.name || 'all players'}.`);
        return;
      }
    }

    const completeScores = scores as Record<PlayerId, { type: ScoreInputType; points: number }>;
    const validation = validateRoundScores(completeScores, activeSeats);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid scores');
      return;
    }

    const finalScores: Record<PlayerId, { type: ScoreInputType; points: number }> = {};
    for (const id of seats) {
      if (activeSeats.includes(id)) {
        finalScores[id] = completeScores[id];
      } else {
        finalScores[id] = { type: 'out', points: 0 };
      }
    }

    onSubmitRound(finalScores);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] font-sans select-none overflow-hidden transition-colors duration-200">
      {/* Top App Bar matching Screenshot */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-[var(--color-primary)] text-white shadow shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-black/10 active:bg-black/20 transition"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="font-semibold text-lg tracking-normal">
          {isEditingLastRound ? `Edit Round ${rounds.length} Scores` : 'Add Round Scores'}
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-w-md w-full mx-auto">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Player Cards */}
        {activeSeats.map(playerId => {
          const player = players[playerId];
          const currentTotal = cumulativeScores[playerId] ?? 0;
          const currentInput = scores[playerId];
          const isDealer = playerId === currentDealerId;
          const dropStatus = getDropStatus(currentTotal, rules.poolLimit, rules.openDrop);

          return (
            <div
              key={playerId}
              className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] space-y-3 shadow-sm"
            >
              {/* Header row: Name + Current Total on left, Outlined Capsule on right */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-base flex items-center gap-1.5 flex-wrap">
                    <span className={dropStatus === 'compulsory' ? 'text-rose-500 font-bold' : dropStatus === 'one_drop' ? 'text-yellow-400 font-bold' : 'text-[var(--color-text)]'}>
                      {player?.name}
                    </span>
                    {(player?.reEntryCount ?? 0) > 0 && (
                      <span className="text-[10px] text-[#ef4444] font-semibold">
                        (re entry)
                      </span>
                    )}
                    {dropStatus === 'compulsory' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase tracking-tight">
                        Compulsory
                      </span>
                    )}
                    {dropStatus === 'one_drop' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 uppercase tracking-tight">
                        1 Drop
                      </span>
                    )}
                    {isDealer && (
                      <span className="text-[10px] text-[var(--color-primary)] bg-[var(--color-primary)]/20 px-1.5 py-0.5 rounded border border-[var(--color-primary)]/30 flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" /> Deal
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] italic mt-0.5 font-mono">
                    Score: {currentTotal}
                  </div>
                </div>

                {/* Outlined Score Capsule matching Screenshot */}
                <div className="relative min-w-[110px] h-[38px] rounded-full border border-zinc-500/80 px-2.5 flex items-center justify-center bg-[var(--color-card)] focus-within:border-[var(--color-primary)] transition">
                  <span className="absolute -top-2 left-3 bg-[var(--color-card)] px-1 text-[10px] font-medium text-zinc-400 select-none">
                    Score
                  </span>

                  {/* Render Badge when selected, exactly like screenshot */}
                  {currentInput?.type === 'show' && (
                    <span
                      onClick={() => {
                        setScores(prev => {
                          const next = { ...prev };
                          delete next[playerId];
                          return next;
                        });
                      }}
                      className="px-3.5 py-1 rounded-full bg-[#16a34a] text-white font-medium text-xs leading-none shadow-sm cursor-pointer"
                      title="Tap to clear"
                    >
                      Show
                    </span>
                  )}
                  {currentInput?.type === 'open_drop' && (
                    <span
                      onClick={() => {
                        setScores(prev => {
                          const next = { ...prev };
                          delete next[playerId];
                          return next;
                        });
                      }}
                      className="px-3.5 py-1 rounded-full bg-[#ea580c] text-white font-medium text-xs leading-none shadow-sm cursor-pointer"
                      title="Tap to clear"
                    >
                      Drop
                    </span>
                  )}
                  {currentInput?.type === 'middle_drop' && (
                    <span
                      onClick={() => {
                        setScores(prev => {
                          const next = { ...prev };
                          delete next[playerId];
                          return next;
                        });
                      }}
                      className="px-3.5 py-1 rounded-full bg-[#ca8a04] text-white font-medium text-xs leading-none shadow-sm cursor-pointer"
                      title="Tap to clear"
                    >
                      M Drop
                    </span>
                  )}
                  {currentInput?.type === 'full_count' && (
                    <span
                      onClick={() => {
                        setScores(prev => {
                          const next = { ...prev };
                          delete next[playerId];
                          return next;
                        });
                      }}
                      className="px-3.5 py-1 rounded-full bg-[#7c3aed] text-white font-medium text-xs leading-none shadow-sm cursor-pointer"
                      title="Tap to clear"
                    >
                      Full
                    </span>
                  )}
                  {currentInput?.type === 'out' && (
                    <span
                      onClick={() => {
                        setScores(prev => {
                          const next = { ...prev };
                          delete next[playerId];
                          return next;
                        });
                      }}
                      className="px-3.5 py-1 rounded-full bg-[#dc2626] text-white font-medium text-xs leading-none shadow-sm cursor-pointer"
                      title="Tap to clear"
                    >
                      Out
                    </span>
                  )}

                  {/* Single controlled numeric text input when no preset pill badge is active */}
                  {(!currentInput || currentInput.type === 'custom') && (
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      placeholder=""
                      value={currentInput?.type === 'custom' ? currentInput.points : ''}
                      onChange={e => handleCustomScoreChange(playerId, e.target.value)}
                      className="w-full text-center font-mono font-bold text-sm bg-transparent border-none text-[var(--color-text)] focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Pill Action Buttons (Controlled by Show Score Options checkbox) */}
              {showScoreOptions && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'show')}
                    className={`px-3.5 py-1.5 rounded-full font-medium text-xs transition ${
                      currentInput?.type === 'show'
                        ? 'bg-[#16a34a] text-white ring-2 ring-white/60 shadow-md'
                        : 'bg-[#16a34a] text-white hover:opacity-95'
                    }`}
                  >
                    Show
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'open_drop')}
                    className={`px-3.5 py-1.5 rounded-full font-medium text-xs transition ${
                      currentInput?.type === 'open_drop'
                        ? 'bg-[#ea580c] text-white ring-2 ring-white/60 shadow-md'
                        : 'bg-[#ea580c] text-white hover:opacity-95'
                    }`}
                  >
                    Drop
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'middle_drop')}
                    className={`px-3.5 py-1.5 rounded-full font-medium text-xs transition ${
                      currentInput?.type === 'middle_drop'
                        ? 'bg-[#ca8a04] text-white ring-2 ring-white/60 shadow-md'
                        : 'bg-[#ca8a04] text-white hover:opacity-95'
                    }`}
                  >
                    M Drop
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'full_count')}
                    className={`px-3.5 py-1.5 rounded-full font-medium text-xs transition ${
                      currentInput?.type === 'full_count'
                        ? 'bg-[#7c3aed] text-white ring-2 ring-white/60 shadow-md'
                        : 'bg-[#7c3aed] text-white hover:opacity-95'
                    }`}
                  >
                    Full
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'out')}
                    className={`px-3.5 py-1.5 rounded-full font-medium text-xs transition ${
                      currentInput?.type === 'out'
                        ? 'bg-[#dc2626] text-white ring-2 ring-white/60 shadow-md'
                        : 'bg-[#dc2626] text-white hover:opacity-95'
                    }`}
                  >
                    Out
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Checkbox: Show Score Options? matching Screenshot */}
        <div className="pt-2">
          <label className="flex items-center gap-2.5 text-sm font-medium text-[var(--color-text)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showScoreOptions}
              onChange={e => setShowScoreOptions(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-0 cursor-pointer"
            />
            <span>Show Score Options?</span>
          </label>
        </div>

        {/* Submit Pill Button matching Screenshot */}
        <div className="pt-4 pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-full font-bold text-sm bg-[var(--color-primary)] hover:opacity-90 text-white shadow-md transition active:scale-[0.99] tracking-wider"
          >
            {isEditingLastRound ? 'UPDATE SCORE' : 'SUBMIT'}
          </button>
        </div>
      </div>
    </div>
  );
};
