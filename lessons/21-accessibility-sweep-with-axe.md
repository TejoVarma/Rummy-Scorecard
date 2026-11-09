# 21 · An accessibility sweep, checked by axe

## The problem it solves

**Accessibility** means the app works for everyone: people with low vision, people using **TalkBack** (Android's screen reader), people using a keyboard or switch control, and anyone tapping one-handed at a noisy table. The review had found:

| Problem | Who it hurts |
|---|---|
| **Pinch-zoom blocked** (`maximum-scale=1.0, user-scalable=no`) | Anyone who needs to enlarge small text |
| **19 icon-only buttons** (⚙️ 🗑️ ⬅️ ✕ ✏️ ⬆️ ⬇️) with only a `title`, or nothing | TalkBack says just "button" |
| **Tap targets of about 28 px** | Everyone's thumbs. Guidance is **44 px** (web) / **48 dp** (Android) |
| **Popups not marked as dialogs** | TalkBack doesn't announce that a popup opened |
| **New Game boxes with no connected labels** | TalkBack says "edit box, 24" with no idea what 24 is |
| **Clickable cards with no real button** | Can't be reached by keyboard or switch control |
| **Deleting a saved player with no confirm** | One mis-tap removes someone |

## Everyday analogy: a building inspection

An inspector walks through with a checklist (ramps, door widths, handrails, signs) and reports what fails. The builder then fixes each item, and the next inspection proves it's fixed. Here **axe-core** is the inspector and the tests are the repeat inspection.

## The inspector: axe-core in the tests

**axe-core** is the industry-standard accessibility engine (the same engine behind Chrome Lighthouse's accessibility audit). We run it **inside Vitest** on every main screen:

```ts
// jsdom can't measure colours or layout, so contrast and target size are checked by
// hand (lesson 20/21); everything else axe knows about is checked here.
async function audit(container: HTMLElement) {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return result.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

it('the scoreboard has no serious problems', async () => {
  const c = renderApp();
  fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
  expect(await audit(c)).toEqual([]);
});
```

- It covers Home, the scoreboard, score entry, New Game, Continue Game, the player list, and the Deal dialog.
- `color-contrast` is switched off **only because jsdom can't compute colours**. Contrast was measured by hand in lesson 20. `region` (every element inside a landmark) is a page-layout rule that doesn't fit a single-screen app.
- Only **serious/critical** findings fail the test, so it stays strict about what really blocks people.
- The violation list is the assertion. A failure prints exactly which rule broke and on which element, e.g. `button-name: .p-1` and `label: input[value="201"]`. That's how the fixes below were found, rather than guessed.

The first run: Home passed, and **every other screen failed**.

## The fixes

### 1. Every icon button gets a name and a 44 px target

A small script listed every `<button>` with no text and no `aria-label` (19 across 8 files). Each got a clear name and a bigger tap area:

```tsx
<button
  type="button"
  onClick={() => handleDeletePlayer(player.id)}
  aria-label={`Delete ${player.name}`}
  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-rose-400 ..."
>
  <Trash2 className="w-4 h-4" />
</button>
```

- **Names say what the button does to what:** "Delete Ravi", "Edit Amit", "Move up", "Back to Home", "Close". A `title` alone is read inconsistently by screen readers, so `aria-label` is set explicitly.
- `min-w-[44px] min-h-[44px] flex items-center justify-center`: the touch area grows, and the icon stays the same size, centred.

### 2. Dialogs are dialogs

`src/components/common/Modal.tsx`:

```tsx
const titleId = useId();
const dialogRef = useRef<HTMLDivElement>(null);

// Move focus into the dialog so screen readers announce it and keyboards land inside.
useEffect(() => {
  if (isOpen) dialogRef.current?.focus();
}, [isOpen]);
// ...
<div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ...>
  <h2 id={titleId}>{title}</h2>
```

- `role="dialog"` plus `aria-modal="true"` tells TalkBack "a popup opened, the page behind is inactive".
- `aria-labelledby` points at the title, so it announces *"Settings, dialog"*.
- `useId()` (React 18) generates a unique id, so two dialogs never clash.
- `tabIndex={-1}` makes the dialog focusable by code (not by Tab), so focus can move inside it.

### 3. Labels connected to boxes (New Game)

```tsx
<label htmlFor="setup-open-drop" className="text-[11px] ...">Open drop</label>
<input id="setup-open-drop" ... />
```

The text "Open drop" was a `<span>` sitting near the box. Now it's a `<label>` connected by `htmlFor`/`id`, so TalkBack reads *"Open drop, 24"*, and tapping the label focuses the box. The stake box gets `aria-label="Stake per player (₹)"`.

### 4. Real buttons inside clickable cards

The Home "Ongoing Game" card and each Continue Game card were `<div onClick>`. You can't just turn them into buttons, because **they already contain buttons** (Resume, Delete), and **buttons can't be nested** in valid HTML. So:
- the existing **Resume** button gets a full name: *"Resume ongoing game: Audit Night"* and *"Resume Sunday Marathon"*
- the card itself stays tappable as a convenience for touch

A native `<button>` works with Enter/Space and switch control automatically. The test checks `resume.tagName === 'BUTTON'` instead of faking a key press, because jsdom doesn't turn key presses into clicks the way a browser does.

### 5. Pinch-zoom allowed

`index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
`src/index.css`:
```css
/* Pinch-zoom stays available; this only removes the double-tap zoom delay on buttons. */
html {
  touch-action: manipulation;
}
```

`touch-action: manipulation` keeps pinch-zoom but turns off double-tap-to-zoom. That's what people usually *wanted* when they wrote `user-scalable=no`: buttons that respond instantly.

### 6. Deleting a saved player asks first

```tsx
if (!window.confirm(`Remove ${player?.name ?? 'this player'} from your saved players? Past matches keep their names.`)) return;
```

It names the person, and reassures you that past matches keep their names (each match stores its own copy of the players).

## The tests (`src/test/accessibility.test.tsx`, 11 tests)

- **axe** on Home, the scoreboard, score entry, New Game, Continue Game plus the player list, and the Deal dialog: no serious or critical violations.
- **Every button has a name** on the scoreboard (text or `aria-label`).
- **Settings opens as a dialog** named "Settings", with `aria-modal="true"` and a "Close" button.
- **Resume** is a real `<button>` and opens the scoreboard.
- **Pinch-zoom:** the viewport has no `user-scalable=no` or `maximum-scale=1`.
- **Deleting Ravi asks**, mentioning Ravi. Saying no keeps him.

Totals: **191/191** unit tests, **15/15** browser tests, build ✅.

## Round two: what the reviewers found after the sweep

Two reviewers checked all of Phase 5 afterwards. axe passing did **not** mean the job was finished. They found gaps that automation can't see:

| Gap | Fix |
|---|---|
| The **score entry screen** and the **Add/Edit Player popups** were hand-built overlays, not dialogs (step 1 only fixed the shared `Modal`) | `role="dialog"`, `aria-modal`, `aria-labelledby` pointing at their heading; focus moved into score entry |
| The Edit Player box and the custom deal boxes had **no names** | `aria-label="Player name"`, `` `Payout for ${player.name}` `` |
| New Game had **12 buttons with 3 identical names** ("Move up", "Move down", "Remove") | `` `Move ${player.name} up` ``, `` `Remove ${player.name}` `` |
| **Text buttons** still below 44 px: Re-Enter, the small Deal pill (10 px text), Details, Dismiss, Continue's Back/New, New Game chips, deal-mode tabs | `min-h-[44px]` added. The Deal pill text went to 11 px |
| **"Resume Game" was named "Resume Sunday Marathon"**, so a voice-control command "click Resume Game" did nothing (WCAG 2.5.3, *label in name*) | `` `Resume Game: ${game.title}` ``: the visible words come first |
| **My own mistake from lesson 19:** `aria-label` on a plain `<div>` is **ignored**. ARIA only allows names on elements with a role, so TalkBack still read "M D" | `role="img"` on the code boxes, so their label is used. RE cells are read as "Re-entry (with the score they came back on): 73" |
| Closing a dialog left focus on the page body | `Modal` remembers what had focus when it opened and **gives focus back** on close |

The tool-assisted pass also had a lesson of its own: the first automatic "grow the small buttons" script missed most of them. Its pattern stopped at the `>` inside `onClick={() => …}`, and it didn't handle `` className={`…`} ``. Checking the script's output count against the reviewer's list caught that.

Six new tests cover these: score entry is a dialog, cells are read by meaning (`getByRole('img', { name: 'Drop' })`), payout boxes are named, the seating buttons name the player, the add-player popup is a dialog with a named box, and focus returns to Settings after closing. Totals: **201/201** unit tests, **15/15** browser tests.

**The takeaway:** automated checks (axe) catch missing names and roles, but not *ambiguous* names, voice-control mismatches, or ARIA that's present but ignored. Human review (and a real TalkBack session) is still needed.

## What can go wrong (interview angle)

**"How do you test accessibility?"** Automate what can be automated (axe in unit/e2e tests catches roughly a third to half of issues: names, roles, labels, ARIA misuse). Then test by hand with a real screen reader and with zoom, because automation can't judge whether a name is *helpful*.

**"`title` vs `aria-label`?"** `title` is a tooltip, and screen-reader support for it is inconsistent. For icon-only buttons, set `aria-label` (or visually hidden text).

**"Why not disable zoom on mobile?"** It fails WCAG 1.4.4 (resize text) and locks out low-vision users. Use `touch-action: manipulation` to remove the tap delay instead.

**"What's a focus trap?"** In a modal, Tab should cycle inside the dialog, not wander behind it. We move focus **into** the dialog. A full trap (cycling Tab) is a further improvement for keyboard-heavy apps.

## From zero, by hand

1. `fnm exec --using=22 -- npm install -D axe-core@4`
2. Write `src/test/accessibility.test.tsx` as in this repo. Run it. Expected: 10 of 11 fail. Read each `button-name` / `label` finding.
3. Run the listing script from this lesson's step 1, and give each icon button an `aria-label` plus `min-w-[44px] min-h-[44px] flex items-center justify-center`.
4. Make `Modal.tsx` a dialog (`useId`, `ref`, `role`, `aria-modal`, `aria-labelledby`, `tabIndex`, focus effect, `id` on the title).
5. In `GameSetupWizard.tsx`, turn the four box captions into `<label htmlFor>` with matching `id`s, and label the title and stake boxes.
6. Name the Resume buttons in `HomeScreen.tsx` and `ContinueGameScreen.tsx`, and name the Continue Game delete button.
7. Fix the viewport in `index.html`, add `touch-action` to `index.css`, and add the confirm to `handleDeletePlayer`.
8. Run `npx vitest run && npm run lint && npm run build && npm run test:e2e`. Expected: `191 passed`, clean, built, `15 passed`.
