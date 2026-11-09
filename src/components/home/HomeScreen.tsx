import React from 'react';
import { GameState } from '../../domain/types';
import { Settings } from 'lucide-react';

interface HomeScreenProps {
  activeGame: GameState | null;
  onStartNewGame: () => void;
  onContinueGame: () => void;
  onResumeGame?: () => void;
  onOpenPlayerList: () => void;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  activeGame,
  onStartNewGame,
  onContinueGame,
  onResumeGame,
  onOpenPlayerList,
  onOpenSettings,
}) => {
  // Only consider game ongoing if actively playing and not finished by winner or deal
  const isOngoingGame = Boolean(
    activeGame &&
    activeGame.status === 'playing' &&
    !activeGame.winnerPlayerId &&
    !activeGame.dealSplit
  );

  // Calculate active game pool stake
  const entryAmount = activeGame?.rules.entryAmount ?? 0;
  const totalReEntries = activeGame
    ? activeGame.seats.reduce((sum, id) => sum + (activeGame.players[id]?.reEntryCount ?? 0), 0)
    : 0;
  const totalPool = activeGame ? entryAmount * (activeGame.seats.length + totalReEntries) : 0;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col font-sans select-none transition-colors duration-200">
      {/* Top App Bar dynamically colored by current theme */}
      <div className="px-4 py-3.5 bg-[var(--color-primary)] text-white shadow flex items-center justify-between">
        <h1 className="font-semibold text-lg tracking-normal">Rummy Score Board</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Settings"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-black/10 active:bg-black/20 transition"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main 2x2 Grid exactly matching Screenshot 1 */}
      <div className="flex-1 max-w-sm w-full mx-auto p-4 flex flex-col justify-start pt-6 gap-3.5">
        <div className="grid grid-cols-2 gap-3.5">
          {/* Tile 1: Add Players (Blue #0078d4) */}
          <button
            type="button"
            onClick={onOpenPlayerList}
            className="aspect-square rounded-2xl bg-[#0078d4] hover:bg-[#006bbd] text-white flex items-center justify-center text-center p-4 shadow-sm active:scale-[0.98] transition cursor-pointer"
          >
            <span className="font-normal text-xl tracking-tight leading-snug">
              Add Players
            </span>
          </button>

          {/* Tile 2: Start New Game (Calm Forest Green #3e7b4e) */}
          <button
            type="button"
            onClick={onStartNewGame}
            className="aspect-square rounded-2xl bg-[#3e7b4e] hover:bg-[#356a42] text-white flex items-center justify-center text-center p-4 shadow-sm active:scale-[0.98] transition cursor-pointer"
          >
            <span className="font-normal text-xl tracking-tight leading-snug">
              Start New Game
            </span>
          </button>

          {/* Tile 3: Continue Game (Teal #338996) */}
          <button
            type="button"
            onClick={onContinueGame}
            className="aspect-square rounded-2xl bg-[#338996] hover:bg-[#2b7580] text-white flex items-center justify-center text-center p-4 shadow-sm active:scale-[0.98] transition cursor-pointer"
          >
            <span className="font-normal text-xl tracking-tight leading-snug">
              Continue Game
            </span>
          </button>

          {/* Tile 4: Settings (Muted Sand/Gold #c8b75b) */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="aspect-square rounded-2xl bg-[#c8b75b] hover:bg-[#b8a74e] text-white flex items-center justify-center text-center p-4 shadow-sm active:scale-[0.98] transition cursor-pointer"
          >
            <span className="font-normal text-xl tracking-tight leading-snug">
              Settings
            </span>
          </button>
        </div>

        {/* Ongoing Game quick card - only displayed when a match is actively in progress */}
        {isOngoingGame && activeGame && (
          <div
            onClick={onResumeGame || onContinueGame}
            className="mt-4 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)] transition active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
                <span className="font-semibold text-xs text-[var(--color-text)]">Ongoing Game</span>
              </div>
              <span className="text-[11px] text-[var(--color-muted)] block mt-0.5">
                {activeGame.title} • Round {activeGame.rounds.length + 1} • {activeGame.seats.length} players
                {totalPool > 0 && (
                  <strong className="text-emerald-500 font-mono ml-1 font-bold">
                    • ₹{totalPool} Pool
                  </strong>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onResumeGame) onResumeGame();
                else onContinueGame();
              }}
              aria-label={`Resume ongoing game: ${activeGame.title}`}
              className="min-h-[44px] px-4 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition"
            >
              Resume →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
