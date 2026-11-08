import React, { useReducer, useEffect, useState } from 'react';
import { gameReducer, INITIAL_STATE } from './state/gameReducer';
import { loadActiveGame, saveActiveGame, clearActiveGame, deleteGameFromList } from './storage/localStorageAdapter';
import { HomeScreen } from './components/home/HomeScreen';
import { ContinueGameScreen } from './components/continue/ContinueGameScreen';
import { PlayerListScreen } from './components/players/PlayerListScreen';
import { GameSetupWizard } from './components/setup/GameSetupWizard';
import { ScoreboardScreen } from './components/scoreboard/ScoreboardScreen';
import { RoundInputModal } from './components/input/RoundInputModal';
import { ReEntryModal } from './components/input/ReEntryModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { GameState, PlayerId, ScoreInputType } from './domain/types';
import { useBackButton, BACK_PRIORITY } from './hooks/useBackButton';
import { backButtonManager } from './services/backHandler';

export const App: React.FC = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE, () => {
    const saved = loadActiveGame();
    return saved && saved.status ? saved : INITIAL_STATE;
  });

  // Always open on Home Dashboard by default
  const [currentScreen, setCurrentScreen] = useState<'home' | 'continue_game' | 'players' | 'new_game' | 'scoreboard'>('home');
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [isEditingLastRound, setIsEditingLastRound] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reEntryTargetPlayerId, setReEntryTargetPlayerId] = useState<PlayerId | null>(null);
  const [showExitToast, setShowExitToast] = useState(false);

  // Subscribe to Android exit toast alerts from the back button manager
  useEffect(() => {
    return backButtonManager.onExitToastChange(visible => {
      setShowExitToast(visible);
    });
  }, []);

  // Back button navigates from any sub-screen back to Home dashboard
  useBackButton(
    () => {
      setCurrentScreen('home');
    },
    currentScreen !== 'home',
    BACK_PRIORITY.SCREEN,
    'screen_navigation'
  );

  // Auto-persist active state to local storage and Preferences
  useEffect(() => {
    if (state.status === 'playing' || state.status === 'completed') {
      saveActiveGame(state);
    }
  }, [state]);

  const handleStartGame = (config: any) => {
    dispatch({ type: 'START_GAME', payload: config });
    setCurrentScreen('scoreboard');
  };

  const handleResumeGame = (gameToResume: GameState) => {
    dispatch({ type: 'LOAD_GAME', payload: gameToResume });
    setCurrentScreen('scoreboard');
  };

  const handleSubmitRound = (roundScores: Record<PlayerId, { type: ScoreInputType; points: number }>) => {
    if (isEditingLastRound) {
      dispatch({ type: 'EDIT_LAST_ROUND', payload: { roundScores } });
    } else {
      dispatch({ type: 'SUBMIT_ROUND', payload: { roundScores } });
    }
  };

  const handleConfirmReEntry = (playerId: PlayerId, customScore?: number) => {
    dispatch({
      type: 'RE_ENTER_PLAYER',
      payload: { playerId, customReEntryScore: customScore },
    });
  };

  const handleDeleteGame = () => {
    if (state.gameId) {
      deleteGameFromList(state.gameId);
    }
    clearActiveGame();
    dispatch({ type: 'RESET_GAME' });
    setCurrentScreen('continue_game');
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-200">
      {/* Screen Router */}
      {currentScreen === 'home' && (
        <HomeScreen
          activeGame={state.status !== 'setup' ? state : null}
          onStartNewGame={() => setCurrentScreen('new_game')}
          onContinueGame={() => setCurrentScreen('continue_game')}
          onResumeGame={() => setCurrentScreen('scoreboard')}
          onOpenPlayerList={() => setCurrentScreen('players')}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {currentScreen === 'continue_game' && (
        <ContinueGameScreen
          onBack={() => setCurrentScreen('home')}
          onResumeGame={handleResumeGame}
          onStartNewGame={() => setCurrentScreen('new_game')}
        />
      )}

      {currentScreen === 'players' && (
        <PlayerListScreen onBack={() => setCurrentScreen('home')} />
      )}

      {currentScreen === 'new_game' && (
        <GameSetupWizard
          onBack={() => setCurrentScreen('home')}
          onStartGame={handleStartGame}
        />
      )}

      {currentScreen === 'scoreboard' && (
        <ScoreboardScreen
          state={state}
          onBack={() => setCurrentScreen('home')}
          onOpenScoreInput={() => {
            setIsEditingLastRound(false);
            setIsInputModalOpen(true);
          }}
          onOpenEditScore={() => {
            setIsEditingLastRound(true);
            setIsInputModalOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onPromptReEntry={id => setReEntryTargetPlayerId(id)}
          onDeleteGame={handleDeleteGame}
          onAcceptDeal={dealSplit => dispatch({ type: 'ACCEPT_DEAL', payload: { dealSplit } })}
          onCancelDeal={() => dispatch({ type: 'CANCEL_DEAL' })}
        />
      )}

      {/* Round Score Entry Modal */}
      {isInputModalOpen && (
        <RoundInputModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          state={state}
          isEditingLastRound={isEditingLastRound}
          onSubmitRound={handleSubmitRound}
        />
      )}

      {/* Re-Entry Dialog Modal */}
      {reEntryTargetPlayerId && (
        <ReEntryModal
          isOpen={Boolean(reEntryTargetPlayerId)}
          onClose={() => setReEntryTargetPlayerId(null)}
          state={state}
          reEnteringPlayerId={reEntryTargetPlayerId}
          onConfirmReEntry={handleConfirmReEntry}
        />
      )}

      {/* Settings & Themes Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onResetGame={handleDeleteGame}
        />
      )}

      {/* Android-style Exit Toast Notification */}
      {showExitToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] pointer-events-none transition-all duration-200">
          <div className="px-4 py-2 rounded-full bg-slate-900/95 text-white text-xs sm:text-sm font-medium shadow-2xl border border-white/10 flex items-center gap-2">
            <span>Press back again to exit</span>
          </div>
        </div>
      )}
    </div>
  );
};
