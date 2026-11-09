// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import {
  readBackup,
  restoreBackup,
  exportAllData,
  loadAllSavedGames,
  loadPlayerRoster,
  MAX_BACKUP_BYTES,
} from '../storage/localStorageAdapter';
import { SettingsModal } from '../components/settings/SettingsModal';
import { ThemeProvider } from '../themes/ThemeContext';
import { GameState, RoundRecord } from '../domain/types';
import { DEFAULT_RULES } from '../domain/scoring';

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

const ACTIVE = 'rummy_active_game_v1';
const LIST = 'rummy_saved_games_list_v1';
const PLAYERS = 'rummy_saved_players_v1';

function round(n: number): RoundRecord {
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
  };
}

function game(id: string, rounds = 0): GameState {
  return {
    gameId: id,
    title: `Match ${id}`,
    createdAt: 1,
    status: 'playing',
    rules: DEFAULT_RULES,
    players: {
      p1: { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
      p2: { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
    },
    seats: ['p1', 'p2'],
    currentDealerIndex: 0,
    rounds: Array.from({ length: rounds }, (_, i) => round(i + 1)),
  };
}

function backupJson(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    exportedAt: 1,
    activeGame: null,
    savedGames: [game('g2', 1)],
    savedPlayers: [{ id: 'p9', name: 'Kiran' }],
    ...over,
  });
}

beforeEach(() => {
  localStorage.clear();
  prefs.store.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('readBackup checks the whole file before anything is written', () => {
  it.each([
    ['not JSON', '{oops', /not a rummy scorecard backup/i],
    ['a newer version', backupJson({ version: 2 }), /newer version/i],
    ['missing lists', JSON.stringify({ version: 1 }), /not a rummy scorecard backup/i],
  ])('rejects %s', (_, json, message) => {
    const result = readBackup(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(message);
  });

  it('counts the damaged matches it will skip', () => {
    const result = readBackup(backupJson({ savedGames: [game('g2', 1), { gameId: 'bad', rounds: 'x' }] }));
    expect(result.ok && result.backup.games.map(g => g.gameId)).toEqual(['g2']);
    expect(result.ok && result.backup.skippedGames).toBe(1);
  });

  it('includes the active match when it is not already in the list', () => {
    const result = readBackup(backupJson({ savedGames: [], activeGame: game('g7', 2) }));
    expect(result.ok && result.backup.games.map(g => g.gameId)).toEqual(['g7']);
  });
});

describe('restoreBackup merges instead of replacing', () => {
  it('keeps your matches and players and adds the new ones', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 3)]));
    localStorage.setItem(PLAYERS, JSON.stringify([{ id: 'p1', name: 'Ravi' }]));

    const result = readBackup(backupJson());
    if (!result.ok) throw new Error(result.message);
    const summary = await restoreBackup(result.backup);

    expect(summary).toEqual({ added: 1, updated: 0, playersAdded: 1 });
    expect(loadAllSavedGames().map(g => g.gameId).sort()).toEqual(['g1', 'g2']);
    expect(loadPlayerRoster().map(p => p.name).sort()).toEqual(['Kiran', 'Ravi']);
  });

  it('for a match in both, keeps the copy with more rounds played', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 5), game('g2', 1)]));
    const result = readBackup(backupJson({ savedGames: [game('g1', 2), game('g2', 4)] }));
    if (!result.ok) throw new Error(result.message);

    const summary = await restoreBackup(result.backup);
    const rounds = Object.fromEntries(loadAllSavedGames().map(g => [g.gameId, g.rounds.length]));
    expect(rounds).toEqual({ g1: 5, g2: 4 });
    expect(summary.updated).toBe(1);
  });

  it('does not touch the match currently open', async () => {
    localStorage.setItem(ACTIVE, JSON.stringify(game('open', 1)));
    const result = readBackup(backupJson({ activeGame: game('other', 3) }));
    if (!result.ok) throw new Error(result.message);
    await restoreBackup(result.backup);
    expect(JSON.parse(localStorage.getItem(ACTIVE)!).gameId).toBe('open');
  });

  it('round-trips: what Export writes, Restore can read', () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 2)]));
    const result = readBackup(exportAllData());
    expect(result.ok && result.backup.games.map(g => g.gameId)).toEqual(['g1']);
  });
});

describe('Restore in Settings', () => {
  function renderSettings() {
    render(
      <ThemeProvider>
        <SettingsModal isOpen onClose={() => {}} announceAfterRound={false} onToggleAnnounce={() => {}} />
      </ThemeProvider>
    );
    return document.querySelector('input[type="file"]') as HTMLInputElement;
  }

  function pick(input: HTMLInputElement, file: File) {
    fireEvent.change(input, { target: { files: [file] } });
  }

  it('asks first, showing what is in the file, and changes nothing if you say no', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 3)]));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    pick(renderSettings(), new File([backupJson()], 'backup.json', { type: 'application/json' }));

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(confirm.mock.calls[0][0]).toMatch(/1 match.*1 player/i);
    expect(confirm.mock.calls[0][0]).toMatch(/nothing you already have will be deleted/i);
    expect(loadAllSavedGames().map(g => g.gameId)).toEqual(['g1']);
  });

  it('refuses a file that is far too big without reading it', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const big = new File(['x'], 'huge.json');
    Object.defineProperty(big, 'size', { value: MAX_BACKUP_BYTES + 1 });
    pick(renderSettings(), big);
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringMatching(/too big/i)));
  });

  it('explains when the file is not a backup', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    pick(renderSettings(), new File(['hello'], 'notes.txt'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringMatching(/not a rummy scorecard backup/i)));
  });
});
