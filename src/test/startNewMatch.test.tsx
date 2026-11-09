// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { App } from '../App';
import { ThemeProvider } from '../themes/ThemeContext';
import { GameState } from '../domain/types';

const ACTIVE_KEY = 'rummy_active_game_v1';
const LIST_KEY = 'rummy_saved_games_list_v1';

const savedMatch: GameState = {
  gameId: 'game_1',
  title: 'Friday Pool',
  createdAt: 1,
  status: 'playing',
  rules: {
    poolLimit: 201,
    openDrop: 24,
    middleDrop: 48,
    fullCount: 80,
    allowReEntry: true,
  },
  players: {
    p1: { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
    p2: { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
  },
  seats: ['p1', 'p2'],
  currentDealerIndex: 0,
  rounds: [],
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderApp() {
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function openSettings() {
  fireEvent.click(screen.getAllByTitle('Settings')[0]);
}

describe('Settings > Start New Match', () => {
  it('keeps the current match in Continue Game and opens new-game setup', () => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(savedMatch));
    localStorage.setItem(LIST_KEY, JSON.stringify([savedMatch]));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderApp();
    openSettings();
    fireEvent.click(screen.getByRole('button', { name: /start new match/i }));

    expect(screen.getByRole('heading', { name: 'New Game' })).toBeTruthy();
    const list = JSON.parse(localStorage.getItem(LIST_KEY)!) as GameState[];
    expect(list.map(g => g.gameId)).toContain('game_1');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('is not offered when no match is in progress', () => {
    renderApp();
    openSettings();
    expect(screen.queryByRole('button', { name: /start new match/i })).toBeNull();
  });
});
