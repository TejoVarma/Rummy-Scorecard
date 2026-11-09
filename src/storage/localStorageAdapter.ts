import { Preferences } from '@capacitor/preferences';
import { GameState } from '../domain/types';
import { isPlainObject, isValidGameState } from '../domain/validation';

export { isValidGameState };

const ACTIVE_GAME_KEY = 'rummy_active_game_v1';
const SAVED_GAMES_LIST_KEY = 'rummy_saved_games_list_v1';
const SAVED_PLAYERS_KEY = 'rummy_saved_players_v1';
const ANNOUNCE_KEY = 'rummy_announce_after_round_v1';

const UNREADABLE_LIST_KEY = `${SAVED_GAMES_LIST_KEY}_unreadable`;

// localStorage is the working copy the app reads synchronously. Every write is also
// mirrored to Capacitor Preferences (Android's own storage), which survives the WebView's
// data being cleared. Mirror writes run one at a time, in order, so a later delete can
// never be overtaken by an earlier save.
let mirrorQueue: Promise<unknown> = Promise.resolve();

// Keys whose Android copy couldn't be read at startup. Writing them now could replace
// a full backup with a nearly empty list, so they're left alone until the next launch.
const unrestoredKeys = new Set<string>();

const PREFERENCES_TIMEOUT_MS = 4000;

// A call that times out may still finish later and land after newer writes; that's rare
// enough to accept, and the timeout keeps one stuck call from freezing everything behind it.
function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Phone storage did not respond')), PREFERENCES_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// Keys whose latest change didn't reach the Android copy, so that copy is out of date.
const behindKeys = new Set<string>();

/** True when recent changes are only in the WebView, not yet in Android's own storage. */
export function isBackupCopyBehind(): boolean {
  return behindKeys.size > 0;
}

/** True when part of the Android copy couldn't be read at startup. */
export function isBackupCopyUnavailable(): boolean {
  return unrestoredKeys.size > 0;
}

export function resetStorageStateForTests(): void {
  unrestoredKeys.clear();
  behindKeys.clear();
  mirrorQueue = Promise.resolve();
}

