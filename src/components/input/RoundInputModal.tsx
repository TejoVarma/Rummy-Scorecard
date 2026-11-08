import React, { useState } from 'react';
import { GameState, PlayerId, ScoreInputType } from '../../domain/types';
import { Modal } from '../common/Modal';
import { validateRoundScores } from '../../domain/scoring';
import { Crown, Check } from 'lucide-react';

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

  // Active players for this round (not yet eliminated)
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
      // If setting this player to show, make sure no other player has show
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

    // Auto-fill non-active players with 0 or out
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Round ${rounds.length + 1} Scores`}>
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {activeSeats.map(playerId => {
            const player = players[playerId];
            const currentTotal = cumulativeScores[playerId] ?? 0;
            const currentInput = scores[playerId] || { type: 'open_drop', points: rules.openDrop };
            const isDealer = playerId === currentDealerId;

            return (
              <div
                key={playerId}
                className="p-3 rounded-xl border border-white/10 bg-black/20 space-y-2.5 transition"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow"
                      style={{ backgroundColor: player?.avatarColor || '#3b82f6' }}
                    >
                      {player?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-1.5">
                        {player?.name}
                        {isDealer && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/40 flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5" /> Deal
                          </span>
                        )}
                      </div>
                      <div className="text-xs opacity-60 font-mono">
                        Current: {currentTotal} pts
                      </div>
                    </div>
                  </div>

                  {/* Score preview / custom input */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-60">Pts:</span>
                    <input
                      type="number"
                      min={0}
                      max={rules.fullCount}
                      value={currentInput.points}
                      onChange={e => handleCustomScoreChange(playerId, e.target.value)}
                      className="w-16 px-2 py-1 text-center font-mono font-bold text-sm rounded-lg bg-white/10 border border-white/20 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Quick Presets Pills */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'show')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition ${
                      currentInput.type === 'show'
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    Show (0)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'open_drop')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition ${
                      currentInput.type === 'open_drop'
                        ? 'bg-orange-500 text-black border-orange-400 shadow'
                        : 'bg-orange-500/10 text-orange-300 border-orange-500/30 hover:bg-orange-500/20'
                    }`}
                  >
                    Drop ({rules.openDrop})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'middle_drop')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition ${
                      currentInput.type === 'middle_drop'
                        ? 'bg-yellow-500 text-black border-yellow-400 shadow'
                        : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/20'
                    }`}
                  >
                    MD ({rules.middleDrop})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'full_count')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition ${
                      currentInput.type === 'full_count'
                        ? 'bg-purple-500 text-black border-purple-400 shadow'
                        : 'bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
                    }`}
                  >
                    Full ({rules.fullCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType(playerId, 'out')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition ${
                      currentInput.type === 'out'
                        ? 'bg-rose-500 text-white border-rose-400 shadow'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                    }`}
                  >
                    Out (X)
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" /> SUBMIT ROUND {rounds.length + 1}
        </button>
      </div>
    </Modal>
  );
};
