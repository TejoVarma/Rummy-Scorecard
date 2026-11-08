import React, { useState } from 'react';
import { GameState } from '../../domain/types';
import { ArrowLeft, Play, Trash2, Trophy, Clock, Users, Plus } from 'lucide-react';
import { loadAllSavedGames, deleteGameFromList } from '../../storage/localStorageAdapter';

interface ContinueGameScreenProps {
  onBack: () => void;
  onResumeGame: (game: GameState) => void;
  onStartNewGame: () => void;
}

export const ContinueGameScreen: React.FC<ContinueGameScreenProps> = ({
  onBack,
  onResumeGame,
  onStartNewGame,
}) => {
  const [games, setGames] = useState<GameState[]>(() => loadAllSavedGames());

  const handleDelete = (e: React.MouseEvent, gameId: string, title: string) => {
    e.stopPropagation(); // Don't trigger resume
    if (window.confirm(`Are you sure you want to delete "${title}" permanently?`)) {
      deleteGameFromList(gameId);
      setGames(prev => prev.filter(g => g.gameId !== gameId));
    }
  };

  return (
    <div className="min-h-screen bg-[#111113] text-[#f4f4f5] flex flex-col font-sans select-none">
      {/* Top App Bar matching original app */}
      <div className="px-4 py-3.5 bg-[#00a2ed] text-white shadow flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded hover:bg-black/10 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg tracking-normal">Continue Game</h1>
        </div>

        <button
          type="button"
          onClick={onStartNewGame}
          title="New Match"
          className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md font-medium transition"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {/* Games List Container */}
      <div className="flex-1 max-w-md w-full mx-auto p-4 space-y-3 pb-12 overflow-y-auto">
        {games.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#1e1e24] flex items-center justify-center mx-auto text-zinc-500">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">No Saved Games</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                There are no matches in progress or saved. Tap below to start a new match!
              </p>
            </div>
            <button
              type="button"
              onClick={onStartNewGame}
              className="px-6 py-2.5 rounded-full bg-[#00a2ed] hover:bg-[#008fcf] text-white text-xs font-bold transition shadow"
            >
              Start New Game
            </button>
          </div>
        ) : (
          games.map(game => {
            const isPlaying = game.status === 'playing';
            const winner = game.winnerPlayerId ? game.players[game.winnerPlayerId] : null;
            const playerNames = game.seats.map(id => game.players[id]?.name).filter(Boolean);

            return (
              <div
                key={game.gameId}
                onClick={() => onResumeGame(game)}
                className="p-4 rounded-xl bg-[#222226] border border-[#33333d] hover:border-[#00a2ed]/50 shadow-sm cursor-pointer transition active:scale-[0.99] space-y-2.5 group"
              >
                {/* Header row: Title & Status badge */}
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-sm text-white group-hover:text-[#00a2ed] transition truncate">
                    {game.title}
                  </h2>
                  {isPlaying ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#00a2ed]/20 text-[#00a2ed] border border-[#00a2ed]/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a2ed] animate-pulse" />
                      Round {game.rounds.length + 1}
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                      <Trophy className="w-2.5 h-2.5" /> Won: {winner?.name || 'Complete'}
                    </span>
                  )}
                </div>

                {/* Sub details: Pool and Players */}
                <div className="space-y-1 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded bg-black/30 font-mono text-[11px] text-zinc-300">
                      {game.rules.poolLimit} Pool
                    </span>
                    <span>•</span>
                    <span>{game.rounds.length} rounds played</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
                    <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">
                      {playerNames.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[#2e2e38]">
                  <span className="text-[11px] font-semibold text-[#00a2ed] flex items-center gap-1 group-hover:underline">
                    <Play className="w-3 h-3 fill-current" /> Resume Game
                  </span>

                  <button
                    type="button"
                    onClick={e => handleDelete(e, game.gameId, game.title)}
                    title="Delete Match"
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
