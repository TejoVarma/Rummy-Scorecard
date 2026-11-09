# 10 · The round winner is whoever *showed*, not whoever scored zero

## The problem it solves

Once a player is knocked out, every later round still stores an entry for them as a **placeholder**: `{ type: 'out', points: 0 }`.

The scoreboard decided "who won this round" with:

```ts
if (scoreInfo.type === 'show' || scoreInfo.points === 0) return pId;
```

and returned the **first** match in seat order. So when a knocked-out player sat in seat 1, their placeholder 0 "won", and the banner said **"Congrats Ravi"** to someone who wasn't even playing.

The same mistake broke the green **all-drop highlight** (a round where everyone dropped except the winner). The placeholder was counted as a *second* winner, so the highlight never appeared once anyone had been knocked out.

## Everyday analogy: the empty chair

A teacher marks a test and an empty chair gets **zero mistakes**. That doesn't put the empty chair top of the class. "Scored zero" and "won" are **different facts**. Our data already records the real fact (`type: 'show'`), so we ask that directly instead of guessing from the number.

## The fix: two small pure functions in `domain/`

`src/domain/roundSummary.ts`:

```ts
import { PlayerId, PlayerRoundScore, RoundRecord } from './types';

// Players knocked out in an earlier round still get an entry in later rounds,
// stored as { type: 'out', points: 0 }. They weren't playing, so they're ignored here.
function wasPlaying(score: PlayerRoundScore): boolean {
  return !(score.type === 'out' && score.points === 0);
}

export function roundWinnerId(round: RoundRecord): PlayerId | null {
  const winner = Object.entries(round.scores).find(([, score]) => score.type === 'show');
  return winner ? winner[0] : null;
}

/** Everyone still playing dropped at the start, except the one player who showed. */
export function isAllDropRound(round: RoundRecord): boolean {
  const playing = Object.values(round.scores).filter(wasPlaying);
  const shows = playing.filter(s => s.type === 'show').length;
  const drops = playing.filter(s => s.type === 'open_drop').length;
  return shows === 1 && drops > 0 && shows + drops === playing.length;
}
```

- `roundWinnerId` only looks at `type === 'show'`. A typed hand score of 0 (`custom`, 0) is not a show either. The score screen already forces exactly one Show per round.
- `wasPlaying` filters out the placeholders. A player put out **by hand this round** has `type: 'out'` with **points = pool limit**, not 0, so they still count as playing (and the round isn't all-drop).
- `isAllDropRound` reads as the rule itself: one show, at least one drop, and **nobody else**.

The scoreboard now just uses them:

```tsx
const allDropRoundIndices = useMemo(
  () => new Set(rounds.flatMap((round, i) => (isAllDropRound(round) ? [i] : []))),
  [rounds]
);

const lastRoundWinnerId = lastRound ? roundWinnerId(lastRound) : null;
```

`flatMap` returning `[i]` or `[]` is a compact "keep the index only when true". The winner lookup is cheap, so it no longer needs `useMemo`.

## The tests

**Unit tests** (`src/test/roundSummary.test.ts`), 7 tests:
- The winner is the show, even with a knocked-out player in seat 1.
- A typed 0 is not the show.
- No show gives `null`.
- All-drop is true for everyone-dropped-but-one, and **also true when a knocked-out player is in the round**.
- All-drop is false when anyone played on, and false when someone was put out by hand.

**End-to-end** (`e2e/game.spec.ts`): Ravi (seat 1) takes Full three times, reaching 240 and out. In round 4 Kiran shows. The banner must say **"Congrats Kiran"** and never "Congrats Ravi".

**Proving it:** we put the **old** `ScoreboardScreen.tsx` back temporarily (`git stash push <file>`), and the test **failed**: the "Congrats Kiran" banner never appeared. Then `git stash pop` restored the fix. Testing a fix against the old code is the surest way to know the test really covers the bug.

## What can go wrong (interview angle)

**"Why not just check `points === 0`?"** Because a number can mean several things: a win, an empty seat, or a perfect hand. Store and check the **meaning** (`type: 'show'`), not a value that happens to coincide.

**"The placeholder `{ type: 'out', points: 0 }` is confusing. Why keep it?"** Changing a stored format means migrating every saved game on every phone. For now, one helper (`wasPlaying`) gives it a clear name in a single place. A cleaner long-term design is a separate type such as `'sitting_out'`, plus a migration.

**"How do you know a regression test covers the bug?"** Run it against the old code and watch it fail.

## From zero, by hand

1. Write `src/test/roundSummary.test.ts` as in this repo. Run `npx vitest run src/test/roundSummary.test.ts`. Expected: it fails, because `../domain/roundSummary` can't be found.
2. Create `src/domain/roundSummary.ts` as above.
3. In `ScoreboardScreen.tsx`, import both functions and replace the two old `useMemo` blocks with the two lines above.
4. Run `npx vitest run`. Expected: `Tests  93 passed (93)`.
5. Add the "real winner" test to `e2e/game.spec.ts` and run `npx playwright test -g "real winner"`. Expected: `1 passed`.
6. Prove it: `git stash push src/components/scoreboard/ScoreboardScreen.tsx`, run again (expected: `1 failed`), then `git stash pop`.
