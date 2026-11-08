import React, { useState } from 'react';
import { GameState, PlayerId } from '../../domain/types';
import { Confetti } from '../common/Confetti';
import { RotateCcw, Settings, Trophy, Crown, Share2, Trash2, ArrowLeft, UserPlus } from 'lucide-react';

interface ScoreboardScreenProps {
  state: GameState;
  onBack: () => void;
  onOpenScoreInput: () => void;
  onUndoRound: () => void;
  onOpenSettings: () => void;
  onPromptReEntry: (playerId: PlayerId) => void;
  onDeleteGame: () => void;
}

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({
  state,
  onBack,
  onOpenScoreInput,
  onUndoRound,
  onOpenSettings,
  onPromptReEntry,
  onDeleteGame,
}) => {
  const { title, rules, seats, players, rounds, currentDealerIndex, winnerPlayerId } = state;
  const currentDealerId = seats[currentDealerIndex];
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number | null>(null);

  // Calculate latest cumulative scores
  const latestScores: Record<PlayerId, number> =
    rounds.length > 0
      ? rounds[rounds.length - 1].cumulativeScores
      : Object.fromEntries(seats.map(id => [id, 0]));

  // Check players who crossed pool limit
  const eliminatedPlayers = seats.filter(
    id => (latestScores[id] ?? 0) >= rules.poolLimit
  );

  const handleShare = () => {
    if (navigator.share) {
      const summary = `🎴 *Rummy Scorecard: ${title}*\nPool: ${rules.poolLimit} | Rounds: ${rounds.length}\n` +
        seats.map(id => `${players[id]?.name}: ${latestScores[id] ?? 0} pts`).join('\n');
      navigator.share({ title: 'Rummy Scorecard', text: summary }).catch(() => {});
    } else {
      alert('Scorecard summary copied to clipboard!');
    }
  };

  // Determine if columns can fit 100% on screen without horizontal scroll
  // Up to 6 players fit cleanly edge-to-edge on standard mobile screens!
  const isCompactFit = seats.length <= 6;

  return (
    <div className="flex flex-col h-screen w-full max-w-2xl mx-auto overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] font-sans select-none transition-colors duration-200">
      {/* Top App Bar matching Screenshot 5 */}
      <div className="flex items-center justify-between px-3.5 py-3 bg-[#00a2ed] text-white shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            title="Back to Home"
            className="p-1 rounded hover:bg-black/10 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-semibold text-base tracking-normal truncate max-w-[200px]">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            title="Share"
            className="p-1.5 rounded hover:bg-black/10 transition"
          >
            <Share2 className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={onUndoRound}
            disabled={rounds.length === 0}
            title="Undo Last Round"
            className="p-1.5 rounded hover:bg-black/10 disabled:opacity-30 transition"
          >
            <RotateCcw className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings"
            className="p-1.5 rounded hover:bg-black/10 transition"
          >
            <Settings className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this game permanently? This action cannot be undone.')) {
                onDeleteGame();
              }
            }}
            title="Delete Game"
            className="p-1.5 rounded hover:bg-rose-600/30 text-rose-200 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subheader info block matching Screenshot 5 */}
      <div className="px-4 py-2.5 bg-[var(--color-subtle)] border-b border-[var(--color-border)] text-xs text-[var(--color-muted)] shrink-0">
        <div className="flex justify-between items-center py-0.5">
          <span>Game Score: <strong className="text-[var(--color-text)] font-mono">{rules.poolLimit}</strong></span>
          <span>Open drop: <strong className="text-[var(--color-text)] font-mono">{rules.openDrop}</strong></span>
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span>Middle drop: <strong className="text-[var(--color-text)] font-mono">{rules.middleDrop}</strong></span>
          <span>Full count: <strong className="text-[var(--color-text)] font-mono">{rules.fullCount}</strong></span>
        </div>
        <div className="text-center pt-1 font-medium text-[var(--color-text)]">
          Rounds Completed: <span className="font-mono text-[#00a2ed] font-bold">{rounds.length}</span>
        </div>
      </div>

      {/* Re-Entry Action Banner */}
      {eliminatedPlayers.length > 0 && rules.allowReEntry && (
        <div className="px-3 py-2 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-[var(--color-text)] truncate">
            {eliminatedPlayers.map(id => players[id]?.name).join(', ')} eliminated!
          </span>
          <div className="flex gap-1.5 shrink-0">
            {eliminatedPlayers.map(id => (
              <button
                key={id}
                type="button"
                onClick={() => onPromptReEntry(id)}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-[#00a2ed] hover:bg-[#008fcf] text-white flex items-center gap-1 shadow-sm transition active:scale-95"
              >
                <UserPlus className="w-3 h-3" /> Re-Enter {players[id]?.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Winner Celebration Banner */}
      {winnerPlayerId && (
        <div className="shrink-0">
          <Confetti />
          <div className="mx-3 my-2 p-2.5 rounded-lg bg-[#064e3b] border border-[#059669] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Winner Declared</span>
                <span className="text-xs font-bold text-white">
                  {players[winnerPlayerId]?.name} won the match!
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score Matrix Table - NO horizontal scroll for <= 6 players! */}
      <div className={`flex-1 ${isCompactFit ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'} relative bg-[var(--color-bg)]`}>
        <table className={`w-full border-collapse ${isCompactFit ? 'table-fixed' : 'min-w-max'}`}>
          {/* Sticky Player Headers matching Screenshot 5 */}
          <thead className="sticky top-0 z-30 bg-[var(--color-card)] border-b border-[var(--color-border)] shadow-sm">
            <tr>
              {seats.map(playerId => {
                const player = players[playerId];
                const score = latestScores[playerId] ?? 0;
                const isDealer = currentDealerId === playerId;
                const isOut = score >= rules.poolLimit;
                const isReEntered = (player?.reEntryCount ?? 0) > 0;

                return (
                  <th
                    key={playerId}
                    style={isCompactFit ? { width: `${100 / seats.length}%` } : { minWidth: '60px' }}
                    className={`py-2 px-1 text-center font-normal border-r border-[var(--color-border)] last:border-r-0 ${
                      isDealer ? 'bg-[#00a2ed]/10' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center">
                      {/* Player Name matching Screenshot 5 */}
                      <div className="flex items-center justify-center gap-0.5 max-w-full">
                        {isDealer && <Crown className="w-3 h-3 text-[#00a2ed] shrink-0" />}
                        <span
                          className={`text-xs truncate block ${
                            isOut || isReEntered ? 'text-[#ef4444] font-semibold' : 'text-[var(--color-text)]'
                          }`}
                          title={player?.name}
                        >
                          {isReEntered && !isOut ? `*${player?.name}` : player?.name}
                        </span>
                      </div>

                      {/* Cumulative Total under player name */}
                      <span
                        className={`text-[11px] font-mono font-semibold block leading-tight mt-0.5 ${
                          isOut ? 'text-rose-400' : 'text-[var(--color-muted)]'
                        }`}
                      >
                        {score}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body (Rounds) */}
          <tbody className="divide-y divide-[var(--color-border)]">
            {rounds.length === 0 ? (
              <tr>
                <td colSpan={seats.length} className="py-20 text-center text-xs text-[var(--color-muted)]">
                  No rounds recorded yet.<br />Tap <strong className="text-[#00a2ed]">"ENTER SCORE"</strong> below to begin.
                </td>
              </tr>
            ) : (
              rounds.map((round, rIdx) => {
                const isRowSelected = selectedRoundIndex === rIdx;

                return (
                  <tr
                    key={round.roundNumber}
                    onClick={() => setSelectedRoundIndex(isRowSelected ? null : rIdx)}
                    className={`transition-colors cursor-pointer ${
                      isRowSelected ? 'bg-black/5 dark:bg-white/[0.06]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    {seats.map(playerId => {
                      const scoreInfo = round.scores[playerId];

                      if (!scoreInfo) {
                        return (
                          <td
                            key={playerId}
                            className="py-1 px-0.5 text-center border-r border-[var(--color-border)] last:border-r-0 text-[var(--color-muted)] font-mono text-xs"
                          >
                            -
                          </td>
                        );
                      }

                      // Cell content exactly matching Screenshot 5 blue rounded boxes
                      const renderScoreCell = () => {
                        switch (scoreInfo.type) {
                          case 'show':
                            return (
                              <div className="w-full max-w-[48px] mx-auto py-1.5 rounded-lg bg-[#0078d4] text-[#facc15] font-bold text-sm text-center shadow-sm">
                                R
                              </div>
                            );
                          case 'open_drop':
                            return (
                              <div className="w-full max-w-[48px] mx-auto py-1.5 rounded-lg bg-[#0078d4] text-white font-bold text-sm text-center shadow-sm">
                                D
                              </div>
                            );
                          case 'middle_drop':
                            return (
                              <div className="w-full max-w-[48px] mx-auto py-1.5 rounded-lg bg-[#0078d4] text-white font-bold text-sm text-center shadow-sm">
                                MD
                              </div>
                            );
                          case 'full_count':
                            return (
                              <div className="w-full max-w-[48px] mx-auto py-1.5 rounded-lg bg-[#0078d4] text-white font-bold text-sm text-center shadow-sm">
                                FC
                              </div>
                            );
                          case 'out':
                            return (
                              <div className="w-full max-w-[48px] mx-auto py-1.5 rounded-lg bg-[#27272a] text-[#71717a] font-bold text-sm text-center">
                                X
                              </div>
                            );
                          default: {
                            // If player re-entered in this round
                            const wasReEnteredHere = round.reEnteredInRound?.includes(playerId);
                            if (wasReEnteredHere) {
                              return (
                                <div className="w-full max-w-[48px] mx-auto py-0.5 rounded-lg bg-[#0078d4] text-white text-center shadow-sm">
                                  <div className="text-[11px] font-bold leading-tight">RE</div>
                                  <div className="text-[9px] font-mono text-emerald-300 font-bold leading-tight">
                                    {scoreInfo.points}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="w-full max-w-[48px] mx-auto py-1.5 rounded-lg bg-[#0078d4] text-white font-bold text-sm text-center shadow-sm font-mono">
                                {scoreInfo.points}
                              </div>
                            );
                          }
                        }
                      };

                      return (
                        <td
                          key={playerId}
                          className="py-1 px-0.5 text-center border-r border-[#24242e] last:border-r-0 align-middle"
                        >
                          {renderScoreCell()}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Round Info Toast */}
      {selectedRoundIndex !== null && rounds[selectedRoundIndex] && (
        <div className="px-4 py-1.5 bg-[var(--color-subtle)] border-t border-[var(--color-border)] text-center text-[11px] text-[var(--color-muted)] shrink-0">
          Showing Round {selectedRoundIndex + 1} • Dealer was {players[rounds[selectedRoundIndex].dealerPlayerId]?.name || 'Unknown'}
        </div>
      )}

      {/* Bottom Action Pill Buttons matching Screenshot 5 */}
      <div className="p-3 bg-[var(--color-bg)] border-t border-[var(--color-border)] space-y-2 shrink-0">
        <button
          type="button"
          onClick={onOpenScoreInput}
          disabled={Boolean(winnerPlayerId)}
          className="w-full py-3 rounded-full font-bold text-sm bg-[#00a2ed] hover:bg-[#008fcf] disabled:bg-[#00a2ed]/40 disabled:text-white/40 text-white shadow transition active:scale-[0.99] tracking-wider"
        >
          ENTER SCORE
        </button>

        <button
          type="button"
          onClick={onUndoRound}
          disabled={rounds.length === 0}
          className="w-full py-2.5 rounded-full font-semibold text-xs border border-[#00a2ed] text-[#00a2ed] hover:bg-[#00a2ed]/10 disabled:opacity-40 transition active:scale-[0.99] tracking-wider"
        >
          UNDO LAST ROUND
        </button>
      </div>
    </div>
  );
};
