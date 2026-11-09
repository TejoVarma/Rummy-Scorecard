// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { App } from '../App';
import { ThemeProvider } from '../themes/ThemeContext';
import { SettingsModal } from '../components/settings/SettingsModal';
import { ShareMenu } from '../components/scoreboard/ShareMenu';
import { backButtonManager, BACK_PRIORITY } from '../services/backHandler';
import { buildScorecardText } from '../services/share';
import { totalPool } from '../domain/rules';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState } from '../domain/types';

function playedGame(): GameState {
  let s = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Back Night',
      rules: { ...DEFAULT_RULES, entryAmount: 500 },
      players: ['Ravi', 'Amit', 'Kiran'].map((name, i) => ({ id: `p${i + 1}`, name, avatarColor: '#000', reEntryCount: 0 })),
      initialSeats: ['p1', 'p2', 'p3'],
      initialDealerIndex: 0,
    },
  });
  s = gameReducer(s, {
    type: 'SUBMIT_ROUND',
    payload: { roundScores: { p1: { type: 'show', points: 0 }, p2: { type: 'out', points: 201 }, p3: { type: 'open_drop', points: 24 } } },
  });
  return gameReducer(s, { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p2' } });
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the Android back button', () => {
  it('is ignored while a share is being prepared, instead of leaving the screen', () => {
    const onClose = vi.fn();
    const goHome = vi.fn();
    const unregister = backButtonManager.register('test_screen', goHome, BACK_PRIORITY.SCREEN);
    render(<ShareMenu isOpen sharingAs="image" onClose={onClose} onShare={() => {}} />);
    backButtonManager.handleBack();
    expect(onClose).not.toHaveBeenCalled();
    expect(goHome).not.toHaveBeenCalled();
    unregister();
  });

  it('closes an open dialog first, even when a round row is selected behind it', () => {
    const g = JSON.stringify(playedGame());
    localStorage.setItem('rummy_active_game_v1', g);
    localStorage.setItem('rummy_saved_games_list_v1', `[${g}]`);
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByText('Ongoing Game'));
    fireEvent.click(document.querySelector('tbody tr') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();

    act(() => {
      backButtonManager.handleBack();
    });
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });
});

describe('Settings colour mode', () => {
  it('tapping the mode that is already on keeps it', () => {
    localStorage.setItem('rummy_color_mode', 'dark');
    render(
      <ThemeProvider>
        <SettingsModal isOpen onClose={() => {}} announceAfterRound={false} onToggleAnnounce={() => {}} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /light/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /light/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('one prize-pool formula everywhere', () => {
  it('the shared text shows the same pool the deal is checked against, re-entries included', () => {
    const g = playedGame();
    expect(totalPool(g)).toBe(2000);
    expect(buildScorecardText(g)).toContain(`Prize Pool: ₹${totalPool(g)}`);
  });
});
