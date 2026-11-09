// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import {
  exportMatch,
  readMatchFile,
  importMatch,
  exportAllData,
  loadAllSavedGames,
  loadActiveGame,
  loadPlayerRoster,
  resetStorageStateForTests,
} from '../storage/localStorageAdapter';
import { ContinueGameScreen } from '../components/continue/ContinueGameScreen';
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
    currentDealerIndex: rounds % 2,
    rounds: Array.from({ length: rounds }, (_, i) => round(i + 1)),
  };
}

beforeEach(() => {
  localStorage.clear();
  prefs.store.clear();
  resetStorageStateForTests();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('match file', () => {
  it('reads back exactly the match that was exported', () => {
    const match = game('g1', 3);
    const result = readMatchFile(exportMatch(match));
    expect(result).toEqual({ ok: true, game: match });
  });

  it('refuses text that is not a match file', () => {
    expect(readMatchFile('hello')).toMatchObject({ ok: false, message: expect.stringMatching(/not a rummy scorecard match/i) });
    expect(readMatchFile('{"kind":"something-else"}')).toMatchObject({ ok: false });
  });

  it('points to Settings when given a full backup instead', () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 1)]));
    expect(readMatchFile(exportAllData())).toMatchObject({ ok: false, message: expect.stringMatching(/settings/i) });
  });

  it('refuses a match file from a newer version of the app', () => {
    const newer = JSON.parse(exportMatch(game('g1', 1)));
    newer.version = 99;
    expect(readMatchFile(JSON.stringify(newer))).toMatchObject({ ok: false, message: expect.stringMatching(/newer version/i) });
  });

  it('refuses a match whose rules make no sense, such as an absurd stake', () => {
    const crafted = JSON.parse(exportMatch(game('g1', 1)));
    crafted.game.rules.entryAmount = 7.95681e295;
    expect(readMatchFile(JSON.stringify(crafted))).toMatchObject({ ok: false, message: expect.stringMatching(/damaged/i) });
  });

  it('refuses seats that point at built-in names instead of real players', () => {
    const crafted = JSON.parse(exportMatch(game('g1', 0)));
    crafted.game.seats = ['p1', 'constructor'];
    expect(readMatchFile(JSON.stringify(crafted))).toMatchObject({ ok: false });
  });

  it('refuses a damaged match', () => {
    const damaged = JSON.parse(exportMatch(game('g1', 1)));
    damaged.game.rounds[0].scores.p2.points = 'lots';
    expect(readMatchFile(JSON.stringify(damaged))).toMatchObject({ ok: false, message: expect.stringMatching(/damaged/i) });
  });
});

