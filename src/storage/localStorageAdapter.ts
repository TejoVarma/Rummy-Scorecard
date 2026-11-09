import { Preferences } from '@capacitor/preferences';
import { GameState } from '../domain/types';

const ACTIVE_GAME_KEY = 'rummy_active_game_v1';
const SAVED_GAMES_LIST_KEY = 'rummy_saved_games_list_v1';
const SAVED_PLAYERS_KEY = 'rummy_saved_players_v1';
const ANNOUNCE_KEY = 'rummy_announce_after_round_v1';

export const MAX_SAVED_GAMES = 50;
const UNREADABLE_LIST_KEY = `${SAVED_GAMES_LIST_KEY}_unreadable`;

// localStorage is the working copy the app reads synchronously. Every write is also
// mirrored to Capacitor Preferences (Android's own storage), which survives the WebView's
// data being cleared. Mirror writes run one at a time, in order, so a later delete can
// never be overtaken by an earlier save.
let mirrorQueue: Promise<unknown> = Promise.resolve();

function mirror(key: string, value: string | null): Promise<boolean> {
  const write = async () => {
    try {
      if (value === null) await Preferences.remove({ key });
      else await Preferences.set({ key, value });
      return true;
    } catch (e) {
      console.error(`Failed to mirror ${key} to Preferences`, e);
      return false;
    }
  };
  const result = mirrorQueue.then(write, write);
  mirrorQueue = result;
  return result;
}

function writeLocal(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error(`Failed to write ${key} to localStorage`, e);
    return false;
  }
}

const MIRRORED_KEYS = [ACTIVE_GAME_KEY, SAVED_GAMES_LIST_KEY, SAVED_PLAYERS_KEY, ANNOUNCE_KEY];

/** Before the first render: refill anything missing from localStorage using the Android copy. */
export async function hydrateFromPreferences(): Promise<void> {
  for (const key of MIRRORED_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) continue;
      const { value } = await Preferences.get({ key });
      if (value !== null) localStorage.setItem(key, value);
    } catch (e) {
      console.error(`Failed to restore ${key} from Preferences`, e);
    }
  }
}

/** The raw saved list, unreadable entries included, or null if the list itself is corrupt. */
function readRawList(): unknown[] | null {
  const raw = localStorage.getItem(SAVED_GAMES_LIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    if (localStorage.getItem(UNREADABLE_LIST_KEY) !== raw) writeLocal(UNREADABLE_LIST_KEY, raw);
    return null;
  }
}

const entryId = (entry: unknown) =>
  typeof entry === 'object' && entry !== null && 'gameId' in entry ? entry.gameId : undefined;

const isFinished = (entry: unknown) =>
  typeof entry === 'object' && entry !== null && 'status' in entry && entry.status === 'completed';

// Over the limit, drop the oldest finished matches; a match still in progress is never dropped.
function trimToLimit(list: unknown[]): unknown[] {
  const trimmed = [...list];
  for (let i = trimmed.length - 1; i >= 0 && trimmed.length > MAX_SAVED_GAMES; i--) {
    if (isFinished(trimmed[i])) trimmed.splice(i, 1);
  }
  return trimmed;
}

async function writeList(list: unknown[]): Promise<boolean> {
  const serialized = JSON.stringify(list);
  const local = writeLocal(SAVED_GAMES_LIST_KEY, serialized);
  const native = await mirror(SAVED_GAMES_LIST_KEY, serialized);
  return local || native;
}

/** Saves the match on screen and its entry in the saved list. Resolves false if neither store took it. */
export async function saveActiveGame(state: GameState): Promise<boolean> {
  const serialized = JSON.stringify(state);
  const local = writeLocal(ACTIVE_GAME_KEY, serialized);
  const native = mirror(ACTIVE_GAME_KEY, serialized);
  const listed = saveGameToList(state);
  const [nativeOk, listOk] = await Promise.all([native, listed]);
  return (local || nativeOk) && listOk;
}

export function loadAllSavedGames(): GameState[] {
  try {
    return (readRawList() ?? []).filter(isValidGameState);
  } catch (e) {
    console.error('Failed to read the saved games list', e);
    return [];
  }
}

export async function saveGameToList(state: GameState): Promise<boolean> {
  const list = readRawList() ?? [];
  const index = list.findIndex(entry => entryId(entry) === state.gameId);
  const updated = index >= 0 ? list.map((entry, i) => (i === index ? state : entry)) : [state, ...list];
  return writeList(trimToLimit(updated));
}

export async function deleteGameFromList(gameId: string): Promise<boolean> {
  const list = readRawList() ?? [];
  const ok = await writeList(list.filter(entry => entryId(entry) !== gameId));
  const active = loadActiveGame();
  if (active && active.gameId === gameId) await clearActiveGame();
  return ok;
}

