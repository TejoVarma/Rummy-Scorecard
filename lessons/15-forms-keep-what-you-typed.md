# 15 · Forms keep exactly what you typed (the New Game screen)

## The problem it solves

Four small but real bugs on the New Game screen:

1. **Every game was titled "Nov …".** The default title was built as `'Nov ' + day + ', ' + year`. The month was typed in by hand, so a game on 3 December was titled "Nov 03, 2026".
2. **The pool box couldn't be cleared.** It showed `customPool !== '' ? customPool : String(poolLimit)`. Delete the last digit, `customPool` becomes `''`, and the **old number snaps back**. You couldn't clear it and retype.
3. **Typing 0, or leaving a box empty, silently became the default.** `parseInt(openDrop, 10) || 24`: both `parseInt('0')` (= 0) and `parseInt('')` (= NaN) are "falsy", so `|| 24` replaced them. You set one thing and the game used another, without a word.
4. **The saved player list was re-read from storage on every keystroke**, because `loadPlayerRoster()` ran on each render.

## Everyday analogy: a form that rewrites itself

Imagine a paper form where a box **refills itself** while you're writing in it, and a "0" you wrote gets quietly rubbed out and replaced. A good form keeps **exactly what you wrote**, and the clerk only checks it **when you hand it in**, telling you clearly what's wrong.

## The fixes

`src/components/setup/GameSetupWizard.tsx`:

### 1. Let the phone format the date

```ts
/** "03 Dec 2026 - 21:05" */
export function defaultGameTitle(now: Date): string {
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} - ${time}`;
}
```

- `toLocaleDateString` with `month: 'short'` gives the **real** month name: "Dec", "Jan" and so on.
- `'en-GB'` fixes the order (day, month, year) and the 24-hour time, so the title looks the same on every phone.
- It takes `now` as a **parameter** instead of calling `new Date()` inside. Tests can pass any date (3 Dec, 15 Jan) without faking the clock. This is a small form of **dependency injection**.
- `useState(() => defaultGameTitle(new Date()))` uses a **lazy initialiser**, so it runs once rather than on every render.

### 2. One string per box, kept exactly as typed

```ts
const digitsOnly = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

const [pool, setPool] = useState<string>(String(DEFAULT_RULES.poolLimit));
// ...
<input value={pool} onChange={e => setPool(digitsOnly(e.target.value))} />
```

- The old design had **two** pieces of state for one box (`poolLimit` and `customPool`) and a rule to choose between them. That's where the snap-back came from. Now there's one string, and the box shows exactly that string, including `''`.
- `digitsOnly` removes anything that isn't a digit (`\D`) and leading zeros before another digit (`007` becomes `7`, while a single `0` stays).
- The pool presets (201, 200, 101, 100) simply do `setPool(String(preset))`. A preset is highlighted when the box's text equals it.

### 3. Judge the values only on Start, and say what's wrong

```ts
// Boxes hold exactly what was typed; an empty required box is pointed out, not replaced.
const required: Array<[string, string]> = [
  ['Game total score', pool],
  ['Open drop', openDrop],
  ['Middle Drop', middleDrop],
  ['Full count', fullCount],
];
const missing = required.find(([, value]) => value === '');
if (missing) {
  alert(`Please fill in ${missing[0]}.`);
  return;
}
const finalPool = Number(pool);
// ...
const finalEntryAmount = entryAmount === '' ? 0 : Number(entryAmount);
```

- An empty box gives *"Please fill in Open drop."*, using the same words as the label on screen.
- `Number('0')` is `0` and passes through **unchanged**. Then `validateRules` (from lesson 12, shared with the reducer) says *"Open Drop must be greater than 0."* instead of quietly using 24.
- The **stake** is the one optional box. Empty means no stake, which is what its "0" placeholder suggests.

### 4. Read the player list once, refresh after the picker

```ts
const [roster, setRoster] = useState(loadPlayerRoster);
// ...
onConfirmSelection={newSelection => {
  setRoster(loadPlayerRoster());
  setSelectedIds(newSelection);
}}
```

`useState(loadPlayerRoster)` passes the **function** (no brackets), so React calls it once. The picker can add new players to storage, so the list is reloaded when you press Done. Otherwise a newly added "Kiran" would show as "Player".

## The tests (`src/test/gameSetup.test.tsx`, 7 tests)

| Test | Before the fix |
|---|---|
| `defaultGameTitle(3 Dec 2026, 21:05)` → `03 Dec 2026 - 21:05`; 15 Jan → `15 Jan 2027 - 08:30` | ❌ didn't exist (always "Nov") |
| Clear the pool box → it stays empty → type 101 → the game uses 101 | ❌ snapped back |
| The 101 preset fills the box and is used | ✅ |
| Empty Open drop → *"Please fill in Open drop."*, game not started | ❌ silently 24 |
| Open drop 0 → *"Open Drop must be greater than 0."*, not started | ❌ silently 24 |
| Empty stake → stake 0 | ✅ |
| A player added in the picker shows by name in the seating list | ✅ (kept working after reading the list only once) |

The helper `field('Open drop')` finds the box by its **visible label**: the label's container, then the textbox inside it. That's how a user finds it too.

Totals: **155/155** unit tests and **14/14** browser tests.

## What can go wrong (interview angle)

**"What's wrong with `parseInt(x) || default`?"** `||` treats every falsy value the same, and `0` is falsy, so a real 0 becomes the default. Use `??` (only `null`/`undefined`), or better, validate explicitly and tell the user.

**"Controlled inputs and numbers: store a number or a string?"** Store the **string** the user typed. A number can't represent "empty" or a half-typed value. Convert and validate on submit.

**"Two pieces of state for one value?"** That's a smell. Duplicated state drifts and needs rules to reconcile it (here, the snap-back). Keep a single source of truth and derive the rest.

**"How do you test code that uses the current date?"** Pass the date in as a parameter (as here), or fake the clock (`vi.useFakeTimers()` / `vi.setSystemTime()`).

## From zero, by hand

1. Write `src/test/gameSetup.test.tsx` as in this repo. Run it. Expected: `4 failed | 3 passed (7)`.
2. In `GameSetupWizard.tsx`:
   - add `defaultGameTitle` and `digitsOnly`
   - replace the title initialiser with `useState(() => defaultGameTitle(new Date()))`
   - replace `poolLimit` + `customPool` with a single `pool` string
   - make the presets call `setPool(String(preset))` and the pool box use `value={pool}`
   - make the drop, full-count and stake boxes use `digitsOnly`
   - replace the `parseInt(...) || default` block with the required-box check and `Number(...)`
   - turn `roster` into state and reload it in `onConfirmSelection`
3. Run `npx vitest run && npx tsc -b && npm run lint && npm run test:e2e`. Expected: `155 passed`, clean, clean, `14 passed`.
