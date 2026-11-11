import React, { useEffect, useRef, useState } from 'react';
import { GameState, PlayerId, ScoreInputType } from '../../domain/types';
import { getPointsForInputType, validateRoundScores } from '../../domain/scoring';
import { analyzePlayerDrops } from '../../domain/elimination';
import { ArrowLeft, Crown } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../../hooks/useBackButton';

// The quick-pick options, in the order they appear. Points always come from the game's rules.
const SCORE_OPTIONS: Array<{ type: Exclude<ScoreInputType, 'custom'>; label: string; color: string }> = [
  { type: 'show', label: 'Show', color: '#16a34a' },
  { type: 'open_drop', label: 'Drop', color: '#ea580c' },
  { type: 'middle_drop', label: 'M Drop', color: '#ca8a04' },
  { type: 'full_count', label: 'Full', color: '#7c3aed' },
  { type: 'out', label: 'Out', color: '#dc2626' },
  { type: 'penalty', label: 'Penalty', color: '#db2777' },
];

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
  const { rules, rounds } = state;
  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const editedRound = isEditingLastRound ? lastRound : null;

  // When editing, show the table exactly as it was when that round was played.
  const roundSeats = editedRound?.seatsSnapshot ?? state.seats;
  const players = editedRound?.playersSnapshot ?? state.players;
  const currentDealerId = editedRound ? editedRound.dealerPlayerId : state.seats[state.currentDealerIndex];

  // Totals going into the round being entered or edited
  const roundsBefore = editedRound ? rounds.slice(0, -1) : rounds;
  const cumulativeScores: Record<PlayerId, number> =
    roundsBefore.length > 0 ? roundsBefore[roundsBefore.length - 1].cumulativeScores : {};

  const activeSeats = roundSeats.filter(id => (cumulativeScores[id] ?? 0) < rules.poolLimit);

  // Editing a round cancels any re-entry made after it, so say who would be affected.
  const undoneReEntries = (editedRound?.reEnteredInRound ?? []).map(id => state.players[id]?.name || 'a player');
  const reEntryWarning =
    undoneReEntries.length > 0 ? `Saving this edit will undo ${undoneReEntries.join(' and ')}'s re-entry.` : null;

  // NO default drop score when opening! Start completely empty unless editing
  const [scores, setScores] = useState<Record<PlayerId, { type: ScoreInputType; points: number } | undefined>>(() => {
    if (isEditingLastRound && lastRound) {
      return { ...lastRound.scores };
    }
    return {};
  });

  const [showScoreOptions, setShowScoreOptions] = useState<boolean>(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, [isOpen]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;


  const handleSelectType = (playerId: PlayerId, type: ScoreInputType) => {
    setErrorMessage(null);
    const pts = getPointsForInputType(type, undefined, rules);

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

  const clearScore = (playerId: PlayerId) => {
    setScores(prev => {
      const next = { ...prev };
      delete next[playerId];
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
    const validation = validateRoundScores(completeScores, activeSeats, rules);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid scores');
      return;
    }

    if (reEntryWarning && !window.confirm(`${reEntryWarning} Continue?`)) return;

    const finalScores: Record<PlayerId, { type: ScoreInputType; points: number }> = {};
    for (const id of roundSeats) {
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
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-input-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col focus:outline-none bg-[var(--color-bg)] text-[var(--color-text)] font-sans select-none overflow-hidden transition-colors duration-200">
      {/* Top App Bar matching Screenshot */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-[var(--color-primary)] text-white shadow shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-black/10 active:bg-black/20 transition"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 id="round-input-title" className="font-semibold text-lg tracking-normal">
          {isEditingLastRound ? `Edit Round ${rounds.length} Scores` : 'Add Round Scores'}
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-w-md w-full mx-auto">
        {reEntryWarning && (
          <div role="alert" className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-medium">
            {reEntryWarning}
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Player Cards */}
        {activeSeats.map(playerId => {
          const player = players[playerId];
          const currentTotal = cumulativeScores[playerId] ?? 0;
          const currentInput = scores[playerId];
          const isDealer = playerId === currentDealerId;
          const dropAnalysis = analyzePlayerDrops(currentTotal, rules.poolLimit, rules.openDrop, rules.middleDrop);
          const dropStatus = dropAnalysis.status;
          const chosen = SCORE_OPTIONS.find(option => option.type === currentInput?.type);

          return (
            <div
              key={playerId}
              role="group"
              aria-label={player?.name}
              className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] space-y-3 shadow-sm"
            >
              {/* Header row: Name + Current Total on left, Outlined Capsule on right */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-base flex items-center gap-1.5 flex-wrap">
                    <span className={dropStatus === 'compulsory' ? 'text-rose-600 dark:text-rose-500 font-bold' : dropStatus === 'one_drop' ? 'text-amber-600 dark:text-yellow-400 font-bold' : 'text-[var(--color-text)]'}>
                      {player?.name}
                    </span>
                    {(player?.reEntryCount ?? 0) > 0 && (
                      <span className="text-[10px] text-[#ef4444] font-semibold">
                        (re entry)
                      </span>
                    )}
                    {dropStatus === 'compulsory' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-tight">
                        Compulsory (0 drops)
                      </span>
                    )}
                    {dropStatus === 'one_drop' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-600 dark:text-yellow-400 border border-amber-500/30 uppercase tracking-tight">
                        1 Drop ({dropAnalysis.canMiddleDrop ? 'Can MD' : 'No MD'})
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

                <div className="relative min-w-[110px] h-[38px] rounded-full border border-zinc-500/80 px-2.5 flex items-center justify-center bg-[var(--color-card)] focus-within:border-[var(--color-primary)] transition">
                  <span aria-hidden className="absolute -top-2 left-3 bg-[var(--color-card)] px-1 text-[11px] font-medium text-zinc-400 select-none">
                    Score
                  </span>
                  {chosen ? (
                    <button
                      type="button"
                      onClick={() => clearScore(playerId)}
                      aria-label={`Clear ${chosen.label} for ${player?.name}`}
                      style={{ backgroundColor: chosen.color }}
                      className="px-3.5 py-1 rounded-full text-white font-medium text-xs leading-none shadow-sm"
                    >
                      {chosen.label} ✕
                    </button>
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      aria-label={`Score for ${player?.name}`}
                      value={currentInput?.type === 'custom' ? currentInput.points : ''}
                      onChange={e => handleCustomScoreChange(playerId, e.target.value)}
                      className="w-full text-center font-mono font-bold text-sm bg-transparent border-none text-[var(--color-text)] placeholder:text-zinc-500 placeholder:font-normal focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {showScoreOptions && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SCORE_OPTIONS.map(option => (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => handleSelectType(playerId, option.type)}
                      aria-pressed={currentInput?.type === option.type}
                      style={{ backgroundColor: option.color }}
                      className={`px-3.5 py-1.5 rounded-full font-medium text-xs text-white transition ${
                        currentInput?.type === option.type ? 'ring-2 ring-white/70 shadow-md' : 'hover:opacity-95'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
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