describe('importing a match', () => {
  it('adds a new match to the saved list and returns it to open', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('other', 2)]));
    const incoming = game('g1', 3);

    const result = await importMatch(incoming);

    expect(result).toEqual({ outcome: 'added', game: incoming });
    expect(loadAllSavedGames().map(g => g.gameId).sort()).toEqual(['g1', 'other']);
    expect(JSON.parse(prefs.store.get(LIST) ?? '[]')).toHaveLength(2);
  });

  it('asks before replacing the phone copy, then replaces it when the file is further along', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 2)]));
    const confirmReplace = vi.fn(() => true);
    const result = await importMatch(game('g1', 5), confirmReplace);
    expect(confirmReplace).toHaveBeenCalledWith(2, 5);
    expect(result.outcome).toBe('updated');
    expect(loadAllSavedGames()).toHaveLength(1);
    expect(loadAllSavedGames()[0].rounds).toHaveLength(5);
  });

  it('leaves the phone copy alone when replacing is declined', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 2)]));
    const result = await importMatch(game('g1', 5), () => false);
    expect(result.outcome).toBe('cancelled');
    expect(loadAllSavedGames()[0].rounds).toHaveLength(2);
  });

  it('keeps and opens the phone copy when the phone is further along', async () => {
    const onPhone = game('g1', 6);
    localStorage.setItem(LIST, JSON.stringify([onPhone]));
    const result = await importMatch(game('g1', 2));
    expect(result).toEqual({ outcome: 'kept_phone_copy', game: onPhone });
    expect(loadAllSavedGames()[0].rounds).toHaveLength(6);
  });

  it('treats the same copy as already here, not as the phone being ahead', async () => {
    const onPhone = game('g1', 3);
    localStorage.setItem(LIST, JSON.stringify([onPhone]));
    expect(await importMatch(game('g1', 3))).toEqual({ outcome: 'already_here', game: onPhone });
  });

  it('on equal rounds, a settled deal counts as further along', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 3)]));
    const settled = {
      ...game('g1', 3),
      status: 'completed' as const,
      dealSplit: { mode: 'equal' as const, payouts: { p1: 100, p2: 100 }, scoresSnapshot: { p1: 0, p2: 72 }, totalPool: 200, timestamp: 9 },
    };
    expect((await importMatch(settled)).outcome).toBe('updated');
    expect(loadAllSavedGames()[0].dealSplit).toBeDefined();
  });

  it('updates the open match too, so the next save cannot undo the import', async () => {
    localStorage.setItem(ACTIVE, JSON.stringify(game('g1', 1)));
    localStorage.setItem(LIST, JSON.stringify([game('g1', 1)]));
    await importMatch(game('g1', 4));
    expect(loadActiveGame()?.rounds).toHaveLength(4);
  });

  it('leaves an unreadable phone copy of the same match alone and says why', async () => {
    const damaged = { ...game('g1', 12), rounds: 'broken' };
    localStorage.setItem(LIST, JSON.stringify([damaged]));

    const result = await importMatch(game('g1', 3));

    expect(result).toMatchObject({ outcome: 'refused', message: expect.stringMatching(/can't be read/i) });
    expect(JSON.parse(localStorage.getItem(LIST) ?? '[]')).toEqual([damaged]);
  });

  it('changes nothing when the saved list itself cannot be read', async () => {
    localStorage.setItem(LIST, '{not json');

    const result = await importMatch(game('g1', 3));

    expect(result).toMatchObject({ outcome: 'refused', message: expect.stringMatching(/saved matches can't be read/i) });
    expect(localStorage.getItem(LIST)).toBe('{not json');
    expect(prefs.store.has(LIST)).toBe(false);
  });

  it('keeps the open match when it is ahead of both the saved list and the file', async () => {
    const open = game('g1', 6);
    localStorage.setItem(ACTIVE, JSON.stringify(open));
    localStorage.setItem(LIST, JSON.stringify([game('g1', 2)]));

    const result = await importMatch(game('g1', 4));

    expect(result).toEqual({ outcome: 'kept_phone_copy', game: open });
    expect(loadActiveGame()?.rounds).toHaveLength(6);
  });

  it('does not add the match players to the Players list', async () => {
    await importMatch(game('g1', 1));
    expect(loadPlayerRoster()).toEqual([]);
  });

  it('throws when the phone cannot store it', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    await expect(importMatch(game('g1', 1))).rejects.toThrow();
  });
});

describe('Import match on Continue Game', () => {
  function pickFile(text: string) {
    const input = screen.getByLabelText('Import a match file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([text], 'match.json', { type: 'application/json' })] } });
  }

  function renderScreen() {
    const onResumeGame = vi.fn();
    render(
      <ContinueGameScreen onBack={() => {}} onResumeGame={onResumeGame} onStartNewGame={() => {}} onGameDeleted={() => {}} />
    );
    return { onResumeGame };
  }

  it('opens the imported match straight away', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onResumeGame } = renderScreen();
    const incoming = game('g1', 3);

    pickFile(exportMatch(incoming));

    await waitFor(() => expect(onResumeGame).toHaveBeenCalledWith(incoming));
    expect(loadAllSavedGames().map(g => g.gameId)).toEqual(['g1']);
  });

  it('is offered even when there are no saved matches', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: /import match/i })).toBeTruthy();
  });

  it('explains a wrong file and opens nothing', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onResumeGame } = renderScreen();

    pickFile('not a match');

    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringMatching(/not a rummy scorecard match/i)));
    expect(onResumeGame).not.toHaveBeenCalled();
  });

  it('opens an identical copy without a misleading message', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 3)]));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onResumeGame } = renderScreen();

    pickFile(exportMatch(game('g1', 3)));

    await waitFor(() => expect(onResumeGame).toHaveBeenCalled());
    expect(alert).not.toHaveBeenCalled();
  });

  it('refuses a file too big to be a match', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onResumeGame } = renderScreen();
    const input = screen.getByLabelText('Import a match file') as HTMLInputElement;
    const huge = new File(['x'], 'big.json');
    Object.defineProperty(huge, 'size', { value: 1_500_000 });

    fireEvent.change(input, { target: { files: [huge] } });

    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/too big/i));
    expect(onResumeGame).not.toHaveBeenCalled();
  });

  it('says so and opens nothing when the phone cannot store the match', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onResumeGame } = renderScreen();
    const json = exportMatch(game('g1', 1));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    pickFile(json);

    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringMatching(/out of space/i)));
    expect(onResumeGame).not.toHaveBeenCalled();
  });

  it('does not blame storage when opening the saved match fails', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onResumeGame = vi.fn(() => {
      throw new Error('screen failed');
    });
    render(
      <ContinueGameScreen onBack={() => {}} onResumeGame={onResumeGame} onStartNewGame={() => {}} onGameDeleted={() => {}} />
    );

    pickFile(exportMatch(game('g1', 1)));

    await waitFor(() => expect(onResumeGame).toHaveBeenCalled());
    expect(loadAllSavedGames().map(g => g.gameId)).toEqual(['g1']);
    expect(alert).not.toHaveBeenCalledWith(expect.stringMatching(/out of space/i));
  });

  it('says so when the phone already has this match further along', async () => {
    localStorage.setItem(LIST, JSON.stringify([game('g1', 6)]));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onResumeGame } = renderScreen();

    pickFile(exportMatch(game('g1', 2)));

    await waitFor(() => expect(onResumeGame).toHaveBeenCalled());
    expect(onResumeGame.mock.calls[0][0].rounds).toHaveLength(6);
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/already has this match further along/i));
  });
});
