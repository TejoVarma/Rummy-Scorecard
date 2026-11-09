import React, { useState, useRef, useMemo } from 'react';
import { GameState, PlayerId, DealSplit } from '../../domain/types';
import { getEligibleForReEntryPlayers, analyzePlayerDrops } from '../../domain/elimination';
import { Confetti } from '../common/Confetti';
import { isAllDropRound, roundWinnerId } from '../../domain/roundSummary';
import { Trophy, UserPlus, Handshake } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../../hooks/useBackButton';
import { PoolShareModal } from './PoolShareModal';
import { ScoreTable } from './ScoreTable';
import { ScoreboardHeader } from './ScoreboardHeader';
import { ScoreboardActions } from './ScoreboardActions';
import { ShareMenu, ShareKind } from './ShareMenu';
import {
  buildScorecardText,
  captureElement,
  isShareCancelled,
  scorecardFileName,
  shareImage,
  shareText,
} from '../../services/share';

interface ScoreboardScreenProps {
  state: GameState;
  onBack: () => void;
  onOpenScoreInput: () => void;
  onOpenEditScore: () => void;
  onOpenSettings: () => void;
  onAnnounceScores: () => void;
  onPromptReEntry: (playerId: PlayerId) => void;
  onDeleteGame: () => void;
  onAcceptDeal: (dealSplit: DealSplit) => void;
}

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({
  state,
  onBack,
  onOpenScoreInput,
  onOpenEditScore,
  onOpenSettings,
  onAnnounceScores,
  onPromptReEntry,
  onDeleteGame,
  onAcceptDeal,
}) => {
  const { title, rules, seats, players, rounds, currentDealerIndex, winnerPlayerId, dealSplit } = state;
  const currentDealerId = seats[currentDealerIndex];
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number | null>(null);
  // Celebrate a win that happens while this screen is open, not one from an earlier visit.
  const [winnerWhenOpened] = useState(winnerPlayerId);
  const justWon = Boolean(winnerPlayerId) && winnerPlayerId !== winnerWhenOpened;
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [sharingAs, setSharingAs] = useState<ShareKind | null>(null);
  const scoreTableScrollRef = useRef<HTMLDivElement>(null);
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
          rules.middleDrop
        ),
      ])
    );
  }, [seats, latestScores, rules]);

  // Identify if match has been settled by pool deal
  const isDealSettled = Boolean(dealSplit);

  // Eligible for re-entry: only players who got eliminated in the most recent round if deal is not settled
  const eligibleReEntryPlayers = getEligibleForReEntryPlayers(rounds, seats, rules, isDealSettled);

  // Pool Stake & Total Amount calculation
  const entryAmount = rules.entryAmount ?? 0;
  const totalReEntries = seats.reduce((sum, id) => sum + (players[id]?.reEntryCount ?? 0), 0);
  const totalPoolAmount = entryAmount * (seats.length + totalReEntries);

  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const isLastRoundEdited = Boolean(lastRound?.isEdited);
  const [dismissedRoundToast, setDismissedRoundToast] = useState<number | null>(null);

  const allDropRoundIndices = useMemo(
    () => new Set(rounds.flatMap((round, i) => (isAllDropRound(round) ? [i] : []))),
    [rounds]
  );

  const lastRoundWinnerId = lastRound ? roundWinnerId(lastRound) : null;

  const handleShare = async (kind: ShareKind) => {
    if (sharingAs) return;
    setSharingAs(kind);
    const shareTitle = `${title.replace(/[\r\n]+/g, ' ').trim()} Scorecard`;
    try {
      if (kind === 'text') {
        await shareText(shareTitle, buildScorecardText(state));
      } else {
        if (!scorecardCaptureRef.current) throw new Error('Scoreboard is not on screen');
        const blob = await captureElement(scorecardCaptureRef.current, scoreTableScrollRef.current);
        await shareImage(blob, scorecardFileName(state), shareTitle);
      }
      setIsShareMenuOpen(false);
    } catch (err) {
      if (!isShareCancelled(err)) {
        console.error(`Sharing the scorecard as ${kind} failed`, err);
        alert(
          kind === 'image'
            ? "Couldn't create the scorecard image. Try Share as Text instead."
            : "Couldn't share the scorecard. Please try again."
        );
      }
    } finally {
      setSharingAs(null);
    }
  };

  // Determine if columns can fit 100% on screen without horizontal scroll
  const isCompactFit = seats.length <= 6;

  return (
    <div className="flex flex-col h-screen w-full max-w-2xl mx-auto overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] font-sans select-none transition-colors duration-200">
      <ScoreboardHeader
        title={title}
        canAnnounce={rounds.length > 0}
        onBack={onBack}
        onAnnounce={onAnnounceScores}
        onShare={() => setIsShareMenuOpen(true)}
        onOpenSettings={onOpenSettings}
        onDelete={onDeleteGame}
      />

      {/* Re-Entry Action Banner - only for players eliminated in the most recent round if no deal settled the match */}
      {eligibleReEntryPlayers.length > 0 && rules.allowReEntry && !isDealSettled && (
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
                {rounds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsPoolShareOpen(true)}
                    className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 hover:bg-amber-300 transition shadow-xs flex items-center gap-1 active:scale-95"
                  >
                    <Handshake className="w-3 h-3" /> Deal
                  </button>
                )}
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
            {justWon && <Confetti />}
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

        <ScoreTable
          ref={scoreTableScrollRef}
          seats={seats}
          players={players}
          rounds={rounds}
          rules={rules}
          latestScores={latestScores}
          currentDealerId={currentDealerId}
          dropAnalysisMap={dropAnalysisMap}
          allDropRoundIndices={allDropRoundIndices}
          selectedRoundIndex={selectedRoundIndex}
          onSelectRound={setSelectedRoundIndex}
          isCompactFit={isCompactFit}
        />
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

      <ScoreboardActions
        dealSplit={dealSplit}
        hasWinner={Boolean(winnerPlayerId)}
        hasRounds={rounds.length > 0}
        isLastRoundEdited={isLastRoundEdited}
        onEnterScore={onOpenScoreInput}
        onEditScore={onOpenEditScore}
        onOpenDeal={() => setIsPoolShareOpen(true)}
      />

      <ShareMenu
        isOpen={isShareMenuOpen}
        sharingAs={sharingAs}
        onClose={() => setIsShareMenuOpen(false)}
        onShare={handleShare}
      />

      {isPoolShareOpen && (
        <PoolShareModal
          isOpen={isPoolShareOpen}
          onClose={() => setIsPoolShareOpen(false)}
          state={state}
          onAcceptDeal={onAcceptDeal}
        />
      )}
    </div>
  );
};
