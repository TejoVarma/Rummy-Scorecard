// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readBackup,
  restoreBackup,
  saveActiveGame,
  loadActiveGame,
  loadAllSavedGames,
  loadPlayerRoster,
  resetStorageStateForTests,
} from '../storage/localStorageAdapter';
import { isValidGameState } from '../domain/validation';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState, RoundRecord } from '../domain/types';

const prefs = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
      remove: async ({ key }: { key: string }) => void store.delete(key),
    },
  };
});
vi.mock('@capacitor/preferences', () => ({ Preferences: prefs.Preferences }));

function round(n: number, extra: Partial<RoundRecord> = {}): RoundRecord {
  return {
    roundNumber: n,
    dealerPlayerId: 'p1',
    scores: { p1: { type: 'show', points: 0 }, p2: { type: 'open_drop', points: 24 } },
    cumulativeScores: { p1: 0, p2: 24 * n },
    seatsSnapshot: ['p1', 'p2'],
    playersSnapshot: {},
    eliminatedInRound: [],
    reEnteredInRound: [],
    timestamp: n,
    ...extra,
  };
}

function game(id: string, rounds: number, extra: Partial<GameState> = {}): GameState {
  return {
    gameId: id,
    title: `Match ${id}`,
    createdAt: 1,
    status: 'playing',
    rules: { ...DEFAULT_RULES, entryAmount: 100 },
    players: {
      p1: { id: 'p1', name: 'Ravi', avatarColor: '#000', reEntryCount: 0 },
      p2: { id: 'p2', name: 'Amit', avatarColor: '#000', reEntryCount: 0 },
    },
    seats: ['p1', 'p2'],
    currentDealerIndex: 0,
    rounds: Array.from({ length: rounds }, (_, i) => round(i + 1)),
    ...extra,
  };
}

const backupOf = (games: GameState[], players: unknown[] = []) =>
  JSON.stringify({ version: 1, savedGames: games, savedPlayers: players });

beforeEach(() => {
  localStorage.clear();
  prefs.store.clear();
  resetStorageStateForTests();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('restoring a further-played copy of the open match', () => {
  it('replaces the open match too, so the next save cannot undo the restore', async () => {
    await saveActiveGame(game('m1', 3));
    const read = readBackup(backupOf([game('m1', 5)]));
    if (!read.ok) throw new Error(read.message);

    const summary = await restoreBackup(read.backup);
    expect(summary.updated).toBe(1);
    expect(loadActiveGame()?.rounds).toHaveLength(5);

    // what the app does right after the reload: save the match on screen
    await saveActiveGame(loadActiveGame()!);
    expect(loadAllSavedGames().find(g => g.gameId === 'm1')?.rounds).toHaveLength(5);
  });

  it('leaves the open match alone when the backup copy is not further along', async () => {
    await saveActiveGame(game('m1', 5));
    const read = readBackup(backupOf([game('m1', 2)]));
    if (!read.ok) throw new Error(read.message);
    await restoreBackup(read.backup);
    expect(loadActiveGame()?.rounds).toHaveLength(5);
  });
});

describe('merge ties', () => {
  it('with the same number of rounds, keeps the copy that was settled by a deal', async () => {
    localStorage.setItem('rummy_saved_games_list_v1', JSON.stringify([game('m1', 2)]));
    const settled = game('m1', 2, {
      status: 'completed',
      dealSplit: { mode: 'equal', payouts: { p1: 100, p2: 100 }, scoresSnapshot: { p1: 0, p2: 48 }, totalPool: 200, timestamp: 9 },
    });
    const read = readBackup(backupOf([settled]));
    if (!read.ok) throw new Error(read.message);
    await restoreBackup(read.backup);
    expect(loadAllSavedGames()[0].dealSplit?.totalPool).toBe(200);
  });
});

describe('players in a backup', () => {
  it('adds a player only once even if the file lists them twice', async () => {
    const read = readBackup(backupOf([], [{ id: 'k', name: 'Kiran' }, { id: 'k', name: 'Kiran' }]));
    if (!read.ok) throw new Error(read.message);
    const summary = await restoreBackup(read.backup);
    expect(summary.playersAdded).toBe(1);
    expect(loadPlayerRoster().filter(p => p.id === 'k')).toHaveLength(1);
  });
});

describe('saved-game validation checks what the screens rely on', () => {
  it('accepts a normal game, including old rounds without a re-entry list', () => {
    const old = game('m1', 1);
    delete (old.rounds[0] as Partial<RoundRecord>).reEnteredInRound;
    expect(isValidGameState(old)).toBe(true);
  });

  it.each<[string, (g: GameState) => unknown]>([
    ['a deal with no score snapshot', g => ({ ...g, dealSplit: { mode: 'equal', payouts: { p1: 1 }, totalPool: 1, timestamp: 1 } })],
    ['a re-entry count that is text', g => ({ ...g, players: { ...g.players, p1: { ...g.players.p1, reEntryCount: '1' } } })],
    ['a knocked-out list that is not a list', g => ({ ...g, rounds: [{ ...g.rounds[0], eliminatedInRound: 'p2' }] })],
    ['a dealer seat that is not a whole number', g => ({ ...g, currentDealerIndex: 0.5 })],
    ['the same player seated twice', g => ({ ...g, seats: ['p1', 'p1'] })],
    ['a stake that is not a number', g => ({ ...g, rules: { ...g.rules, entryAmount: 'lots' } })],
    ['a round score with no type', g => ({ ...g, rounds: [{ ...g.rounds[0], scores: { p1: { points: 0 } } }] })],
  ])('rejects %s', (_, damage) => {
    expect(isValidGameState(damage(game('m1', 1)))).toBe(false);
  });
});
