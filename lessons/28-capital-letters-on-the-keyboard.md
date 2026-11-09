# 28 · Capital letters on the keyboard (autocapitalize)

## The problem

When you typed a player's name, the phone keyboard started with a small letter, so "ravi" was saved instead of "Ravi". You had to press Shift every time.

## Everyday analogy

A form at a bank counter says "NAME (in capitals)" above the box. The box itself doesn't change what you can write. It just tells you how to start. `autocapitalize` is that note, written for the phone keyboard.

## What decides it

A web page can't press Shift for you. The **keyboard app** (Gboard, Samsung Keyboard) decides whether Shift starts on. It reads hints from the text box:

| Attribute value | What the keyboard does |
|---|---|
| (none) / `off` | Small letters. A plain `<input type="text">` in a WebView gets this, which caused the bug |
| `sentences` | Capital after `.` and at the start |
| `words` | Capital at the start of every word: "Ravi Kumar" |
| `characters` | ALL CAPS |

Inside a `<textarea>` the default is often `sentences`, but a text `<input>` gets no capitals. That's why this bug is easy to miss when testing on a laptop, which has no on-screen keyboard.

## The change

In React the prop is written `autoCapitalize` (camelCase). It becomes the HTML attribute `autocapitalize`.

```tsx
<input
  aria-label="New player name"
  type="text"
  autoCapitalize="words"
  ...
/>
```

Where:
- **Players screen, add** (`PlayerListScreen.tsx`): `words`
- **Players screen, rename** (`PlayerListScreen.tsx`): `words`
- **Player picker in New Game, quick add** (`SelectPlayersModal.tsx`): `words`. It also got `aria-label="New player name"`, because it had only a placeholder, which screen readers don't treat as a reliable label.
- **Game title** (`GameSetupWizard.tsx`): `sentences`. A title like "Friday night game" reads better with only the first word capitalised.

## What it does *not* do

- It does **not** change what's saved. If someone presses Shift off and types "ravi", "ravi" is saved. It's a keyboard hint, not a rule.
- A hardware or Bluetooth keyboard ignores it.
- Some third-party keyboards ignore it. Gboard and Samsung Keyboard honour it.

If names must always be capitalised, that's a separate choice: change the text on save (`name[0].toUpperCase() + …`). That rewrites what the user typed ("McDonald", "de Silva"), so the hint is the gentler fix.

## The test

`src/test/nameCapitalization.test.tsx` opens each screen and checks the attribute:

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
expect(screen.getByLabelText('New player name').getAttribute('autocapitalize')).toBe('words');
```

All 4 tests failed before the change and pass after it. A test can check that the hint is there. Whether the keyboard obeys it can only be checked on a real phone.

## What can go wrong (interview angle)

**"A user says the keyboard starts in lowercase on your form. What's going on?"** The on-screen keyboard follows hints on the input: `autocapitalize`, `inputmode`, `type`, `autocomplete`. Use `words` for names, `sentences` for free text, and `off` for emails, usernames and codes. While you're there, check `inputmode="numeric"` on number fields. This app already does that, so score fields open the number pad.

**"Why not just uppercase it in code?"** A hint keeps the user in control. Changing the text on save can corrupt names that aren't simply "first letter capital".

## From zero, by hand

1. Find every input where a person types a name: `grep -rn "<input" src/components`.
2. Add `autoCapitalize="words"` to each name input, and `autoCapitalize="sentences"` to the title.
3. Write `src/test/nameCapitalization.test.tsx` as above (render, open the form, read the attribute).
4. Run `npx vitest run src/test/nameCapitalization.test.tsx`. Expected: `4 passed`. Remove one attribute and it fails.
5. Run everything: `npx vitest run && npm run lint && npx tsc -b`. Expected: `225 passed`, clean, clean.
6. On the phone: Players → Add Player. The keyboard opens with Shift on.
