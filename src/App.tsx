import { useReducer, useEffect, useState, useCallback, useRef } from 'react';
import { gameReducer, INITIAL_STATE } from './state/gameReducer';
import {
  loadActiveGame,
  saveActiveGame,
  clearActiveGame,
  deleteGameFromList,
  loadAnnounceAfterRound,
  saveAnnounceAfterRound,
} from './storage/localStorageAdapter';
import { buildAnnouncement } from './domain/announce';
import { speak } from './services/speech';
import { HomeScreen } from './components/home/HomeScreen';
import { ContinueGameScreen } from './components/continue/ContinueGameScreen';
import { PlayerListScreen } from './components/players/PlayerListScreen';
import { GameSetupWizard } from './components/setup/GameSetupWizard';
import { ScoreboardScreen } from './components/scoreboard/ScoreboardScreen';
import { RoundInputModal } from './components/input/RoundInputModal';
import { ReEntryModal } from './components/input/ReEntryModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { GameRules, GameState, Player, PlayerId, ScoreInputType, DealSplit } from './domain/types';
import { useBackButton, BACK_PRIORITY } from './hooks/useBackButton';
import { backButtonManager } from './services/backHandler';

interface StartGameConfig {
  title: string;
  rules: GameRules;
  players: Player[];
  initialSeats: PlayerId[];
  initialDealerIndex: number;
}

export function App() {
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
  const [announceAfterRound, setAnnounceAfterRound] = useState(loadAnnounceAfterRound);
  const lastSeenRound = useRef<{ gameId: string; round: string } | null>(null);

  const handleToggleAnnounce = useCallback((on: boolean) => {
    setAnnounceAfterRound(on);
    saveAnnounceAfterRound(on);
  }, []);

  const announceScores = useCallback(async () => {
    const text = buildAnnouncement(state);
    if (!text) return;
    try {
      await speak(text);
    } catch (e) {
      console.error('Text-to-speech failed', e);
      alert("Couldn't read the scores aloud. Check that a text-to-speech voice is installed on this phone.");
    }
  }, [state]);

  // Speak only when a round is submitted or edited in the game already on screen,
  // not when a game is opened, resumed or started.
  useEffect(() => {
    const last = state.rounds[state.rounds.length - 1];
    const seen = { gameId: state.gameId, round: last ? `${state.rounds.length}@${last.timestamp}` : '' };
    const previous = lastSeenRound.current;
    lastSeenRound.current = seen;

    if (!previous || previous.gameId !== seen.gameId || previous.round === seen.round) return;
    if (announceAfterRound && last) {
      const text = buildAnnouncement(state);
      if (text) speak(text).catch(e => console.error('Text-to-speech failed', e));
    }
  }, [state, announceAfterRound]);

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

  const handleStartGame = useCallback((config: StartGameConfig) => {
    dispatch({ type: 'START_GAME', payload: config });
    setCurrentScreen('scoreboard');
  }, []);

  const handleResumeGame = useCallback((gameToResume: GameState) => {
    dispatch({ type: 'LOAD_GAME', payload: gameToResume });
    setCurrentScreen('scoreboard');
  }, []);

  const handleSubmitRound = useCallback((roundScores: Record<PlayerId, { type: ScoreInputType; points: number }>) => {
    if (isEditingLastRound) {
      dispatch({ type: 'EDIT_LAST_ROUND', payload: { roundScores } });
    } else {
      dispatch({ type: 'SUBMIT_ROUND', payload: { roundScores } });
    }
  }, [isEditingLastRound]);

  const handleConfirmReEntry = useCallback((playerId: PlayerId, customScore?: number) => {
    dispatch({
      type: 'RE_ENTER_PLAYER',
      payload: { playerId, customReEntryScore: customScore },
    });
  }, []);

  const handleDeleteGame = useCallback(() => {
    if (state.gameId) {
      deleteGameFromList(state.gameId);
    }
    clearActiveGame();
    dispatch({ type: 'RESET_GAME' });
    setCurrentScreen('continue_game');
  }, [state.gameId]);

  const handleAcceptDeal = useCallback((dealSplit: DealSplit) => {
    dispatch({ type: 'ACCEPT_DEAL', payload: { dealSplit } });
  }, []);

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
          onAnnounceScores={announceScores}
          onPromptReEntry={id => setReEntryTargetPlayerId(id)}
          onDeleteGame={handleDeleteGame}
          onAcceptDeal={handleAcceptDeal}
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
          key={reEntryTargetPlayerId}
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
          announceAfterRound={announceAfterRound}
          onToggleAnnounce={handleToggleAnnounce}
          onStartNewMatch={state.status !== 'setup' ? () => setCurrentScreen('new_game') : undefined}
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
