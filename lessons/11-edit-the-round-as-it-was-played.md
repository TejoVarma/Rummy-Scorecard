# 11 · Edit a round as it was played (players, dealer, re-entry warning)

## The problem it solves

"EDIT SCORE" lets you correct the last round. It got three things wrong:

1. **The players.** It listed everyone in the round's record, `Object.keys(lastRound.scores)`. That record also holds a `{ type: 'out', points: 0 }` placeholder for every player who was **already out**, so knocked-out players appeared as if they'd played. You could give them a score, even the Show.
2. **The dealer crown.** It used `seats[currentDealerIndex]`, but the dealer index **moves on** after each round. So in edit mode the crown sat on **the next** dealer, not the one who dealt the round being fixed.
3. **Re-entry.** Editing a round restores the seating and players from **before** any re-entry made after it, so the re-entry is **cancelled** and the prize pool shrinks. That happened **silently**.

## Everyday analogy: correcting last week's register

You're correcting last week's attendance register. You use **last week's class list and last week's teacher**, not today's. And if the correction would also undo something done since (a late registration), the clerk **warns you first** and asks before stamping it.

## The fix: read the round's own snapshot

Every saved round already keeps a snapshot of the table at the time: `seatsSnapshot`, `playersSnapshot` and `dealerPlayerId`. The edit screen now uses them.

`src/components/input/RoundInputModal.tsx`:

```tsx
const { rules, rounds } = state;
const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
const editedRound = isEditingLastRound ? lastRound : null;

// When editing, show the table exactly as it was when that round was played.
const roundSeats = editedRound?.seatsSnapshot ?? state.seats;
const players = editedRound?.playersSnapshot ?? state.players;
const currentDealerId = editedRound ? editedRound.dealerPlayerId : state.seats[state.currentDealerIndex];

// Totals going into the round being entered or edited
const roundsBefore = editedRound ? rounds.slice(0, -1) : rounds;
const cumulativeScores: Record<PlayerId, number> =
  roundsBefore.length > 0 ? roundsBefore[roundsBefore.length - 1].cumulativeScores : {};

const activeSeats = roundSeats.filter(id => (cumulativeScores[id] ?? 0) < rules.poolLimit);
```

- `?.` and `??` read as: "if we're editing, use the round's snapshot, otherwise use the live game".
- **Who was in?** Whoever's total **going into** the round was under the pool limit. For an edit that's the totals after the *previous* round (`rounds.slice(0, -1)` drops the last one). A player **knocked out by this very round** was still in when it started, so they correctly stay editable.
- The same rule now works for **adding** a round too (going in = the latest totals), so both modes share one code path instead of two.

The re-entry warning:

```tsx
// Editing a round cancels any re-entry made after it, so say who would be affected.
const undoneReEntries = (editedRound?.reEnteredInRound ?? []).map(id => state.players[id]?.name || 'a player');
const reEntryWarning =
  undoneReEntries.length > 0 ? `Saving this edit will undo ${undoneReEntries.join(' and ')}'s re-entry.` : null;
```

- It's shown at the top of the edit screen as an amber box with `role="alert"`, so screen readers announce it.
- On UPDATE: `if (reEntryWarning && !window.confirm(`${reEntryWarning} Continue?`)) return;`. If you say no, nothing is saved.

On submit, the final scores are built over `roundSeats`. Players who were in get what you entered, and everyone else keeps the `out` placeholder.

## The tests (`src/test/roundEdit.test.tsx`)

The games are built with the real reducer: Ravi takes Full three times and is out at 240.

| Test | Before the fix |
|---|---|
| Editing round 4 lists only Amit and Kiran, not Ravi | ❌ Ravi was listed |
| Editing round 3 (the one that knocked Ravi out) still lists Ravi | ✅ |
| The crown is on round 1's dealer (Ravi), not the next dealer | ❌ wrong player |
| Submitted scores keep Ravi as `out` | ✅ |
| After Ravi re-enters, editing warns *"will undo Ravi's re-entry"* | ❌ no warning |
| …and asks first; saying **no** saves nothing | ❌ saved silently |
| …saying **yes** saves | ✅ |

4 failed before the fix and 3 already passed. The passing ones guard behaviour that must not break. After the fix: **100/100** unit tests and **13/13** browser tests.

## What can go wrong (interview angle)

**"Why snapshot state per round instead of recalculating?"** Some facts (seating order, who re-entered, who dealt) change over time and can't be reliably rebuilt from scores alone. Snapshots make edit and undo correct, at the cost of a little extra storage.

**"Where's the line between UI state and domain state?"** "Who was in this round" is a game rule. It would be even better as a domain function shared with the reducer, which is what step 4.3 moves towards.

**"Isn't `window.confirm` bad UX?"** It blocks and looks plain. But it's honest, and it beats silently undoing a paid re-entry. A styled in-app dialog is a polish item for later.

## From zero, by hand

1. Write `src/test/roundEdit.test.tsx` as in this repo. Run `npx vitest run src/test/roundEdit.test.tsx`. Expected: `4 failed | 3 passed (7)`.
2. In `RoundInputModal.tsx`, replace the block that computed `currentDealerId`, `activeSeats` and `cumulativeScores` with the snapshot-based block above. Then:
   - add the `reEntryWarning` lines
   - in `handleSubmit`, add the `window.confirm` check and loop over `roundSeats` instead of `seats`
   - render the amber `role="alert"` box above the error message
3. Run `npx vitest run`. Expected: `Tests  100 passed (100)`. Run `npm run test:e2e`. Expected: `13 passed`.
