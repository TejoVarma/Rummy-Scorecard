import React, { useReducer, useEffect, useState } from 'react';
import { gameReducer, INITIAL_STATE } from './state/gameReducer';
import { loadActiveGame, saveActiveGame, clearActiveGame } from './storage/localStorageAdapter';
import { GameSetupWizard } from './components/setup/GameSetupWizard';
import { ScoreboardScreen } from './components/scoreboard/ScoreboardScreen';
import { RoundInputModal } from './components/input/RoundInputModal';
import { ReEntryModal } from './components/input/ReEntryModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { PlayerId, ScoreInputType } from './domain/types';

export const App: React.FC = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE, () => {
    const saved = loadActiveGame();
    return saved && saved.status ? saved : INITIAL_STATE;
  });

  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reEntryTargetPlayerId, setReEntryTargetPlayerId] = useState<PlayerId | null>(null);

  // Auto-persist active state to local storage
  useEffect(() => {
    if (state.status === 'playing' || state.status === 'completed') {
      saveActiveGame(state);
    }
  }, [state]);

  const handleStartGame = (config: any) => {
    dispatch({ type: 'START_GAME', payload: config });
  };

  const handleSubmitRound = (roundScores: Record<PlayerId, { type: ScoreInputType; points: number }>) => {
    dispatch({ type: 'SUBMIT_ROUND', payload: { roundScores } });
  };

  const handleUndoRound = () => {
    dispatch({ type: 'UNDO_ROUND' });
  };

  const handleConfirmReEntry = (playerId: PlayerId, customScore?: number) => {
    dispatch({
      type: 'RE_ENTER_PLAYER',
      payload: { playerId, customReEntryScore: customScore },
    });
  };

  const handleResetGame = () => {
    clearActiveGame();
    dispatch({ type: 'RESET_GAME' });
  };

  return (
    <div className="min-h-screen">
      {state.status === 'setup' ? (
        <GameSetupWizard onStartGame={handleStartGame} />
      ) : (
        <ScoreboardScreen
          state={state}
          onOpenScoreInput={() => setIsInputModalOpen(true)}
          onUndoRound={handleUndoRound}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onPromptReEntry={id => setReEntryTargetPlayerId(id)}
          onDeleteGame={handleResetGame}
        />
      )}

      {/* Round Score Entry Modal */}
      {isInputModalOpen && (
        <RoundInputModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          state={state}
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
          onResetGame={handleResetGame}
        />
      )}
    </div>
  );
};
