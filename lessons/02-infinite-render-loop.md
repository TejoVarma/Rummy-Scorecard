# 02 · The infinite render loop in the Deal screen

## The problem it solves

If a stake is set and you tap the small **Deal** button in the scoreboard header **before round 1**, the Deal screen redraws itself forever. The phone heats up, the screen stutters, and the app may freeze.

## Everyday analogy: the clerk and the blank sheets

A clerk is told: *"Whenever the guest list changes, rewrite the seating chart."*
Each time the clerk finishes, a helper hands over a **brand-new blank sheet** and says "here's the guest list".
The sheet is blank, just like the last one, but it is a **different piece of paper**. The clerk only checks *"is this the same sheet?"*, not *"does it say the same thing?"*, so they rewrite the chart again. Then they get another new sheet, and so on, forever.

## How React decides something "changed"

- `useMemo(fn, deps)` and `useEffect(fn, deps)` re-run only when a dependency has changed.
- React checks "changed" with `Object.is`, which for objects means **"is it the very same object in memory?"**, not "does it have the same contents?".
- `{} === {}` is `false`. Two empty objects are two different sheets of paper.

## The loop, step by step

In `src/components/scoreboard/PoolShareModal.tsx` (before the fix):

```tsx
const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
const latestScores = lastRound?.cumulativeScores ?? {};   // new {} every render when there are no rounds

const activePlayers = useMemo(() => { /* builds an array */ }, [seats, latestScores, rules.poolLimit, players, dealSplit]);

useEffect(() => {
  if (isOpen) {
    // ...
    setCustomPayouts(res);                                 // setting state causes another render
  }
}, [isOpen, dealSplit, rules.poolLimit, totalPoolAmount, activePlayers]);
```

1. Render: no rounds, so `latestScores` is a **new** `{}`.
2. `useMemo` sees a "changed" `latestScores` and builds a **new** `activePlayers` array.
3. `useEffect` sees a "changed" `activePlayers` and calls `setCustomPayouts(...)`.
4. Setting state causes a render. Go to 1.

After round 1, `latestScores` is the stored `cumulativeScores` object. That's the same object every render, so the loop never happens. That's why the bug only shows up before the first round.

## The fix

**1. One shared empty object, created once outside the component:**

```tsx
// Shared so the memo below sees the same object every render before round 1.
const NO_SCORES: Record<PlayerId, number> = {};

// inside the component
const latestScores = lastRound?.cumulativeScores ?? NO_SCORES;
```

`NO_SCORES` is created once, when the file loads. Every render gets the **same** object, so `useMemo` doesn't rebuild and the effect doesn't fire again.

**2. Don't offer a deal before anyone has played.** In `src/components/scoreboard/ScoreboardScreen.tsx` the header button is now wrapped:

```tsx
{rounds.length > 0 && (
  <button type="button" onClick={() => setIsPoolShareOpen(true)} /* ...classes... */>
    <Handshake className="w-3 h-3" /> Deal
  </button>
)}
```

`rounds.length > 0 && (...)` renders the button only when there's at least one round. This matches the bottom "Share pool / Make deal" button, which already had this check.

## The test (written first)

`src/test/poolShareModal.test.tsx` uses **React Testing Library**, which renders components the way a user sees them, and **jsdom**, a fake browser that runs inside Node. The first line, `// @vitest-environment jsdom`, tells Vitest to use jsdom for this file only. The other tests are plain logic and don't need a browser.

```tsx
it('opens the deal modal without an endless re-render', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<PoolShareModal isOpen onClose={() => {}} state={startedGame()} onAcceptDeal={() => {}} />);
  const loopWarnings = errors.mock.calls.filter(args => String(args[0]).includes('Maximum update depth'));
  expect(loopWarnings).toHaveLength(0);
});

it('hides the header Deal button until a round has been played', () => {
  render(<ScoreboardScreen state={startedGame()} /* ...no-op callbacks... */ />);
  expect(screen.queryByRole('button', { name: /^deal$/i })).toBeNull();
});
```

