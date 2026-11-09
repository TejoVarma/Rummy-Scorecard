// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Preferences } from '@capacitor/preferences';
import {
  hydrateFromPreferences,
  saveActiveGame,
  saveGameToList,
  deleteGameFromList,
  loadAllSavedGames,
  MAX_SAVED_GAMES,
} from '../storage/localStorageAdapter';
import { App } from '../App';
import { ThemeProvider } from '../themes/ThemeContext';
import { GameState } from '../domain/types';
import { DEFAULT_RULES } from '../domain/scoring';

// Capacitor plugins are proxies that can't be spied on, so the Android store is faked in memory.
const prefs = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    failWrites: false,
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => {
        if (prefs.failWrites) throw new Error('disk full');
        store.set(key, value);
      },
      remove: async ({ key }: { key: string }) => {
        store.delete(key);
      },
    },
  };
});
vi.mock('@capacitor/preferences', () => ({ Preferences: prefs.Preferences }));

const ACTIVE = 'rummy_active_game_v1';
const LIST = 'rummy_saved_games_list_v1';
const PLAYERS = 'rummy_saved_players_v1';

function game(id: string, status: GameState['status'] = 'playing'): GameState {
  return {
    gameId: id,
    title: `Match ${id}`,
    createdAt: 1,
    status,
    rules: DEFAULT_RULES,
    players: {
      p1: { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
      p2: { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
    },
    seats: ['p1', 'p2'],
    currentDealerIndex: 0,
    rounds: [],
  };
}

const listIds = () => (JSON.parse(localStorage.getItem(LIST) ?? '[]') as Array<{ gameId?: string }>).map(g => g.gameId);

beforeEach(async () => {
  localStorage.clear();
  prefs.store.clear();
  prefs.failWrites = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('restoring from the Android copy at startup', () => {
  it('brings back the match, the saved list and the players when the WebView storage was wiped', async () => {
    const g = JSON.stringify(game('g1'));
    await Preferences.set({ key: ACTIVE, value: g });
    await Preferences.set({ key: LIST, value: `[${g}]` });
    await Preferences.set({ key: PLAYERS, value: '[{"id":"p1","name":"Ravi"}]' });

    await hydrateFromPreferences();

    expect(JSON.parse(localStorage.getItem(ACTIVE)!).gameId).toBe('g1');
    expect(listIds()).toEqual(['g1']);
    expect(localStorage.getItem(PLAYERS)).toContain('Ravi');
  });

  it('does not overwrite data that is already there', async () => {
    localStorage.setItem(ACTIVE, JSON.stringify(game('newer')));
    await Preferences.set({ key: ACTIVE, value: JSON.stringify(game('older')) });
    await hydrateFromPreferences();
    expect(JSON.parse(localStorage.getItem(ACTIVE)!).gameId).toBe('newer');
  });
});

describe('saving reports what happened', () => {
  it('reports success', async () => {
    expect(await saveActiveGame(game('g1'))).toBe(true);
    expect(listIds()).toEqual(['g1']);
  });

  it('reports failure when neither store can be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    prefs.failWrites = true;
    expect(await saveActiveGame(game('g1'))).toBe(false);
  });

  it('still counts as saved when only the Android copy worked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    prefs.failWrites = false;
    expect(await saveActiveGame(game('g1'))).toBe(true);
  });
});

describe('the saved-games list', () => {
  it('keeps entries it cannot read instead of deleting them', async () => {
    localStorage.setItem(LIST, JSON.stringify([{ gameId: 'broken', rounds: 'oops' }, game('g1')]));
    await saveGameToList(game('g2'));
    expect(listIds()).toEqual(['g2', 'broken', 'g1']);
    expect(loadAllSavedGames().map(g => g.gameId)).toEqual(['g2', 'g1']);
  });

  it('backs up an unreadable list once instead of piling up copies', () => {
    localStorage.setItem(LIST, '{not json');
    loadAllSavedGames();
    loadAllSavedGames();
    const backups = Object.keys(localStorage).filter(k => k.startsWith(LIST + '_'));
    expect(backups).toEqual([`${LIST}_unreadable`]);
    expect(localStorage.getItem(`${LIST}_unreadable`)).toBe('{not json');
  });

  it('makes room by dropping the oldest finished match, never one still in progress', async () => {
    const full = Array.from({ length: MAX_SAVED_GAMES }, (_, i) => game(`old${i}`, 'completed'));
    full[full.length - 1] = game('unfinished', 'playing');
    localStorage.setItem(LIST, JSON.stringify(full));

    await saveGameToList(game('new'));

    const ids = listIds();
    expect(ids).toHaveLength(MAX_SAVED_GAMES);
    expect(ids[0]).toBe('new');
    expect(ids).toContain('unfinished');
    expect(ids).not.toContain(`old${MAX_SAVED_GAMES - 2}`);
  });

  it('a delete is not undone by a save that started earlier', async () => {
    const saving = saveActiveGame(game('g1'));
    const deleting = deleteGameFromList('g1');
    await Promise.all([saving, deleting]);
    expect(listIds()).toEqual([]);
    const { value } = await Preferences.get({ key: LIST });
    expect(JSON.parse(value ?? '[]')).toEqual([]);
  });
});

describe('in the app', () => {
  function renderApp() {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
  }

  it('warns when a match could not be saved', async () => {
    localStorage.setItem(ACTIVE, JSON.stringify(game('g1')));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    prefs.failWrites = true;

    renderApp();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/couldn't save/i));
  });

  it('forgets the open match when it is deleted from Continue Game', async () => {
    const g = game('g1');
    localStorage.setItem(ACTIVE, JSON.stringify(g));
    localStorage.setItem(LIST, JSON.stringify([g]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderApp();
    expect(screen.getByText('Ongoing Game')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /continue game/i }));
    fireEvent.click(screen.getByTitle(/delete/i));
    fireEvent.click(screen.getByTitle(/back/i));

    expect(screen.queryByText('Ongoing Game')).toBeNull();
    await new Promise(r => setTimeout(r, 20));
    expect(listIds()).toEqual([]);
  });
});
