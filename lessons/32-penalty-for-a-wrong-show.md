# 32 · Penalty for a wrong show

## The problem

In a closed-joker game, a player declared (showed) but the show was wrong, and everyone saw the joker. The table has two choices:

- **Stop the hand:** the wrong-show player gets full count (80), and everyone else gets what the table agrees (for example 20). Nobody wins the round.
- **Carry on:** the wrong-show player gets 80, and the rest play to the end. Someone shows properly, and the others get their usual points.

The app couldn't save the first case. Every round had to have **exactly one Show** ("One player must be marked with Show"), and a stopped hand has no winner.

## Everyday analogy

A referee stops a football match after a foul. The team that fouled is penalised, and the result is decided by the officials, not by a goal. The scoresheet needs a box for "stopped by a penalty", not just "who scored".

## Why a button, not "allow rounds without a Show"

Simply dropping the Show rule would also let through the common mistake of **forgetting to mark the winner**. A named **Penalty** option keeps the rule meaningful:

> A round needs exactly one Show, **unless someone has a Penalty**. A Penalty round may have a Show (carried on) or none (stopped).

It also records *why* there was no winner, so the scoreboard, the legend and the "Congrats" banner can all read it correctly.

## The code

**A new score type** (`src/domain/types.ts`): `'penalty'`, worth full count.

```ts
// src/domain/scoring.ts
case 'full_count':
case 'penalty':
  return rules.fullCount;
```

**The rule** (`validateRoundScores`):

```ts
const showCount = activePlayerIds.filter(id => scores[id]?.type === 'show').length;
const hasPenalty = activePlayerIds.some(id => scores[id]?.type === 'penalty');
if (showCount === 0 && !hasPenalty) {
  return { valid: false, error: 'Mark the winner with Show, or a wrong show with Penalty.' };
}
if (showCount > 1) {
  return { valid: false, error: 'Only one player can have Show in a single round.' };
}
```

- No Show and no Penalty → refused (the forgotten-winner case is still caught).
- Two Shows → still refused.
- A Penalty must be exactly full count, like every other button. Points always come from the rules, never from the screen.

**Where it shows up:**
- **Score entry** (`RoundInputModal.tsx`): a pink **Penalty** button, placed **last** so the usual row (Show, Drop, M Drop, Full, Out) stays exactly where players' thumbs expect it.
- **Scoreboard cell** (`ScoreTable.tsx`): **P**, read by TalkBack as "Penalty (wrong show)".
- **Legend** (`ScoreLegend.tsx`): "P Penalty". The cell and the legend read from the same `CELL_CODES` list, so they can't disagree.
- **Saved games** (`validation.ts`): `'penalty'` is an accepted score type, so saves and match files with it load.
- **Nothing else needed changing.** `roundWinnerId` looks for a `show`, so a stopped hand has no winner and no "Congrats" banner. The all-drop colour needs exactly one Show, so a penalty round is never mistaken for one. Totals, eliminations, announcements and sharing all work on points, so they just work.

## Something to know

A phone still on an **older version** of the app won't open a match file or backup containing a Penalty round, because to it `'penalty'` is an unknown score type, and the strict check refuses it rather than guess. Update both phones before handing over a match.

## Tests

- `src/test/penaltyRound.test.tsx` (9 tests): Penalty is worth full count; a stopped hand saves without a Show; a carried-on hand saves with Penalty + Show; no Show and no Penalty is still refused; a Penalty of any other number is refused; totals 80/20/20 with no round winner; the carried-on hand names the real winner; score entry submits Penalty + typed 20s; the scoreboard shows **P**, the legend lists Penalty, and nobody is congratulated.
- `e2e/game.spec.ts`: a real 3-player game, Penalty for Ravi, 20 typed for the others → totals 80, 20, 20 and a **P** cell. The old "no Show" test now expects the new message.

## What can go wrong (interview angle)

**"A rule blocks a real-world case. Do you delete the rule?"** No. Find the case the rule was protecting against (here, a forgotten winner) and add an **explicit exception** (Penalty) so both are handled. Deleting a validation rule usually brings back the bug it was written for.

**"How do you add a new value to an enum used across the app?"** Search every place that switches on it (`grep "'show'\|full_count"`), let TypeScript find the exhaustive `switch`es, and check the stored-data validator. Old data must still load, and new data may not load on old app versions, so say so.

**"Why does the score come from the rules and not the button?"** One source of truth. If a table uses full count 60, Penalty is 60 everywhere automatically.

## From zero, by hand

1. `types.ts`: add `| 'penalty'` to `ScoreInputType`.
2. `scoring.ts`: add `case 'penalty':` next to `full_count`, and change the Show check to the `showCount === 0 && !hasPenalty` version above.
3. `validation.ts`: add `'penalty'` to `SCORE_TYPES`.
4. `RoundInputModal.tsx`: add `{ type: 'penalty', label: 'Penalty', color: '#db2777' }` at the end of `SCORE_OPTIONS`.
5. `ScoreLegend.tsx`: add `penalty: { code: 'P', label: 'Penalty (wrong show)', short: 'Penalty' }` to `CELL_CODES`. In `ScoreTable.tsx`, add `'penalty'` to `CODED_TYPES`.
6. Run `npx vitest run src/test/penaltyRound.test.tsx`. Expected: `9 passed`. Then run everything: `npx vitest run && npm run lint && npx tsc -b && npm run test:e2e`. Expected: `280 passed`, clean, clean, `18 passed`.
7. On the phone: Enter Score → Penalty for one player, type 20 for the others → Submit. The scoreboard shows **P** and 80/20/20.
