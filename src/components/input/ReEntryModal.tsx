import React, { useState } from 'react';
import { GameState, PlayerId } from '../../domain/types';
import { Modal } from '../common/Modal';
import { calculateReEntryScore, isEliminated } from '../../domain/elimination';
import { RotateCw, Crown, AlertCircle } from 'lucide-react';

interface ReEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  reEnteringPlayerId: PlayerId | null;
  onConfirmReEntry: (playerId: PlayerId, customScore?: number) => void;
}

export const ReEntryModal: React.FC<ReEntryModalProps> = ({
  isOpen,
  onClose,
  state,
  reEnteringPlayerId,
  onConfirmReEntry,
}) => {
  if (!reEnteringPlayerId) return null;

  const { players, seats, rules, rounds, currentDealerIndex } = state;
  const player = players[reEnteringPlayerId];
  const currentDealerId = seats[currentDealerIndex];
  const dealerPlayer = players[currentDealerId];

  const lastRound = rounds[rounds.length - 1];
  const latestScores = lastRound ? lastRound.cumulativeScores : {};

  // Active player scores
  const activeScores = seats
    .filter(id => id !== reEnteringPlayerId && !isEliminated(latestScores[id] ?? 0, rules.poolLimit))
    .map(id => latestScores[id] ?? 0);

  const highestActive = activeScores.length > 0 ? Math.max(...activeScores) : 0;
  const calculatedScore = calculateReEntryScore(activeScores, rules);

  const [scoreInput, setScoreInput] = useState<string>(String(calculatedScore));

  const handleConfirm = () => {
    const parsed = parseInt(scoreInput, 10);
    // Boundary check: cannot be negative, cannot exceed pool limit
    const safeScore = (isNaN(parsed) || parsed < 0 || parsed >= rules.poolLimit)
      ? calculatedScore
      : parsed;

    onConfirmReEntry(reEnteringPlayerId, safeScore);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Player Re-Entry">
      <div className="space-y-4">
        {/* Info Box */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
              <RotateCw className="w-4 h-4 animate-spin" />
              Re-entering: {player?.name}
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-500/30">
              Re-entry #{(player?.reEntryCount ?? 0) + 1}
            </span>
          </div>
          <p className="text-xs opacity-80 leading-relaxed">
            Highest score among active players is <span className="font-mono font-bold text-white">{highestActive}</span>.
            Standard re-entry formula sets their score to <span className="font-mono font-bold text-amber-300">{calculatedScore}</span> (Highest + 1).
          </p>
          {(rules.entryAmount ?? 0) > 0 && (
            <p className="text-xs font-semibold text-emerald-400 pt-1 border-t border-blue-500/20">
              💰 Re-entry stake of <span className="font-mono font-bold">₹{rules.entryAmount}</span> will be added to the total prize pool!
            </p>
          )}
        </div>

        {/* Score adjustment */}
        <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-subtle)] space-y-2">
          <label className="block text-xs font-semibold text-[var(--color-muted)]">Re-entry Score</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={scoreInput}
              onChange={e => setScoreInput(e.target.value)}
              className="w-full px-3 py-2 font-mono font-bold text-base rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* Seating Relocation Notice (The User's Key Feature) */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300 block">Automatic Seating Relocation:</span>
            <p className="opacity-90 leading-relaxed">
              Upon re-entry, <span className="font-bold text-[var(--color-text)]">{player?.name}</span>'s chair position will automatically move to sit <span className="font-bold underline text-amber-300">immediately to the LEFT of Distributor ({dealerPlayer?.name})</span> in the playing turn order!
            </p>
          </div>
        </div>

        {/* Confirm Button */}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm bg-[var(--color-primary)] hover:opacity-90 text-white shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2"
        >
          <Crown className="w-4 h-4" /> CONFIRM RE-ENTRY & RE-ORDER SEAT
        </button>
      </div>
    </Modal>
  );
};
