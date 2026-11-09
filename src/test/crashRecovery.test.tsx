// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { isValidGameState } from '../storage/localStorageAdapter';
import { GameState } from '../domain/types';

const ACTIVE_KEY = 'rummy_active_game_v1';
const LIST_KEY = 'rummy_saved_games_list_v1';
const BACKUP_KEY = 'rummy_crashed_game_backup';

function game(overrides: Partial<GameState> = {}): GameState {
  return {
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
      reEntryScoreMode: 'highest_plus_one',
    },
    players: {
      p1: { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
      p2: { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
    },
    seats: ['p1', 'p2'],
    currentDealerIndex: 0,
    rounds: [],
    ...overrides,
  };
}

function Boom(): never {
  throw new Error('bad saved match');
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('crash screen reset', () => {
  it('clears the real active match, keeps a backup and drops it from the saved list', async () => {
    const crashed = game();
    const other = game({ gameId: 'game_2', title: 'Old match' });
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(crashed));
    localStorage.setItem(LIST_KEY, JSON.stringify([crashed, other]));

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /clear this match/i }));

    await waitFor(() => expect(localStorage.getItem(ACTIVE_KEY)).toBeNull());
    expect(JSON.parse(localStorage.getItem(BACKUP_KEY)!).gameId).toBe('game_1');
    const remaining = JSON.parse(localStorage.getItem(LIST_KEY)!) as GameState[];
    expect(remaining.map(g => g.gameId)).toEqual(['game_2']);
  });
});

describe('saved match validation', () => {
  it('accepts a normal match', () => {
    expect(isValidGameState(game())).toBe(true);
  });

  it('rejects a dealer seat that does not exist', () => {
    expect(isValidGameState(game({ currentDealerIndex: 5 }))).toBe(false);
  });

  it('rejects a round with no cumulative scores', () => {
    const broken = game({ rounds: [{} as GameState['rounds'][number]] });
    expect(isValidGameState(broken)).toBe(false);
  });

  it('rejects a score that is not a real number', () => {
    const round = {
      roundNumber: 1,
      dealerPlayerId: 'p1',
      scores: { p1: { type: 'show', points: 0 }, p2: { type: 'custom', points: 10 } },
      cumulativeScores: { p1: 0, p2: null },
      seatsSnapshot: ['p1', 'p2'],
      playersSnapshot: {},
      eliminatedInRound: [],
      reEnteredInRound: [],
      timestamp: 1,
    } as unknown as GameState['rounds'][number];
    expect(isValidGameState(game({ rounds: [round] }))).toBe(false);
  });
});