export function isValidGameState(obj: unknown): obj is GameState {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const candidate = obj as Record<string, unknown>;

  if (typeof candidate.gameId !== 'string' || !candidate.gameId) return false;
  if (typeof candidate.title !== 'string') return false;
  if (typeof candidate.createdAt !== 'number') return false;
  if (!['setup', 'playing', 'completed'].includes(candidate.status as string)) return false;
  if (typeof candidate.currentDealerIndex !== 'number' || candidate.currentDealerIndex < 0) return false;

  // Validate rules
  if (!isPlainObject(candidate.rules)) return false;
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
  const players = candidate.players;
  if (!isPlainObject(players)) return false;
  for (const [id, player] of Object.entries(players)) {
    if (!isPlainObject(player) || player.id !== id || typeof player.name !== 'string') {
      return false;
    }
  }

  // Validate seats
  if (!Array.isArray(candidate.seats) || candidate.seats.length === 0) return false;
  for (const seatId of candidate.seats) {
    if (typeof seatId !== 'string' || !players[seatId]) return false;
  }

  if (candidate.currentDealerIndex >= candidate.seats.length) return false;

  // Validate rounds
  if (!Array.isArray(candidate.rounds)) return false;
  for (const round of candidate.rounds) {
    if (!isValidRound(round)) return false;
  }

  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The scoreboard reads every round's cumulative scores while drawing, so a
// malformed round must be rejected here rather than crash the screen.
function isValidRound(round: unknown): boolean {
  if (!isPlainObject(round)) return false;
  if (!isPlainObject(round.scores) || !isPlainObject(round.cumulativeScores)) return false;
  if (!Object.values(round.cumulativeScores).every(Number.isFinite)) return false;
  if (!Array.isArray(round.seatsSnapshot)) return false;
  return true;
}

const CRASHED_GAME_BACKUP_KEY = 'rummy_crashed_game_backup';

/**
 * Takes the active match out of play after it crashed the app: keeps a raw copy
 * under a backup key, removes it from the saved list and clears it everywhere.
 */
export async function quarantineActiveGame(): Promise<void> {
  const raw = localStorage.getItem(ACTIVE_GAME_KEY);
  if (raw) {
    try {
      localStorage.setItem(CRASHED_GAME_BACKUP_KEY, raw);
    } catch (e) {
      // Storage may be full; clearing the match still matters more than the copy.
      console.error('Could not back up the crashed match', e);
    }
    removeFromSavedList(raw);
  }
  localStorage.removeItem(ACTIVE_GAME_KEY);
  await mirror(ACTIVE_GAME_KEY, null);
}

function removeFromSavedList(rawActiveGame: string): void {
  try {
    const { gameId } = JSON.parse(rawActiveGame);
    const list = JSON.parse(localStorage.getItem(SAVED_GAMES_LIST_KEY) ?? '[]');
    if (!gameId || !Array.isArray(list)) return;
    const remaining = list.filter((g: { gameId?: unknown }) => g?.gameId !== gameId);
    const serialized = JSON.stringify(remaining);
    localStorage.setItem(SAVED_GAMES_LIST_KEY, serialized);
    void mirror(SAVED_GAMES_LIST_KEY, serialized);
  } catch {
    // The active game or list is unreadable; the raw copy is already backed up.
  }
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
  writeLocal(ACTIVE_GAME_KEY, null);
  await mirror(ACTIVE_GAME_KEY, null);
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
    void mirror(SAVED_PLAYERS_KEY, serialized);
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

export const MAX_BACKUP_BYTES = 5_000_000;
const BACKUP_VERSION = 1;
const NOT_A_BACKUP = 'This is not a Rummy Scorecard backup file.';

export interface RestorableBackup {
  games: GameState[];
  players: SavedRosterPlayer[];
  skippedGames: number;
}

const isRosterPlayer = (p: unknown): p is SavedRosterPlayer =>
  isPlainObject(p) && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim() !== '';

/** Reads and checks a whole backup file without writing anything. */
export function readBackup(json: string): { ok: true; backup: RestorableBackup } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: NOT_A_BACKUP };
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.savedGames) || !Array.isArray(parsed.savedPlayers)) {
    return { ok: false, message: NOT_A_BACKUP };
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    return { ok: false, message: 'This backup was made by a newer version of the app. Update the app first.' };
  }

  const games = parsed.savedGames.filter(isValidGameState);
  const active = parsed.activeGame;
  if (isValidGameState(active) && !games.some(g => g.gameId === active.gameId)) games.unshift(active);

  return {
    ok: true,
    backup: {
      games,
      players: parsed.savedPlayers.filter(isRosterPlayer),
      skippedGames: parsed.savedGames.length - parsed.savedGames.filter(isValidGameState).length,
    },
  };
}

/**
 * Adds a checked backup to what's already on the phone. Nothing is deleted: a match in
 * both keeps whichever copy has more rounds, and existing player names are kept.
 * The match currently open is left alone.
 */
export async function restoreBackup(
  backup: RestorableBackup
): Promise<{ added: number; updated: number; playersAdded: number }> {
  const list = readRawList() ?? [];
  let added = 0;
  let updated = 0;

  for (const incoming of backup.games) {
    const index = list.findIndex(entry => entryId(entry) === incoming.gameId);
    if (index < 0) {
      list.push(incoming);
      added++;
      continue;
    }
    const existing = list[index];
    const existingRounds = isValidGameState(existing) ? existing.rounds.length : -1;
    if (incoming.rounds.length > existingRounds) {
      list[index] = incoming;
      updated++;
    }
  }

  const roster = loadPlayerRoster();
  const known = new Set(roster.map(p => p.id));
  const newPlayers = backup.players.filter(p => !known.has(p.id));

  await writeList(list);
  if (newPlayers.length > 0) savePlayerRoster([...roster, ...newPlayers]);
  await mirrorQueue;

  return { added, updated, playersAdded: newPlayers.length };
}

export function loadAnnounceAfterRound(): boolean {
  try {
    return localStorage.getItem(ANNOUNCE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAnnounceAfterRound(on: boolean): void {
  try {
    localStorage.setItem(ANNOUNCE_KEY, String(on));
    void mirror(ANNOUNCE_KEY, String(on));
  } catch (e) {
    console.error('Failed to save the announce setting', e);
  }
}
