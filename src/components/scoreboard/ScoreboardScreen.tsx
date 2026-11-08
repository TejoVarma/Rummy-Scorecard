import React from 'react';
import { GameState, PlayerId } from '../../domain/types';
import { StatusChip } from '../common/StatusChip';
import { Confetti } from '../common/Confetti';
import { PlusCircle, RotateCcw, Settings, Trophy, Crown, Share2, Trash2 } from 'lucide-react';

interface ScoreboardScreenProps {
  state: GameState;
  onOpenScoreInput: () => void;
  onUndoRound: () => void;
  onOpenSettings: () => void;
  onPromptReEntry: (playerId: PlayerId) => void;
  onDeleteGame: () => void;
}

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({
  state,
  onOpenScoreInput,
  onUndoRound,
  onOpenSettings,
  onPromptReEntry,
  onDeleteGame,
}) => {
  const { title, rules, seats, players, rounds, currentDealerIndex, winnerPlayerId } = state;
  const currentDealerId = seats[currentDealerIndex];
  const currentDealer = players[currentDealerId];

  // Calculate latest cumulative scores
  const latestScores: Record<PlayerId, number> =
    rounds.length > 0
      ? rounds[rounds.length - 1].cumulativeScores
      : Object.fromEntries(seats.map(id => [id, 0]));

  // Sort players by score to determine ranks
  const sortedByScore = [...seats].sort((a, b) => (latestScores[a] ?? 0) - (latestScores[b] ?? 0));
  const ranks: Record<PlayerId, number> = {};
  sortedByScore.forEach((id, idx) => {
    ranks[id] = idx + 1;
  });

  // Check players who are eliminated
  const eliminatedPlayers = seats.filter(
    id => (latestScores[id] ?? 0) >= rules.poolLimit
  );

  const handleShare = () => {
    if (navigator.share) {
      const summary = `🎴 *Rummy Match: ${title}*\nPool: ${rules.poolLimit} | Rounds: ${rounds.length}\n` +
        seats.map(id => `${players[id]?.name}: ${latestScores[id] ?? 0} pts`).join('\n');
      navigator.share({ title: 'Rummy Scorecard', text: summary }).catch(() => {});
    } else {
      alert('Scorecard copied to clipboard!');
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-7xl mx-auto overflow-hidden bg-[#121214] text-[#f4f4f5]">
      {/* Top App Bar (Clean solid blue matching original app) */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0284c7] text-white shadow-sm">
        <div>
          <h1 className="font-bold text-base tracking-tight flex items-center gap-2">
            {title}
            <span className="text-xs px-2 py-0.5 rounded bg-black/20 font-mono">
              {rules.poolLimit}
            </span>
          </h1>
          <div className="flex items-center gap-2 text-xs opacity-90 mt-0.5 font-normal">
            <span>Drop: {rules.openDrop}</span>
            <span>•</span>
            <span>MD: {rules.middleDrop}</span>
            <span>•</span>
            <span>Full: {rules.fullCount}</span>
            <span>•</span>
            <span>Rounds: {rounds.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            title="Share scores"
            className="p-2 rounded-lg hover:bg-black/10 active:bg-black/20 transition"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={onUndoRound}
            disabled={rounds.length === 0}
            title="Undo last round"
            className="p-2 rounded-lg hover:bg-black/10 active:bg-black/20 disabled:opacity-30 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            title="Settings & Themes"
            className="p-2 rounded-lg hover:bg-black/10 active:bg-black/20 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this game permanently?')) {
                onDeleteGame();
              }
            }}
            title="Delete Game"
            className="p-2 rounded-lg hover:bg-rose-600/30 text-rose-100 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Current Dealer & Seating Bar (Subtle and clean) */}
      <div className="px-4 py-2 bg-[#1a1a20] border-b border-[#2a2a34] flex items-center justify-between text-xs text-[#a1a1aa]">
        <div className="flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>Distributor:</span>
          <span className="font-semibold text-white">
            {currentDealer?.name ?? 'Dealer'}
          </span>
        </div>
        <span className="text-[11px] opacity-75">Clockwise Turn Order</span>
      </div>

      {/* Winner Banner */}
      {winnerPlayerId && (
        <>
          <Confetti />
          <div className="mx-4 my-2 p-3 rounded-lg bg-[#064e3b] border border-[#059669] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-amber-400" />
              <div>
                <div className="font-bold text-xs text-emerald-300">WINNER DECLARED</div>
                <div className="text-sm font-semibold text-white">
                  {players[winnerPlayerId]?.name} won the match!
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Re-Entry Prompt Banner */}
      {eliminatedPlayers.length > 0 && rules.allowReEntry && (
        <div className="px-4 py-2 bg-[#1e293b] border-b border-[#334155] flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-300">
            {eliminatedPlayers.map(id => players[id]?.name).join(', ')} crossed {rules.poolLimit}!
          </span>
          <div className="flex gap-1.5">
            {eliminatedPlayers.map(id => (
              <button
                key={id}
                onClick={() => onPromptReEntry(id)}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-[#0284c7] hover:bg-[#0369a1] text-white transition"
              >
                Re-Enter {players[id]?.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dual-Axis Score Matrix */}
      <div className="flex-1 overflow-auto relative bg-[#121214]">
        <table className="w-full border-collapse text-left min-w-max">
          {/* Sticky Player Headers */}
          <thead className="sticky top-0 z-30 bg-[#1e1e24] shadow-sm border-b border-[#2e2e38]">
            <tr>
              {/* Sticky Round Header */}
              <th className="sticky left-0 z-40 bg-[#1e1e24] p-3 w-16 text-center border-r border-[#2e2e38] font-mono text-xs font-semibold text-[#a1a1aa]">
                RND
              </th>

              {/* Player Columns */}
              {seats.map((playerId, idx) => {
                const player = players[playerId];
                const score = latestScores[playerId] ?? 0;
                const isDealer = currentDealerIndex === idx;
                const isOut = score >= rules.poolLimit;

                return (
                  <th
                    key={playerId}
                    className={`p-2.5 min-w-[105px] max-w-[130px] border-r border-[#2e2e38] ${
                      isDealer ? 'bg-[#0284c7]/10' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center text-center space-y-1">
                      {/* Name & Dealer Indicator */}
                      <div className="flex items-center gap-1 font-semibold text-xs tracking-tight truncate max-w-[100px]">
                        {isDealer && <Crown className="w-3 h-3 text-[#38bdf8] shrink-0" />}
                        <span className={isDealer ? 'text-[#38bdf8]' : 'text-white'}>
                          {player?.name}
                        </span>
                      </div>

                      {/* Cumulative Score */}
                      <div className={`text-base font-mono font-bold ${
                        isOut ? 'text-rose-400' : score >= rules.poolLimit - rules.openDrop ? 'text-amber-300' : 'text-white'
                      }`}>
                        {score}
                      </div>

                      {/* Status / Re-entry tag / Rank */}
                      <div className="flex items-center gap-1">
                        {player?.reEntryCount > 0 && !isOut && (
                          <StatusChip label="RE" variant="re_entered" subLabel={String(player.reEntryScore)} />
                        )}
                        {isOut && <StatusChip label="OUT" variant="out" />}
                        {!isOut && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20 text-[#a1a1aa]">
                            #{ranks[playerId]}
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body (Rounds) */}
          <tbody className="divide-y divide-[#23232c]">
            {rounds.length === 0 ? (
              <tr>
                <td colSpan={seats.length + 1} className="py-16 text-center text-xs text-[#71717a]">
                  No rounds recorded yet. Tap "ENTER SCORE" below to begin.
                </td>
              </tr>
            ) : (
              rounds.map(round => {
                const roundDealer = players[round.dealerPlayerId];

                return (
                  <tr key={round.roundNumber} className="hover:bg-white/[0.02] transition-colors">
                    {/* Sticky Round Col */}
                    <td className="sticky left-0 z-20 bg-[#18181e] p-2.5 text-center border-r border-[#2e2e38] font-mono text-xs text-[#a1a1aa]">
                      <div>{round.roundNumber}</div>
                      <div className="text-[9px] text-[#38bdf8] truncate max-w-[45px] mx-auto opacity-80">
                        {roundDealer?.name}
                      </div>
                    </td>

                    {/* Scores for each player - Clean blue boxes matching screenshot */}
                    {seats.map(playerId => {
                      const scoreInfo = round.scores[playerId];
                      if (!scoreInfo) {
                        return (
                          <td key={playerId} className="p-2 text-center border-r border-[#23232c] text-[#52525b] font-mono text-xs">
                            -
                          </td>
                        );
                      }

                      const renderCell = () => {
                        // Cell box matching original app Screenshot 5
                        switch (scoreInfo.type) {
                          case 'show':
                            return (
                              <div className="mx-auto w-12 py-1.5 rounded bg-[#0284c7] text-amber-300 font-bold text-sm text-center shadow-sm">
                                R
                              </div>
                            );
                          case 'open_drop':
                            return (
                              <div className="mx-auto w-12 py-1.5 rounded bg-[#0284c7] text-white font-bold text-sm text-center shadow-sm">
                                D
                              </div>
                            );
                          case 'middle_drop':
                            return (
                              <div className="mx-auto w-12 py-1.5 rounded bg-[#0284c7] text-white font-bold text-sm text-center shadow-sm">
                                MD
                              </div>
                            );
                          case 'full_count':
                            return (
                              <div className="mx-auto w-12 py-1.5 rounded bg-[#0284c7] text-white font-bold text-sm text-center shadow-sm">
                                FC
                              </div>
                            );
                          case 'out':
                            return (
                              <div className="mx-auto w-12 py-1.5 rounded bg-[#1e293b] text-slate-400 font-bold text-sm text-center">
                                X
                              </div>
                            );
                          default:
                            return (
                              <div className="mx-auto w-12 py-1.5 rounded bg-[#0284c7] text-white font-bold text-sm text-center shadow-sm">
                                {scoreInfo.points}
                              </div>
                            );
                        }
                      };

                      return (
                        <td key={playerId} className="p-1.5 text-center border-r border-[#23232c]">
                          {renderCell()}
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

      {/* Bottom Action Bar (Simple solid blue button matching screenshot) */}
      <div className="p-3 border-t border-[#2a2a34] bg-[#1a1a20] flex gap-2">
        <button
          onClick={onOpenScoreInput}
          className="w-full py-3 px-4 rounded-lg font-bold text-sm bg-[#0284c7] hover:bg-[#0369a1] text-white shadow transition flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <PlusCircle className="w-4 h-4" /> ENTER SCORE
        </button>
      </div>
    </div>
  );
};
