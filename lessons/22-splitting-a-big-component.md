# 22 · Splitting a big component without changing what it does

## The problem it solves

`ScoreboardScreen.tsx` had grown to **657 lines** and did everything: the top bar, the rules summary, the score table, the banners, the bottom buttons, sharing, and three dialogs. Big components are:
- **hard to read**: you scroll past 200 lines of table to find a button
- **hard to change safely**: editing the top bar means touching a file that also holds the table logic
- **full of copies**: the five R/D/MD/FC/X cell boxes were near-identical blocks

## Everyday analogy: a one-room house

Kitchen, bedroom and office in one room works, until cooking smokes up your bed. **Rooms with doors** (components with clear inputs) keep each job contained, and you can repaint one room without touching the others.

## The rule for a safe split

This is a **refactor**: the structure changes and the **behaviour must not**. So:
1. Move one section at a time into its own component.
2. Pass in **only what that section needs** (its props).
3. Run the **unchanged** test suite after each move.

The proof at the end: `git diff --stat -- src/test e2e` was **empty**. Not one test was touched, and all 191 unit tests and 15 browser tests still passed.

## The new pieces

| File | Lines | Job |
|---|---|---|
| `scoreboard/ScoreTable.tsx` | 217 | Header row with drop warnings, round rows, total row, legend |
| `scoreboard/ScoreboardHeader.tsx` | 55 | Top bar: back, title, announce, share, settings, delete |
| `scoreboard/ScoreboardActions.tsx` | 65 | Bottom buttons: Enter / Edit score, Deal, View settlement |
| `scoreboard/ShareMenu.tsx` | 42 | The "Image or Text" dialog |
| `common/IconButton.tsx` | 22 | Every icon-only button: a name plus a 44 px target |
| `ScoreboardScreen.tsx` | **338** (was 657) | State, sharing logic, banners, putting the pieces together |

### `forwardRef`: handing a ref through a component

Share → Image needs the table's **scrolling box** (lesson 08, to capture the full height). That box now lives inside `ScoreTable`, so the parent passes its ref **through**:

```tsx
export const ScoreTable = forwardRef<HTMLDivElement, ScoreTableProps>(function ScoreTable(
  { seats, players, rounds, /* ... */ },
  scrollRef
) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto ...">
      <table>...</table>
    </div>
  );
});

// in ScoreboardScreen
<ScoreTable ref={scoreTableScrollRef} seats={seats} /* ... */ />
```

Normal props can't carry `ref`. `forwardRef` is React's way to let a parent reach a DOM element inside a child.

### One cell component instead of five copies

```tsx
const CODED_TYPES = ['show', 'open_drop', 'middle_drop', 'full_count'] as const;

function ScoreCell({ score, reEntered, rowColour }) {
  if (score.type === 'out') { /* grey X box */ }
  const coded = CODED_TYPES.find(type => type === score.type);
  if (coded) {
    const { code, label } = CELL_CODES[coded];
    const textColour = coded === 'show' ? 'text-[#facc15]' : 'text-white';
    return (
      <div title={label} aria-label={label} className={`${CELL} ${rowColour} ${textColour} shadow-sm`}>
        {code}
      </div>
    );
  }
  if (reEntered) { /* RE + score */ }
  return <div className={`${CELL} ${rowColour} text-white shadow-sm font-mono`}>{score.points}</div>;
}
```

The codes and labels come from `CELL_CODES` (lesson 19), the same list the legend shows.

### `IconButton`: make the right thing the easy thing

```tsx
/** An icon-only button with a name and a 44px touch target, so neither can be forgotten. */
export const IconButton: React.FC<IconButtonProps> = ({ label, onClick, className = '', children }) => (
  <button type="button" onClick={onClick} title={label} aria-label={label}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition ${className}`}>
    {children}
  </button>
);
```

While extracting the top bar, a miss from lesson 21 showed up. The **Announce** and **Share** buttons still had about 28 px targets: they already had names, so the "missing name" search didn't catch them. A shared component makes the name and the 44 px size **required by construction**. `label` isn't optional, and you can't forget the classes because you never write them.

### Deliberate small changes (and why they're fine in a refactor)

A refactor shouldn't change behaviour, but two **visual** fixes rode along and are called out here on purpose:
- The secondary bottom buttons (Edit Score, Make Deal) are now at least 44 px tall.
- The amber "Make Deal" text is darker in light mode (`text-amber-600 dark:text-amber-300`), where it was hard to read.

The total row's colours were **kept exactly**: an early draft merged them with the header's colours, which would have been an unnoticed visual change.

## What can go wrong (interview angle)

**"When should you split a component?"** When it has several jobs, when you scroll to find things, or when changes in one area keep risking others. Split along **responsibilities** (header, table, actions), not arbitrary line counts.

**"How do you refactor safely?"** Have behaviour tests first. Move code in small steps. Keep props minimal. Run the same tests, unchanged, after each step. If you must change a test, that's a sign behaviour changed.

**"What is `forwardRef` for?"** Passing a ref from a parent to a DOM node inside a child component, for things like focus, measuring or scrolling. (React 19 lets function components take `ref` as a normal prop.)

**"How do you stop accessibility regressions?"** Encode the rule in a shared component (`IconButton`), and keep the automated checks (axe, "every button has a name") in the test suite.

## From zero, by hand

1. Create `ScoreTable.tsx` (with `forwardRef`, `ScoreCell`, the header/rows/total markup and `<ScoreLegend />`). In `ScoreboardScreen`, replace the table block with `<ScoreTable ref={scoreTableScrollRef} … />`.
2. Run `npx tsc -b && npx vitest run && npm run test:e2e`. Expected: all pass, with no test edits.
3. Create `IconButton.tsx`, `ScoreboardHeader.tsx`, `ScoreboardActions.tsx` and `ShareMenu.tsx` (exporting `ShareKind`). Replace the top bar, bottom buttons and share `Modal` in `ScoreboardScreen` with them.
4. Remove the now-unused icon imports that `tsc` reports.
5. Run `npx vitest run && npm run lint && npm run build && npm run test:e2e`, then `git diff --stat -- src/test e2e`. Expected: `191 passed`, clean, built, `15 passed`, and **no output** from the diff.
