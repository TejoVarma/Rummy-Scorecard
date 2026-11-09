# 12 · The reducer enforces the rules, not just the buttons

## The problem it solves

Every change to a game goes through **the reducer**, `gameReducer(state, action)`. It's one function that takes the current game plus an action ("submit this round", "re-enter Ravi") and returns the new game.

Before this step the reducer **trusted whatever it was given**. Every rule lived in the screens:

| Hole | What the reducer accepted |
|---|---|
| Round scores | Two Shows, negative or fractional points, "Drop = 999", points for a player already out |
| Re-entry | A player knocked out several rounds earlier; a re-entry score at or over the limit, or `NaN` |
| After a deal | Editing the settled round (game back to "playing" with old payouts still attached); a second deal overwriting the first; payouts that don't add up |
| Starting a game | 1 player, duplicate seats, a dealer seat that doesn't exist, Drop ≥ Middle Drop |
| **Full count (step 4.4)** | The score check hard-coded **80**, so with a custom full count of 100 a hand of 90 could be typed but **never submitted** |

## Everyday analogy: the bank form and the vault

The form on the counter (the UI) helps you fill in a withdrawal correctly. But the **vault** (the reducer) still checks your balance before handing over money. Forms get bypassed: a restored backup, a new screen, a bug. The vault is the **last line of defence**, so it enforces every rule. The form is a convenience on top.

## The design: one rules module, used everywhere

`src/domain/rules.ts` holds the checks. Each one returns **a message for the player, or `null` when it's fine**:

```ts
export function validateRules(rules: GameRules): string | null {
  const { poolLimit, openDrop, middleDrop, fullCount, entryAmount = 0 } = rules;
  if (![poolLimit, openDrop, middleDrop, fullCount].every(isWholeNumber)) {
    return 'Scores must be whole numbers.';
  }
  if (openDrop <= 0) return 'Open Drop must be greater than 0.';
  if (openDrop >= middleDrop) return 'Open Drop must be less than Middle Drop.';
  if (middleDrop >= fullCount) return 'Middle Drop must be less than Full Count.';
  if (openDrop >= poolLimit) return 'Open Drop must be less than the pool score.';
  if (!isWholeNumber(entryAmount) || entryAmount < 0) return 'The stake must be a whole number of rupees, 0 or more.';
  return null;
}
```

- `validateStartGame`: at least 2 players, unique ids, every player has a name, seats contain every player exactly once, the dealer index exists, then `validateRules`.
- `validateDeal`: not already settled, game in play with at least one round, payouts for **exactly** the players still in, whole rupees, `totalPool` equal to the real pool (stake × (players + re-entries)), and the payouts add up.
- `totalPool(state)`: the pool calculation in one place.

The **same functions** serve two audiences:
- **The reducer** treats any message as "refuse": `if (validateStartGame(action.payload)) return state;`
- **The setup screen** shows the message: `const problem = validateRules(rules); if (problem) { alert(problem); return; }`. Its own duplicate checks were deleted, so the screen and the reducer can **never disagree**.

## Round scores: checked against *these* rules

`src/domain/scoring.ts`:

```ts
export function validateRoundScores(
  scores: Record<string, { type: ScoreInputType; points: number } | undefined>,
  activePlayerIds: string[],
  rules: GameRules
): { valid: boolean; error?: string } {
  for (const id of activePlayerIds) {
    const s = scores[id];
    if (!s) return { valid: false, error: 'All active players must have a score recorded.' };
    if (!Number.isInteger(s.points)) return { valid: false, error: 'Scores must be whole numbers.' };
    if (s.type === 'custom') {
      if (s.points < 0 || s.points > rules.fullCount) {
        return { valid: false, error: `Custom hand points must be between 0 and ${rules.fullCount}.` };
      }
    } else if (s.points !== getPointsForInputType(s.type, undefined, rules)) {
      return { valid: false, error: 'A score does not match the chosen option.' };
    }
  }
  // ...then exactly one Show among the players still in
}
```

- It now receives `rules`, so the limit is `rules.fullCount`, not a hard-coded 80. That's the **step 4.4** fix, and it covers the error message too.
- Each button's points must match the rules: Drop = `openDrop`, M Drop = `middleDrop`, Full = `fullCount`, Out = `poolLimit`, Show = 0. "Drop = 999" is refused.
- `Number.isInteger` rejects negatives-as-fractions, `NaN` and `Infinity`.

## One shared scoring helper in the reducer

Submit and Edit used to repeat the same ~40 lines. Now both call `scoreRound`:

```ts
function scoreRound(seats, previous, submitted, rules): ScoredRound | null {
  const inBefore = seats.filter(id => !isEliminated(previous[id] ?? 0, rules.poolLimit));
  if (!validateRoundScores(submitted, inBefore, rules).valid) return null;

  for (const id of seats) {
    const playing = inBefore.includes(id);
    scores[id] = playing ? { type: submitted[id].type, points: submitted[id].points } : { type: 'out', points: 0 };
    // ...add to the running total, note who went out this round
  }
  // ...one player left wins; if everyone went out together, the lowest total wins
}
```

