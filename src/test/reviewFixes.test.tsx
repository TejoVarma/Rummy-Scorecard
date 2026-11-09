// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import {
  hydrateFromPreferences,
  saveGameToList,
  saveActiveGame,
  loadAllSavedGames,
  readBackup,
  restoreBackup,
  quarantineActiveGame,
  loadActiveGame,
  resetStorageStateForTests,
} from '../storage/localStorageAdapter';
import { validateStartGame } from '../domain/rules';
import { ReEntryModal } from '../components/input/ReEntryModal';
import { App } from '../App';
import { ThemeProvider } from '../themes/ThemeContext';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState, Player } from '../domain/types';

const prefs = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    failGets: false,
    failWrites: false,
    Preferences: {
      get: async ({ key }: { key: string }) => {
        if (prefs.failGets) throw new Error('bridge down');
        return { value: store.get(key) ?? null };
      },
      set: async ({ key, value }: { key: string; value: string }) => {
        if (prefs.failWrites) throw new Error('disk full');
        store.set(key, value);
      },
      remove: async ({ key }: { key: string }) => {
        if (prefs.failWrites) throw new Error('disk full');
        store.delete(key);
      },
    },
  };
});
vi.mock('@capacitor/preferences', () => ({ Preferences: prefs.Preferences }));

const ACTIVE = 'rummy_active_game_v1';
const LIST = 'rummy_saved_games_list_v1';

function game(id: string, status: GameState['status'] = 'playing', createdAt = 1): GameState {
  return {
    gameId: id,
    title: `Match ${id}`,
    createdAt,
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


beforeEach(() => {
  localStorage.clear();
  prefs.store.clear();
  prefs.failGets = false;
  prefs.failWrites = false;
  resetStorageStateForTests();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('restoring a backup', () => {
  it('a restore that could not be stored fails loudly', async () => {
    const backup = readBackup(JSON.stringify({ version: 1, savedGames: [game('g1')], savedPlayers: [] }));
    if (!backup.ok) throw new Error(backup.message);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    prefs.failWrites = true;
    await expect(restoreBackup(backup.backup)).rejects.toThrow();
  });
});

describe('protecting the Android copy', () => {
  it('if it could not be read at startup, it is not overwritten by a nearly empty list', async () => {
    prefs.store.set(LIST, JSON.stringify([game('old1'), game('old2')]));
    prefs.failGets = true;
    await hydrateFromPreferences();
    prefs.failGets = false;

    await saveActiveGame(game('new'));
    expect(JSON.parse(prefs.store.get(LIST)!).map((g: GameState) => g.gameId)).toEqual(['old1', 'old2']);
  });

  it('a list that is not a list is backed up before being replaced', async () => {
    localStorage.setItem(LIST, '{"gameId":"lonely"}');
    await saveGameToList(game('g1'));
    expect(localStorage.getItem(`${LIST}_unreadable`)).toBe('{"gameId":"lonely"}');
  });

  it('a crashed match stays cleared even if Android could not forget it', async () => {
    localStorage.setItem(ACTIVE, JSON.stringify(game('crashy')));
    prefs.store.set(ACTIVE, JSON.stringify(game('crashy')));
    prefs.failWrites = true;
    await quarantineActiveGame();
    prefs.failWrites = false;

    await hydrateFromPreferences();
    expect(loadActiveGame()).toBeNull();
  });
});

describe('starting a game', () => {
  it('a player record with no name is refused with a message, not a crash', () => {
    const broken = { id: 'p2', avatarColor: '#000', reEntryCount: 0 } as unknown as Player;
    const message = validateStartGame({
      rules: DEFAULT_RULES,
      players: [{ id: 'p1', name: 'Ravi', avatarColor: '#000', reEntryCount: 0 }, broken],
      initialSeats: ['p1', 'p2'],
      initialDealerIndex: 0,
    });
    expect(message).toMatch(/name/i);
  });
});

describe('re-entry score box', () => {
  function reEntryState(): GameState {
    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'R',
        rules: DEFAULT_RULES,
        players: [
          { id: 'p1', name: 'Ravi', avatarColor: '#000', reEntryCount: 0 },
          { id: 'p2', name: 'Amit', avatarColor: '#000', reEntryCount: 0 },
          { id: 'p3', name: 'Kiran', avatarColor: '#000', reEntryCount: 0 },
        ],
        initialSeats: ['p1', 'p2', 'p3'],
        initialDealerIndex: 0,
      },
    });
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: { roundScores: { p1: { type: 'out', points: 201 }, p2: { type: 'show', points: 0 }, p3: { type: 'open_drop', points: 24 } } },
    });
    return state;
  }

  it('says what is wrong with an out-of-range score instead of quietly changing it', () => {
    const onConfirm = vi.fn();
    render(
      <ReEntryModal isOpen onClose={() => {}} state={reEntryState()} reEnteringPlayerId="p1" onConfirmReEntry={onConfirm} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm re-entry/i }));
    expect(screen.getByText(/between 1 and 200/i)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('the save-failure banner', () => {
  it('goes away once the match it was about is deleted', async () => {
    localStorage.setItem(ACTIVE, JSON.stringify(game('g1')));
    prefs.failWrites = true;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/couldn't save/i));

    setItem.mockRestore();
    prefs.failWrites = false;
    fireEvent.click(screen.getByText('Ongoing Game'));
    fireEvent.click(screen.getByTitle('Delete Game'));
    await waitFor(() => expect(screen.queryByText(/couldn't save/i)).toBeNull());
  });
});

it('still lists saved games after all this', () => {
  localStorage.setItem(LIST, JSON.stringify([game('g1')]));
  expect(loadAllSavedGames()).toHaveLength(1);
});
