import React, { useState, useRef, useMemo } from 'react';
import { GameState, PlayerId, DealSplit } from '../../domain/types';
import { getEligibleForReEntryPlayers, analyzePlayerDrops } from '../../domain/elimination';
import { Confetti } from '../common/Confetti';
import { Settings, Trophy, Share2, Trash2, ArrowLeft, UserPlus, Loader2, Handshake } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../../hooks/useBackButton';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { PoolShareModal } from './PoolShareModal';

interface ScoreboardScreenProps {
  state: GameState;
  onBack: () => void;
  onOpenScoreInput: () => void;
  onOpenEditScore: () => void;
  onOpenSettings: () => void;
  onPromptReEntry: (playerId: PlayerId) => void;
  onDeleteGame: () => void;
  onAcceptDeal: (dealSplit: DealSplit) => void;
  onCancelDeal: () => void;
}

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({
  state,
  onBack,
  onOpenScoreInput,
  onOpenEditScore,
  onOpenSettings,
  onPromptReEntry,
  onDeleteGame,
  onAcceptDeal,
  onCancelDeal,
}) => {
  const { title, rules, seats, players, rounds, currentDealerIndex, winnerPlayerId, dealSplit } = state;
  const currentDealerId = seats[currentDealerIndex];
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number | null>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [isPoolShareOpen, setIsPoolShareOpen] = useState(false);
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

  // Memoized drop analysis for each seat (avoids recalculating in header and footer)
  const dropAnalysisMap = useMemo(() => {
    return Object.fromEntries(
      seats.map(id => [
        id,
        analyzePlayerDrops(
          latestScores[id] ?? 0,
          rules.poolLimit,
          rules.openDrop,
          rules.middleDrop,
          rules.fullCount
        ),
      ])
    );
  }, [seats, latestScores, rules]);

  // Eligible for re-entry: only players who got eliminated in the most recent round
  const eligibleReEntryPlayers = getEligibleForReEntryPlayers(rounds, seats, rules);

  // Pool Stake & Total Amount calculation
  const entryAmount = rules.entryAmount ?? 0;
  const totalReEntries = seats.reduce((sum, id) => sum + (players[id]?.reEntryCount ?? 0), 0);
  const totalPoolAmount = entryAmount * (seats.length + totalReEntries);

  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const isLastRoundEdited = Boolean(lastRound?.isEdited);
  const [dismissedRoundToast, setDismissedRoundToast] = useState<number | null>(null);

  // Precompute All-Drop rounds for O(1) cell coloring
  const allDropRoundIndices = useMemo(() => {
    const indices = new Set<number>();
    rounds.forEach((round, rIdx) => {
      const scoreEntries = Object.entries(round.scores);
      if (scoreEntries.length <= 1) return;
      let showCount = 0;
      let dropCount = 0;
      let isAllDrop = true;
      for (const [, info] of scoreEntries) {
        if (info.type === 'show' || info.points === 0) {
          showCount++;
        } else if (info.type === 'open_drop') {
          dropCount++;
        } else {
          isAllDrop = false;
          break;
        }
      }
      if (isAllDrop && showCount === 1 && dropCount > 0) {
        indices.add(rIdx);
      }
    });
    return indices;
  }, [rounds]);

  // Identify winner of the last completed round for congrats toast
  const lastRoundWinnerId = useMemo(() => {
    if (!lastRound) return null;
    for (const [pId, scoreInfo] of Object.entries(lastRound.scores)) {
      if (scoreInfo.type === 'show' || scoreInfo.points === 0) {
        return pId;
      }
    }
    return null;
  }, [lastRound]);

  // Generate and share or download image of current scoreboard matrix
  const handleShareScorecard = async () => {
    if (!scorecardCaptureRef.current || isSharingImage) return;
    setIsSharingImage(true);

    const safeShareTitle = title.replace(/[\r\n]/g, ' ').trim();
    const poolInfo = entryAmount > 0 ? ` | Prize Pool: ₹${totalPoolAmount}` : '';
    const dealText = dealSplit
      ? `\n🤝 *Match Settled by Deal:*\n` +
        Object.entries(dealSplit.payouts)
          .map(([id, amt]) => `• ${players[id]?.name || 'Player'}: ₹${amt}`)
          .join('\n') +
        '\n'
      : '';
    const summary =
      `🎴 *Rummy Scorecard: ${safeShareTitle}*\nPool: ${rules.poolLimit}${poolInfo} | Rounds: ${rounds.length}\n${dealText}\n` +
      seats
        .map(id => {
          const score = latestScores[id] ?? 0;
          const pName = players[id]?.name || 'Player';
          const isOut = score >= rules.poolLimit;
          return `${pName}: ${score} pts${isOut ? ' (Out)' : ''}`;
        })
        .join('\n');

    try {
      // 1. Native Android / iOS app sharing via Capacitor Share plugin
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: `${safeShareTitle} Scorecard`,
          text: summary,
          dialogTitle: 'Share Rummy Scorecard',
        });
        return;
      }

      // 2. Web browser: generate image screenshot and share/download
      const { toBlob } = await import('html-to-image');
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
          title: `${safeShareTitle} Scorecard`,
          text: `Rummy Scorecard: ${safeShareTitle} (Pool ${rules.poolLimit})`,
          files: [file],
        });
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        // Fallback for mobile browsers when file sharing is unavailable
        await navigator.share({ title: `${safeShareTitle} Scorecard`, text: summary });
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
        try {
          if (Capacitor.isNativePlatform()) {
            await Share.share({
              title: `${safeShareTitle} Scorecard`,
              text: summary,
              dialogTitle: 'Share Rummy Scorecard',
            });
          } else if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share({ title: `${safeShareTitle} Scorecard`, text: summary });
          } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(summary);
            alert('Scorecard text copied to clipboard!');
          }
        } catch (shareErr: any) {
          if (shareErr?.name !== 'AbortError') {
            console.warn('Text share fallback failed:', shareErr);
          }
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

        {/* Subheader info block matching Screenshot 1 & 2 */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-[#0078d4] via-[#0284c7] to-[#1e40af] text-white border-b border-black/10 text-xs shadow-inner shrink-0">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-white/90">Game Score: <strong className="text-white font-mono font-bold text-sm">{rules.poolLimit}</strong></span>
            <span className="text-white/90">Open drop: <strong className="text-white font-mono font-bold text-sm">{rules.openDrop}</strong></span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-white/90">Middle drop: <strong className="text-white font-mono font-bold text-sm">{rules.middleDrop}</strong></span>
            <span className="text-white/90">Full count: <strong className="text-white font-mono font-bold text-sm">{rules.fullCount}</strong></span>
          </div>

          {/* Pool Stake & Total Amount */}
          {entryAmount > 0 && (
            <div className="flex justify-between items-center py-1 border-t border-white/20 mt-1">
              <span className="text-white/90">Stake: <strong className="text-white font-mono">₹{entryAmount}</strong></span>
              <span className="flex items-center gap-1">
                <span className="text-white/90">Total Pool:</span>
                <strong className="text-emerald-300 font-mono font-bold text-sm">₹{totalPoolAmount}</strong>
                {totalReEntries > 0 && (
                  <span className="text-[10px] text-amber-300 font-semibold font-mono">
                    (+{totalReEntries * entryAmount})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsPoolShareOpen(true)}
                  className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 hover:bg-amber-300 transition shadow-xs flex items-center gap-1 active:scale-95"
                >
                  <Handshake className="w-3 h-3" /> Deal
                </button>
              </span>
            </div>
          )}

          <div className="text-center pt-1 font-semibold text-white text-xs sm:text-sm tracking-wide">
            Rounds Completed: <span className="font-mono text-yellow-300 font-extrabold text-sm sm:text-base">{rounds.length}</span>
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

        {/* Deal Settled Banner */}
        {dealSplit && (
          <div className="shrink-0 mx-3 my-2 p-2.5 rounded-lg bg-[#064e3b] border border-[#059669] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
                  Match Settled by Deal
                </span>
                <span className="text-xs font-bold text-white block">
                  {Object.entries(dealSplit.payouts)
                    .map(([id, amt]) => `${players[id]?.name || 'Player'}: ₹${amt}`)
                    .join('  •  ')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPoolShareOpen(true)}
              className="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-700 hover:bg-emerald-600 text-white shrink-0 shadow-sm transition active:scale-95"
            >
              Details
            </button>
          </div>
        )}

        {/* Score Matrix Table - NO horizontal scroll for <= 6 players */}
        <div className={`flex-1 ${isCompactFit ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'} relative bg-[var(--color-bg)]`}>
          <table className={`w-full border-collapse ${isCompactFit ? 'table-fixed' : 'min-w-max'}`}>
            {/* Sticky Player Headers */}
            <thead className="sticky top-0 z-30 bg-[#1f2937] dark:bg-[#18181b] text-white border-b border-[var(--color-border)] shadow-sm">
              <tr>
                {seats.map(playerId => {
                  const player = players[playerId];
                  const score = latestScores[playerId] ?? 0;
                  const isDealer = currentDealerId === playerId;
                  const isOut = score >= rules.poolLimit;
                  const dropAnalysis = dropAnalysisMap[playerId];
                  const dropStatus = dropAnalysis?.status ?? 'safe';
                  const reEntryCount = player?.reEntryCount ?? 0;
                  const isReEntered = reEntryCount > 0;

                  const nameColorClass = isOut
                    ? 'text-rose-400/80 line-through'
                    : dropStatus === 'compulsory'
                    ? 'text-rose-500 font-extrabold'
                    : dropStatus === 'one_drop'
                    ? 'text-yellow-400 font-extrabold'
                    : 'text-white font-bold';

                  const oneDropLabel = dropAnalysis.canMiddleDrop ? '1 DROP' : '1 DROP (NO MD)';

                  return (
                    <th
                      key={playerId}
                      style={isCompactFit ? { width: `${100 / seats.length}%` } : { minWidth: '60px' }}
                      className={`py-2 px-1 text-center font-normal border-r border-[var(--color-border)] last:border-r-0 ${
                        isDealer ? 'bg-[var(--color-primary)]/15' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center min-h-[30px]">
                        {/* Player Name with dealer asterisk * matching screenshots */}
                        <div className="flex items-center justify-center gap-0.5 max-w-full">
                          <span
                            className={`text-xs truncate block ${nameColorClass}`}
                            title={isReEntered ? `${player?.name} (re-entry x${reEntryCount})` : player?.name}
                          >
                            {isDealer ? `*${player?.name}` : player?.name}
                          </span>
                        </div>

                        {/* Drop Warning / Compulsory Pill */}
                        {!isOut && dropStatus === 'compulsory' && (
                          <span className="text-[8px] sm:text-[9px] font-extrabold leading-tight tracking-tight text-rose-500 block uppercase mt-0.5">
                            COMPULSORY
                          </span>
                        )}
                        {!isOut && dropStatus === 'one_drop' && (
                          <span className="text-[8px] sm:text-[9px] font-extrabold leading-tight tracking-tight text-yellow-400 block uppercase mt-0.5">
                            {oneDropLabel}
                          </span>
                        )}

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

            {/* Table Body (Rounds + Next Grid Total Row) */}
            <tbody className="divide-y divide-[var(--color-border)]">
              {rounds.length === 0 ? (
                <tr>
                  <td colSpan={seats.length} className="py-20 text-center text-xs text-[var(--color-muted)]">
                    No rounds recorded yet.<br />Tap <strong className="text-[var(--color-primary)]">"ENTER SCORE"</strong> below to begin.
                  </td>
                </tr>
              ) : (
                <>
                  {rounds.map((round, rIdx) => {
                    const isRowSelected = selectedRoundIndex === rIdx;
                    const isEdited = Boolean(round.isEdited);

                    // O(1) All Drop round check from precomputed memoized set
                    const isAllDropRound = allDropRoundIndices.has(rIdx);
                    const cellBgClass = isAllDropRound ? 'bg-[#15803d]' : 'bg-[#0078d4]';

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
                                className={`py-1 px-0.5 text-center border-b border-[var(--color-border)] border-r border-[var(--color-border)] last:border-r-0 text-[var(--color-muted)] font-mono text-xs ${
                                  isEdited && isFirstCol ? 'border-l-4 border-l-amber-500' : ''
                                }`}
                              >
                                -
                              </td>
                            );
                          }

                          // Cell content matching blue or green rounded boxes
                          const renderScoreCell = () => {
                            switch (scoreInfo.type) {
                              case 'show':
                                return (
                                  <div className={`w-full max-w-[48px] mx-auto py-1.5 rounded-lg ${cellBgClass} text-[#facc15] font-bold text-sm text-center shadow-sm`}>
                                    R
                                  </div>
                                );
                              case 'open_drop':
                                return (
                                  <div className={`w-full max-w-[48px] mx-auto py-1.5 rounded-lg ${cellBgClass} text-white font-bold text-sm text-center shadow-sm`}>
                                    D
                                  </div>
                                );
                              case 'middle_drop':
                                return (
                                  <div className={`w-full max-w-[48px] mx-auto py-1.5 rounded-lg ${cellBgClass} text-white font-bold text-sm text-center shadow-sm`}>
                                    MD
                                  </div>
                                );
                              case 'full_count':
                                return (
                                  <div className={`w-full max-w-[48px] mx-auto py-1.5 rounded-lg ${cellBgClass} text-white font-bold text-sm text-center shadow-sm`}>
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
                                    <div className={`w-full max-w-[48px] mx-auto py-1 rounded-lg ${cellBgClass} text-center shadow-sm flex items-center justify-center gap-0.5`}>
                                      <span className="text-[#ef4444] font-extrabold text-xs">RE</span>
                                      <span className="text-[#4ade80] font-mono font-bold text-[10px] align-sub">
                                        {scoreInfo.points}
                                      </span>
                                    </div>
                                  );
                                }
                                return (
                                  <div className={`w-full max-w-[48px] mx-auto py-1.5 rounded-lg ${cellBgClass} text-white font-bold text-sm text-center shadow-sm font-mono`}>
                                    {scoreInfo.points}
                                  </div>
                                );
                              }
                            }
                          };

                          return (
                            <td
                              key={playerId}
                              className={`py-1 px-0.5 text-center border-b border-[var(--color-border)] border-r border-[var(--color-border)] last:border-r-0 align-middle ${
                                isEdited && isFirstCol ? 'border-l-4 border-l-amber-500' : ''
                              }`}
                            >
                              {renderScoreCell()}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Total Score Grid Row - clean, elegant dark tile matching the grid seamlessly */}
                  <tr className="bg-black/[0.03] dark:bg-white/[0.02]">
                    {seats.map(playerId => {
                      const score = latestScores[playerId] ?? 0;
                      const isDealer = currentDealerId === playerId;
                      const isOut = score >= rules.poolLimit;
                      const dropAnalysis = dropAnalysisMap[playerId];
                      const dropStatus = dropAnalysis?.status ?? 'safe';

                      const totalColorClass = isOut
                        ? 'text-rose-400/70 line-through'
                        : dropStatus === 'compulsory'
                        ? 'text-rose-400 font-bold'
                        : dropStatus === 'one_drop'
                        ? 'text-yellow-400 font-bold'
                        : 'text-white font-bold';

                      return (
                        <td
                          key={playerId}
                          className={`py-1 px-0.5 text-center border-b border-[var(--color-border)] border-r border-[var(--color-border)] last:border-r-0 align-middle ${
                            isDealer ? 'bg-[var(--color-primary)]/10' : ''
                          }`}
                        >
                          <div
                            className={`w-full max-w-[48px] mx-auto py-1.5 rounded-lg bg-[#1e293b] dark:bg-[#18181b] text-center font-mono text-sm shadow-sm ${totalColorClass}`}
                          >
                            {score}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </>
              )}
            </tbody>
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

      {/* Round Winner Toast matching Screenshot 2 */}
      {lastRoundWinnerId && !winnerPlayerId && dismissedRoundToast !== rounds[rounds.length - 1]?.roundNumber && (
        <div className="mx-3 my-1.5 px-3 py-2 rounded-lg bg-[#0284c7] text-white flex items-center justify-between shadow-md shrink-0">
          <span className="font-semibold text-xs text-white truncate mr-2">
            Congrats {players[lastRoundWinnerId]?.name}
          </span>
          <button
            type="button"
            onClick={() => setDismissedRoundToast(rounds[rounds.length - 1]?.roundNumber)}
            className="text-[11px] font-bold px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 tracking-wider uppercase text-cyan-100 transition active:scale-95 shrink-0"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Bottom Action Pill Buttons matching Screenshot 5 */}
      <div className="p-3 bg-[var(--color-bg)] border-t border-[var(--color-border)] space-y-2 shrink-0">
        {dealSplit ? (
          <button
            type="button"
            onClick={() => setIsPoolShareOpen(true)}
            className="w-full py-3 rounded-full font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow transition active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Handshake className="w-4 h-4" /> View Prize Pool Settlement (₹{dealSplit.totalPool})
          </button>
        ) : (
          <>
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

            {rounds.length > 0 && !winnerPlayerId && (
              <button
                type="button"
                onClick={() => setIsPoolShareOpen(true)}
                className="w-full py-2 rounded-full font-semibold text-xs border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition flex items-center justify-center gap-1.5 active:scale-[0.99] tracking-wider"
              >
                <Handshake className="w-3.5 h-3.5" /> SHARE POOL / MAKE DEAL
              </button>
            )}
          </>
        )}
      </div>

      {isPoolShareOpen && (
        <PoolShareModal
          isOpen={isPoolShareOpen}
          onClose={() => setIsPoolShareOpen(false)}
          state={state}
          onAcceptDeal={onAcceptDeal}
          onCancelDeal={onCancelDeal}
        />
      )}
    </div>
  );
};
