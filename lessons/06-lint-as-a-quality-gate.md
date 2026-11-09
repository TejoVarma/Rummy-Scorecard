# 06 · Lint as a quality gate (ESLint, typed errors, CI hygiene)

## The problem it solves

- **Tests** check that the code *does the right thing* when it runs.
- **Types** (`tsc`) check that values *have the right shape*.
- Some bugs pass both. The classic React example is calling a hook **after an early `return`**. It compiles and works today, then crashes later with *"Rendered more hooks than during the previous render"*.

**Lint** reads the code **without running it** and flags risky patterns like that one.

## Everyday analogy: three checks in a restaurant kitchen

- **Types**: the delivery checker making sure **the right ingredients** arrived (a string where a string belongs).
- **Lint**: the **kitchen inspector** walking around *before* cooking. A knife on the edge of the counter, raw chicken next to the salad. Nothing has gone wrong yet, but this is how things go wrong.
- **Tests**: the **taste test** of the finished dish.

You want all three. This is **defence in depth**.

## What we added

### `eslint.config.js` (ESLint's "flat config" format)

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'android', 'node_modules', 'scripts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  }
);
```

- `ignores` skips build output and generated files. `android/` contains a copy of the built web app, which we never want to lint.
- `js.configs.recommended` holds ESLint's core rules, for example "variable assigned but never used".
- `tseslint.configs.recommended` holds TypeScript-aware rules, for example **no `any`**.
- `react-hooks/rules-of-hooks` (**error**): hooks must be called in the same order on every render, so never after an early return, inside an `if`, or inside a loop.
- `react-hooks/exhaustive-deps` (**warning**): every value an effect or memo uses should be in its dependency list. This is the family of bugs behind the step 1.2 render loop.

`package.json` gets `"lint": "eslint ."`.

## What the first run found (27 errors), and how we fixed them properly

The rule is: **fix the code, don't switch off the rule.**

### 1. A real hooks bug: `ReEntryModal`

```tsx
}) => {
  if (!reEnteringPlayerId) return null;   // early return...
  // ...
  const [scoreInput, setScoreInput] = useState(...);   // ...then a hook: breaks rules-of-hooks
```

It was safe *today* only because `App` never rendered the modal without a player. The clean fix is to make that guarantee **part of the type**, so the compiler enforces it instead of a runtime check:

```tsx
reEnteringPlayerId: PlayerId;        // was: PlayerId | null
```

The early return was deleted. `App` already renders the modal inside `{reEntryTargetPlayerId && (...)}`, so TypeScript knows the value isn't null there.

We also added `key={reEntryTargetPlayerId}` in `App`. A **key** tells React "this is a different item". If the target player changes, React throws away the old modal and its typed-in score, and starts fresh.

### 2. `any` → `unknown`, then narrow

`any` switches off type checking for that value. `unknown` means "could be anything, **so prove what it is before you use it**". In `isValidGameState`:

```ts
const candidate = obj as Record<string, unknown>;        // was Record<string, any>
if (!isPlainObject(candidate.rules)) return false;       // narrows rules to an object
const players = candidate.players;
if (!isPlainObject(players)) return false;
for (const [id, player] of Object.entries(players)) {
  if (!isPlainObject(player) || player.id !== id || typeof player.name !== 'string') return false;
}
```

`isPlainObject` is a **type guard**. Its return type `value is Record<string, unknown>` tells TypeScript that after it returns `true`, the value is an object. That's why `player.id` compiles without `any`. The function accepts and rejects exactly what it did before, and now the compiler checks it too.

The roster filter in `importAllData` uses the same idea:

```ts
(p: unknown): p is SavedRosterPlayer =>
  isPlainObject(p) && typeof p.id === 'string' && typeof p.name === 'string'
```

### 3. `catch (err: any)` → `catch (err)` plus a small helper

`src/services/share.ts`:

```ts
// The browser share sheet rejects with an AbortError when the user just closes it.
export function isShareCancelled(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError';
}
```

It matches the old `err?.name !== 'AbortError'` check exactly, but safely. `'name' in err` proves the property exists before we read it. Two components used the same check, so one helper replaces three copies. The image-share feature will add more to this file later.

For an error message: `err instanceof Error ? err.message : 'Failed to parse backup file'`.

### 4. Small ones

- `catch (e) { ... }` where `e` is never used becomes `catch { ... }`.
- `let status: DropStatus = 'safe';` followed by an `if/else` that **always** reassigns it: the first `'safe'` was never read. We now declare `let status: DropStatus;` and TypeScript checks that every branch assigns it.
- In tests, `{} as any` becomes `{}`, which already fits the type. For the "legacy round with a missing field" test we used `Partial<RoundRecord>` and `delete`, instead of casting to `any`.

Result: `npm run lint` is clean, `tsc` is clean, and 70/70 tests pass.

**A note on reading tool output.** The first run's ReEntryModal error was the 27th line, and `| tail -40` cut it off, so it looked as though the rule had missed it. Before deciding a tool is broken, run it on the single file (`npx eslint src/components/input/ReEntryModal.tsx`). It was there.

## CI hygiene

`.github/workflows/build-apk.yml`:

```yaml
permissions:
  contents: read
```

Every workflow gets a `GITHUB_TOKEN`. By default it can write to the repo. This job only needs to *read* the code, so we give it the least power that works (the **principle of least privilege**). If a step or a third-party action were ever compromised, it couldn't push code.

```yaml
- name: Lint
  run: npm run lint

- name: Run Tests
  run: npm test
```

Lint runs before the tests and fails the build on any error. It's a **gate**: nothing ships unless it passes.

## Honest coverage

`vite.config.ts`:

```ts
test: {
  coverage: {
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
  },
},
```

Before this, the coverage report also counted `android/` build output and `scripts/`, which hid the real numbers. Now it shows: **52% overall**. The rules logic (`src/domain`) is at about 93%, and most screens have no tests yet. That's planned for Phase 5. An honest low number is more useful than a misleading one.

## Dependency audit

- `npm audit --omit=dev` (what ships in the app): **0 vulnerabilities**.
- We upgraded the test runner, **vitest 2 → 5**, which cleared the old esbuild and vitest advisories.
- 10 "moderate" findings remain. They're all one old `minimatch` bundled **inside ESLint's latest release**. It's a dev-only tool that only ever reads our own files. `npm audit fix --force` would *downgrade* ESLint, which is worse. Accepted and noted, until ESLint updates it.

## What can go wrong (interview angle)

**"Lint vs types vs tests: what does each catch?"** Types catch shape errors. Lint catches risky patterns without running anything. Tests catch wrong behaviour. Run all three in CI.

**"`any` vs `unknown`?"** `any` turns the type checker off. `unknown` forces you to prove the type, using `typeof`, `instanceof`, `in`, or a type guard, before you use the value. Use `unknown` for anything from outside your code: JSON, storage, caught errors, API responses.

**"A lint rule is noisy. Do you disable it?"** Fix the code first. Disable a rule only when it's wrong for the codebase, and record why. Never disable a rule just to make the build green.

**"Why `permissions: contents: read`?"** Least privilege. A compromised dependency or action in CI can't push code or tamper with releases.

**"Should you run `npm audit fix --force`?"** Not blindly. It may make breaking changes or downgrades. Check what's vulnerable, whether it ships to users, and whether the risk actually applies.

## From zero, by hand

1. Install:
   ```bash
   fnm exec --using=22 -- npm install -D eslint@10 @eslint/js@10 typescript-eslint@8 eslint-plugin-react-hooks@7 globals@17
   ```
2. Create `eslint.config.js` with the contents above, and add `"lint": "eslint ."` to `package.json` scripts.
3. Run `fnm exec --using=22 -- npx eslint .`. Expected: `✖ 27 problems (27 errors, 0 warnings)`.
4. Fix each one as described in sections 1 to 4: `ReEntryModal` prop and `key`; `unknown` plus `isPlainObject` in `localStorageAdapter.ts`; create `src/services/share.ts` and use `isShareCancelled` in `PoolShareModal.tsx` and `ScoreboardScreen.tsx`; `catch {}`; `let status: DropStatus;`; remove the `as any` casts in the tests.
5. Run `fnm exec --using=22 -- npm run lint && npx tsc -b && npx vitest run`. Expected: no lint output, no tsc output, `Tests  70 passed (70)`.
6. Add the `permissions:` block and the `Lint` step to the workflow, and the `test.coverage` block to `vite.config.ts`.
7. Run `fnm exec --using=22 -- npm install -D vitest@5 @vitest/coverage-v8@5`, then `npx vitest run --coverage`. Expected: `All files` is about 52%, and there are no `android` or `scripts` rows.