- `startedGame()` builds a real game with the reducer: 2 players, a ₹500 stake and **zero rounds**. That's the exact situation that triggers the bug.
- **Before the fix**, the first test **hung**. `render` kept running effects forever and never returned. That hang is the loop itself.
- **After the fix**, both tests pass in about 50 ms.
- `queryByRole('button', { name: /^deal$/i })` finds a button by its accessible name, the way a screen reader would. `queryBy...` returns `null` when nothing matches, so we can assert that the button is absent.

## What can go wrong (interview angle)

**"What causes an infinite render loop in React?"** An effect that sets state, plus a dependency that's a **new object or array on every render**. The usual culprits are `?? {}`, `?? []`, inline objects such as `style={{...}}` passed into deps, and `.map()` or `.filter()` results that aren't memoized.

**How to fix it:**
- Use stable references: a module-level constant (as here), `useMemo`, or `useCallback`.
- Only set state when the value actually changed.
- Narrow the effect's dependencies to what really matters (for example `[isOpen]`).
- Ask whether you need the effect at all. Often the value can just be calculated during render.

**How would you spot it?** React logs *"Maximum update depth exceeded"*. The UI freezes, the CPU sits at 100%, and the React DevTools Profiler shows the same component rendering over and over.

## From zero, by hand

1. **Install the test tools:**
   ```bash
   npm install -D @testing-library/react@16 @testing-library/dom@10 jsdom@25
   ```

2. **Write the test** as `src/test/poolShareModal.test.tsx`:
   ```tsx
   // @vitest-environment jsdom
   import { describe, it, expect, vi, afterEach } from 'vitest';
   import { render, screen, cleanup } from '@testing-library/react';
   import { PoolShareModal } from '../components/scoreboard/PoolShareModal';
   import { ScoreboardScreen } from '../components/scoreboard/ScoreboardScreen';
   import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
   import { DEFAULT_RULES } from '../domain/scoring';
   import { GameState } from '../domain/types';

   function startedGame(): GameState {
     return gameReducer(INITIAL_STATE, {
       type: 'START_GAME',
       payload: {
         title: 'Friday Pool',
         rules: { ...DEFAULT_RULES, entryAmount: 500 },
         players: [
           { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
           { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
         ],
         initialSeats: ['p1', 'p2'],
         initialDealerIndex: 0,
       },
     });
   }

   afterEach(() => {
     cleanup();
     vi.restoreAllMocks();
   });

   describe('pool deal before the first round', () => {
     it('opens the deal modal without an endless re-render', () => {
       const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
       render(<PoolShareModal isOpen onClose={() => {}} state={startedGame()} onAcceptDeal={() => {}} />);
       const loopWarnings = errors.mock.calls.filter(args =>
         String(args[0]).includes('Maximum update depth')
       );
       expect(loopWarnings).toHaveLength(0);
     });

     it('hides the header Deal button until a round has been played', () => {
       render(
         <ScoreboardScreen
           state={startedGame()}
           onBack={() => {}}
           onOpenScoreInput={() => {}}
           onOpenEditScore={() => {}}
           onOpenSettings={() => {}}
           onPromptReEntry={() => {}}
           onDeleteGame={() => {}}
           onAcceptDeal={() => {}}
         />
       );
       expect(screen.queryByRole('button', { name: /^deal$/i })).toBeNull();
     });
   });
   ```

3. **Run it and watch it fail:**
   ```bash
   timeout 120 npx vitest run src/test/poolShareModal.test.tsx
   ```
   Expected: only `RUN v2.1.9 ...` is printed, then nothing until the timeout kills it. That's the infinite loop.

4. **Apply the two fixes** from "The fix" above:
   - In `PoolShareModal.tsx`, add `NO_SCORES` above the component and use `?? NO_SCORES`.
   - In `ScoreboardScreen.tsx`, wrap the header Deal button in `{rounds.length > 0 && (...)}`.

5. **Run everything:**
   ```bash
   npx vitest run && npx tsc -b && echo "tsc ok"
   ```
   Expected: `Test Files  8 passed (8)`, `Tests  63 passed (63)`, `tsc ok`.
