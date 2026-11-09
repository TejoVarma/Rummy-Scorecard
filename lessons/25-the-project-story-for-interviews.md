# 25 · The project story, for interviews

Use this to talk about Rummy Scoreboard Pro in an interview. Each section is a likely question with an answer you can give in your own words.

## "Tell me about a project you built."

> It's an offline Android scorecard for Indian pool rummy that my friends and I use at the table. It's React and TypeScript wrapped with Capacitor, so one web codebase ships as a native APK. The interesting parts are the game rules: drops, re-entry at the highest score plus one, dealer rotation, and splitting the prize pool when players make a deal. The engineering is about making that **trustworthy**: the rules live in pure functions and one reducer that refuses invalid moves, data is saved in two places with an ordered write queue, and there are about 200 unit tests and 15 browser tests running in CI before every signed APK is built.

## "Walk me through the architecture."

- **`domain/`**: pure functions with no React and no storage. Scoring, drop analysis, re-entry eligibility, dealer rotation, deal splits, rule validation. Easy to test with plain inputs and outputs.
- **`state/gameReducer.ts`**: every change goes through one reducer (`START_GAME`, `SUBMIT_ROUND`, `EDIT_LAST_ROUND`, `RE_ENTER_PLAYER`, `ACCEPT_DEAL`…). It validates with the domain rules and **returns the old state unchanged** if a rule is broken.
- **`storage/`**: `localStorage` is the fast synchronous copy. Every write is mirrored to Capacitor Preferences (Android storage) through a **promise queue**, so writes land in order. On startup, missing data is restored from the Android copy before the first render.
- **`services/`**: share (render the scoreboard to PNG, write it to the cache folder, open the Android share sheet) and text-to-speech.
- **`components/`**: screens. They show friendly messages using the **same** rule functions the reducer enforces, so the UI and the logic can't disagree.

## "What was the hardest bug?"

Pick one and tell it as **symptom → cause → fix → proof**:

1. **The app froze when you opened Deal before round 1.**
   - Cause: `latestScores ?? {}` created a new object every render, which invalidated a `useMemo`, which re-ran an effect that set state, and so on in a loop.
   - Fix: a shared constant empty object.
   - Proof: a test that **hung** before the fix and passes after.
2. **The winner banner congratulated a player who was already out.**
   - Cause: knocked-out players are stored as `{ type: 'out', points: 0 }` placeholders, and the code treated `points === 0` as a win.
   - Fix: check `type === 'show'`, the real fact, not a number that happens to match.
3. **A crash loop with no escape.**
   - Cause: the crash screen's Reset cleared `rummy_active_game`, but the app saves to `rummy_active_game_v1`, so a bad saved game crashed every launch.
   - Fix: one function owns the key names, keeps a backup copy, and clears both stores.
4. **The odd rupee went to the wrong player** in the drop split.
   - Cause: three "equal" fractions like 0.67 were stored slightly differently in floating point, so the tie-break never ran.
   - Fix: compare with a tolerance. Found by testing with awkward numbers, not round ones.

## "How do you make sure money calculations are right?"

- The drop split is a **waterfall**: stakes back first, then each drop is worth one stake (shared pro rata if the money runs short), then the rest is split equally.
- I turned the verbal rule into a **table of worked examples** with the person who plays it, then made that table the test suite.
- Rounding uses the **largest-remainder method**, so payouts are whole rupees that always sum to the exact pool, with an explicit tie-break.
- Tested with ugly inputs (₹350 stakes, uneven pools), which found the floating-point tie bug.

## "How do you handle data safety on mobile?"

- **Two stores:** fast WebView storage, plus Android Preferences, which survives the WebView being cleared.
- **An ordered write queue**, so a delete can't be overtaken by an earlier save.
- **Restore before the first render.** If the Android copy can't be read, it's never overwritten that session.
- **Failures are visible.** A save that fails shows a banner, restore asks first and merges instead of replacing, and unreadable data is kept, not deleted.

## "Tell me about a security issue you handled."

> The release signing key and its passwords were committed to a public repo. Deleting them doesn't help, because they're in history and in every clone. So I **rotated** the key: made a new one, stored it outside the repo, gave CI the key as base64 plus the passwords as GitHub Secrets, decoded it into a temp folder at build time, and made the job fail clearly if a secret is missing. Users had to reinstall once, because Android only accepts updates signed with the same key.

## "How do you test?"

- **Unit tests** (Vitest) for the domain and reducer, with real games built by the reducer itself.
- **Component tests** (React Testing Library in jsdom) that find elements by role and name, the way a user or screen reader does.
- **Browser tests** (Playwright, Pixel 7 viewport, against the production build) for the main flows: scoring, edit, re-entry, deal, share image, backup round trip, announce.
- **An accessibility audit** (axe-core) on every main screen.
- **Each test proven able to fail:** run it against the old code, or break the expectation on purpose. One "passed first time" e2e test turned out to be checking text that was always on screen.

## "Tell me about a time you got feedback you disagreed with, or got wrong."

> I applied accessibility guidelines across the app: bigger buttons, darker colours. Each change was correct on paper, but the owner said it looked bulkier and duller, and he was right. "Out" wrapped onto a second line and SUBMIT fell off-screen. Instead of arguing, I built a side-by-side screenshot page of the old and new versions with a keep-or-revert choice for each visible change, applied exactly what he chose, and showed the result before committing. The invisible improvements (screen-reader names, dialogs, focus) stayed. The lesson: visible changes need the owner's eyes; guidelines inform the decision but don't make it.

## "Why these technology choices?"

| Choice | Why |
|---|---|
| React + TypeScript + Capacitor | One web codebase, a native APK, and access to the share sheet, files and the voice engine |
| Capacitor 8 (skipping 7) | Play's target SDK rules, and the text-to-speech plugin only exists for 6 and 8 |
| Reducer plus pure domain functions | Rules in one place, easy to test, and the UI can't bypass them |
| localStorage + Preferences | Synchronous reads for the UI, with a durable copy Android keeps |
| APK, not the Play Store | A small friend group; Play needs a fee, an AAB, a store listing and a closed test, plus care with ₹-stake wording under the gambling policy |
| Vitest + Playwright + axe in CI | Rules, screens and real-browser flows are all checked before every APK |

## Numbers to remember

- About **200 unit and component tests** and **15 browser tests**, all in CI.
- **Target SDK 36**, Capacitor 8, Node 22, Java 21.
- The scoreboard component went from **657 to 338 lines**. Dead-code removal deleted **285** lines.
- **25 lessons** documenting each step.
