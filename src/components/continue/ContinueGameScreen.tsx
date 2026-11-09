import React, { useRef, useState } from 'react';
import { GameState } from '../../domain/types';
import { ArrowLeft, Play, Trash2, Trophy, Clock, Users, Plus, Download } from 'lucide-react';
import {
  loadAllSavedGames,
  deleteGameFromList,
  countUnreadableSavedGames,
  readMatchFile,
  importMatch,
  MAX_MATCH_BYTES,
} from '../../storage/localStorageAdapter';

interface ContinueGameScreenProps {
  onBack: () => void;
  onResumeGame: (game: GameState) => void;
  onStartNewGame: () => void;
  onGameDeleted: (gameId: string) => void;
}

export const ContinueGameScreen: React.FC<ContinueGameScreenProps> = ({
  onBack,
  onResumeGame,
  onStartNewGame,
  onGameDeleted,
}) => {
  const [games, setGames] = useState<GameState[]>(() => loadAllSavedGames());
  const [unreadable] = useState(countUnreadableSavedGames);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_MATCH_BYTES) {
      alert('That file is too big to be a Rummy Scorecard match.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => alert("Couldn't read that file. Please pick it again.");
    reader.onload = async () => {
      const result = readMatchFile(String(reader.result ?? ''));
      if (!result.ok) {
        alert(result.message);
        return;
      }
      let imported: Awaited<ReturnType<typeof importMatch>>;
      try {
        imported = await importMatch(result.game, (phoneRounds, fileRounds) =>
          window.confirm(
            `This phone already has "${result.game.title}" (${phoneRounds} rounds). Replace it with the copy in this file (${fileRounds} rounds)?`
          )
        );
      } catch (err) {
        console.error('Importing a match failed', err);
        alert("Couldn't save the match. Your phone may be out of space.");
        return;
      }
      if (imported.outcome === 'cancelled') return;
      if (imported.outcome === 'refused') {
        alert(imported.message);
        return;
      }
      if (imported.outcome === 'kept_phone_copy') {
        alert(`This phone already has this match further along (${imported.game.rounds.length} rounds), so that copy is opened.`);
      }
      try {
        onResumeGame(imported.game);
      } catch (err) {
        console.error('Opening the imported match failed', err);
        alert('The match was saved. Open it from the Continue Game list.');
      }
    };
    reader.readAsText(file);
  };

  const importButton = (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="min-h-[44px] w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--color-border)] text-xs font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] transition"
      >
        <Download className="w-4 h-4" /> Import match from another phone
      </button>
      {/* No accept filter: chat apps often save .json files with a generic type, which Android's picker would grey out. The contents are checked instead. */}
      <input ref={fileInputRef} type="file" aria-label="Import a match file" onChange={handleImportFile} className="hidden" />
    </>
  );

  const handleDelete = async (e: React.MouseEvent, gameId: string, title: string) => {
    e.stopPropagation(); // Don't trigger resume
    if (!window.confirm(`Are you sure you want to delete "${title}" permanently?`)) return;
    if (!(await deleteGameFromList(gameId))) {
      alert(`Couldn't delete "${title}". Your phone may be out of space; please try again.`);
      return;
    }
    setGames(prev => prev.filter(g => g.gameId !== gameId));
    onGameDeleted(gameId);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col font-sans select-none transition-colors duration-200">
      {/* Top App Bar matching original app */}
      <div className="px-4 py-3.5 bg-[var(--color-primary)] text-white shadow flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            title="Back"
            aria-label="Back"
            className="min-h-[44px] p-1 rounded hover:bg-black/10 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg tracking-normal">Continue Game</h1>
        </div>

        <button
          type="button"
          onClick={onStartNewGame}
          title="New Match"
          className="min-h-[44px] flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md font-medium transition"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {/* Games List Container */}
      <div className="flex-1 max-w-md w-full mx-auto p-4 space-y-3 pb-12 overflow-y-auto">
        {unreadable > 0 && (
          <p role="status" className="text-xs text-amber-600 dark:text-amber-400">
            {unreadable === 1 ? '1 saved match' : `${unreadable} saved matches`} couldn't be read and {unreadable === 1 ? "isn't" : "aren't"} listed. A copy is kept on the phone.
          </p>
        )}
        {games.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-subtle)] flex items-center justify-center mx-auto text-[var(--color-muted)]">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">No Saved Games</h2>
              <p className="text-xs text-[var(--color-muted)] mt-1 max-w-xs mx-auto">
                There are no matches in progress or saved. Tap below to start a new match!
              </p>
            </div>
            <button
              type="button"
              onClick={onStartNewGame}
              className="min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--color-primary)] hover:opacity-90 text-white text-xs font-bold transition shadow"
            >
              Start New Game
            </button>
            <div className="max-w-xs mx-auto pt-2">{importButton}</div>
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
                className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 shadow-sm cursor-pointer transition active:scale-[0.99] space-y-2.5 group"
              >
                {/* Header row: Title & Status badge */}
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-sm text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition truncate">
                    {game.title}
                  </h2>
                  {isPlaying ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                      Round {game.rounds.length + 1}
                    </span>
                  ) : game.dealSplit ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      🤝 Deal (₹{game.dealSplit.totalPool})
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Trophy className="w-2.5 h-2.5" /> Won: {winner?.name || 'Complete'}
                    </span>
                  )}
                </div>

                {/* Sub details: Pool and Players */}
                <div className="space-y-1.5 text-xs text-[var(--color-muted)]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--color-subtle)] font-mono text-[11px] text-[var(--color-text)]">
                      {game.rules.poolLimit} Pool
                    </span>
                    <span>•</span>
                    <span>{game.rounds.length} rounds played</span>
                  </div>

                  {game.dealSplit && (
                    <div className="text-[11px] text-amber-400 font-mono bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 truncate">
                      🤝 {Object.entries(game.dealSplit.payouts).map(([id, amt]) => `${game.players[id]?.name || 'Player'}: ₹${amt}`).join(', ')}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)] truncate">
                    <Users className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    <span className="truncate">
                      {playerNames.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onResumeGame(game);
                    }}
                    aria-label={`Resume Game: ${game.title}`}
                    className="min-h-[44px] -ml-1 px-1 text-xs font-semibold text-[var(--color-primary)] flex items-center gap-1 group-hover:underline"
                  >
                    <Play className="w-3 h-3 fill-current" /> Resume Game
                  </button>

                  <button
                    type="button"
                    onClick={e => handleDelete(e, game.gameId, game.title)}
                    title="Delete Match"
                    aria-label={`Delete ${game.title}`}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
        {games.length > 0 && importButton}
      </div>
    </div>
  );
};