Players **already out** always get the `{ out, 0 }` placeholder, **whatever was sent**, so they can never gain points. `null` means "refuse": `if (!scored) return state;`.

Each action then checks its own rule first:

```ts
case 'START_GAME':
  if (validateStartGame(action.payload)) return state;

case 'EDIT_LAST_ROUND':
  // A settled deal fixed the scores it was based on.
  if (state.rounds.length === 0 || state.dealSplit) return state;

case 'RE_ENTER_PLAYER':
  const eligible = getEligibleForReEntryPlayers(state.rounds, state.seats, state.rules, Boolean(state.dealSplit));
  if (!lastRound || !player || !eligible.includes(playerId)) return state;
  // ...
  if (!Number.isInteger(newScore) || newScore < 1 || !isEligibleForReEntry(newScore, state.rules.poolLimit)) return state;

case 'ACCEPT_DEAL':
  if (validateDeal(state, action.payload.dealSplit)) return state;
```

The re-entry check reuses `getEligibleForReEntryPlayers`, **the same function the scoreboard uses to show the Re-Enter button**. One source of truth again.

## When old tests broke, and why that was good

The stricter reducer broke **7 older tests**. Each one was investigated, not just patched:
- 6 knocked a player out with a **typed hand score of 105**. The screen caps typed scores at full count (80), so that's impossible in the app. They now use the **Out** button (`{ type: 'out', points: poolLimit }`), which is how a player is really put out.
- 1 had Drop = **20** under default rules, where Drop is 24.
- The deal test accepted a deal **before any round was played**. It now plays a round first.

The behaviour each test checks (dealer rotation, re-entry seating, edits cancelling re-entries) is unchanged. Only impossible inputs were replaced.

**We also checked the UI can't hit a silent refusal.** The Deal screen builds deals exactly as `validateDeal` expects, and shows Accept only while the game is being played. The setup screen uses `validateRules` messages. The score screen uses the same `validateRoundScores`.

## The tests (`src/test/reducerRules.test.ts`, 25 tests)

- **Starting:** refuses 1 player, dealer seat 3 of 3, duplicate seats, Drop 50 > Middle 40. `validateRules` accepts the defaults and rejects five bad set-ups with the right message.
- **Rounds:** accepts a normal round. Refuses two shows, a missing player, −10, 12.5 and Drop = 999. A knocked-out player sent 40 points stays at 240 with an `out` placeholder. **Full count 100 accepts a hand of 90**, while the default still says "between 0 and 80".
- **Re-entry:** allowed for the player out in the last round (score 73). Refused for one out a round earlier, for a custom 201, and for `NaN`.
- **Deals:** settling works. Then editing and a second deal are refused, and payouts of 500 from a 300 pool are refused.

Totals: **125/125** unit tests and **13/13** browser tests.

## What can go wrong (interview angle)

**"Where should validation live: frontend or backend?"** Both, for different reasons. The front end gives friendly, instant feedback. The **source of truth** (here the reducer, in a web app the server or database) must enforce every rule, because the front end can always be bypassed. Share the rule code where you can, so they agree.

**"What's an invariant?"** A statement that must always be true, for example "a knocked-out player's total never changes" or "deal payouts add up to the pool". Enforce invariants where state changes, not where it's displayed.

**"A refactor broke old tests. What do you do?"** Read each failure. Is it a real regression, or did the test depend on something now correctly forbidden? Fix the code in the first case. In the second, fix the test's **inputs** while keeping what it **asserts**.

## From zero, by hand

1. Write `src/test/reducerRules.test.ts` as in this repo. Run it. Expected: *Cannot find module '../domain/rules'*.
2. Create `src/domain/rules.ts` (`validateRules`, `validateStartGame`, `totalPool`, `validateDeal`).
3. In `src/domain/scoring.ts`, replace `validateRoundScores` with the rules-aware version. Pass `rules` from `RoundInputModal.tsx` and in `scoring.test.ts`.
4. In `src/state/gameReducer.ts`:
   - add the `scoreRound` helper
   - rewrite `START_GAME`, `SUBMIT_ROUND`, `EDIT_LAST_ROUND` and `RE_ENTER_PLAYER` with their guards
   - add the deal guard to `UNDO_ROUND` and `validateDeal` to `ACCEPT_DEAL`
   - use `DEFAULT_RULES` in `INITIAL_STATE`
5. Run `npx vitest run`. Expected: 7 old tests fail. Fix them as described above. Expected after: `Tests  125 passed (125)`.
6. In `GameSetupWizard.tsx`, delete the four inline drop checks and call `validateRules(rules)` before starting.
7. Run `npx tsc -b`, `npm run lint` and `npm run test:e2e`. Expected: clean, clean, `13 passed`.
