import { Preferences } from '@capacitor/preferences';
import { GameState } from '../domain/types';

const ACTIVE_GAME_KEY = 'rummy_active_game_v1';
const SAVED_GAMES_LIST_KEY = 'rummy_saved_games_list_v1';
const SAVED_PLAYERS_KEY = 'rummy_saved_players_v1';

export async function saveActiveGame(state: GameState): Promise<void> {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(ACTIVE_GAME_KEY, serialized);
    await Preferences.set({ key: ACTIVE_GAME_KEY, value: serialized });
    await saveGameToList(state);
  } catch (e) {
    console.error('Failed to save active game', e);
  }
}

export function loadAllSavedGames(): GameState[] {
  try {
    const raw = localStorage.getItem(SAVED_GAMES_LIST_KEY);
    if (!raw) {
      const active = loadActiveGame();
      return active ? [active] : [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidGameState) : [];
  } catch (e) {
    console.error('Failed to parse saved games list from storage:', e);
    const raw = localStorage.getItem(SAVED_GAMES_LIST_KEY);
    if (raw) {
      try {
        localStorage.setItem(`${SAVED_GAMES_LIST_KEY}_corrupted_${Date.now()}`, raw);
      } catch {
        // Ignore backup failure
      }
    }
    return [];
  }
}

export async function saveGameToList(state: GameState): Promise<void> {
  try {
    const all = loadAllSavedGames();
    const existingIndex = all.findIndex(g => g.gameId === state.gameId);
    let updated: GameState[];
    if (existingIndex >= 0) {
      updated = [...all];
      updated[existingIndex] = state;
    } else {
      updated = [state, ...all];
    }
    // Cap to the most recent 30 games to prevent storage quota exhaustion
    updated = updated.slice(0, 30);
    const serialized = JSON.stringify(updated);
    localStorage.setItem(SAVED_GAMES_LIST_KEY, serialized);
    await Preferences.set({ key: SAVED_GAMES_LIST_KEY, value: serialized });
  } catch (e) {
    console.error('Failed to save game to list', e);
  }
}

export async function deleteGameFromList(gameId: string): Promise<void> {
  try {
    const all = loadAllSavedGames();
    const updated = all.filter(g => g.gameId !== gameId);
    const serialized = JSON.stringify(updated);
    localStorage.setItem(SAVED_GAMES_LIST_KEY, serialized);
    await Preferences.set({ key: SAVED_GAMES_LIST_KEY, value: serialized });

    const active = loadActiveGame();
    if (active && active.gameId === gameId) {
      await clearActiveGame();
    }
  } catch (e) {
    console.error('Failed to delete game from list', e);
  }
}

export async function loadActiveGameAsync(): Promise<GameState | null> {
  try {
    const { value } = await Preferences.get({ key: ACTIVE_GAME_KEY });
    if (value) {
      const parsed = JSON.parse(value);
      if (isValidGameState(parsed)) return parsed;
    }
    return loadActiveGame();
  } catch (e) {
    return loadActiveGame();
  }
}

export function isValidGameState(obj: unknown): obj is GameState {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const candidate = obj as Record<string, any>;

  if (typeof candidate.gameId !== 'string' || !candidate.gameId) return false;
  if (typeof candidate.title !== 'string') return false;
  if (typeof candidate.createdAt !== 'number') return false;
  if (!['setup', 'playing', 'completed'].includes(candidate.status)) return false;
  if (typeof candidate.currentDealerIndex !== 'number' || candidate.currentDealerIndex < 0) return false;

  // Validate rules
  if (!candidate.rules || typeof candidate.rules !== 'object' || Array.isArray(candidate.rules)) return false;
  const { poolLimit, openDrop, middleDrop, fullCount } = candidate.rules;
  if (
    typeof poolLimit !== 'number' ||
    typeof openDrop !== 'number' ||
    typeof middleDrop !== 'number' ||
    typeof fullCount !== 'number'
  ) {
    return false;
  }

  // Validate players dictionary
  if (!candidate.players || typeof candidate.players !== 'object' || Array.isArray(candidate.players)) return false;
  for (const [id, player] of Object.entries(candidate.players)) {
    if (!player || typeof player !== 'object' || (player as any).id !== id || typeof (player as any).name !== 'string') {
      return false;
    }
  }

  // Validate seats
  if (!Array.isArray(candidate.seats) || candidate.seats.length === 0) return false;
  for (const seatId of candidate.seats) {
    if (typeof seatId !== 'string' || !candidate.players[seatId]) return false;
  }

  // Validate rounds
  if (!Array.isArray(candidate.rounds)) return false;

  return true;
}

export function loadActiveGame(): GameState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidGameState(parsed) ? parsed : null;
  } catch (e) {
    console.error('Failed to load active game', e);
    return null;
  }
}

