import React from 'react';
import { GameState } from '../../domain/types';
import { Settings, Share2 } from 'lucide-react';

interface HomeScreenProps {
  activeGame: GameState | null;
  onStartNewGame: () => void;
  onContinueGame: () => void;
  onOpenPlayerList: () => void;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  activeGame,
  onStartNewGame,
  onContinueGame,
  onOpenPlayerList,
  onOpenSettings,
}) => {
  const hasActiveGame = activeGame && activeGame.status === 'playing';

  const handleShareApp = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Rummy Score Board',
          text: 'Offline-first Indian Rummy Score Board app',
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed silently
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#111113] text-[#f4f4f5] flex flex-col font-sans select-none">
      {/* Top App Bar matching original app */}
      <div className="px-4 py-3.5 bg-[#00a2ed] text-white shadow flex items-center justify-between">
        <h1 className="font-semibold text-lg tracking-normal">Rummy Score Board</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings"
            className="p-1 rounded hover:bg-black/10 active:bg-black/20 transition"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
          <button
            type="button"
            onClick={handleShareApp}
            title="Share"
            className="p-1 rounded hover:bg-black/10 active:bg-black/20 transition"
          >
            <Share2 className="w-5 h-5 text-white" />
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
            className={`aspect-square rounded-2xl flex items-center justify-center text-center p-4 shadow-sm transition cursor-pointer ${
              hasActiveGame
                ? 'bg-[#338996] hover:bg-[#2b7580] text-white active:scale-[0.98]'
                : 'bg-[#338996]/50 text-white/60'
            }`}
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

        {/* Active game quick card if a game is in progress */}
        {hasActiveGame && (
          <div
            onClick={onContinueGame}
            className="mt-4 p-3.5 rounded-xl border border-[#00a2ed]/40 bg-[#18181f] flex items-center justify-between cursor-pointer hover:bg-[#1f1f28] transition"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00a2ed] animate-pulse" />
                <span className="font-semibold text-xs text-white">Active Game</span>
              </div>
              <span className="text-[11px] text-[#9ca3af] block mt-0.5">
                {activeGame.title} • Round {activeGame.rounds.length + 1} • {activeGame.seats.length} players
              </span>
            </div>
            <span className="text-xs font-semibold text-[#00a2ed] underline">Resume →</span>
          </div>
        )}
      </div>
    </div>
  );
};
