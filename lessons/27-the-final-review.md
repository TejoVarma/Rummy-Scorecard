# 27 · The final review: five reviewers, one app

## What happened

At the end, five specialist reviewers each read the **whole app** (not just the latest change): code quality, TypeScript, React, security and silent failures. They were told the visual look was the owner's decision, so any visual concern went into a separate "for the owner" list instead of being "fixed".

**Headline results:**
- **No critical or high issues** from any reviewer.
- **Security:** "safe to publish and distribute". No secret is exposed now, the Android manifest declares no permissions of its own, and backup import is validated.
- **Money maths fuzzed:** two reviewers independently ran **500,000 random deals** (2–8 players, odd stakes, re-entries, random drops). Every payout was a non-negative whole rupee, every split added up exactly to the pool, and nobody in a drop split got less than their stake.
- **Scores:** code review 8/10, approve.

The medium and low findings were fixed in three commits, each test-first.

## Batch 1: data safety

| Finding | Fix |
|---|---|
| Restoring a backup that was **further along on the match currently open** got silently undone: after the reload, the on-screen copy (fewer rounds) saved over it | `restoreBackup` also updates the open match when the backup copy is further along |
| Merge ties (same number of rounds) always kept the phone's copy | `isFurtherAlong()`: more rounds wins; on a tie, a deal-settled copy wins, then the more recently changed one |
| The same player listed twice in a backup was added twice | Each id is added to the known set as it's accepted |
| A save counted as "saved" if only Android's copy took it, but the app reads the WebView copy, so the next launch showed old data and then overwrote the newer Android copy | A save only counts when **localStorage** took it. If Android's copy falls behind, an amber note says "the phone's backup copy isn't up to date" |
| The "export a backup" advice in the save-failure banner exported the **old** data, not the rounds just entered | `exportAllData(onScreen)` puts the match on screen into the backup |
| The crash reset removed the match even when it couldn't keep the promised copy | Keep the copy first, remove from the list only if that worked, and say so if it didn't |
| Saved-game validation was shallow (a damaged backup could pass, then crash a screen) | Moved to `domain/validation.ts` and checks deal shape, re-entry counts, unique seats, whole-number dealer index, stake type, and every round score's type and points. Old saves (rounds without the newer re-entry list) still pass |
| Unreadable saved matches disappeared from Continue Game without a word | `countUnreadableSavedGames()`, shown on Continue Game: "1 saved match couldn't be read and isn't listed. A copy is kept on the phone." |
| A purge of old sample players re-saved a filtered list, dropping unreadable entries for good | Only the sample players are removed. Everything else is kept as stored |
| Startup restore read four keys one after another (up to 16 s if Android hung) | `Promise.all`: up to 4 s in total. Timeout timers are now cleared |

Moving validation into `domain/` also fixed a **layering** problem: the reducer (pure game logic) had been importing from the storage module, which pulled a Capacitor plugin into game logic. Now storage depends on the domain, never the other way round.

## Batch 2: behaviour

| Finding | Fix |
|---|---|
| Pressing **Back while a share was being prepared** sent you Home | The dialog's close handler returned `false`, which the back-button manager reads as "not handled", so Back fell through. It now returns nothing, so Back is swallowed while sharing |
| With a round row selected, Back cleared the row **before** closing an open dialog on top | The round-details handler now sits below dialogs (`SCREEN + 5` instead of `NESTED_MODAL`) |
| Tapping **Dark** while already in dark mode switched to light (both buttons toggled) | `setColorMode('dark')` / `setColorMode('light')` |
| The prize-pool formula was written in **four places** | One `totalPool(state)` (and `countReEntries`) in `domain/rules.ts`, used by the scoreboard, deal screen, shared text and deal check |
| Accepting a deal didn't check it first, so a refusal would just close the dialog | `validateDeal` runs first, and a problem is explained |
| An empty share image or a missing clipboard failed silently | Both now throw, and the existing "couldn't share" message appears |

**A test lesson from this batch.** The first "Back while sharing" test **passed before the fix**, because in the test nothing else was listening for Back. Adding a "go home" listener behind the dialog (as the real app has) made it fail for the right reason. A test has to recreate the conditions where the bug happens.

## Batch 3: invisible accessibility and housekeeping

