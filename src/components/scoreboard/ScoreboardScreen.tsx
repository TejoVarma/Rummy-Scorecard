import React from 'react';
import { GameState, PlayerId } from '../../domain/types';
import { StatusChip } from '../common/StatusChip';
import { Confetti } from '../common/Confetti';
import { PlusCircle, RotateCcw, Settings, Trophy, Crown, Share2 } from 'lucide-react';

interface ScoreboardScreenProps {
  state: GameState;
  onOpenScoreInput: () => void;
  onUndoRound: () => void;
  onOpenSettings: () => void;
  onPromptReEntry: (playerId: PlayerId) => void;
}

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({
  state,
  onOpenScoreInput,
  onUndoRound,
  onOpenSettings,
  onPromptReEntry,
}) => {
  const { title, rules, seats, players, rounds, currentDealerIndex, winnerPlayerId } = state;
  const currentDealerId = seats[currentDealerIndex];
  const currentDealer = players[currentDealerId];

  // Calculate current cumulative scores
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

  // Check players who are eliminated and eligible for re-entry
  const eliminatedPlayers = seats.filter(
    id => (latestScores[id] ?? 0) >= rules.poolLimit
  );

  const getScoreColor = (score: number) => {
    if (score >= rules.poolLimit) return 'text-rose-500 font-extrabold';
    if (score >= rules.poolLimit - rules.openDrop) return 'text-amber-400 font-bold';
    return 'text-white font-bold';
  };

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
    <div className="flex flex-col h-screen max-w-7xl mx-auto overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div>
          <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
            {title}
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {rules.poolLimit} Pool
            </span>
          </h1>
          <div className="flex items-center gap-2 text-xs opacity-75 mt-0.5">
            <span>Drop: {rules.openDrop}</span>
            <span>•</span>
            <span>MD: {rules.middleDrop}</span>
            <span>•</span>
            <span>Full: {rules.fullCount}</span>
            <span>•</span>
            <span>Rounds: {rounds.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShare}
            title="Share scores"
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
          >
            <Share2 className="w-4 h-4 text-slate-300" />
          </button>
          <button
            onClick={onUndoRound}
            disabled={rounds.length === 0}
            title="Undo last round"
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition"
          >
            <RotateCcw className="w-4 h-4 text-slate-300" />
          </button>
          <button
            onClick={onOpenSettings}
            title="Settings & Themes"
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
          >
            <Settings className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Current Dealer & Seating Banner */}
      <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium">
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            <Crown className="w-3.5 h-3.5" /> Next Distributor:
          </span>
          <span className="font-bold underline decoration-amber-400 underline-offset-2">
            {currentDealer?.name ?? 'Dealer'}
          </span>
        </div>
        <span className="text-[11px] opacity-75">Clockwise Turn Order</span>
      </div>

      {/* Winner Banner (if game completed) */}
      {winnerPlayerId && (
        <>
          <Confetti />
          <div className="mx-4 my-2 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/40 via-amber-600/30 to-emerald-600/40 border border-emerald-400/60 shadow-lg shadow-emerald-500/20 flex items-center justify-between animate-in zoom-in-95 duration-500">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400 animate-bounce drop-shadow" />
              <div>
                <div className="font-extrabold text-sm text-emerald-300 tracking-wide uppercase">Winner Declared!</div>
                <div className="text-xs font-semibold text-white/90">
                  {players[winnerPlayerId]?.name} has won the match!
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Re-Entry Prompt Banner */}
      {eliminatedPlayers.length > 0 && rules.allowReEntry && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-blue-300 font-semibold">
            {eliminatedPlayers.map(id => players[id]?.name).join(', ')} crossed {rules.poolLimit}!
          </span>
          <div className="flex gap-1.5">
            {eliminatedPlayers.map(id => (
              <button
                key={id}
                onClick={() => onPromptReEntry(id)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white shadow hover:bg-blue-500 transition"
              >
                Re-Enter {players[id]?.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Dual-Axis Score Matrix */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse text-left min-w-max">
          {/* Sticky Player Headers */}
          <thead className="sticky top-0 z-30 bg-black/80 backdrop-blur-md shadow-md border-b border-white/10">
            <tr>
              {/* Sticky Corner (Round header) */}
              <th className="sticky left-0 z-40 bg-black/90 p-3 w-16 text-center border-r border-white/10 font-mono text-xs font-bold text-slate-400">
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
                    className={`p-3 min-w-[120px] max-w-[150px] border-r border-white/10 transition-colors ${
                      isDealer ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center text-center space-y-1">
                      {/* Avatar & Dealer Crown */}
                      <div className="relative">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow border border-white/20"
                          style={{ backgroundColor: player?.avatarColor || '#3b82f6' }}
                        >
                          {player?.name?.[0]?.toUpperCase()}
                        </div>
                        {isDealer && (
                          <div className="absolute -top-2 -right-2 bg-gradient-to-tr from-amber-500 to-amber-300 text-black p-1 rounded-full shadow-lg shadow-amber-500/50 animate-pulse ring-2 ring-amber-300">
                            <Crown className="w-3 h-3 fill-current" />
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <span className="font-bold text-xs tracking-tight truncate max-w-[110px]">
                        {player?.name}
                      </span>

                      {/* Status / Re-entry tag */}
                      {player?.reEntryCount > 0 && !isOut && (
                        <StatusChip label="RE" variant="re_entered" subLabel={String(player.reEntryScore)} />
                      )}
                      {isOut && <StatusChip label="OUT" variant="out" />}

                      {/* Cumulative Score */}
                      <div className={`text-base tracking-tight font-mono ${getScoreColor(score)}`}>
                        {score}
                      </div>

                      {/* Rank badge */}
                      {!isOut && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 opacity-70">
                          #{ranks[playerId]}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body (Rounds) */}
          <tbody className="divide-y divide-white/5">
            {rounds.length === 0 ? (
              <tr>
                <td colSpan={seats.length + 1} className="py-16 text-center text-sm opacity-50">
                  No rounds recorded yet. Tap "Enter Round Scores" below to begin!
                </td>
              </tr>
            ) : (
              rounds.map(round => {
                const roundDealer = players[round.dealerPlayerId];

                return (
                  <tr key={round.roundNumber} className="hover:bg-white/5 transition-colors">
                    {/* Sticky Round Col */}
                    <td className="sticky left-0 z-20 bg-black/80 backdrop-blur-sm p-3 text-center border-r border-white/10 font-mono text-xs font-bold text-slate-300">
                      <div>R{round.roundNumber}</div>
                      <div className="text-[9px] text-amber-400 font-sans truncate max-w-[50px] mx-auto opacity-75">
                        🎴 {roundDealer?.name}
                      </div>
                    </td>

                    {/* Scores for each player */}
                    {seats.map(playerId => {
                      const scoreInfo = round.scores[playerId];
                      if (!scoreInfo) {
                        return (
                          <td key={playerId} className="p-3 text-center border-r border-white/5 opacity-30 font-mono">
                            -
                          </td>
                        );
                      }

                      const renderCellBadge = () => {
                        switch (scoreInfo.type) {
                          case 'show':
                            return (
                              <span className="px-2 py-1 rounded font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                0 (Show)
                              </span>
                            );
                          case 'open_drop':
                            return (
                              <span className="px-2 py-1 rounded font-bold text-xs bg-orange-500/20 text-orange-300 border border-orange-500/40">
                                {scoreInfo.points} (D)
                              </span>
                            );
                          case 'middle_drop':
                            return (
                              <span className="px-2 py-1 rounded font-bold text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                                {scoreInfo.points} (MD)
                              </span>
                            );
                          case 'full_count':
                            return (
                              <span className="px-2 py-1 rounded font-bold text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                {scoreInfo.points} (FC)
                              </span>
                            );
                          case 'out':
                            return (
                              <span className="px-2 py-1 rounded font-bold text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                X (Out)
                              </span>
                            );
                          default:
                            return (
                              <span className="font-mono font-bold text-sm text-slate-200">
                                {scoreInfo.points}
                              </span>
                            );
                        }
                      };

                      return (
                        <td key={playerId} className="p-3 text-center border-r border-white/5">
                          {renderCellBadge()}
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

      {/* Bottom Floating Bar */}
      <div className="p-3 border-t border-white/10 bg-black/60 backdrop-blur-md flex gap-3">
        <button
          onClick={onOpenScoreInput}
          className="flex-1 py-3.5 px-4 rounded-xl font-extrabold text-sm sm:text-base bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-5 h-5 fill-current" /> ENTER ROUND SCORES
        </button>
      </div>
    </div>
  );
};
