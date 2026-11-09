# 20 · One list instead of ten copies (the score entry screen)

## The problem it solves

`RoundInputModal` (the screen where you enter a round's scores) repeated almost the same block **ten times**:
- **five "chips"** that show your choice (Show, Drop, M Drop, Full, Out) and clear it when tapped
- **five option buttons** to choose one

Each copy had its own colour, its own label and its own points rule (`if (type === 'open_drop') pts = rules.openDrop; …`). That's how bugs creep in: change one copy, forget the other four. On top of that:
- The chips were `<span onClick>`. They're not focusable, have no role, and TalkBack can't reach them.
- The score box had **no name**, so a screen reader announced "edit box".
- The buttons were about 28 px tall, below comfortable thumb size.
- White text on the green Show and amber M Drop buttons was **too faint** (contrast 3.3:1 and 2.9:1, where the standard asks for at least 4.5:1).

## Everyday analogy: five hand-typed menus

A café with **five separate printed menus**, one per table, each typed by hand. Change a price and you must remember all five, and one will be wrong for a week. Better: **one menu** that every table reads from.

## The fix

`src/components/input/RoundInputModal.tsx`:

### One list of options

```tsx
// The quick-pick options, in the order they appear. Points always come from the game's rules.
const SCORE_OPTIONS: Array<{ type: Exclude<ScoreInputType, 'custom'>; label: string; color: string }> = [
  { type: 'show', label: 'Show', color: '#15803d' },
  { type: 'open_drop', label: 'Drop', color: '#c2410c' },
  { type: 'middle_drop', label: 'M Drop', color: '#a16207' },
  { type: 'full_count', label: 'Full', color: '#7c3aed' },
  { type: 'out', label: 'Out', color: '#dc2626' },
];
```

- `Exclude<ScoreInputType, 'custom'>` is a TypeScript utility type: "every score type **except** custom". The compiler stops anyone adding a `'custom'` quick-pick by mistake.
- Points come from **one** function, the same one the rules check uses (lesson 12):
  ```tsx
  const pts = getPointsForInputType(type, undefined, rules);
  ```

### Buttons drawn from the list

```tsx
{SCORE_OPTIONS.map(option => (
  <button
    key={option.type}
    type="button"
    onClick={() => handleSelectType(playerId, option.type)}
    aria-pressed={currentInput?.type === option.type}
    style={{ backgroundColor: option.color }}
    className={`min-h-[40px] px-4 rounded-full font-medium text-sm text-white transition ${
      currentInput?.type === option.type ? 'ring-2 ring-white/70 shadow-md' : 'hover:opacity-95'
    }`}
  >
    {option.label}
  </button>
))}
```

- `aria-pressed` tells TalkBack which option is currently selected ("Drop, toggle button, pressed").
- `min-h-[40px]` gives a much easier thumb target. Step 5.4 handles the rest of the app.

### The chip is now a real button, and the box has a name

```tsx
const chosen = SCORE_OPTIONS.find(option => option.type === currentInput?.type);
// ...
{chosen ? (
  <button
    type="button"
    onClick={() => clearScore(playerId)}
    aria-label={`Clear ${chosen.label} for ${player?.name}`}
    style={{ backgroundColor: chosen.color }}
    className="min-h-[32px] px-4 rounded-full text-white font-medium text-xs leading-none shadow-sm"
  >
    {chosen.label} ✕
  </button>
) : (
  <input
    type="text"
    inputMode="numeric"
    aria-label={`Score for ${player?.name}`}
    placeholder={`0–${rules.fullCount}`}
    /* ... */
  />
)}
```

- Five near-identical chip blocks became **one**, chosen by looking up the current choice in the list.
- The **✕** shows sighted users it can be cleared. `aria-label` tells screen-reader users the same: *"Clear Drop for Ravi"*.
- The placeholder `0–80` shows the allowed range **before** you type, instead of silently capping 95 to 80 after.
- The accessible name *"Clear Show for Ravi"* is deliberately different from the option button's name *"Show"*. Otherwise "find the Show button" would match two things.

### Colours with enough contrast

The contrast ratio was measured with the WCAG formula (relative luminance of white vs the button colour):

| Button | Before | Now |
|---|---|---|
| Show | 3.3 : 1 | **5.0 : 1** (`#15803d`, the same green as all-drop rows) |
| Drop | 3.6 : 1 | **5.2 : 1** (`#c2410c`) |
| M Drop | 2.9 : 1 | **4.9 : 1** (`#a16207`) |
| Full | 5.7 : 1 | 5.7 : 1 |
| Out | 4.8 : 1 | 4.8 : 1 |

They're the same hues, just slightly darker, so they still look like the same buttons.

## The tests

**Refactor safety net:** every existing unit and browser test that taps Show / Drop / M Drop / Full / Out, or types a hand score, passed **unchanged**. That's the proof a refactor kept behaviour.

**New** (`src/test/roundInput.test.tsx`, 4 tests):
- Options send points from the **rules** (with Drop 25 and M Drop 50, M Drop sends 50).
- Only one Show: choosing Show for Amit clears Ravi's.
- A chosen option is a **button** named "Clear Drop for Ravi", and tapping it brings back the named score box.
- The score box is named "Score for Amit", shows `0–80`, and caps 95 to 80.

Totals: **180/180** unit tests, **15/15** browser tests. The file went from 396 to **306** lines.

## What can go wrong (interview angle)

**"How do you remove duplication in UI code?"** Find what varies (label, colour, type), put it in a **data list**, and map over it. Keep behaviour in one function. This is **data-driven UI**.

**"How do you refactor safely?"** Have tests on the behaviour first (here, e2e and component tests that click real buttons), change the structure, and the same tests must still pass without edits.

**"What's `aria-pressed`, and when do you use `aria-label`?"** `aria-pressed` marks a toggle button's on/off state. `aria-label` gives an element a name when its visible text isn't enough on its own ("✕" or "Drop ✕" → "Clear Drop for Ravi").

**"What contrast is required?"** WCAG AA: 4.5:1 for normal text, 3:1 for large text (about 18 px regular or 14 px bold).

## From zero, by hand

1. Write `src/test/roundInput.test.tsx` as in this repo. Run it. Expected: `3 failed | 1 passed (4)`.
2. In `RoundInputModal.tsx`:
   - add `SCORE_OPTIONS` above the props interface, and import `getPointsForInputType`
   - in `handleSelectType`, replace the `if/else` chain with `getPointsForInputType`
   - add `clearScore` and, in the player loop, `const chosen = SCORE_OPTIONS.find(...)`
   - replace the five chip blocks with the single chip/input block above
   - replace the five option buttons with the `SCORE_OPTIONS.map(...)` block
3. Run `npx vitest run && npm run lint && npm run test:e2e`. Expected: `180 passed`, clean, `15 passed`.
