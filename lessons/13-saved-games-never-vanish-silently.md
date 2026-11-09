# 13 · Saved games must never vanish silently

## The problem it solves

The app saves every match in two places:
- **`localStorage`**: storage inside the WebView (the browser engine the app runs in). It's fast and synchronous, and it's what the app reads.
- **Capacitor `Preferences`**: Android's own app storage (`SharedPreferences`). It survives the WebView's data being cleared.

The reviewers found five ways data could still be lost **without the user knowing**:

| # | Problem | What the user would see |
|---|---|---|
| a | The Android copy was **written but never read** | Android clears WebView data → empty app, every game and player gone, while the backup sits unused |
| b | Failed saves were only `console.error`'d, which is invisible on a phone | Storage full → an hour of scores not saved, no warning |
| c | Unreadable games were **filtered out, then the filtered list was written back** | One bad entry silently deleted for good |
| d | Saves and deletes were **fire-and-forget and could overlap** | A deleted game reappears. Deleting the open match from Continue Game left it on screen, so the next change saved it again |
| e | The **30-game cap dropped the oldest game**, even one still being played | An unfinished match quietly disappears |

## Everyday analogy: a shop ledger with a carbon copy

- If the top sheet gets wet, **read the carbon copy** (a).
- If the pen runs dry, the clerk **says so** instead of pretending to write (b).
- A smudged page is **kept**, not torn out (c).
- Entries go into the carbon book **one at a time, in order**, so a later "cancel" can't be overwritten by an earlier "sale" (d).
- When the drawer is full, archive **closed** accounts, never open ones (e).

## The design

`src/storage/localStorageAdapter.ts`:

### One ordered queue for the Android copy (d)

```ts
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
```

- `mirrorQueue.then(write, write)` chains each write **after** the previous one, whether that one succeeded or failed. It's a **promise queue**: a one-lane road where nothing overtakes.
- Each call returns `true`/`false`, so callers know whether the Android copy took it.
- `localStorage` writes are synchronous and happen immediately. The old code wrote the list only *after* awaiting an Android write, which is how a delete could be overtaken.

### Restore before the first screen (a)

```ts
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
```

`src/main.tsx` runs it **before** React starts, because the app reads saved games synchronously while drawing its first screen:

```tsx
// Restore anything Android kept that the WebView lost before the app reads saved games.
hydrateFromPreferences().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(/* ... */);
});
```

- It only fills **missing** keys. Data already in `localStorage` is newer and is never overwritten.
- `.finally` means the app starts **even if** restoring fails.
- We first wrote `await hydrateFromPreferences()` at the top level of the file. That's **top-level await**, which our build target (older browser JavaScript) doesn't allow, so `.then/.finally` it is. Always run `npm run build`, not just the tests.

### Saving reports the truth (b)

```ts
/** Saves the match on screen and its entry in the saved list. Resolves false if neither store took it. */
export async function saveActiveGame(state: GameState): Promise<boolean> {
  const serialized = JSON.stringify(state);
  const local = writeLocal(ACTIVE_GAME_KEY, serialized);
  const native = mirror(ACTIVE_GAME_KEY, serialized);
  const listed = saveGameToList(state);
  const [nativeOk, listOk] = await Promise.all([native, listed]);
  return (local || nativeOk) && listOk;
}
```

It's saved if **either** store holds it. `src/App.tsx` turns a `false` into a visible banner:

```tsx
// Save every change; if the phone couldn't store it, say so instead of losing it quietly.
useEffect(() => {
  if (state.status !== 'playing' && state.status !== 'completed') return;
  let current = true;
  saveActiveGame(state).then(ok => {
    if (current) setSaveFailed(!ok);
  });
  return () => {
    current = false;
  };
}, [state]);
```

`current` guards against an **old** save's answer arriving after a newer one. The cleanup flips it to `false` when the next change starts. The banner (`role="alert"`) reads: *"Couldn't save this match. Your phone may be out of space. Free some up, or export a backup from Settings."* It disappears as soon as a save succeeds again.

### Keep what you can't read (c), and back up a broken list once

```ts
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
```

- **Writes work on the raw list**, so entries the app can't read stay in place untouched. **Reads** (`loadAllSavedGames`) still filter to valid games for display.
- A list that isn't JSON at all is copied **once** to `rummy_saved_games_list_v1_unreadable`. The old code made a new timestamped key **on every load**, which slowly filled up storage.

### Make room only from finished games (e)

