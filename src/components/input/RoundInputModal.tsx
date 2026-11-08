import React, { useState } from 'react';
import { GameState, PlayerId, ScoreInputType } from '../../domain/types';
import { Modal } from '../common/Modal';
import { validateRoundScores } from '../../domain/scoring';
import { Crown } from 'lucide-react';

interface RoundInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  onSubmitRound: (roundScores: Record<PlayerId, { type: ScoreInputType; points: number }>) => void;
}

export const RoundInputModal: React.FC<RoundInputModalProps> = ({
  isOpen,
  onClose,
  state,
  onSubmitRound,
}) => {
  const { seats, players, rules, rounds, currentDealerIndex } = state;
  const currentDealerId = seats[currentDealerIndex];

  // Get cumulative scores
  const cumulativeScores: Record<PlayerId, number> =
    rounds.length > 0
      ? rounds[rounds.length - 1].cumulativeScores
      : Object.fromEntries(seats.map(id => [id, 0]));

  // Active players for this round
  const activeSeats = seats.filter(id => (cumulativeScores[id] ?? 0) < rules.poolLimit);

  // Round input state
  const [scores, setScores] = useState<Record<PlayerId, { type: ScoreInputType; points: number }>>(() => {
    return Object.fromEntries(
      activeSeats.map(id => [id, { type: 'open_drop' as ScoreInputType, points: rules.openDrop }])
    );
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      if (type === 'show') {
        for (const id of activeSeats) {
          if (id !== playerId && next[id]?.type === 'show') {
            next[id] = { type: 'open_drop', points: rules.openDrop };
          }
        }
      }
      next[playerId] = { type, points: pts };
      return next;
    });
  };

  const handleCustomScoreChange = (playerId: PlayerId, val: string) => {
    setErrorMessage(null);
    const parsed = parseInt(val, 10);
    const pts = isNaN(parsed) ? 0 : Math.min(Math.max(0, parsed), rules.fullCount);
    setScores(prev => ({
      ...prev,
      [playerId]: { type: 'custom', points: pts },
    }));
  };

  const handleSubmit = () => {
    const validation = validateRoundScores(scores, activeSeats);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid scores');
      return;
    }

    const finalScores: Record<PlayerId, { type: ScoreInputType; points: number }> = {};
    for (const id of seats) {
      if (activeSeats.includes(id)) {
        finalScores[id] = scores[id];
      } else {
        finalScores[id] = { type: 'out', points: 0 };
      }
    }

    onSubmitRound(finalScores);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add Round Scores`}>
      <div className="space-y-3">
        {errorMessage && (
          <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-200 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
          {activeSeats.map(playerId => {
            const player = players[playerId];
            const currentTotal = cumulativeScores[playerId] ?? 0;
            const currentInput = scores[playerId] || { type: 'open_drop', points: rules.openDrop };
            const isDealer = playerId === currentDealerId;

            return (
              <div
                key={playerId}
                className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-subtle)] space-y-2"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-[var(--color-text)] flex items-center gap-1.5">
                      {player?.name}
                      {(player?.reEntryCount ?? 0) > 0 && (
                        <span className="text-[10px] text-[#ef4444] font-semibold">
                          (re entry)
                        </span>
                      )}
                      {isDealer && (
                        <span className="text-[10px] text-[#00a2ed] bg-[#00a2ed]/20 px-1.5 py-0.2 rounded border border-[#00a2ed]/30 flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> Deal
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-muted)] font-mono">
                      Score: {currentTotal}
                    </div>
                  </div>

                  {/* Score box matching original app */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={rules.fullCount}
                      placeholder="Score"
                      value={currentInput.type === 'show' ? 'Show' : currentInput.points}
                      onChange={e => handleCustomScoreChange(playerId, e.target.value)}
                      className={`w-20 px-2.5 py-1 text-center font-mono font-semibold text-xs rounded-full border focus:outline-none ${
                        currentInput.type === 'show'
                          ? 'bg-[#15803d] text-white border-[#22c55e]'
                          : 'bg-[var(--color-card)] text-[var(--color-text)] border-[var(--color-border)] focus:border-[#00a2ed]'
                      }`}
                    />
                  </div>
                </div>

                {/* Flat Pills matching original app Screenshot 6 */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'show')}
                    className={`px-3 py-1 rounded-full font-medium text-xs transition ${
                      currentInput.type === 'show'
                        ? 'bg-[#16a34a] text-white ring-2 ring-white/50'
                        : 'bg-[#16a34a] text-white opacity-85 hover:opacity-100'
                    }`}
                  >
                    Show
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'open_drop')}
                    className={`px-3 py-1 rounded-full font-medium text-xs transition ${
                      currentInput.type === 'open_drop'
                        ? 'bg-[#ea580c] text-white ring-2 ring-white/50'
                        : 'bg-[#ea580c] text-white opacity-85 hover:opacity-100'
                    }`}
                  >
                    Drop
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'middle_drop')}
                    className={`px-3 py-1 rounded-full font-medium text-xs transition ${
                      currentInput.type === 'middle_drop'
                        ? 'bg-[#ca8a04] text-white ring-2 ring-white/50'
                        : 'bg-[#ca8a04] text-white opacity-85 hover:opacity-100'
                    }`}
                  >
                    M Drop
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'full_count')}
                    className={`px-3 py-1 rounded-full font-medium text-xs transition ${
                      currentInput.type === 'full_count'
                        ? 'bg-[#7c3aed] text-white ring-2 ring-white/50'
                        : 'bg-[#7c3aed] text-white opacity-85 hover:opacity-100'
                    }`}
                  >
                    Full
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'out')}
                    className={`px-3 py-1 rounded-full font-medium text-xs transition ${
                      currentInput.type === 'out'
                        ? 'bg-[#dc2626] text-white ring-2 ring-white/50'
                        : 'bg-[#dc2626] text-white opacity-85 hover:opacity-100'
                    }`}
                  >
                    Out
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Button (Clean solid blue matching screenshot) */}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3 rounded-lg font-bold text-sm bg-[#0284c7] hover:bg-[#0369a1] text-white shadow transition active:scale-[0.99]"
        >
          SUBMIT
        </button>
      </div>
    </Modal>
  );
};
