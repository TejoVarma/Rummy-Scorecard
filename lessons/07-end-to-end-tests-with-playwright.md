# 07 · End-to-end tests with Playwright

## The problem it solves

Unit and component tests check **single parts**: a function, one screen rendered in a fake browser (jsdom). They can all pass while the **whole app** is broken. Two screens might not hand data to each other properly, a button might be wired to the wrong action, or saving might not survive a page reload.

**End-to-end (e2e) tests** drive a **real browser** the way a person would: tap buttons, type scores, read the screen, reload the page.

## Everyday analogy: the bench test and the test drive

- Unit tests are **bench tests** of each engine part.
- E2E tests are the **test drive**: start the car, change gears, brake, park, start it again.

You need both. A part can be perfect on the bench and still fitted the wrong way round.

**What e2e here does *not* cover:** it runs the **web** version in a phone-sized Chrome window. Android-only behaviour (status bar padding, the hardware back button, the native share sheet, installing the APK) still needs a real phone. That's why the **phone checklist** stays.

## Setup

```bash
fnm exec --using=22 -- npm install -D @playwright/test@latest
fnm exec --using=22 -- npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- `devices['Pixel 7']` gives a phone-sized screen, touch input and a mobile user agent. The app is tested the way it's used.
- `webServer` **builds the real production bundle** and serves it with `vite preview`, then waits for the URL before starting the tests. We test what ships, not the dev server.
- `forbidOnly` in CI: a stray `test.only` left in by mistake would silently skip every other test, so CI rejects it.
- `retries: 1` in CI absorbs a rare slow-machine hiccup. Locally a failure is a failure.
- `trace: 'retain-on-failure'` records a step-by-step replay (screenshots, DOM, network) **only when a test fails**, so you can see exactly what went wrong.
- Each test gets a **fresh browser context** with empty `localStorage`, so tests can't leak saved games into each other.

## The tests: `e2e/game.spec.ts`

They use **user-facing locators**, finding things the way a person (or a screen reader) would:

```ts
await page.getByRole('button', { name: /start new game/i }).click();
await page.getByPlaceholder('Player name').fill(name);
await page.getByRole('button', { name: 'SUBMIT' }).click();
```

`getByRole` plus the visible name keeps working when CSS classes change, and it nudges the app towards accessible markup.

Helpers keep each test short and readable:
- `startGame(page, players, stake?)`: Home → Start New Game → add players → Done → START GAME.
- `playerCard(page, name)`: the score card that belongs to one player.
- `enterRound(page, { Ravi: 'Show', Amit: 'Drop' })`: ENTER SCORE, tap each player's button, SUBMIT.
- `totals(page)`: reads the **Total row**, the last row of the score table, as `['0', '24', '48']`.

The 8 flows covered:

| Test | What it proves |
|---|---|
| Show, Drop and M Drop add up | 0 / 24 / 48 land in the right players' totals |
| Typed hand score is capped | Typing 95 shows 80 (full count) and adds 80 |
| Needs exactly one Show | Two drops and no show gives the error message, and nothing is saved |
| Edit last round once | Drop → Full gives total 80, then EDIT SCORE is disabled |
| Deal waits for round 1 | No Deal button before round 1. After it, the modal opens and shows the ₹1000 pool, which covers the step 1.2 freeze bug |
| Survives a reload | Reload → Continue Game → open it, totals still 0 / 48 |
| Start New Match keeps the match | Settings → Start New Match opens setup, and the match is still in Continue Game, which covers the step 1.4 bug |
| Re-entry | After 3 rounds Amit is on 240 (out) and Kiran on 72. Re-Enter Amit pre-fills **73** (highest active + 1). After confirming, totals are 0 / 72 / 73 and the Re-Enter button is gone |

## Lesson inside the lesson: a test that can't fail proves nothing

The first version checked `expect(page.locator('body')).toContainText('24')`. All 7 tests passed **first time**, which is a warning sign rather than good news. The scoreboard header shows the **rules** ("Open drop 24", "Middle 48", "Full count 80"), so those checks would pass even if the scores were completely wrong.

The fix was to check the **exact Total row**:

```ts
// The last row of the score table holds each player's running total, in seat order.
async function totals(page: Page): Promise<string[]> {
  const cells = page.locator('table tbody tr').last().locator('td');
  return (await cells.allInnerTexts()).map(t => t.trim());
}

expect(await totals(page)).toEqual(['0', '24', '48']);
```

Then we **proved the test can fail** by temporarily expecting `'49'`:

```
- Expected  - 1
+ Received  + 1
-   "49",
+   "48",
  1 failed
```

and put the correct value back. This trick (break the expectation on purpose, watch it go red) is cheap, and it catches tests that pass for the wrong reason.

## A trap: two test runners and one file name

Vitest picks up **any** `*.spec.ts` by default, so it tried to run `e2e/game.spec.ts` and failed (`Test Files 1 failed`). The fix is to tell Vitest where its tests live, in `vite.config.ts`:

```ts
test: {
  include: ['src/**/*.test.{ts,tsx}'],
  ...
}
```

Now `npm test` runs Vitest on `src/`, and `npm run test:e2e` (`playwright test`) runs `e2e/`. Each tool keeps to its own folder.

`.gitignore` also gets `test-results/` and `playwright-report/`, which are Playwright's output folders.

## In CI

```yaml
- name: Install Playwright browser
  run: npx playwright install --with-deps chromium

- name: Run end-to-end tests
  run: npm run test:e2e
```

`--with-deps` also installs the Linux system libraries Chrome needs on the CI machine. The e2e step runs **before** the APK build, so a broken flow stops a broken APK being produced.

## What can go wrong (interview angle)

**"Unit vs integration vs e2e tests?"**
- **Unit:** one function, fast, many of them.
- **Integration/component:** several parts together, for example a screen with its state.
- **E2E:** the whole app in a real browser, slower, fewer of them, covering the most important user journeys.

This is the "testing pyramid": lots of unit tests at the bottom, a few e2e tests at the top.

**"Why are e2e tests flaky, and how do you avoid it?"** Usually it's timing: clicking before something appears, or fixed `sleep`s. Playwright **auto-waits**. `expect(...).toBeVisible()` and `.click()` retry until the element is ready. Use role/text locators instead of fragile CSS, isolate state per test, and keep traces for failures.

**"Your tests all passed first time. Good news?"** Not necessarily. Check that each assertion is specific enough to fail, and prove it by breaking it on purpose.

**"Why test the production build?"** The dev server behaves differently: no minification, different module loading. Users get the production bundle, so test that.

## From zero, by hand

1. `fnm exec --using=22 -- npm install -D @playwright/test@latest && fnm exec --using=22 -- npx playwright install chromium`
2. Create `playwright.config.ts` as above, and `e2e/game.spec.ts` with the helpers and 8 tests from this repo.
3. In `vite.config.ts`, add `include: ['src/**/*.test.{ts,tsx}']` under `test`. In `package.json` scripts, add `"test:e2e": "playwright test"`.
4. Run `fnm exec --using=22 -- npm run test:e2e`. Expected: `8 passed`.
5. Prove a test can fail: change `['0', '24', '48']` to `['0', '24', '49']`, run `npx playwright test -g "play a round"`, see `1 failed` with the `-"49" +"48"` diff, then change it back.
6. Run `fnm exec --using=22 -- npm test`. Expected: `Test Files  10 passed (10)`, with no `e2e/` file listed.
7. Add the two Playwright steps to `.github/workflows/build-apk.yml` after `Run Tests`.
