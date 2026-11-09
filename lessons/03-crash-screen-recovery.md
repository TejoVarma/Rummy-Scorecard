# 03 · A crash screen you can actually escape

## The problem it solves

When a React component throws an error while drawing, the **error boundary** catches it and shows "Something went wrong" instead of a blank white screen. Our app has one wrapped around everything in `src/main.tsx`.

But the most likely cause of a crash is **bad saved data**: a corrupted match, or a hand-edited or broken backup. The app loads the active match on **every launch**, in `App.tsx`'s `useReducer` initialiser. A bad match therefore crashes the app every time it opens. The "Reset" button was supposed to break that cycle, but it removed `rummy_active_game`, while the app actually saves to `rummy_active_game_v1`. So it removed nothing. The empty `catch {}` around it hid even that, and the only way out was to clear the app's data, losing every game and player.

## Everyday analogy: the fuse and the faulty kettle

A fuse keeps blowing because a faulty kettle is plugged in.
- **Reload** = flip the fuse back on. The kettle is still plugged in, so it blows again.
- **Old reset** = unplug the toaster by mistake. The kettle is still plugged in, so it blows again.
- **New reset** = **unplug the kettle**, then flip the fuse back on, and **put the kettle in the cupboard** rather than the bin, so it can be inspected or repaired later.

## What we changed

### 1. One function that knows the real keys

`src/storage/localStorageAdapter.ts`:

```ts
const CRASHED_GAME_BACKUP_KEY = 'rummy_crashed_game_backup';

export async function quarantineActiveGame(): Promise<void> {
  const raw = localStorage.getItem(ACTIVE_GAME_KEY);
  if (raw) {
    localStorage.setItem(CRASHED_GAME_BACKUP_KEY, raw);
    removeFromSavedList(raw);
  }
  localStorage.removeItem(ACTIVE_GAME_KEY);
  try {
    await Preferences.remove({ key: ACTIVE_GAME_KEY });
  } catch (e) {
    console.error('Failed to clear active game from Preferences', e);
  }
}
```

- `ACTIVE_GAME_KEY` is the constant `'rummy_active_game_v1'`, defined once at the top of the file. The real bug was **typing a key name by hand in a second place**. Now the crash screen calls this function and never needs to know the name.
- `localStorage.setItem(CRASHED_GAME_BACKUP_KEY, raw)` stores the raw text **before** deleting anything. That's the kettle in the cupboard. It's one key that is overwritten each time, so it can't slowly fill up storage.
- `removeFromSavedList(raw)` takes the same match out of the "Continue game" list. Otherwise you could resume it and crash all over again.
- The match is cleared from **both** places it's stored: `localStorage` (the WebView) and Capacitor `Preferences` (Android's own storage).

```ts
function removeFromSavedList(rawActiveGame: string): void {
  try {
    const { gameId } = JSON.parse(rawActiveGame);
    const list = JSON.parse(localStorage.getItem(SAVED_GAMES_LIST_KEY) ?? '[]');
    if (!gameId || !Array.isArray(list)) return;
    const remaining = list.filter((g: { gameId?: unknown }) => g?.gameId !== gameId);
    const serialized = JSON.stringify(remaining);
    localStorage.setItem(SAVED_GAMES_LIST_KEY, serialized);
    Preferences.set({ key: SAVED_GAMES_LIST_KEY, value: serialized }).catch(e =>
      console.error('Failed to sync saved games list to Preferences', e)
    );
  } catch {
    // The active game or list is unreadable; the raw copy is already backed up.
  }
}
```

It works on the **raw list**, not the validated one. If it reused `loadAllSavedGames()`, which filters out invalid games, writing that list back would silently delete every other invalid game too.

### 2. The crash screen uses it

`src/components/common/ErrorBoundary.tsx`:

```tsx
private handleReset = async () => {
  try {
    await quarantineActiveGame();
  } catch (e) {
    console.error('Failed to clear the crashed match', e);
  }
  window.location.reload();
};
```

- `async` and `await` make sure the clean-up **finishes before** the reload. Reloading first would cut it off halfway.
- The button now says **"Clear this match & reload"**, with a line explaining that a copy is kept.

### 3. Reject crash-causing data at the door

`isValidGameState` used to check only the top-level shape, such as "`rounds` is an array". It now also checks:

