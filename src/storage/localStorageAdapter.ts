import { Preferences } from '@capacitor/preferences';
import { GameState } from '../domain/types';

const ACTIVE_GAME_KEY = 'rummy_active_game_v1';
const SAVED_PLAYERS_KEY = 'rummy_saved_players_v1';

export async function saveActiveGame(state: GameState): Promise<void> {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(ACTIVE_GAME_KEY, serialized);
    await Preferences.set({ key: ACTIVE_GAME_KEY, value: serialized });
  } catch (e) {
    console.error('Failed to save active game', e);
  }
}

export async function loadActiveGameAsync(): Promise<GameState | null> {
  try {
    const { value } = await Preferences.get({ key: ACTIVE_GAME_KEY });
    if (value) return JSON.parse(value);
    const raw = localStorage.getItem(ACTIVE_GAME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return loadActiveGame();
  }
}

function isValidGameState(obj: any): obj is GameState {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.gameId === 'string' &&
    Array.isArray(obj.seats) &&
    typeof obj.players === 'object' &&
    Array.isArray(obj.rounds) &&
    typeof obj.rules === 'object' &&
    typeof obj.rules.poolLimit === 'number'
  );
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

export const DEFAULT_ROSTER: SavedRosterPlayer[] = [
  { id: 'p_aashu', name: 'Aashu' },
  { id: 'p_atthaya', name: 'Atthaya' },
  { id: 'p_bava', name: 'Bava' },
  { id: 'p_chellai', name: 'Chellai' },
  { id: 'p_kannamma', name: 'Kannamma' },
  { id: 'p_pavan', name: 'Pavan bava' },
  { id: 'p_pedha', name: 'Pedha akka' },
];

export function savePlayerRoster(players: SavedRosterPlayer[]): void {
  try {
    localStorage.setItem(SAVED_PLAYERS_KEY, JSON.stringify(players));
  } catch (e) {
    console.error('Failed to save players', e);
  }
}

export function loadPlayerRoster(): SavedRosterPlayer[] {
  try {
    const raw = localStorage.getItem(SAVED_PLAYERS_KEY);
    if (!raw) return DEFAULT_ROSTER;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ROSTER;
  } catch (e) {
    return DEFAULT_ROSTER;
  }
}
