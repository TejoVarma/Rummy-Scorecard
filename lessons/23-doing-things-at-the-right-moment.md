# 23 · Doing things at the right moment (theme flash, stacked dialogs, confetti)

## The problem it solves

Three small "feel" bugs, each caused by doing something at the **wrong moment**:

1. **A wrong-theme flash at launch.** Theme colours were applied in a `useEffect`, which React runs **after** the browser has painted. A light-theme user saw one dark frame first.
2. **Fragile scroll locking.** Each dialog set `body.style.overflow = 'hidden'` when it opened and `'unset'` when it closed. With **two dialogs stacked** (Settings over the scoreboard), closing the inner one unlocked the page while the outer one was still open.
3. **Confetti on every visit.** Opening a *finished* game from Continue Game replayed the 5-second celebration, and its animation loop, every time.

## Everyday analogy

- A shop that switches the lights on *after* the customers walk in.
- Two staff sharing one OPEN/CLOSED sign, where whoever leaves first flips it to CLOSED while the other is still serving.
- A party popper that goes off every time someone looks at last week's photos.

## Fix 1: colours before the first paint

`src/themes/ThemeContext.tsx`:

```tsx
// Apply the saved colours once, before any screen draws, so a light theme never flashes dark.
useState(() => applyThemeStyles(theme, colorMode));

// Later changes apply before the browser paints, too.
useLayoutEffect(() => applyThemeStyles(theme, colorMode), [theme, colorMode]);
```

React's order of events:

```
render (children too)  →  DOM updated  →  useLayoutEffect  →  browser paints  →  useEffect
```

- **`useEffect`** runs after the paint, which is too late for anything visible on the first frame.
- **`useLayoutEffect`** runs after the DOM update but **before** the paint. It's the right hook for "must be in place before the user sees anything" work like measuring or theming.
- The **lazy `useState` initialiser** runs once, during the provider's **first render**, before its children render. It's a deliberate, one-time, idempotent side effect: setting CSS variables twice is harmless, which matters because StrictMode may call it twice in development. It guarantees the child screens are drawn with the right variables from the very start.
- `applyThemeStyles` is the old effect body moved into a plain function, so both places share it. `classList.toggle('dark', isDark)` replaces the add/remove `if`.

## Fix 2: count the open dialogs

`src/components/common/Modal.tsx`:

```tsx
let openDialogs = 0;

// Several dialogs can be open at once (Settings over the scoreboard), so count them and
// only let the page scroll again when the last one closes.
useEffect(() => {
  if (!isOpen) return;
  openDialogs += 1;
  document.body.style.overflow = 'hidden';
  return () => {
    openDialogs -= 1;
    if (openDialogs === 0) document.body.style.overflow = '';
  };
}, [isOpen]);
```

- It's a **reference count**: one shared counter at module level, outside any component. Each open dialog adds one, and each close (the effect cleanup) takes one away. Only the **last** close unlocks.
- The cleanup runs when `isOpen` turns false **or** the dialog unmounts, so the count can't leak.
- `overflow = ''` removes the inline style entirely and returns to the stylesheet's value. The old `'unset'` left a stray inline style behind.

## Fix 3: celebrate only a win you just saw

`src/components/scoreboard/ScoreboardScreen.tsx`:

```tsx
// Celebrate a win that happens while this screen is open, not one from an earlier visit.
const [winnerWhenOpened] = useState(winnerPlayerId);
const justWon = Boolean(winnerPlayerId) && winnerPlayerId !== winnerWhenOpened;
// ...
{justWon && <Confetti />}
```

- `useState(winnerPlayerId)` **remembers the value from the first render** and ignores later changes, because we never call the setter. That's a simple way to keep a "snapshot at mount".
- `justWon` is **derived** during render, with no extra effect or state updates. A game opened already finished has `winnerPlayerId === winnerWhenOpened`, so no confetti. A game that finishes while you watch changes from `undefined` to a winner, so confetti.
- The "Winner" banner still shows either way. Only the animation is limited.

## The tests (`src/test/polish.test.tsx`, 4 tests)

| Test | Before |
|---|---|
| With a saved **light** mode, the very first child render already sees the light `--color-bg` | ❌ |
| Two dialogs open → close the inner one → page **still locked** → close the outer → unlocked (`''`) | ❌ |
| Opening a game that **already** finished draws **no** confetti canvas | ❌ |
| A game that finishes **while on screen** draws the confetti canvas | ✅ (kept) |

The theme test uses a tiny `FirstScreen` component that records `--color-bg` **during its own render**. That's the earliest moment a screen could show anything.

Totals: **195/195** unit tests, **15/15** browser tests, build ✅.

## What can go wrong (interview angle)

**"`useEffect` vs `useLayoutEffect`?"** `useEffect` runs after paint and doesn't block it (use it for data fetching, subscriptions, logging). `useLayoutEffect` runs before paint and blocks it (use it for measuring layout or applying visual state to avoid flicker). Keep layout effects small, because they delay the frame.

**"How do you handle a shared resource many components lock?"** Reference counting (or a stack). Never let one component "release" what others still hold. The same idea appears in database connection pools and file handles.

**"Derived state vs effects?"** If a value can be calculated from props and state during render, calculate it. Don't sync it with an effect plus `setState`, which causes extra renders and timing bugs. `justWon` is derived.

## From zero, by hand

1. Write `src/test/polish.test.tsx` as in this repo. Run it. Expected: `3 failed | 1 passed (4)`.
2. In `ThemeContext.tsx`:
   - move the effect body into `applyThemeStyles(theme, colorMode)`
   - call it from `useState(() => …)` and from `useLayoutEffect(…, [theme, colorMode])`
   - import `useLayoutEffect` instead of `useEffect`
3. In `Modal.tsx`, add `let openDialogs = 0;` and replace the scroll-lock effect with the counted version.
4. In `ScoreboardScreen.tsx`, add `winnerWhenOpened` and `justWon`, and render `{justWon && <Confetti />}`.
5. Run `npx vitest run && npm run lint && npm run build && npm run test:e2e`. Expected: `195 passed`, clean, built, `15 passed`.