```ts
if (candidate.currentDealerIndex >= candidate.seats.length) return false;
for (const round of candidate.rounds) {
  if (!isValidRound(round)) return false;
}
```

```ts
function isValidRound(round: unknown): boolean {
  if (!isPlainObject(round)) return false;
  if (!isPlainObject(round.scores) || !isPlainObject(round.cumulativeScores)) return false;
  if (!Object.values(round.cumulativeScores).every(Number.isFinite)) return false;
  if (!Array.isArray(round.seatsSnapshot)) return false;
  return true;
}
```

- A dealer index past the end of the seats would make `seats[index]` `undefined`.
- The scoreboard reads `round.cumulativeScores[id]` while drawing, so a round without it throws.
- `Number.isFinite` rejects `null`, `NaN` and text. When `NaN` is saved, JSON turns it into `null`.

Before adding these checks, we confirmed that every field required here has existed since the app's first commit. A stricter check that rejects **real, older** saves is a silent data-loss bug of its own.

## The tests (written first)

`src/test/crashRecovery.test.tsx` runs in jsdom, a fake browser with a real `localStorage`.

- **The crash-screen test** puts a match in both the active key and the saved list, then renders `<ErrorBoundary><Boom /></ErrorBoundary>`. `Boom` is a component that always throws. The test clicks "Clear this match" and checks three things: the active key is gone, the backup holds `game_1`, and the list contains only `game_2`.
- **Validation tests:**
  - A normal match is accepted.
  - Dealer index 5 with 2 seats is rejected.
  - A round `{}` is rejected.
  - `cumulativeScores: { p2: null }` is rejected.

Before the fix, 4 of these 5 tests failed. After it, 68/68 pass.

## What can go wrong (interview angle)

**"What can an error boundary catch, and what can't it?"** It catches errors thrown while **rendering**, in lifecycle methods, and in constructors of the components below it. It **can't** catch errors in event handlers (use try/catch), in async code (`await`, `setTimeout`, promises), during server-side rendering, or in the boundary itself.

**"How do you design crash recovery?"**
- The recovery action must actually **change the state that caused the crash**. Otherwise it's a loop.
- **Keep a copy** of what you remove (quarantine it, don't delete it), so data can be recovered or debugged.
- **Validate at the boundary**, when data enters from storage or an import, so bad data never reaches the render code.
- Never write the same magic string twice. Use one constant or one function, as the "Single Source of Truth" principle says.

**"Your stricter validator shipped, and users say their old games disappeared. What happened?"** The validator rejected a field shape that older versions saved. Next time, check the history of the stored format first, as we did. Version the format, and migrate old data instead of rejecting it.

## From zero, by hand

1. **Write the test** as `src/test/crashRecovery.test.tsx`, with the same contents as in this repo. The key parts:
   ```tsx
   // @vitest-environment jsdom
   function Boom(): never { throw new Error('bad saved match'); }

   it('clears the real active match, keeps a backup and drops it from the saved list', async () => {
     localStorage.setItem('rummy_active_game_v1', JSON.stringify(crashed));
     localStorage.setItem('rummy_saved_games_list_v1', JSON.stringify([crashed, other]));
     render(<ErrorBoundary><Boom /></ErrorBoundary>);
     fireEvent.click(screen.getByRole('button', { name: /clear this match/i }));
     await waitFor(() => expect(localStorage.getItem('rummy_active_game_v1')).toBeNull());
     expect(JSON.parse(localStorage.getItem('rummy_crashed_game_backup')!).gameId).toBe('game_1');
   });
   ```
   Also add the 4 `isValidGameState` cases listed above.

2. **Run it:** `npx vitest run src/test/crashRecovery.test.tsx`
   Expected: `Tests  4 failed | 1 passed (5)`. The button isn't found, and the bad matches are accepted.

3. **Add** `isPlainObject`, `isValidRound`, the dealer-index check, `quarantineActiveGame` and `removeFromSavedList` to `src/storage/localStorageAdapter.ts`, exactly as shown above.

4. **In `ErrorBoundary.tsx`:** import `quarantineActiveGame`, replace `handleReset` with the async version, and rename the button to "Clear this match & reload".

5. **Run everything:** `npx vitest run && npx tsc -b && echo "tsc ok"`
   Expected: `Test Files  9 passed (9)`, `Tests  68 passed (68)`, `tsc ok`.
