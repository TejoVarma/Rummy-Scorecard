# 30 · Announce only who's still playing

## The problem

After a player went out, every later announcement still said their name: "Round 7. Ravi 45. Amit 120. Kiran out." "Round 8. … Kiran out." Round after round, for someone who isn't playing any more. It's noise.

## Everyday analogy

A cricket commentator says "He's out!" once, when the wicket falls. They don't repeat "and he's still out" every over. If the batter comes back in, he's mentioned again.

## The rule now

- **Still playing:** name and total ("Amit 82").
- **Went out this round:** said **once**: "Kiran out".
- **Out since an earlier round, not re-entered:** not mentioned at all.
- **Re-entered:** read again with the new total ("Kiran 78").

## How the code knows "went out this round"

Every round stores the running totals *after* that round (`cumulativeScores`). So compare the last round with the one before it:

```ts
const totals = rounds[rounds.length - 1].cumulativeScores;
const before = rounds.length > 1 ? rounds[rounds.length - 2].cumulativeScores : {};
const isOut = (score: number | undefined) => (score ?? 0) >= rules.poolLimit;

const parts = seats.flatMap(id => {
  const name = players[id]?.name || 'Player';
  if (!isOut(totals[id])) return [`${name} ${totals[id] ?? 0}`];
  return isOut(before[id]) ? [] : [`${name} out`];
});
```

- Out now, and not out before → went out this round → "Kiran out".
- Out now, and out before too → already out → `[]` (nothing).
- `flatMap` lets each player add one phrase **or none**, which `map` can't do.

**Why re-entry just works:** re-entering rewrites the re-entered player's total in the last round to the new score (for example 73), which is below the pool limit. So a re-entered player is "not out", and is read normally from then on. If they go out a second time, the round before shows 73, so "out" is said once again.

## Tests (`src/test/announce.test.tsx`)

- Out in round 3, round 4 played without them → `"Round 4. Ravi 0. Amit 82."`. Before the fix it ended with `"Kiran out."`, so the test failed for the right reason.
- Re-entered after round 3 → `"Round 4. Kiran 78. Ravi 0. Amit 82."`. Kiran comes first because a re-entered player sits just before the dealer. This guards against the fix removing too much.
- The existing test still holds: in the round a player goes out, "Kiran out" is said.

## What can go wrong (interview angle)

**"How do you detect a change, like 'just went out'?"** Compare the state now with the state before. Here, the totals after this round versus after the previous one. Storing a snapshot per round makes "what changed?" a cheap comparison instead of replaying the whole game.

**"Why not just skip everyone who's out?"** Then nobody would hear that someone just went out, which is the one moment it matters. Event (went out) versus state (is out).

## From zero, by hand

1. In `src/domain/announce.ts`, replace the `seats.map(...)` with the `flatMap` above, plus the `before` and `isOut` lines.
2. Add the two tests above to `src/test/announce.test.tsx`.
3. Run `npx vitest run src/test/announce.test.tsx`. Expected: `10 passed`.
4. Run everything: `npx vitest run && npm run lint && npx tsc -b`. Expected: `257 passed`, clean, clean.
5. On the phone, with announcements on: put a player out. You hear "… out" once. On the next round their name isn't read. Re-enter them, and they're read again.
