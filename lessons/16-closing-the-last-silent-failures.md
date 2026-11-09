# 16 · Closing the last silent failures (the Phase 4 review)

## The problem it solves

After Phase 4, two reviewers checked the whole phase:
- **code-reviewer** found no blocking issues. It confirmed that every screen sends the reducer only what it accepts, and that older saved games still load.
- **silent-failure-hunter** found **12 places where something could fail without the user being told**.

Both independently found the same real data-loss bug: **restoring a backup could push the saved list past the 50-match limit, and the next save would quietly delete the restored matches.**

## Everyday analogy: the shop that's open but the till is broken

A shop can look perfectly normal while the till silently fails to record sales. Customers leave happy, and the books are wrong. "Silent failure" bugs are like that: the screen looks fine, and the data quietly isn't. The fix is always the same: **check the result, and tell the person** in words they can act on.

## The fixes

### No more limit on saved matches (both reviewers' bug)

Tejo's decision: *it's local storage only, so why limit it?* Right. There's no server cost, and the real ceiling is the phone's WebView storage (about 5–10 MB, several hundred matches), which the "Couldn't save" banner already covers. Removing `MAX_SAVED_GAMES` and the trimming code **removed the bug entirely**, because nothing is evicted automatically any more. Simpler code, fewer ways to lose data.

Test: 300 saved matches plus a new one keeps **all 301**.

### Starting a game checks first (`App.tsx`)

```tsx
const handleStartGame = useCallback((config: StartGameConfig) => {
  // Check first: if the reducer refused, we'd otherwise land on the previous match.
  const problem = validateStartGame(config);
  if (problem) {
    alert(problem);
    return;
  }
  dispatch({ type: 'START_GAME', payload: config });
  setCurrentScreen('scoreboard');
}, []);
```

The reducer refuses a bad game by returning the old state. But the handler switched to the scoreboard regardless, so you'd land on the **previous** match and could score into it. Now it uses the same `validateStartGame` first. A player record with no name used to **crash** inside the check (`p.name.trim()` on `undefined`). It's now `typeof p.name !== 'string' || !p.name.trim()`, and `loadPlayerRoster` only accepts players with a real name.

### Protect the Android copy (`localStorageAdapter.ts`)

```ts
// Keys whose Android copy couldn't be read at startup. Writing them now could replace
// a full backup with a nearly empty list, so they're left alone until the next launch.
const unrestoredKeys = new Set<string>();
```

- **The scenario:** Android cleared the WebView's data, and reading the backup also failed at startup. The app opens empty. You start a match, and the save would overwrite the backup of **all** your matches with a list of one. Now `mirror()` skips any key that couldn't be read, and the app shows an amber banner: *"Couldn't open the phone's backup copy of your matches, so it won't be changed this time. Restart the app to try again."*
- **Timeouts:** every Android storage call is wrapped in `withTimeout` (4 seconds) using `Promise.race`. A stuck call can no longer leave a **blank screen** at startup, or freeze every later save behind it in the queue.
- **A crashed match stays cleared:** if Android couldn't forget the crashed match, `quarantineActiveGame` writes an **empty** value locally as a "tombstone". The startup restore only fills **missing** keys, so it won't bring the crash back.
- **A saved list that isn't a list** (valid JSON, wrong shape) is now backed up too, not only unparseable text.

### Results are checked, and failures are said out loud

