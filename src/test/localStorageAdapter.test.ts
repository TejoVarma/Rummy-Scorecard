import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidGameState,
  loadAllSavedGames,
  exportAllData,
  readBackup,
  restoreBackup,
  loadPlayerRoster,
} from '../storage/localStorageAdapter';
import { GameState } from '../domain/types';

// Mock in-memory localStorage for Node test runner
const memoryStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => memoryStore[key] ?? null,
  setItem: (key: string, value: string) => {
    memoryStore[key] = String(value);
  },
  removeItem: (key: string) => {
    delete memoryStore[key];
  },
  clear: () => {
    Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  },
  get length() {
    return Object.keys(memoryStore).length;
  },
  key: (i: number) => Object.keys(memoryStore)[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('localStorageAdapter Schema Validation', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const validGameState: GameState = {
    gameId: 'game_123',
    title: 'Test Game',
    createdAt: Date.now(),
    status: 'playing',
    rules: {
      poolLimit: 201,
      openDrop: 24,
      middleDrop: 48,
      fullCount: 80,
      allowReEntry: true,
    },
    players: {
      p1: { id: 'p1', name: 'Akka', avatarColor: '#10b981', reEntryCount: 0 },
      p2: { id: 'p2', name: 'Bava', avatarColor: '#3b82f6', reEntryCount: 0 },
    },
    seats: ['p1', 'p2'],
    currentDealerIndex: 0,
    rounds: [],
  };

  it('validates a correct GameState', () => {
    expect(isValidGameState(validGameState)).toBe(true);
  });

  it('rejects null, non-objects, and arrays', () => {
    expect(isValidGameState(null)).toBe(false);
    expect(isValidGameState(undefined)).toBe(false);
    expect(isValidGameState('hello')).toBe(false);
    expect(isValidGameState(12345)).toBe(false);
    expect(isValidGameState([])).toBe(false);
  });

  it('rejects objects with null or missing rules', () => {
    expect(isValidGameState({ ...validGameState, rules: null })).toBe(false);
    expect(isValidGameState({ ...validGameState, rules: {} })).toBe(false);
  });

  it('rejects objects with missing or corrupt players dictionary', () => {
    expect(isValidGameState({ ...validGameState, players: null })).toBe(false);
    expect(isValidGameState({ ...validGameState, players: { p1: null } })).toBe(false);
  });

  it('enforces referential integrity between seats and players', () => {
    // p3 is in seats but NOT in players
    expect(isValidGameState({ ...validGameState, seats: ['p1', 'p3'] })).toBe(false);
  });

  it('still loads games saved by older versions that had a re-entry mode setting', () => {
    const older = { ...validGameState, rules: { ...validGameState.rules, reEntryScoreMode: 'highest_plus_one' } };
    expect(isValidGameState(older)).toBe(true);
  });

  it('preserves corrupted backup key when saved games list contains corrupted JSON', () => {
    mockLocalStorage.setItem('rummy_saved_games_list_v1', '{ invalid json garbage');
    const result = loadAllSavedGames();
    expect(result).toEqual([]);

    // The unreadable list is kept under one backup key, not a new key per load
    expect(mockLocalStorage.getItem('rummy_saved_games_list_v1_unreadable')).toBe('{ invalid json garbage');
  });

  it('exports and imports complete application backup JSON cleanly', async () => {
    const backupJson = exportAllData();
    expect(backupJson).toContain('"version": 1');

    // Simulate import of backup
    const testBackup = JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      savedPlayers: [
        { id: 'p_custom1', name: 'Ravi' },
        { id: 'p_custom2', name: 'Sita' },
      ],
      savedGames: [validGameState],
    });

    const read = readBackup(testBackup);
    expect(read.ok).toBe(true);
    if (read.ok) await restoreBackup(read.backup);

    const loadedRoster = loadPlayerRoster();
    expect(loadedRoster.some(p => p.name === 'Ravi')).toBe(true);

    const loadedGames = loadAllSavedGames();
    expect(loadedGames.length).toBe(1);
    expect(loadedGames[0].gameId).toBe('game_123');
  });
});