export async function clearActiveGame(): Promise<void> {
  try {
    localStorage.removeItem(ACTIVE_GAME_KEY);
    await Preferences.remove({ key: ACTIVE_GAME_KEY });
  } catch (e) {
    console.error('Failed to clear active game', e);
  }
}

export interface SavedRosterPlayer {
  id: string;
  name: string;
}

export const DEFAULT_ROSTER: SavedRosterPlayer[] = [];

// Sample test IDs to purge from existing storage
const LEGACY_SAMPLE_IDS = new Set([
  'p_aashu',
  'p_atthaya',
  'p_bava',
  'p_chellai',
  'p_kannamma',
  'p_pavan',
  'p_pedha',
]);

export function savePlayerRoster(players: SavedRosterPlayer[]): void {
  try {
    const serialized = JSON.stringify(players);
    localStorage.setItem(SAVED_PLAYERS_KEY, serialized);
    Preferences.set({ key: SAVED_PLAYERS_KEY, value: serialized }).catch(err => {
      console.warn('Failed to sync player roster to native Preferences:', err);
    });
  } catch (e) {
    console.error('Failed to save players', e);
  }
}

export function loadPlayerRoster(): SavedRosterPlayer[] {
  try {
    const raw = localStorage.getItem(SAVED_PLAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Purge test/sample data if present
    const cleaned = parsed.filter(p => p && p.id && !LEGACY_SAMPLE_IDS.has(p.id));
    if (cleaned.length !== parsed.length) {
      savePlayerRoster(cleaned);
    }
    return cleaned;
  } catch (e) {
    console.error('Failed to read or parse player roster from storage:', e);
    return [];
  }
}

export interface BackupDataPayload {
  version: number;
  exportedAt: number;
  activeGame: GameState | null;
  savedGames: GameState[];
  savedPlayers: SavedRosterPlayer[];
}

export function exportAllData(): string {
  const payload: BackupDataPayload = {
    version: 1,
    exportedAt: Date.now(),
    activeGame: loadActiveGame(),
    savedGames: loadAllSavedGames(),
    savedPlayers: loadPlayerRoster(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importAllData(jsonStr: string): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'Invalid backup file format' };
    }

    let restoredGames = 0;
    let restoredPlayers = 0;

    if (Array.isArray(parsed.savedPlayers)) {
      const validPlayers = parsed.savedPlayers.filter(
        (p: any) => p && typeof p.id === 'string' && typeof p.name === 'string'
      );
      savePlayerRoster(validPlayers);
      restoredPlayers = validPlayers.length;
    }

    if (Array.isArray(parsed.savedGames)) {
      const validGames = parsed.savedGames.filter(isValidGameState);
      const serialized = JSON.stringify(validGames);
      localStorage.setItem(SAVED_GAMES_LIST_KEY, serialized);
      Preferences.set({ key: SAVED_GAMES_LIST_KEY, value: serialized }).catch(() => {});
      restoredGames = validGames.length;
    }

    if (parsed.activeGame && isValidGameState(parsed.activeGame)) {
      saveActiveGame(parsed.activeGame);
    }

    return {
      success: true,
      message: `Successfully restored ${restoredGames} matches and ${restoredPlayers} players!`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to parse backup file' };
  }
}
