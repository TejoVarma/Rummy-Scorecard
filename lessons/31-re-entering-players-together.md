# 31 · Re-entering two players together

## The problem

In pool rummy, two players can go out in the **same round**. If both re-enter:

1. **Both get the same score:** the highest total among players still in, plus one.
2. **They draw cards to decide the seats.** The highest card sits furthest from the dealer, and the lowest card sits right next to the dealer, so the lowest card is dealt last.

The app got the first rule wrong. Example: Suresh (still in) has 72. Amit and Kiran both go out.

- Re-enter Kiran → 72 + 1 = **73** ✅
- Re-enter Amit → the app now counted Kiran as "in" at 73, so 73 + 1 = **74** ❌

Whoever came back second paid an extra point for nothing. There was also no way to re-enter both at once in card order.

## Everyday analogy

Two latecomers join a queue at the same moment. They both get the same token number range (they arrived together). Who stands in front is decided by a coin toss (the card draw), not by who happened to reach the counter first.

## The fix, in three parts

### 1. One shared re-entry score

`src/domain/elimination.ts`:

```ts
export function sharedReEntryScore(lastRound: RoundRecord, seats: PlayerId[], poolLimit: number): number | null {
  const reEntered = new Set(lastRound.reEnteredInRound || []);
  const stillIn = seats
    .filter(id => !reEntered.has(id) && !isEliminated(lastRound.cumulativeScores[id] ?? 0, poolLimit))
    .map(id => lastRound.cumulativeScores[id] ?? 0);
  return stillIn.length > 0 ? calculateReEntryScore(stillIn) : null;
}
```

The key line is `!reEntered.has(id)`. Anyone who **already re-entered after this round** doesn't count towards "highest". So Kiran's 73 isn't used for Amit, and Amit gets 73 too, whether they're re-entered together or one after the other. The same function is used by the eligibility check, the game logic and the dialog, so all three always agree.

### 2. Seat a group in the order picked

`src/domain/seating.ts`:

```ts
export function seatReEnteredPlayers(seats: PlayerId[], currentDealerId: PlayerId, reEnteringIds: PlayerId[]): PlayerId[] {
  const coming = new Set(reEnteringIds);
  const remaining = seats.filter(id => !coming.has(id));
  const dealerIndex = remaining.indexOf(currentDealerId);
  if (dealerIndex === -1) return [...reEnteringIds, ...remaining];
  return [...remaining.slice(0, dealerIndex), ...reEnteringIds, ...remaining.slice(dealerIndex)];
}
```

Take the re-entering players out, then put them back as a **block** just before the dealer, in the order tapped: `… Kiran, Amit, Suresh (dealer)`. The old single-player function now just calls this with a list of one.

### 3. One action for "re-enter these players"

`src/state/gameReducer.ts` has a new action, `RE_ENTER_PLAYERS { playerIds, customReEntryScore? }`. It checks that the list is non-empty, has no repeats, and that everyone is allowed to re-enter. Then it gives every player the same score, adds one to each player's re-entry count, records all of them in `reEnteredInRound`, and seats them as a block.

The old `RE_ENTER_PLAYER` (one player) now simply **forwards** to it with a list of one, so there's only one copy of the rules:

```ts
case 'RE_ENTER_PLAYER':
  return gameReducer(state, {
    type: 'RE_ENTER_PLAYERS',
    payload: { playerIds: [action.payload.playerId], customReEntryScore: action.payload.customReEntryScore },
  });
```

## The screen

- **One player out:** same as before: "Re-Enter Kiran" → the same dialog.
- **Two or more out:** the banner shows one **Re-Enter** button. The dialog lists them with tick boxes, like the New Game player picker. *Tap in card order: highest card first.* Each shows #1, #2…, the score box shows the one shared score, and the seating box shows the result: **Kiran → Amit → Suresh (dealer)**.
- You can tick just one if the other isn't re-entering. Confirming with nobody ticked says "Tap the players who are re-entering."
- With a stake, the note says the stake is added **each**.

## Tests

- `src/test/reEntryTogether.test.tsx` (14 tests, including the banner, keyboard use and TalkBack reading "Kiran, number 1"): both get 73 together; both get 73 when re-entered one after the other (this failed before, giving 74); seat order is first-tapped furthest and last-tapped beside the dealer; a typed score applies to all; empty, repeated or still-in players are refused; the dialog confirms in tap order, shows the seating line, allows just one, and needs at least one.
- `e2e/game.spec.ts`: a real 4-player game. Amit and Kiran both go out at 240. Tap Kiran then Amit, and the score shows 73. After confirming, the seats are `… Kiran, Amit, dealer`, and the totals are 0, 72, 73, 73.
- All the earlier single re-entry tests still pass unchanged, which proves the forwarding kept the old behaviour.

## What can go wrong (interview angle)

**"Two actions applied one after the other gave a different result than applying them together. Why?"** The second action read state the first had just changed (Kiran counted as "in"). The fix is to define the rule against a **stable snapshot**: players still in **before** this round's re-entries. Then order doesn't matter.

**"How do you add a batch version of an action without duplicating logic?"** Make the batch the real implementation, and make the single version a batch of one. One code path means one set of rules and one set of bugs.

**"How is seat order decided?"** By people, not by the app: they draw cards. The app records the order they tap. Don't encode a rule in software that the table decides physically.

## From zero, by hand

1. Add `sharedReEntryScore` to `elimination.ts`, and use it in `getEligibleForReEntryPlayers` in place of the old "highest active + 1".
2. Add `seatReEnteredPlayers` to `seating.ts`, and make `relocateReEnteredPlayer` call it with `[id]`.
3. Add `RE_ENTER_PLAYERS` to `gameActions.ts`, implement it in the reducer as above, and make `RE_ENTER_PLAYER` forward to it.
4. `ReEntryModal`: new props `eligiblePlayerIds`, `initialSelection`, and `onConfirmReEntry(playerIds, score)`. With more than one eligible player, show the tap-in-order list (`role="checkbox"`, `#n` badges) and the seating line.
5. `ScoreboardScreen` banner: one eligible player → "Re-Enter {name}" (`onPromptReEntry([id])`); more than one → "Re-Enter" (`onPromptReEntry([])`). `App` keeps the preselection in state and dispatches `RE_ENTER_PLAYERS`.
6. Run `npx vitest run src/test/reEntryTogether.test.tsx`. Expected: `14 passed`. Then run everything: `npx vitest run && npm run lint && npx tsc -b && npm run test:e2e`. Expected: `271 passed`, clean, clean, `17 passed`.
7. On the phone: put two players out in the same round, tap Re-Enter, tap them in card order, and check that both get the same score and sit in that order beside the dealer.
