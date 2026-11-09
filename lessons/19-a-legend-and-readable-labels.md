# 19 · A colour legend and readable labels

## The problem it solves

Tejo asked: *"Some entries are green and some are blue. Why?"* If the person who **built** the app has to ask, the screen isn't explaining itself. The same was true of the cell codes (R, D, MD, FC, X, RE, and the `*` before the dealer's name), which appeared nowhere in words.

The warning labels under player names ("COMPULSORY", "1 DROP", "(re entry)") were also **8–9 px**, which is hard to read on a phone at arm's length across a table. Accessibility guidance (WCAG and the platform guidelines) treats about 11–12 px as the practical minimum for mobile text.

## Everyday analogy: the key on a map

A map has a key in the corner: blue is water, dashed lines are footpaths. Without it you'd have to phone the mapmaker. A legend is that key for the scoreboard.

## The design: one list of meanings, used everywhere

`src/components/scoreboard/ScoreLegend.tsx`:

```tsx
/** What each score-cell code means. The cells and the legend both read from here. */
export const CELL_CODES = {
  show: { code: 'R', label: 'Show (won the round)' },
  open_drop: { code: 'D', label: 'Drop' },
  middle_drop: { code: 'MD', label: 'Middle drop' },
  full_count: { code: 'FC', label: 'Full count' },
  out: { code: 'X', label: 'Out' },
  reEntry: { code: 'RE', label: 'Re-entry (with the score they came back on)' },
} as const;
```

- **One source of truth.** The legend lists these, and every score cell uses the same `label` for its tooltip and screen-reader name. Change a meaning here and both update. They can't drift apart.
- `as const` makes TypeScript treat the values as exact, read-only strings.

The legend itself:

```tsx
export const ScoreLegend: React.FC = () => (
  <section aria-label="Legend" className="px-3 py-2.5 border-t ... text-[11px] ...">
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <Swatch className="bg-[#15803d]" label="All-drop round" />
      <Swatch className="bg-[#0078d4]" label="Normal round" />
      <Swatch className="bg-[#27272a]" label="Already out" />
    </div>
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {Object.values(CELL_CODES).map(({ code, label }) => (
        <span key={code}>
          <strong className="font-mono text-[var(--color-text)]">{code}</strong> {label}
        </span>
      ))}
    </div>
  </section>
);
```

- `<section aria-label="Legend">` gives it the **region** role, so screen readers can jump to it, and the test can find it by name.
- `flex-wrap` lets the items flow onto more lines on a narrow phone instead of scrolling sideways.
- The colour swatches are `aria-hidden`. They're decoration next to words that already say the same thing. **Colour is never the only signal.**

## Later change: a crown for the dealer

Tejo asked for a **👑 crown** instead of the `*` before the dealer's name, matching the crown already used on the score entry screen. The dealer isn't a *cell code*, so it left `CELL_CODES`. The legend shows it as its own item (a `Crown` icon plus "Dealer"), and the table header draws it like this:

```tsx
<span className="flex items-center justify-center gap-0.5 max-w-full">
  {isDealer && <Crown aria-hidden className="w-3 h-3 shrink-0 text-amber-300" />}
  <span className={`text-xs truncate block ...`}>{player?.name}</span>
  {isDealer && <span className="sr-only">(dealer)</span>}
</span>
```

- `aria-hidden` on the icon means TalkBack skips the picture.
- `sr-only` (a Tailwind class) hides text visually but keeps it for screen readers, so they hear **"Ravi (dealer)"**. That's better than "crown Ravi" or "star Ravi".
- The name keeps its own `truncate`, so a long name shortens without pushing the crown off.

The test checks that the dealer's column header contains an icon and "(dealer)", that no name starts with `*`, and that the legend shows the crown.

## Where it goes, and why

In `ScoreboardScreen.tsx`, directly under the table, inside the scrolling area:

```tsx
          </table>
          {rounds.length > 0 && <ScoreLegend />}
```

- It's **inside the area that Share → Image captures** (lesson 08), so friends who get the WhatsApp picture can read the colours too.
- It's hidden before round 1, when there's nothing to explain.

## Cells get names

Each code box now has a tooltip and an accessible name:

```tsx
<div className={`w-full max-w-[48px] ... ${cellBgClass} ...`}
     title={CELL_CODES.middle_drop.label} aria-label={CELL_CODES.middle_drop.label}>
  MD
</div>
```

TalkBack reads "Middle drop" instead of "M D", and a long-press or hover shows the meaning.

## Readable labels

`text-[8px] sm:text-[9px]` and `text-[9px]` became `text-[11px]` for "COMPULSORY", the one-drop warning and "(re entry)". A check in the edit script confirmed **no 8–9 px text is left** in the scoreboard.

## The tests (`src/test/scoreLegend.test.tsx`)

- After a round, the **Legend** region contains all three colours and every code with its meaning (R Show, D Drop, MD Middle drop, FC Full count, X Out, RE Re-entry, * Dealer).
- Before any round, there's no legend.
- Score cells are findable by their label: `getByLabelText('Show (won the round)')` and `getByLabelText('Middle drop')`.

The first version looked for `"R Show"` as one piece of text. On screen the code is in `<strong>`, so "R" and "Show" are separate elements, and Testing Library said exactly that (*"the text is broken up by multiple elements"*). The test now checks the legend's whole `textContent`.

Totals: **176/176** unit tests, **15/15** browser tests (the share-image test confirms the capture still works with the legend inside it).

## What can go wrong (interview angle)

**"How do you make colour-coded UI accessible?"** Never rely on colour alone. Pair it with text, icons or patterns. Provide a legend. Give each coded element an accessible name.

**"What's the minimum text size on mobile?"** Platform guidelines suggest around 12 px or more for body text (11 px for captions at the very least), and users must be able to zoom (step 5.4).

**"Why a shared constant for labels?"** It's DRY, the "Don't Repeat Yourself" principle. One meaning in one place means the legend and the cells can never disagree.

## From zero, by hand

1. Write `src/test/scoreLegend.test.tsx` as in this repo. Run it. Expected: `2 failed | 1 passed (3)`.
2. Create `src/components/scoreboard/ScoreLegend.tsx` with `CELL_CODES`, `Swatch` and `ScoreLegend` as above.
3. In `ScoreboardScreen.tsx`:
   - import both
   - add `title`/`aria-label` from `CELL_CODES` to the R, D, MD, FC and X boxes, and a `title` to RE
   - change the 8–9 px label classes to `text-[11px]`
   - render `{rounds.length > 0 && <ScoreLegend />}` after `</table>`
4. Run `npx vitest run && npm run lint && npm run test:e2e`. Expected: `176 passed`, clean, `15 passed`.
