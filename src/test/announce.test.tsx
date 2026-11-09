// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { buildAnnouncement } from '../domain/announce';
import { loadAnnounceAfterRound, saveAnnounceAfterRound } from '../storage/localStorageAdapter';
import { App } from '../App';
import { ThemeProvider } from '../themes/ThemeContext';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState } from '../domain/types';

const speech = vi.hoisted(() => ({ speak: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/speech', () => ({ speak: speech.speak }));

function game(rounds: Array<Record<string, { type: 'show' | 'open_drop' | 'full_count' | 'custom'; points: number }>>): GameState {
  let state = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Friday Pool',
      rules: DEFAULT_RULES,
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
        { id: 'p3', name: 'Kiran', avatarColor: '#f59e0b', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2', 'p3'],
      initialDealerIndex: 0,
    },
  });
  for (const roundScores of rounds) {
    state = gameReducer(state, { type: 'SUBMIT_ROUND', payload: { roundScores } });
  }
  return state;
}

const ROUND = {
  p1: { type: 'show' as const, points: 0 },
  p2: { type: 'open_drop' as const, points: 24 },
  p3: { type: 'full_count' as const, points: 80 },
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('buildAnnouncement', () => {
  it('reads the round number and every total in seat order', () => {
    expect(buildAnnouncement(game([ROUND]))).toBe('Round 1. Ravi 0. Amit 24. Kiran 80.');
  });

  it('says "out" instead of a score for knocked-out players', () => {
    const state = game([ROUND, ROUND, ROUND]);
    expect(buildAnnouncement(state)).toBe('Round 3. Ravi 0. Amit 72. Kiran out.');
  });

  it('has nothing to say before the first round', () => {
    expect(buildAnnouncement(game([]))).toBeNull();
  });
});

describe('announce setting', () => {
  it('is off until switched on, and remembers the choice', () => {
    expect(loadAnnounceAfterRound()).toBe(false);
    saveAnnounceAfterRound(true);
    expect(loadAnnounceAfterRound()).toBe(true);
    saveAnnounceAfterRound(false);
    expect(loadAnnounceAfterRound()).toBe(false);
  });
});

function renderAppWith(state: GameState) {
  localStorage.setItem('rummy_active_game_v1', JSON.stringify(state));
  localStorage.setItem('rummy_saved_games_list_v1', JSON.stringify([state]));
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
  fireEvent.click(screen.getByText('Ongoing Game'));
}

async function submitRound() {
  fireEvent.click(screen.getByRole('button', { name: 'ENTER SCORE' }));
  for (const [name, button] of [['Ravi', 'Show'], ['Amit', 'Drop'], ['Kiran', 'Full']] as const) {
    const card = screen.getAllByText(name, { exact: true })
      .map(el => el.closest('div.rounded-xl'))
      .find(Boolean) as HTMLElement;
    const btn = Array.from(card.querySelectorAll('button')).find(b => b.textContent?.trim() === button)!;
    fireEvent.click(btn);
  }
  fireEvent.click(screen.getByRole('button', { name: 'SUBMIT' }));
}

describe('announcing in the app', () => {
  it('speaks the totals after a round when the setting is on', async () => {
    saveAnnounceAfterRound(true);
    renderAppWith(game([ROUND]));
    await submitRound();
    await waitFor(() => expect(speech.speak).toHaveBeenCalledWith('Round 2. Ravi 0. Amit 48. Kiran 160.'));
  });

  it('stays quiet after a round when the setting is off', async () => {
    renderAppWith(game([ROUND]));
    await submitRound();
    await new Promise(r => setTimeout(r, 20));
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('does not speak just because a saved game was opened', async () => {
    saveAnnounceAfterRound(true);
    renderAppWith(game([ROUND]));
    await new Promise(r => setTimeout(r, 20));
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('replays the totals from the speaker button, even with the setting off', async () => {
    renderAppWith(game([ROUND]));
    fireEvent.click(screen.getByRole('button', { name: 'Announce scores' }));
    await waitFor(() => expect(speech.speak).toHaveBeenCalledWith('Round 1. Ravi 0. Amit 24. Kiran 80.'));
  });
});
