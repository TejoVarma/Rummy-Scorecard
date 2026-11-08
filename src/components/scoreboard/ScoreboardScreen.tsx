import React, { useState, useRef } from 'react';
import { GameState, PlayerId } from '../../domain/types';
import { getEligibleForReEntryPlayers } from '../../domain/elimination';
import { Confetti } from '../common/Confetti';
import { toBlob } from 'html-to-image';
import { Settings, Trophy, Crown, Share2, Trash2, ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../../hooks/useBackButton';

interface ScoreboardScreenProps {
  state: GameState;
  onBack: () => void;
  onOpenScoreInput: () => void;
  onOpenEditScore: () => void;
  onOpenSettings: () => void;
  onPromptReEntry: (playerId: PlayerId) => void;
  onDeleteGame: () => void;
}

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({
  state,
  onBack,
  onOpenScoreInput,
  onOpenEditScore,
  onOpenSettings,
  onPromptReEntry,
  onDeleteGame,
}) => {
  const { title, rules, seats, players, rounds, currentDealerIndex, winnerPlayerId } = state;
  const currentDealerId = seats[currentDealerIndex];
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number | null>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const scorecardCaptureRef = useRef<HTMLDivElement>(null);

  // Close round details sheet on back press
  useBackButton(
    () => setSelectedRoundIndex(null),
    selectedRoundIndex !== null,
    BACK_PRIORITY.NESTED_MODAL,
    'scoreboard_round_details'
  );

  // Calculate latest cumulative scores
  const latestScores: Record<PlayerId, number> =
    rounds.length > 0
      ? rounds[rounds.length - 1].cumulativeScores
      : Object.fromEntries(seats.map(id => [id, 0]));

  // Eligible for re-entry: only players who got eliminated in the most recent round
  const eligibleReEntryPlayers = getEligibleForReEntryPlayers(rounds, seats, rules);

  // Pool Stake & Total Amount calculation
  const entryAmount = rules.entryAmount ?? 0;
  const totalReEntries = seats.reduce((sum, id) => sum + (players[id]?.reEntryCount ?? 0), 0);
  const totalPoolAmount = entryAmount * (seats.length + totalReEntries);

  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const isLastRoundEdited = Boolean(lastRound?.isEdited);

  // Generate and share or download image of current scoreboard matrix
  const handleShareScorecard = async () => {
    if (!scorecardCaptureRef.current || isSharingImage) return;
    setIsSharingImage(true);

    try {
      const rootStyles = getComputedStyle(document.documentElement);
      const bgColor = rootStyles.getPropertyValue('--color-bg').trim() || '#0f172a';

      const blob = await toBlob(scorecardCaptureRef.current, {
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
      });

      if (!blob) throw new Error('Image generation failed');

      const safeTitle = title.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'scorecard';
      const fileName = `${safeTitle}-round-${rounds.length}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${title} Scorecard`,
          text: `Rummy Scorecard: ${title} (Pool ${rules.poolLimit})`,
          files: [file],
        });
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        // Fallback for Android WebView / mobile when file sharing is unavailable
        const poolInfo = entryAmount > 0 ? ` | Prize Pool: ₹${totalPoolAmount}` : '';
        const summary = `🎴 *Rummy Scorecard: ${title}*\nPool: ${rules.poolLimit}${poolInfo} | Rounds: ${rounds.length}\n` +
          seats.map(id => `${players[id]?.name}: ${latestScores[id] ?? 0} pts`).join('\n');
        await navigator.share({ title: `${title} Scorecard`, text: summary });
      } else {
        // Desktop browser download fallback
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        // Fallback to text share
        if (navigator.share) {
          const poolInfo = entryAmount > 0 ? ` | Prize Pool: ₹${totalPoolAmount}` : '';
          const summary = `🎴 *Rummy Scorecard: ${title}*\nPool: ${rules.poolLimit}${poolInfo} | Rounds: ${rounds.length}\n` +
            seats.map(id => `${players[id]?.name}: ${latestScores[id] ?? 0} pts`).join('\n');
          navigator.share({ title: `${title} Scorecard`, text: summary }).catch(() => {});
        }
      }
    } finally {
      setIsSharingImage(false);
    }
  };

  // Determine if columns can fit 100% on screen without horizontal scroll
  const isCompactFit = seats.length <= 6;

  return (
    <div className="flex flex-col h-screen w-full max-w-2xl mx-auto overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] font-sans select-none transition-colors duration-200">
      {/* Top App Bar matching Screenshot 5 with dynamic theme color */}
      <div className="flex items-center justify-between px-3.5 py-3 bg-[var(--color-primary)] text-white shadow-sm shrink-0">
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
            onClick={handleShareScorecard}
            disabled={isSharingImage}
            title="Share Scorecard Image"
            className="p-1.5 rounded hover:bg-black/10 transition disabled:opacity-50"
          >
            {isSharingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Share2 className="w-4 h-4 text-white" />
            )}
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

      {/* Re-Entry Action Banner - only for players eliminated in the most recent round */}
      {eligibleReEntryPlayers.length > 0 && rules.allowReEntry && (
        <div className="px-3 py-2 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-[var(--color-text)] truncate">
            {eligibleReEntryPlayers.map(id => players[id]?.name).join(', ')} eliminated!
          </span>
          <div className="flex gap-1.5 shrink-0">
            {eligibleReEntryPlayers.map(id => (
              <button
                key={id}
                type="button"
                onClick={() => onPromptReEntry(id)}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--color-primary)] hover:opacity-90 text-white flex items-center gap-1 shadow-sm transition active:scale-95"
              >
                <UserPlus className="w-3 h-3" /> Re-Enter {players[id]?.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Capture container for Scorecard Image sharing */}
      <div ref={scorecardCaptureRef} className="flex flex-col flex-1 overflow-hidden bg-[var(--color-bg)]">
        {/* Title Header for image capture */}
        <div className="px-4 py-2 bg-[var(--color-primary)] text-white font-bold text-sm text-center tracking-wide shrink-0">
          {title} • Scoreboard
        </div>

        {/* Subheader info block matching Screenshot 5 */}
        <div className="px-4 py-2 bg-[var(--color-subtle)] border-b border-[var(--color-border)] text-xs text-[var(--color-muted)] shrink-0">
          <div className="flex justify-between items-center py-0.5">
            <span>Game Score: <strong className="text-[var(--color-text)] font-mono">{rules.poolLimit}</strong></span>
            <span>Open drop: <strong className="text-[var(--color-text)] font-mono">{rules.openDrop}</strong></span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span>Middle drop: <strong className="text-[var(--color-text)] font-mono">{rules.middleDrop}</strong></span>
            <span>Full count: <strong className="text-[var(--color-text)] font-mono">{rules.fullCount}</strong></span>
          </div>

          {/* Pool Stake & Total Amount */}
          {entryAmount > 0 && (
            <div className="flex justify-between items-center py-1 border-t border-[var(--color-border)] mt-1">
              <span>Stake: <strong className="text-[var(--color-text)] font-mono">₹{entryAmount}</strong></span>
              <span className="flex items-center gap-1">
                <span>Total Pool:</span>
                <strong className="text-emerald-500 font-mono font-bold text-sm">₹{totalPoolAmount}</strong>
                {totalReEntries > 0 && (
                  <span className="text-[10px] text-amber-500 font-semibold font-mono">
                    (+{totalReEntries * entryAmount})
                  </span>
                )}
              </span>
            </div>
          )}

          <div className="text-center pt-1 font-medium text-[var(--color-text)]">
            Rounds Completed: <span className="font-mono text-[var(--color-primary)] font-bold">{rounds.length}</span>
          </div>
        </div>

        {/* Winner Celebration Banner */}
        {winnerPlayerId && (
          <div className="shrink-0">
            <Confetti />
            <div className="mx-3 my-2 p-2.5 rounded-lg bg-[#064e3b] border border-[#059669] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Winner Declared</span>
                  <span className="text-xs font-bold text-white block">
                    {players[winnerPlayerId]?.name} won the match!
                  </span>
                  {entryAmount > 0 && (
                    <span className="text-xs font-bold text-amber-300 font-mono block mt-0.5">
                      Prize Pool: ₹{totalPoolAmount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Score Matrix Table - NO horizontal scroll for <= 6 players */}
        <div className={`flex-1 ${isCompactFit ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'} relative bg-[var(--color-bg)]`}>
          <table className={`w-full border-collapse ${isCompactFit ? 'table-fixed' : 'min-w-max'}`}>
            {/* Sticky Player Headers */}
            <thead className="sticky top-0 z-30 bg-[var(--color-card)] border-b border-[var(--color-border)] shadow-sm">
              <tr>
                {seats.map(playerId => {
                  const player = players[playerId];
                  const score = latestScores[playerId] ?? 0;
                  const isDealer = currentDealerId === playerId;
                  const isOut = score >= rules.poolLimit;
                  const reEntryCount = player?.reEntryCount ?? 0;
                  const isReEntered = reEntryCount > 0;

                  return (
                    <th
                      key={playerId}
                      style={isCompactFit ? { width: `${100 / seats.length}%` } : { minWidth: '60px' }}
                      className={`py-2 px-1 text-center font-normal border-r border-[var(--color-border)] last:border-r-0 ${
                        isDealer ? 'bg-[var(--color-primary)]/10' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center min-h-[30px]">
                        {/* Player Name */}
                        <div className="flex items-center justify-center gap-0.5 max-w-full">
                          {isDealer && <Crown className="w-3 h-3 text-[var(--color-primary)] shrink-0" />}
                          <span
                            className={`text-xs truncate block font-bold ${
                              isOut ? 'text-rose-400 line-through' : 'text-[var(--color-text)]'
                            }`}
                            title={isReEntered ? `${player?.name} (re-entry x${reEntryCount})` : player?.name}
                          >
                            {player?.name}
                          </span>
                        </div>

                        {/* Explicit re-entry badge showing the exact count */}
                        {isReEntered && (
                          <span
                            className={`text-[9px] font-bold leading-tight tracking-tight block mt-0.5 ${
                              isOut ? 'text-rose-400/80 line-through' : 'text-[#ef4444]'
                            }`}
                          >
                            {reEntryCount === 1 ? '(re entry)' : `(re entry #${reEntryCount})`}
                          </span>
                        )}
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
                    No rounds recorded yet.<br />Tap <strong className="text-[var(--color-primary)]">"ENTER SCORE"</strong> below to begin.
                  </td>
                </tr>
              ) : (
                rounds.map((round, rIdx) => {
                  const isRowSelected = selectedRoundIndex === rIdx;
                  const isEdited = Boolean(round.isEdited);

                  return (
                    <tr
                      key={round.roundNumber}
                      onClick={() => setSelectedRoundIndex(isRowSelected ? null : rIdx)}
                      className={`transition-colors cursor-pointer ${
                        isEdited ? 'bg-amber-500/15' : ''
                      } ${
                        isRowSelected ? 'bg-black/5 dark:bg-white/[0.06]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      {seats.map((playerId, colIdx) => {
                        const scoreInfo = round.scores[playerId];
                        const isFirstCol = colIdx === 0;

                        if (!scoreInfo) {
                          return (
                            <td
                              key={playerId}
                              className={`py-1 px-0.5 text-center border-r border-[var(--color-border)] last:border-r-0 text-[var(--color-muted)] font-mono text-xs ${
                                isEdited && isFirstCol ? 'border-l-4 border-l-amber-500' : ''
                              }`}
                            >
                              -
                            </td>
                          );
                        }

                        // Cell content matching blue rounded boxes
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
                            className={`py-1 px-0.5 text-center border-r border-[var(--color-border)] last:border-r-0 align-middle ${
                              isEdited && isFirstCol ? 'border-l-4 border-l-amber-500' : ''
                            }`}
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

            {/* Sticky Total Footer below all round rows */}
            <tfoot className="sticky bottom-0 z-20 bg-[var(--color-card)] border-t-2 border-[var(--color-border)] shadow-[0_-2px_8px_rgba(0,0,0,0.12)]">
              <tr>
                {seats.map(playerId => {
                  const score = latestScores[playerId] ?? 0;
                  const isDealer = currentDealerId === playerId;
                  const isOut = score >= rules.poolLimit;

                  return (
                    <td
                      key={playerId}
                      style={isCompactFit ? { width: `${100 / seats.length}%` } : { minWidth: '60px' }}
                      className={`py-2 px-1 text-center border-r border-[var(--color-border)] last:border-r-0 ${
                        isDealer ? 'bg-[var(--color-primary)]/10' : ''
                      }`}
                    >
                      <div className="text-[10px] uppercase font-sans font-bold text-[var(--color-muted)] tracking-wider">
                        TOTAL
                      </div>
                      <div
                        className={`text-base font-extrabold font-mono leading-tight mt-0.5 ${
                          isOut ? 'text-rose-500 line-through' : 'text-[var(--color-primary)]'
                        }`}
                      >
                        {score}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Selected Round Info Toast */}
      {selectedRoundIndex !== null && rounds[selectedRoundIndex] && (
        <div className="px-4 py-1.5 bg-[var(--color-subtle)] border-t border-[var(--color-border)] text-center text-[11px] text-[var(--color-muted)] shrink-0 flex items-center justify-center gap-2">
          <span>
            Showing Round {selectedRoundIndex + 1} • Dealer was {players[rounds[selectedRoundIndex].dealerPlayerId]?.name || 'Unknown'}
          </span>
          {rounds[selectedRoundIndex].isEdited && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-500 border border-amber-500/30">
              ✏️ Edited
            </span>
          )}
        </div>
      )}

      {/* Bottom Action Pill Buttons matching Screenshot 5 */}
      <div className="p-3 bg-[var(--color-bg)] border-t border-[var(--color-border)] space-y-2 shrink-0">
        <button
          type="button"
          onClick={onOpenScoreInput}
          disabled={Boolean(winnerPlayerId)}
          className="w-full py-3 rounded-full font-bold text-sm bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 text-white shadow transition active:scale-[0.99] tracking-wider"
        >
          ENTER SCORE
        </button>

        <button
          type="button"
          onClick={onOpenEditScore}
          disabled={rounds.length === 0 || isLastRoundEdited}
          className="w-full py-2.5 rounded-full font-semibold text-xs border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-40 transition active:scale-[0.99] tracking-wider"
        >
          EDIT SCORE
        </button>
      </div>
    </div>
  );
};
