import { useReducer, useEffect, useState, useCallback, useRef } from 'react';
import { gameReducer, INITIAL_STATE } from './state/gameReducer';
import {
  loadActiveGame,
  saveActiveGame,
  clearActiveGame,
  deleteGameFromList,
  loadAnnounceAfterRound,
  saveAnnounceAfterRound,
  isBackupCopyUnavailable,
  isBackupCopyBehind,
} from './storage/localStorageAdapter';
import { validateStartGame } from './domain/rules';
import { buildAnnouncement } from './domain/announce';
import { speak } from './services/speech';
import { HomeScreen } from './components/home/HomeScreen';
import { ContinueGameScreen } from './components/continue/ContinueGameScreen';
import { PlayerListScreen } from './components/players/PlayerListScreen';
import { GameSetupWizard } from './components/setup/GameSetupWizard';
import { ScoreboardScreen } from './components/scoreboard/ScoreboardScreen';
import { RoundInputModal } from './components/input/RoundInputModal';
import { ReEntryModal } from './components/input/ReEntryModal';
import { getEligibleForReEntryPlayers } from './domain/elimination';
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
  const [reEntryPreselected, setReEntryPreselected] = useState<PlayerId[] | null>(null);
  const [showExitToast, setShowExitToast] = useState(false);
  const [announceAfterRound, setAnnounceAfterRound] = useState(loadAnnounceAfterRound);
  const [saveFailed, setSaveFailed] = useState(false);
  const [backupBehind, setBackupBehind] = useState(false);
  const lastSeenRound = useRef<{ gameId: string; round: string } | null>(null);
  const speechFailureShown = useRef(false);
  const [backupUnavailable] = useState(isBackupCopyUnavailable);

  const handleToggleAnnounce = useCallback((on: boolean) => {
    setAnnounceAfterRound(on);
    if (!saveAnnounceAfterRound(on)) {
      alert("Couldn't remember this setting. Your phone may be out of space, so it will reset when the app restarts.");
    }
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
      if (text) {
        speak(text)
          .then(() => {
            speechFailureShown.current = false;
          })
          .catch(e => {
          console.error('Text-to-speech failed', e);
          if (!speechFailureShown.current) {
            speechFailureShown.current = true;
            alert("Couldn't read the scores aloud. Check that a text-to-speech voice is installed on this phone.");
          }
        });
      }
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

  // Save every change; if the phone couldn't store it, say so instead of losing it quietly.
  useEffect(() => {
    if (state.status !== 'playing' && state.status !== 'completed') {
      setSaveFailed(false);
      return;
    }
    let current = true;
    saveActiveGame(state)
      .then(ok => {
        if (!current) return;
        setSaveFailed(!ok);
        setBackupBehind(isBackupCopyBehind());
      })
      .catch(e => {
        console.error('Saving the match failed', e);
        if (current) setSaveFailed(true);
      });
    return () => {
      current = false;
    };
  }, [state]);

  const handleGameDeletedFromList = useCallback(
    (gameId: string) => {
      if (gameId === state.gameId) dispatch({ type: 'RESET_GAME' });
    },
    [state.gameId]
  );

  const handleStartGame = useCallback((config: StartGameConfig) => {
    // Check first: if the reducer refused, we'd otherwise land on the previous match.
    const problem = validateStartGame(config);
    if (problem) {
      alert(problem);
      return;
    }
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

  const handleConfirmReEntry = useCallback((playerIds: PlayerId[], score: number) => {
    dispatch({ type: 'RE_ENTER_PLAYERS', payload: { playerIds, customReEntryScore: score } });
  }, []);

  const handleDeleteGame = useCallback(async () => {
    if (state.gameId && !(await deleteGameFromList(state.gameId))) {
      alert("Couldn't delete this match. Your phone may be out of space; please try again.");
      return;
    }
    await clearActiveGame();
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
          onGameDeleted={handleGameDeletedFromList}
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
          onPromptReEntry={setReEntryPreselected}
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
      {reEntryPreselected && (
        <ReEntryModal
          key={reEntryPreselected.join(',') || 'pick'}
          isOpen
          onClose={() => setReEntryPreselected(null)}
          state={state}
          eligiblePlayerIds={getEligibleForReEntryPlayers(state.rounds, state.seats, state.rules, Boolean(state.dealSplit))}
          initialSelection={reEntryPreselected}
          onConfirmReEntry={handleConfirmReEntry}
        />
      )}

      {/* Settings & Themes Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentGame={state.status !== 'setup' ? state : null}
          announceAfterRound={announceAfterRound}
          onToggleAnnounce={handleToggleAnnounce}
          onStartNewMatch={state.status !== 'setup' ? () => setCurrentScreen('new_game') : undefined}
        />
      )}

      {backupBehind && !backupUnavailable && !saveFailed && (
        <div
          role="status"
          className="fixed top-2 inset-x-2 z-[70] mx-auto max-w-md px-4 py-3 rounded-xl bg-amber-900 text-amber-50 text-xs font-medium shadow-2xl border border-amber-500/40"
        >
          Your match is saved, but the phone's backup copy isn't up to date. Export a backup from Settings to be safe.
        </div>
      )}

      {backupUnavailable && !saveFailed && (
        <div
          role="alert"
          className="fixed top-2 inset-x-2 z-[70] mx-auto max-w-md px-4 py-3 rounded-xl bg-amber-900 text-amber-50 text-xs font-medium shadow-2xl border border-amber-500/40"
        >
          Couldn't open the phone's backup copy of your matches, so it won't be changed this time. Restart the app to try again.
        </div>
      )}

      {saveFailed && (
        <div
          role="alert"
          className="fixed top-2 inset-x-2 z-[70] mx-auto max-w-md px-4 py-3 rounded-xl bg-rose-900 text-rose-50 text-xs font-medium shadow-2xl border border-rose-500/40"
        >
          Couldn't save this match. Your phone may be out of space. Free some up, or export a backup from Settings.
        </div>
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
