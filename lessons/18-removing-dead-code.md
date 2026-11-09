# 18 · Removing dead code safely

## The problem it solves

**Dead code** is code that never runs, because nothing calls it. It looks harmless, but it costs you:
- **It misleads.** Seeing `UNDO_ROUND` in the reducer, you'd assume the app can undo a round. It can't: no button sends it.
- **It hides bugs.** The reviewers found that Undo would corrupt a re-entry (it restored the wrong seating). Nobody had noticed, because nobody could press it.
- **It costs work.** In step 4.3 we added a deal guard to `UNDO_ROUND`. That was effort spent on code no user can reach.

## Everyday analogy: the kitchen drawer

A drawer full of gadgets you never use: an egg slicer, three broken peelers, a garlic press from 2009. Every time you look for the right knife, you dig past them. Clearing them out makes the useful things easy to find. Just check nothing in there is something you *do* use.

## How to find dead code safely

1. **Search every reference** to each suspect, separating app code from tests:
   ```bash
   for sym in UNDO_ROUND REORDER_SEATS reorderSeats custom_fixed getDropStatus getRemainingDrops canFullCount PlayerStatus 'playerId?:' StatusChip; do
     printf "%-22s app: " "$sym"; grep -rlF -- "$sym" src | grep -v '^src/test/' | tr '\n' ' '
     printf "| tests: "; grep -rlF -- "$sym" src/test e2e | tr '\n' ' '; echo
   done
   ```
   (`grep -F` treats the name as plain text. In zsh, `--include=*.ts` gets expanded by the shell before grep sees it, which is why the first attempt printed errors.)
2. If something is used **only by its own definition and its own tests**, it's dead.
3. Delete it, then let **the type checker** find anything that still depended on it. `tsc` pointed straight at three tests that still set the removed field.

## What was removed

| Dead code | Why it was dead |
|---|---|
| `UNDO_ROUND` and `REORDER_SEATS` actions, `reorderSeats()` | No screen dispatches them |
| `reEntryScoreMode` and its `'custom_fixed'` value | No screen can choose it, and `custom_fixed` didn't even mean "fixed" (it returned the highest score) |
| `getDropStatus`, `getRemainingDrops` | Duplicated `analyzePlayerDrops`, used only by tests |
| `canFullCount` field (and the then-unused `fullCount` parameter of `analyzePlayerDrops`) | Computed but never read |
| `PlayerStatus` type, `PlayerRoundScore.playerId?` | Never used |
| `components/common/StatusChip.tsx` | Never imported |

`calculateReEntryScore` is **live**, so it stays, now honest and simple:

```ts
export function calculateReEntryScore(activeScores: number[]): number {
  if (activeScores.length === 0) return 0;
  return Math.max(...activeScores) + 1;
}
```

## Keeping the knowledge, not the code

The `getDropStatus` tests pinned down **exactly** when a player is safe, on one drop, compulsory or out. That rule is live in `analyzePlayerDrops`, so the tests were **moved** onto it instead of deleted:

```ts
expect(analyzePlayerDrops(161, pool201, drop20).status).toBe('one_drop');
expect(analyzePlayerDrops(161, pool201, drop20).openDropsRemaining).toBe(1);
```

Only tests of genuinely dead features (Undo, Reorder) were deleted.

Two ported lines failed. They tested a quirk of the removed `getRemainingDrops`: an open drop of 0 meant "0 drops left". Since lesson 12, `validateRules` refuses an open drop of 0 or less, so that input can't exist. Those lines were removed rather than inventing behaviour for an impossible case.

## Old saved data still loads

Games saved before this change still have `"reEntryScoreMode": "highest_plus_one"` inside their rules. Removing it from the **type** doesn't break them: extra fields in stored JSON are simply ignored. A new test proves it:

```ts
it('still loads games saved by older versions that had a re-entry mode setting', () => {
  const older = { ...validGameState, rules: { ...validGameState.rules, reEntryScoreMode: 'highest_plus_one' } };
  expect(isValidGameState(older)).toBe(true);
});
```

Results: **285 lines deleted, 44 added**. **173/173** unit tests, **15/15** browser tests, build ✅.

## What can go wrong (interview angle)

**"How do you find dead code?"** Search references (or use a tool like `knip` or `ts-prune`). Check for indirect use (string-based dispatch, reflection, public APIs other projects import). Then delete and let the compiler and tests confirm.

**"Isn't deleting code risky?"** Less risky than keeping misleading code, *if* tests and types back you up. Git keeps the history, so nothing is truly lost.

**"What about stored data that used a removed field?"** Make sure old data still loads: ignore unknown fields, or migrate them. Test it explicitly.

## From zero, by hand

1. Run the search loop above. Expected: each symbol shows only its own definition file, and tests at most.
2. Delete the code listed in the table (the two action types, the two reducer cases, `reorderSeats` plus its test, the `reEntryScoreMode` field from types, defaults and wizard, `getDropStatus`/`getRemainingDrops`, `canFullCount`, `PlayerStatus`, `playerId?` and `StatusChip.tsx`), and simplify `calculateReEntryScore`.
3. Run `npx tsc -b`. Fix each place it reports (callers of `calculateReEntryScore` and `analyzePlayerDrops`, and test fixtures with `reEntryScoreMode`).
4. Port the drop-status tests to `analyzePlayerDrops(...).status` / `.openDropsRemaining`. Delete the Undo and Reorder tests. Add the "older versions" test.
5. Run `npx vitest run && npm run lint && npm run build && npm run test:e2e`. Expected: `173 passed`, clean, built, `15 passed`.