- **Player picker:** a `dialog` of `checkbox`es (`aria-checked`) that toggle with Space or Enter.
- **Round rows** can be opened from a keyboard (`tabIndex`, Enter/Space).
- **Choice buttons** (pool presets, stake presets, deal modes, theme and mode) report `aria-pressed`.
- **Score entry** returns focus to the opener on close, and announces errors (`role="alert"`).
- **Section headings** that aren't connected to a field are `<span>`, not orphan `<label>`s.
- **CI:** every action is **pinned to a commit SHA**. A tag like `v4` can be moved by whoever controls the action, and this job holds the signing key. Plus `concurrency`, so a newer push cancels an older build. `package.json` carries the real app version (1.8.0).

Results: **221/221** unit tests, **15/15** browser tests, lint and types clean.

## Owner's decisions on the visual notes

Tejo chose two of the visual notes to change:
- **The "Options" / "More options" icons were removed.** They did nothing, and a control that does nothing confuses everyone, screen-reader users most.
- **The scoreboard follows the theme.** The info banner (rules, stake, pool) was a fixed blue gradient. It now uses the theme's `--color-primary`, shaded darker to the right with a translucent gradient layered on top:
  ```tsx
  const THEMED_BANNER = {
    backgroundColor: 'var(--color-primary)',
    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06), rgba(0,0,0,0.28))',
  };
  ```
  Layering a translucent gradient over a plain colour works on every Android WebView, unlike newer CSS such as `color-mix()`. The "Congrats" bar uses `bg-[var(--color-primary)]` too.
- **The banner's highlighted numbers follow the theme too.** The pool amount, the re-entry extra and the round count were three unrelated colours (green, amber, yellow), and the green looked wrong on the red Crimson banner. Each theme now has an `accent`: a light tint of its own colour (pale sky `#e0f2fe`, mint `#d1fae5`, violet `#ede9fe`, rose `#ffe4e6`). It's set as `--color-accent` and used for all three numbers. Tints were chosen **by measuring contrast** against each banner, about 3:1 on all of them, the guideline for large bold text. The deeper tints measured under 3:1. Checked with screenshots of all 4 themes × dark and light.
- **The score cells stay blue and green on purpose.** Their colours **mean** something (normal round vs all-drop round), and the Emerald theme would otherwise make normal rounds green too.

The other notes stay as they are, by choice.

## Left for the owner (visual), not changed

- The compact top-bar icons and the small Deal pill are smaller than the 44 px touch guideline (a deliberate choice).
- Some small or low-contrast text: the red "(re entry)", the grey "Score" label, 10–11 px badges.
- The "Options" and "More options" icons on the player screens do nothing yet.
- The New Game stake defaults to ₹100 (a no-money group must clear it).
- The scoreboard's blue gradient doesn't follow the selected theme.
- On a narrow phone with many players, the "X eliminated!" banner name can be cut short.

## What can go wrong (interview angle)

**"How do you run a final review?"** Give reviewers the whole codebase and clear boundaries (here, "the look is the owner's decision"). Verify every finding against the code, fix with tests, and **write down** what you deliberately didn't change and why.

**"How do you test money code?"** Example tables for the agreed rules, plus **property-based fuzzing**: thousands of random inputs checking invariants (the sum equals the pool, whole rupees, no one below their stake).

**"Why pin GitHub Actions to a SHA?"** A tag can be moved to malicious code. A SHA can't change. It matters most in jobs that hold secrets.

**"A save worked in one store but not the other. Is it saved?"** It's saved only if the store the app **reads from** took it. Otherwise the app shows stale data and may write it back over the good copy.

## From zero, by hand

1. Run the five reviewers on the whole repo, telling them to put visual concerns in a separate list.
2. For each finding: read the code, confirm, write a failing test (check that it fails for the right reason), fix, run everything.
3. Group fixes into themed commits (data safety, behaviour, polish).
4. Resolve action SHAs with `git ls-remote https://github.com/actions/checkout "refs/tags/v4^{}"`, and pin with `uses: actions/checkout@<sha> # v4`.
5. Run `npx vitest run && npm run lint && npx tsc -b && npm run build && npm run test:e2e`. Expected: `221 passed`, clean, clean, built, `15 passed`.
