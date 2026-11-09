import React, { useState } from 'react';
import { GameState, PlayerId } from '../../domain/types';
import { Modal } from '../common/Modal';
import { isEliminated, sharedReEntryScore } from '../../domain/elimination';
import { RotateCw, Crown, AlertCircle, Check } from 'lucide-react';

interface ReEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  /** Everyone who may re-enter now. With more than one, they're picked in card order. */
  eligiblePlayerIds: PlayerId[];
  initialSelection: PlayerId[];
  onConfirmReEntry: (playerIds: PlayerId[], score: number) => void;
}

export const ReEntryModal: React.FC<ReEntryModalProps> = ({
  isOpen,
  onClose,
  state,
  eligiblePlayerIds,
  initialSelection,
  onConfirmReEntry,
}) => {
  const { players, seats, rules, rounds, currentDealerIndex } = state;
  const currentDealerId = seats[currentDealerIndex];
  const dealerPlayer = players[currentDealerId];
  const lastRound = rounds[rounds.length - 1];

  const calculatedScore = lastRound ? sharedReEntryScore(lastRound, seats, rules.poolLimit) ?? 0 : 0;
  const reEntered = new Set(lastRound?.reEnteredInRound ?? []);
  const stillIn = seats.filter(
    id => !reEntered.has(id) && !isEliminated(lastRound?.cumulativeScores[id] ?? 0, rules.poolLimit)
  );
  const highestActive = Math.max(0, ...stillIn.map(id => lastRound?.cumulativeScores[id] ?? 0));

  const [selected, setSelected] = useState<PlayerId[]>(initialSelection);
  const [scoreInput, setScoreInput] = useState<string>(String(calculatedScore));
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const choosing = eligiblePlayerIds.length > 1;
  const names = selected.map(id => players[id]?.name).join(' & ');

  const toggle = (id: PlayerId) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    setSelectionError(null);
  };

  const handleConfirm = () => {
    if (selected.length === 0) {
      setSelectionError('Tap the players who are re-entering.');
      return;
    }
    const score = Number(scoreInput);
    if (scoreInput === '' || !Number.isInteger(score) || score < 1 || score >= rules.poolLimit) {
      setScoreError(`Enter a re-entry score between 1 and ${rules.poolLimit - 1}.`);
      return;
    }
    onConfirmReEntry(selected, score);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Player Re-Entry">
      <div className="space-y-4">
        {choosing && (
          <div role="group" aria-labelledby="re-entry-order-hint" className="space-y-2">
            <p id="re-entry-order-hint" className="text-xs text-[var(--color-muted)]">
              Tap in card order: highest card first. The last one tapped sits next to the dealer.
            </p>
            {eligiblePlayerIds.map(id => {
              const order = selected.indexOf(id);
              const isSelected = order >= 0;
              return (
                <div
                  key={id}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={isSelected ? `${players[id]?.name}, number ${order + 1}` : players[id]?.name}
                  tabIndex={0}
                  onClick={() => toggle(id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(id);
                    }
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]'
                      : 'bg-[var(--color-subtle)] border-[var(--color-border)] hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition border ${
                        isSelected
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                          : 'border-[#52525e] bg-transparent text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <span className="font-medium text-sm text-[var(--color-text)]">{players[id]?.name}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[11px] font-mono text-[var(--color-primary)] px-2 py-0.5 rounded bg-[var(--color-primary)]/10">
                      #{order + 1}
                    </span>
                  )}
                </div>
              );
            })}
            {selectionError && (
              <p role="alert" className="text-xs font-medium text-rose-500">
                {selectionError}
              </p>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-sm min-w-0">
              <RotateCw className="w-4 h-4 animate-spin shrink-0" />
              <span className="truncate">Re-entering: {names || '—'}</span>
            </div>
            {selected.length === 1 && (
              <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-500/30">
                Re-entry #{(players[selected[0]]?.reEntryCount ?? 0) + 1}
              </span>
            )}
          </div>
          <p className="text-xs opacity-80 leading-relaxed">
            Highest score among active players is <span className="font-mono font-bold text-white">{highestActive}</span>.
            Standard re-entry formula sets {selected.length > 1 ? 'each score' : 'their score'} to{' '}
            <span className="font-mono font-bold text-amber-300">{calculatedScore}</span> (Highest + 1).
          </p>
          {(rules.entryAmount ?? 0) > 0 && (
            <p className="text-xs font-semibold text-emerald-400 pt-1 border-t border-blue-500/20">
              💰 Re-entry stake of <span className="font-mono font-bold">₹{rules.entryAmount}</span>
              {selected.length > 1 ? ' each' : ''} will be added to the total prize pool!
            </p>
          )}
        </div>

        {/* Score adjustment */}
        <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-subtle)] space-y-2">
          <label htmlFor="re-entry-score" className="block text-xs font-semibold text-[var(--color-muted)]">Re-entry Score</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={scoreInput}
              onChange={e => {
                const clean = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                setScoreInput(clean);
                setScoreError(null);
              }}
              id="re-entry-score"
              aria-label="Re-entry score"
              aria-invalid={scoreError !== null}
              aria-describedby={scoreError ? 're-entry-score-error' : undefined}
              className="w-full px-3 py-2 font-mono font-bold text-base rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          {scoreError && (
            <p id="re-entry-score-error" role="alert" className="text-xs font-medium text-rose-500">
              {scoreError}
            </p>
          )}
          {!choosing && selectionError && (
            <p role="alert" className="text-xs font-medium text-rose-500">
              {selectionError}
            </p>
          )}
        </div>

        {/* Seating Relocation Notice */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1" aria-live="polite">
            <span className="font-bold text-amber-300 block">Automatic Seating Relocation:</span>
            {selected.length > 1 ? (
              <>
                <p className="opacity-90 leading-relaxed">They will sit to the LEFT of the Distributor in this order:</p>
                <p className="font-bold text-[var(--color-text)]">
                  {[...selected.map(id => players[id]?.name), `${dealerPlayer?.name} (dealer)`].join(' → ')}
                </p>
              </>
            ) : (
              <p className="opacity-90 leading-relaxed">
                Upon re-entry, <span className="font-bold text-[var(--color-text)]">{names || 'the player'}</span>'s chair position will automatically move to sit <span className="font-bold underline text-amber-300">immediately to the LEFT of Distributor ({dealerPlayer?.name})</span> in the playing turn order!
              </p>
            )}
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