function mirror(key: string, value: string | null): Promise<boolean> {
  const write = async () => {
    if (unrestoredKeys.has(key)) return false;
    try {
      if (value === null) await withTimeout(Preferences.remove({ key }));
      else await withTimeout(Preferences.set({ key, value }));
      behindKeys.delete(key);
      return true;
    } catch (e) {
      console.error(`Failed to mirror ${key} to Preferences`, e);
      behindKeys.add(key);
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
  await Promise.all(
    MIRRORED_KEYS.map(async key => {
      try {
        if (localStorage.getItem(key) !== null) return;
        const { value } = await withTimeout(Preferences.get({ key }));
        if (value !== null) localStorage.setItem(key, value);
      } catch (e) {
        unrestoredKeys.add(key);
        console.error(`Failed to restore ${key} from Preferences`, e);
      }
    })
  );
}

/** The raw saved list, unreadable entries included, or null if the list itself is corrupt. */
function readRawList(): unknown[] | null {
  const raw = localStorage.getItem(SAVED_GAMES_LIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to keeping a copy
  }
  if (localStorage.getItem(UNREADABLE_LIST_KEY) !== raw) writeLocal(UNREADABLE_LIST_KEY, raw);
  return null;
}

const entryId = (entry: unknown) =>
  typeof entry === 'object' && entry !== null && 'gameId' in entry ? entry.gameId : undefined;

// The app reads localStorage, so a write only counts as saved when localStorage took it.
// The Android copy is a backup; when it falls behind, isBackupCopyBehind() says so.
async function writeList(list: unknown[]): Promise<boolean> {
  const serialized = JSON.stringify(list);
  const local = writeLocal(SAVED_GAMES_LIST_KEY, serialized);
  await mirror(SAVED_GAMES_LIST_KEY, serialized);
  return local;
}

/** Saves the match on screen and its entry in the saved list. Resolves false if the phone couldn't store it. */
export async function saveActiveGame(state: GameState): Promise<boolean> {
  const serialized = JSON.stringify(state);
  const local = writeLocal(ACTIVE_GAME_KEY, serialized);
  const [, listOk] = await Promise.all([mirror(ACTIVE_GAME_KEY, serialized), saveGameToList(state)]);
  return local && listOk;
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
  return writeList(updated);
}

export async function deleteGameFromList(gameId: string): Promise<boolean> {
  const list = readRawList() ?? [];
  const ok = await writeList(list.filter(entry => entryId(entry) !== gameId));
  const active = loadActiveGame();
  if (active && active.gameId === gameId) await clearActiveGame();
  return ok;
}

const CRASHED_GAME_BACKUP_KEY = 'rummy_crashed_game_backup';

/**
 * Takes the active match out of play after it crashed the app. Keeps a raw copy under a
 * backup key and, only once that copy is safe, removes it from the saved list. The match
 * is always cleared from the active slot so the app can open. Resolves whether a copy was kept.
 */
export async function quarantineActiveGame(): Promise<boolean> {
  const raw = localStorage.getItem(ACTIVE_GAME_KEY);
  const keptCopy = raw ? writeLocal(CRASHED_GAME_BACKUP_KEY, raw) : true;
  if (raw && keptCopy) removeFromSavedList(raw);
  writeLocal(ACTIVE_GAME_KEY, null);
  if (!(await mirror(ACTIVE_GAME_KEY, null))) {
    // Android still holds the crashed match. An empty value here stops the startup
    // restore from bringing it back (it only fills keys that are missing).
    writeLocal(ACTIVE_GAME_KEY, '');
  }
  return keptCopy;
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
  } catch (e) {
    // The active game or list is unreadable, or storage is full; the raw copy is already kept.
    console.error('Could not remove the crashed match from the saved list', e);
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

/** Saves the player list; false when the phone couldn't store it. */
export function savePlayerRoster(players: SavedRosterPlayer[]): boolean {
  try {
    const serialized = JSON.stringify(players);
    localStorage.setItem(SAVED_PLAYERS_KEY, serialized);
    void mirror(SAVED_PLAYERS_KEY, serialized);
    return true;
  } catch (e) {
    console.error('Failed to save players', e);
    return false;
  }
}

export function loadPlayerRoster(): SavedRosterPlayer[] {
  try {
    const raw = localStorage.getItem(SAVED_PLAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const withoutSamples = parsed.filter(p => !(isPlainObject(p) && LEGACY_SAMPLE_IDS.has(p.id as string)));
    if (withoutSamples.length !== parsed.length) {
      writeLocal(SAVED_PLAYERS_KEY, JSON.stringify(withoutSamples));
    }
    return withoutSamples.filter(isRosterPlayer);
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

/**
 * The backup file's contents. Pass the match on screen so the backup includes rounds
 * that couldn't be saved (for example when the phone is full).
 */
export function exportAllData(onScreen?: GameState | null): string {
  const current = onScreen && isValidGameState(onScreen) ? onScreen : loadActiveGame();
  const saved = loadAllSavedGames();
  const savedGames = current
    ? [current, ...saved.filter(g => g.gameId !== current.gameId)]
    : saved;
  const payload: BackupDataPayload = {
    version: 1,
    exportedAt: Date.now(),
    activeGame: current,
    savedGames,
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

const lastChange = (g: GameState) => (g.rounds.length ? g.rounds[g.rounds.length - 1].timestamp : g.createdAt);

/** Whether the incoming copy of a match is further along than the one already on the phone. */
function isFurtherAlong(incoming: GameState, existing: unknown): boolean {
  if (!isValidGameState(existing)) return true;
  if (incoming.rounds.length !== existing.rounds.length) return incoming.rounds.length > existing.rounds.length;
  if (Boolean(incoming.dealSplit) !== Boolean(existing.dealSplit)) return Boolean(incoming.dealSplit);
  return lastChange(incoming) > lastChange(existing);
}

function mergeBackup(backup: RestorableBackup) {
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
    if (isFurtherAlong(incoming, list[index])) {
      list[index] = incoming;
      updated++;
    }
  }

  return { list, added, updated };
}

/**
 * Adds a checked backup to what's already on the phone. Nothing is deleted: a match in
 * both keeps the copy that's further along, and existing player names are kept. If the
 * backup is further along on the match that's open, the open match is updated too, so the
 * next save can't undo the restore. Throws if the matches couldn't be stored.
 */
export async function restoreBackup(
  backup: RestorableBackup
): Promise<{ added: number; updated: number; playersAdded: number; playersSaved: boolean }> {
  const { list, added, updated } = mergeBackup(backup);

  const roster = loadPlayerRoster();
  const known = new Set(roster.map(p => p.id));
  const newPlayers: SavedRosterPlayer[] = [];
  for (const p of backup.players) {
    if (known.has(p.id)) continue;
    known.add(p.id);
    newPlayers.push(p);
  }
  const playersSaved = newPlayers.length === 0 || savePlayerRoster([...roster, ...newPlayers]);

  if (!(await writeList(list))) throw new Error('Could not store the restored matches');

  const open = loadActiveGame();
  const restoredOpen = open && backup.games.find(g => g.gameId === open.gameId);
  if (open && restoredOpen && isFurtherAlong(restoredOpen, open)) {
    const serialized = JSON.stringify(restoredOpen);
    if (!writeLocal(ACTIVE_GAME_KEY, serialized)) throw new Error('Could not update the open match');
    void mirror(ACTIVE_GAME_KEY, serialized);
  }
  await mirrorQueue;

  return { added, updated, playersAdded: playersSaved ? newPlayers.length : 0, playersSaved };
}

/** How many saved matches exist but can't be read (shown so nothing disappears silently). */
export function countUnreadableSavedGames(): number {
  const list = readRawList();
  if (list === null) return localStorage.getItem(UNREADABLE_LIST_KEY) ? 1 : 0;
  return list.filter(entry => !isValidGameState(entry)).length;
}

export function loadAnnounceAfterRound(): boolean {
  try {
    return localStorage.getItem(ANNOUNCE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Remembers the announce setting; false when the phone couldn't store it. */
export function saveAnnounceAfterRound(on: boolean): boolean {
  if (!writeLocal(ANNOUNCE_KEY, String(on))) return false;
  void mirror(ANNOUNCE_KEY, String(on));
  return true;
}
