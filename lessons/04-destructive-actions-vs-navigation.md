# 04 · Destructive actions vs navigation

## The problem it solves

Settings had a button called **"Start New Match"**. Its confirmation said *"Current scores will be cleared."* What it actually did was call `handleDeleteGame`, the same function as the scoreboard's 🗑️ delete button. That function:

1. removed the match from the saved-games list (the list **Continue Game** reads), in both localStorage and Preferences
2. cleared it as the active match
3. reset the app and opened the Continue Game screen, not the new-game setup

So someone who just wanted to start a fresh match **permanently lost** the old one: its scores, re-entries and deal record.

## Everyday analogy: the notebook's "New page" button

Imagine a notebook app whose **"New page"** button also **tears out the page you were on**. Starting a page and throwing one away are two different jobs. The second should be harder to do, and it should tell you exactly which page is going in the bin.

## The rule

- **Navigation** (go somewhere, start something) must **never destroy data**. Because nothing is lost, it needs no confirmation.
- **Destruction** (delete) lives in **one obvious place**, **names the thing** being destroyed, and says it can't be undone.

## What we changed

### `src/components/settings/SettingsModal.tsx`

The prop changed from `onResetGame: () => void` to an optional `onStartNewMatch`:

```tsx
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Left undefined when there's no match in progress, which hides the button.
  onStartNewMatch?: () => void;
}
```

```tsx
{onStartNewMatch && (
  <div className="pt-3 border-t border-[var(--color-border)] space-y-1.5">
    <button
      type="button"
      onClick={() => {
        onStartNewMatch();
        onClose();
      }}
      className="... bg-[var(--color-primary)] text-white ..."
    >
      <RefreshCw className="w-3.5 h-3.5" /> Start New Match
    </button>
    <p className="text-[11px] text-[var(--color-muted)] text-center">
      Your current match stays in Continue Game.
    </p>
  </div>
)}
```

- `onStartNewMatch && (...)` renders the button only when the parent passes a function. The parent decides *when* it makes sense, and the modal just shows or hides it.
- There's no `window.confirm` any more, because nothing is lost.
- The colour changed from **red** (danger) to the normal **primary** colour, because it's no longer dangerous. Colour is part of the message.

### `src/App.tsx`

```tsx
onStartNewMatch={state.status !== 'setup' ? () => setCurrentScreen('new_game') : undefined}
```

- `state.status !== 'setup'` means a match exists (playing or completed). Only then is the button offered.
- `setCurrentScreen('new_game')` simply **navigates** to the setup wizard. Nothing is deleted.
- Why the old match survives: the app auto-saves every match into the saved list whenever its state changes. Starting a new match creates a **new `gameId`**, so the new match is *added* to the list next to the old one.

### `src/components/scoreboard/ScoreboardScreen.tsx`: the real delete names its target

```tsx
if (window.confirm(`Delete "${title}" permanently? Its scores and deal can't be recovered.`)) {
  onDeleteGame();
}
```

The backtick string (a **template literal**) puts the match title into the message, for example *Delete "Friday Pool" permanently?*. People confirm a **named** thing much more carefully than a generic "Are you sure?".

## The tests (written first)

`src/test/startNewMatch.test.tsx` renders the **real `App`**, wrapped in `ThemeProvider` the same way `main.tsx` does it. It's an integration test, because the bug was in how `App` **wired** the button, not inside the modal itself.

```tsx
it('keeps the current match in Continue Game and opens new-game setup', () => {
  localStorage.setItem('rummy_active_game_v1', JSON.stringify(savedMatch));
  localStorage.setItem('rummy_saved_games_list_v1', JSON.stringify([savedMatch]));
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderApp();
  openSettings();
  fireEvent.click(screen.getByRole('button', { name: /start new match/i }));

  expect(screen.getByRole('heading', { name: 'New Game' })).toBeTruthy();
  const list = JSON.parse(localStorage.getItem('rummy_saved_games_list_v1')!);
  expect(list.map(g => g.gameId)).toContain('game_1');
  expect(confirmSpy).not.toHaveBeenCalled();
});

it('is not offered when no match is in progress', () => {
  renderApp();
  openSettings();
  expect(screen.queryByRole('button', { name: /start new match/i })).toBeNull();
});
```

- `vi.spyOn(window, 'confirm').mockReturnValue(true)` stands in for the browser's confirm dialog and **clicks OK automatically**. Without that, the old code would have stopped at the dialog. With it, the test proves the old code really deleted the match. The last line then checks that the new code never asks at all.
- The first run failed with *"useTheme must be used within a ThemeProvider"*. That was a mistake in the **test setup**, not the bug, so we wrapped `App` like `main.tsx` does. A test that fails for the wrong reason proves nothing. Always read *why* a test fails.
- On the second run both tests failed for the **right** reason: the "New Game" heading was missing, and the button was shown without a match. After the fix, 70/70 pass.

## What can go wrong (interview angle)

**"How do you design destructive actions?"**
- Keep them separate from navigation and creation.
- Put them in one predictable place, styled as danger (red).
- Name the object: "Delete 'Friday Pool'?", not "Are you sure?".
- Prefer **undo** (a toast with an "Undo" button) or **soft delete** (a "trash" you can restore from) over a confirm dialog. People click OK on confirm dialogs out of habit.
- Make labels match behaviour. A label that understates what happens is a bug, even if the code "works".

**"Why test at the App level here instead of the modal?"** The modal did exactly what it was told. The bug was that `App` passed it the **delete** function. Testing the modal alone, with a fake callback, would have passed even with the bug in place. Choose the test level where the bug actually lives.

## From zero, by hand

1. **Write `src/test/startNewMatch.test.tsx`** with the contents in this repo: the `savedMatch` fixture, `renderApp()` wrapping `<App />` in `<ThemeProvider>`, `openSettings()` clicking the first element titled "Settings", and the two tests above.

2. **Run it:** `npx vitest run src/test/startNewMatch.test.tsx`
   Expected: `Tests  2 failed (2)`, with *Unable to find ... heading "New Game"* and *expected <button> to be null*.

3. **Change `SettingsModal.tsx`:** replace `onResetGame` with the optional `onStartNewMatch` prop, and replace the old red button block with the `{onStartNewMatch && (...)}` block above.

4. **Change `App.tsx`:** replace `onResetGame={handleDeleteGame}` with
   `onStartNewMatch={state.status !== 'setup' ? () => setCurrentScreen('new_game') : undefined}`.

5. **Change the delete confirmation in `ScoreboardScreen.tsx`** to the template literal shown above.

6. **Run everything:** `npx vitest run && npx tsc -b && echo "tsc ok"`
   Expected: `Test Files  10 passed (10)`, `Tests  70 passed (70)`, `tsc ok`.