| Where | Before | Now |
|---|---|---|
| Save banner | Stayed on screen after the match was deleted. A save that *crashed* (rather than returned false) was never reported | Clears when no match is open. `.catch` sets the banner |
| Restore | Always said "Restored N…" even if nothing was stored | `restoreBackup` **throws** if the list or players couldn't be stored. Settings shows *"Couldn't restore the backup"* |
| Delete (scoreboard and Continue Game) | Removed from screen whether or not storage was updated | Waits for the result. On failure: *"Couldn't delete … please try again"*, and the match stays |
| Adding a player | Shown even if storage was full, then appeared as "Player" later | `savePlayerRoster` returns `true`/`false`. On false: *"Couldn't save Kiran…"* |
| Re-entry score | 0, blank or ≥ pool limit **silently replaced** by the calculated score | *"Enter a re-entry score between 1 and 200."*, and the modal stays open |
| Auto-announce | No voice → silence every round, only `console.error` | Told **once per session** to check the phone's voice (a `useRef` remembers it's been shown) |
| Share deal | Share and copy both failing → nothing | *"Couldn't share or copy the deal. Take a screenshot of it instead."* |

## Two findings deliberately left

- **#5: an Android-copy write failing while the app copy succeeded still counts as "saved".** The match *is* saved and usable, so the red "couldn't save" banner would be wrong. A separate "backup out of date" notice is noted for later.
- **#6 (last point): a restored copy of the *currently open* match loses to the open one.** That's the intended rule: restore never changes the match in front of you.

Choosing *not* to fix something is fine **if you say why**.

## The tests (`src/test/reviewFixes.test.tsx`, plus updates)

- A restore whose writes fail **rejects** (throws).
- Startup couldn't read the backup → a later save leaves the Android list `['old1', 'old2']` untouched.
- A non-array saved list is backed up to `_unreadable`.
- A crashed match whose Android removal failed **stays cleared** after the startup restore.
- `validateStartGame` with a nameless player returns a "name" message instead of crashing.
- The re-entry box with 250 shows *"between 1 and 200"*, and confirm isn't called.
- In the full App: storage full → the banner appears → delete the match → **the banner goes away**.

The Continue Game delete test now **waits** for the delete to finish (`waitFor`), because deleting is properly awaited.

Totals: **163/163** unit tests, **14/14** browser tests, build ✅.

## What can go wrong (interview angle)

**"What's a silent failure, and how do you hunt them?"** An operation that fails while the UI carries on as if it succeeded. Look for ignored return values, `catch` blocks that only log, fire-and-forget promises, and fallbacks that replace user input without saying so.

**"How do you stop a startup failure from destroying a backup?"** Remember what you couldn't read, and don't write over it until you can. Fail safe, not fail empty.

**"Why put a timeout on a local call?"** Bridges to native code can hang. Without a timeout, one stuck call can freeze the start screen, or a whole queue of writes behind it.

**"Is it OK to leave review findings unfixed?"** Yes, if it's a deliberate, explained decision rather than something forgotten.

## From zero, by hand

1. Write `src/test/reviewFixes.test.tsx` as in this repo, with the Preferences fake that can fail reads and writes. Run it. Expected: failures.
2. In `localStorageAdapter.ts`, add `unrestoredKeys`, `withTimeout`, `isBackupCopyUnavailable` and `resetStorageStateForTests`. Make `mirror` skip unrestored keys and use timeouts. Make `hydrateFromPreferences` record failures and use a timeout. Back up non-array lists in `readRawList`. Remove the saved-match limit. Make `restoreBackup` throw on failed writes and `savePlayerRoster` return a boolean. Add the quarantine tombstone. Filter the roster with `isRosterPlayer`.
3. In `rules.ts`, make the name check `typeof`-safe.
4. In `App.tsx`:
   - `validateStartGame` before dispatching
   - await the delete with a failure alert
   - clear the banner when no match is open, with `.catch` on the save
   - alert once on auto-announce failure
   - add the amber backup banner
5. In `ContinueGameScreen.tsx`, await the delete. In `ReEntryModal.tsx`, add the inline error. In `PoolShareModal.tsx`, add the share alerts. In `SelectPlayersModal.tsx` and `PlayerListScreen.tsx`, check `savePlayerRoster`.
6. Run `npx vitest run && npx tsc -b && npm run lint && npm run build && npm run test:e2e`. Expected: `163 passed`, clean, clean, built, `14 passed`.