```ts
export const MAX_SAVED_GAMES = 50;

// Over the limit, drop the oldest finished matches; a match still in progress is never dropped.
function trimToLimit(list: unknown[]): unknown[] {
  const trimmed = [...list];
  for (let i = trimmed.length - 1; i >= 0 && trimmed.length > MAX_SAVED_GAMES; i--) {
    if (isFinished(trimmed[i])) trimmed.splice(i, 1);
  }
  return trimmed;
}
```

The newest is first, so walking from the end visits the oldest first. If every game is still in progress the list may go over 50, and that's the right trade.

### Deleting the open match from Continue Game (d)

`ContinueGameScreen` now calls `onGameDeleted(gameId)`, and `App` resets if that's the match on screen:

```tsx
const handleGameDeletedFromList = useCallback(
  (gameId: string) => {
    if (gameId === state.gameId) dispatch({ type: 'RESET_GAME' });
  },
  [state.gameId]
);
```

Without this, Home still offered the deleted match, and the next state change saved it back. The Continue Game back button also got `title`/`aria-label="Back"`. It had no label at all, so screen readers and tests couldn't find it.

Everything else that touched `Preferences` directly (roster, announce setting, crash quarantine, import) now goes through `mirror`. The unused `loadActiveGameAsync` was deleted.

## The tests (`src/test/storageSafety.test.tsx`, 11 tests)

**Faking Android storage.** Capacitor plugins are **proxy objects**, so `vi.spyOn(Preferences, 'set')` fails with *"The property set is not defined"*. Instead, `vi.mock('@capacitor/preferences', ...)` swaps in a small in-memory store with a `failWrites` switch.

| Test | Covers |
|---|---|
| WebView wiped: match, list and players come back from Preferences | a |
| Existing local data isn't overwritten by an older Android copy | a |
| Save → `true`. Both stores fail → `false`. Only Android works → still `true` | b |
| A list with an unreadable entry keeps it after another save | c |
| A corrupt list is backed up once under one key | c |
| A full list drops the oldest **finished** match, keeps the unfinished one | e |
| Save then delete at the same moment: the delete wins, in both stores | d |
| In the App: storage full shows the "Couldn't save" alert | b |
| In the App: deleting the open match in Continue Game removes "Ongoing Game" from Home | d |

All 11 failed before the fix. An older test expected a timestamped `_corrupted_…` key per load. It was updated to the intended single `_unreadable` key, because that behaviour was the bug.

Totals: **136/136** unit tests, **13/13** browser tests, and `npm run build` ✅.

## What can go wrong (interview angle)

**"How do you make sure writes happen in order with async storage?"** Serialise them through a promise queue (or a single writer). Fire-and-forget async writes can complete out of order.

**"What does 'fail loudly' mean on mobile?"** `console.error` is invisible to users. Return a result and show the user something they can act on, such as "free up space, or export a backup".

**"How do you avoid destroying data you don't understand?"** Read-modify-write on the **raw** data, change only what you own, and quarantine what you can't parse instead of dropping it.

**"Why restore before React renders?"** The app reads saved games synchronously on its first render. Restoring afterwards would show an empty app first, and could even save that emptiness over the backup.

## From zero, by hand

1. Write `src/test/storageSafety.test.tsx` as in this repo (with the `vi.mock('@capacitor/preferences')` fake). Run it. Expected: `11 failed`.
2. In `localStorageAdapter.ts`, add `MAX_SAVED_GAMES`, `UNREADABLE_LIST_KEY`, `mirror`, `writeLocal`, `hydrateFromPreferences`, `readRawList`, `entryId`, `isFinished`, `trimToLimit` and `writeList`. Rewrite `saveActiveGame`, `loadAllSavedGames`, `saveGameToList`, `deleteGameFromList` and `clearActiveGame` as above. Route the roster, announce, quarantine and import writes through `mirror`. Delete `loadActiveGameAsync`.
3. In `ContinueGameScreen.tsx`, add the `onGameDeleted` prop (called after a delete) and the Back `title`/`aria-label`.
4. In `App.tsx`, add `saveFailed` state, the save effect, `handleGameDeletedFromList`, the `onGameDeleted` prop and the alert banner.
5. In `main.tsx`, wrap the render in `hydrateFromPreferences().finally(...)`.
6. In `localStorageAdapter.test.ts`, change the corrupt-list test to expect `rummy_saved_games_list_v1_unreadable`.
7. Run `npx vitest run && npx tsc -b && npm run lint && npm run build && npm run test:e2e`. Expected: `136 passed`, clean, clean, `built in …`, `13 passed`.
