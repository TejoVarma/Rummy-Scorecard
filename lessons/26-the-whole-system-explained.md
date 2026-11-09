# 26 · The whole system, explained

This lesson explains Rummy Scoreboard Pro end to end: **what** we used, **how** the parts fit together, and **why** each choice was made over the alternatives. It's self-contained: you don't need any other lesson to follow it.

---

## 1. What the product is

An Android app for scoring **Indian pool rummy** at a real table. Players are knocked out when their total reaches the pool limit (201 or 101). Along the way the app must handle:
- **Drops:** giving up a hand early costs 24 (open drop) or 48 (middle drop). A full hand caps at 80.
- **Re-entry:** a knocked-out player may buy back in at the highest remaining score + 1.
- **Dealer rotation:** the deal moves round the table, skipping players who are out.
- **Deals:** players can agree to stop and split the prize pool.
- **Sharing and announcing** the totals.

Constraints that shaped every decision:
- **Offline.** It's used around a table, often with bad signal. No server, no account.
- **Trustworthy.** Money is involved (stakes and payouts), so scores must never be silently wrong or lost.
- **Small audience.** A group of friends, distributed as an **APK file** rather than through the Play Store.
- **One developer**, who needs to understand and explain every part.

---

## 2. The big picture

```
 ┌──────────────────────────── Android phone ────────────────────────────┐
 │  APK (signed)                                                          │
 │  ┌────────────────────────── Capacitor shell ───────────────────────┐  │
 │  │  WebView running our React app (HTML + JS + CSS from Vite)       │  │
 │  │                                                                  │  │
 │  │   Screens (components/) ──dispatch──▶ Reducer (state/)            │  │
 │  │        ▲                                │  uses                   │  │
 │  │        │ new state                      ▼                         │  │
 │  │        └──────────────────────── Game rules (domain/)             │  │
 │  │                                                                  │  │
 │  │   Save effect ──▶ storage/ ──▶ localStorage (WebView)             │  │
 │  │                         └──queue──▶ Preferences ───────────────┐  │  │
 │  │   services/share ──▶ Filesystem (cache) ──▶ Share sheet ──┐    │  │  │
 │  │   services/speech ──▶ Text-to-speech plugin ─────────┐    │    │  │  │
 │  └──────────────────────────────────────────────────────┼────┼────┼──┘  │
 │      Android TTS engine ◀────────────────────────────────┘    │    │     │
 │      WhatsApp / Drive via FileProvider ◀───────────────────────┘    │     │
 │      SharedPreferences (survives WebView clears) ◀───────────────────┘     │
 └────────────────────────────────────────────────────────────────────────┘
```

**Everyday analogy: a restaurant.**
- The **screens** are the waiters taking orders.
- The **reducer** is the head chef. Every order passes through them, and they refuse anything not on the menu.
- The **domain rules** are the recipe book the chef follows.
- **Storage** is the order ledger plus its carbon copy in the safe.
- **Capacitor** is the building, connecting the kitchen to the outside world: the phone's share sheet, files and voice.

---

## 3. The technology, and why each one

### React 18 + TypeScript: the app itself

- **React** builds the screens out of components and re-draws them when state changes.
- **TypeScript** adds types, so mistakes like passing a score where a player id belongs are caught before the app runs.
- **Why:** it's the most widely used way to build interactive UIs, with a huge ecosystem, and it's what Tejo knows best. TypeScript matters more than usual here because the data is rule-heavy (round records, deal splits, saved games).
- **Alternatives:**
  - **Kotlin native Android** would be the most "native", but it's a second language and doesn't reuse web skills.
  - **Flutter** means learning Dart.
  - **React Native** gives native UI widgets but a different build and testing setup.

  For a scorecard (forms, tables, buttons), a web UI is more than fast enough.

### Vite: the build tool

- Turns our TypeScript and JSX into plain JavaScript and CSS bundles, and serves the app during development with instant reloads.
- **Why:** it's fast, simple, and the standard for new React projects (Create React App is retired).
- Output: the `dist/` folder, a static website.

### Tailwind CSS: styling

- Small utility classes (`px-3 py-1.5 rounded-full`) written straight in the components.
- **Why:** no separate stylesheets to keep in sync, consistent spacing and colours, and only the classes actually used end up in the bundle.
- **Themes:** colours are **CSS variables** (`--color-bg`, `--color-primary`…), set by a `ThemeProvider` before the first paint, so dark/light and the four table themes switch without re-rendering every component.

### Capacitor 8: turning the website into an Android app

- Capacitor wraps `dist/` in a native Android project. The app runs in a **WebView** (Chrome's engine embedded in the app), and **plugins** call native features from JavaScript.
- **Plugins used:**

| Plugin | What for |
|---|---|
| `@capacitor/app` | The Android back button and gestures |
| `@capacitor/preferences` | Durable key-value storage in Android's SharedPreferences |
| `@capacitor/filesystem` | Writing the scorecard PNG and backup JSON into the app's cache folder |
| `@capacitor/share` | Opening Android's share sheet (WhatsApp, Drive…) |
| `@capacitor-community/text-to-speech` | Reading totals aloud using the phone's voice engine |

- **Why Capacitor over Cordova:** Capacitor is its modern successor, with real native projects you can open in Android Studio and maintained plugins.
- **Why version 8:**
  - Google Play requires apps to **target a recent Android SDK** (we target **36**, Android 16).
  - The text-to-speech plugin only exists for Capacitor 6 and 8, so we jumped straight from 6 to 8.
  - Capacitor 8 needs **Node 22**, **Java 21**, Android Gradle Plugin **8.13** and Gradle **8.14.3**, and sets the minimum to Android 7 (**minSdk 24**).

### Supporting libraries

| Library | Why |
|---|---|
| `html-to-image` | Draws an HTML element to a PNG for "Share as Image". Loaded only when needed (`await import(...)`), so start-up stays light |
| `lucide-react` | A consistent icon set (crown, share, speaker…) as React components |

---

## 4. How a tap becomes a saved score (the data flow)

Follow one round, from tap to storage:

```
1. Tap "Drop" for Amit  ──▶ RoundInputModal keeps the choice in local state
2. Tap SUBMIT           ──▶ validateRoundScores(scores, playersStillIn, rules)  (friendly message if wrong)
3. dispatch(SUBMIT_ROUND) ─▶ gameReducer
4. Reducer              ──▶ scoreRound(): validate again, add points, find who went out,
                            decide winner, move the dealer  ──▶ returns NEW state (or the old one if invalid)
5. React re-renders     ──▶ scoreboard shows new totals, warnings, crown
6. Save effect          ──▶ saveActiveGame(state):
                              localStorage (instant) + Preferences (through the ordered queue)
                            ──▶ banner if both failed
7. Announce effect      ──▶ if the setting is on and this is a new/edited round: speak the totals
```

### Why a reducer?

A **reducer** is a function `(state, action) → newState`. Every change to a game is an **action** (`START_GAME`, `SUBMIT_ROUND`, `EDIT_LAST_ROUND`, `RE_ENTER_PLAYER`, `ACCEPT_DEAL`, `LOAD_GAME`, `RESET_GAME`).
- **One door for every change.** The rules are enforced in one place, so no screen can bypass them.
- **Predictable.** The same state plus the same action always gives the same result, which makes it easy to test.
- **Immutable updates.** It returns new objects instead of editing old ones, so React can tell what changed, and old states (round snapshots) stay intact.

It's built with React's own `useReducer`, with no Redux. One game state doesn't need a global store library.

### Why separate `domain/` (pure functions)?

`domain/` holds the **rules** with no React and no storage: scoring, drop analysis, re-entry eligibility, dealer rotation, deal splits and validation.
- They're **pure functions**: input in, output out, nothing else touched. So they're trivial to test (`analyzePlayerDrops(161, 201, 20).status === 'one_drop'`).
- They're **shared** by the screens (to show friendly messages) and the reducer (to enforce). The UI and the logic can't disagree, because they run the same code.

### Defence in depth for rules

| Layer | Example |
|---|---|
| Input | Typed scores can't exceed full count (95 → 80) |
| Screen | "One player must be marked with Show" before submit |
| Reducer | Refuses two Shows, points that don't match the button, re-entry for the wrong player, editing after a deal |
| Storage | Loaded and imported games are checked with `isValidGameState` (in `domain/validation.ts`) before use |

---

## 5. The data model

```ts
GameState {
  gameId, title, createdAt, status: 'setup' | 'playing' | 'completed',
  rules: { poolLimit, openDrop, middleDrop, fullCount, allowReEntry, entryAmount },
  players: { [id]: { id, name, avatarColor, reEntryCount, reEntryScore? } },
  seats: [ids in seating order], currentDealerIndex,
  rounds: [RoundRecord], winnerPlayerId?, dealSplit?
}

RoundRecord {
  roundNumber, dealerPlayerId,
  scores: { [id]: { type: 'show'|'open_drop'|'middle_drop'|'full_count'|'custom'|'out', points } },
  cumulativeScores: { [id]: total after this round },
  seatsSnapshot, playersSnapshot,        // the table as it was when the round started
  eliminatedInRound, reEnteredInRound, timestamp, isEdited?
}
```

Design decisions:
- **Store the meaning, not just the number.** A score has a `type` (show, drop…) as well as `points`, so "who won" is a fact (`type === 'show'`), not a guess from `points === 0`.
- **Running totals are stored per round** (`cumulativeScores`), so the scoreboard never has to recompute history, and editing the last round only touches the last record.
- **Snapshots per round** (`seatsSnapshot`, `playersSnapshot`) let "edit last round" restore the table exactly as it was, including undoing a re-entry made after it.
- **The whole game is one JSON document.** There are no relations to keep in sync, it's easy to save and back up, and a game stays small (a few KB).

---

## 6. Storage design: why two stores and a queue

| Store | Speed | Survives | Role |
|---|---|---|---|
| `localStorage` (inside the WebView) | Instant and **synchronous** | Usually, but Android can clear WebView data | The working copy the app reads while drawing |
| Capacitor **Preferences** (Android SharedPreferences) | Async (goes through the native bridge) | WebView clears | The durable copy |

How they work together:
1. **Every write goes to both.** The Preferences write goes through **one ordered promise queue**, so writes land in the order they were made. A delete can never be overtaken by an older save.
2. **On launch, before React draws anything**, any key missing from `localStorage` is **restored from Preferences**. If that read fails (or times out after 4 s), the app remembers and **won't overwrite** the Android copy that session, so a failed read can't turn into an empty list being saved over the backup.
3. **Saves report success or failure.** A save counts only when `localStorage` (the copy the app reads) took it; otherwise a red banner appears. If Android's copy falls behind, an amber note says so.
4. **Unreadable data is kept, never deleted.** A corrupt list is copied to an `_unreadable` key, and a crashing match is moved to `rummy_crashed_game_backup`.
5. **No limit** on saved matches. It's local only, and the save banner covers a full phone.

**Why not IndexedDB or SQLite?**
- **IndexedDB** is async-only. Our screens read saved games synchronously on first render, and the data is small JSON documents.
- **SQLite** (a plugin) would bring a schema and migrations for what is essentially "save this document".

Key-value storage fits the shape of the data. With thousands of games or queries across games, a database would make sense.

**Backup and restore:** export writes a `.json` file and shares it. Restore:
- checks the **whole file** first (format, version, every game, size under 5 MB)
- **asks** with the counts
- **merges** by game id (the copy with more rounds wins), deleting nothing and leaving the open match alone
- reports what changed

---

## 7. Native features: how they're wired

### Share as image
1. `html-to-image` renders the scoreboard element to a PNG at 2× resolution. Just for the capture, the scrolling table is expanded to its full height so every round is included, then restored.
2. The PNG is turned into base64 and written to the app's **cache folder** with the Filesystem plugin.
3. The Share plugin opens Android's share sheet with that file. Android's **FileProvider** gives the receiving app (WhatsApp) **temporary read access to just that file**.
4. Closing the share sheet isn't an error. Browsers reject with `AbortError` and the Android plugin with "Share canceled", and both are treated as a cancel.

### Announce
- The `buildAnnouncement(state)` pure function produces "Round 6. Ravi 45. Amit 120. Kiran out."
- The plugin speaks it with an Indian-English voice (falling back to the phone's default). A new announcement interrupts the old one.
- **When to speak:** after a round is submitted or edited, never on opening or resuming a game. That's decided by remembering the last *(game, round count, timestamp)* seen, in a `useRef`.

### Back button
`services/backHandler.ts` keeps a **priority stack** of handlers. An open dialog handles Back first, then the screen, and at the top level it's "press back again to exit".

---

## 8. Money: the deal splits

Three automatic splits plus custom. All return **whole rupees that add up to the exact pool**.

| Mode | Rule |
|---|---|
| Points | Each player's share is proportional to their room before the pool limit (`poolLimit − score`) |
| Equal | The pool divided by the players still in |
| **By drops** (Tejo's rule) | A **waterfall**: (1) everyone gets one stake back; (2) each open drop left is worth one stake, shared pro rata if the money runs short; (3) the rest is shared equally |
| Custom | Typed amounts, accepted only when they add up to the pool |

**Rounding** uses the **largest-remainder method**: round everyone down, then give the missing rupees to the largest fractions. Ties go to more drops. Fractions are compared with a tiny tolerance, because floating point stores 2/3 slightly differently each time.

**The pool** is stake × (everyone who started, including players already out, plus re-entries). It's shared only among the players still in.

---

## 9. Quality: how we know it works

### The testing pyramid

```
            ▲  15 browser tests (Playwright, Pixel 7 screen, production build)
           ▲▲▲  ~40 component tests (React Testing Library in jsdom) + axe accessibility audits
        ▲▲▲▲▲▲▲  ~160 unit tests (Vitest) for rules, reducer, storage, splits
```

| Tool | Why |
|---|---|
| **Vitest** | Fast, works natively with Vite and TypeScript, Jest-compatible API |
| **React Testing Library** | Tests find things the way a user does (by role and name), so tests survive refactors |
| **Playwright** | Drives real Chrome against the **built** app, e.g. downloads the share PNG and checks its height, or round-trips a backup file |
| **axe-core** | The industry-standard accessibility engine, run inside tests on every main screen |
| **ESLint** (+ react-hooks rules) | Catches risky patterns before running, like a hook after an early return |

**Practices that matter more than the tools:**
- **Write the test first and watch it fail** for the right reason.
- **Prove a test can fail**: break the expectation on purpose, or run it against the old code.
- **Test with awkward inputs** (₹350 stakes, 25-round games). That's how the floating-point and screen-capture bugs were found.

### Reviews
After each phase, specialist reviewers (code, TypeScript, React, security, silent failures) read the change. Every finding was checked against the code. Confirmed ones were fixed with a test, and deliberate non-fixes were written down with a reason.

---

## 10. Build, signing and release (CI/CD)

```
git push main
   │
   ▼
GitHub Actions (ubuntu, Node from .nvmrc = 22, Java 21, 20-min timeout, read-only token)
   ├─ npm ci
   ├─ npm run lint        ┐
   ├─ npm test            ├─ any failure stops here, so no APK
   ├─ npm run test:e2e    ┘
   ├─ npm run build      → dist/
   ├─ npx cap sync android
   ├─ decode keystore from secret → $RUNNER_TEMP (fail clearly if missing)
   ├─ ./gradlew assembleRelease  (signing passwords from secrets as env vars)
   └─ upload RummyScoreboard.apk (fail if missing)
```

### Why signing matters
Android only installs an update if it's signed with the **same key** as the installed app. The key is like a wax seal: whoever holds it can publish "updates".
- The original key and its passwords had been committed to the public repo. It was **rotated** (new key, old one abandoned).
- The new key lives **outside git**: on the Mac in `~/keys`, with values in `~/.gradle/gradle.properties`, and in CI as **GitHub Secrets**, with the keystore stored as base64 text.
- Users reinstalled once.

### Why APK and not the Play Store
- It's for a small group of friends.
- Play would need a **$25 account**, an **AAB** bundle, a store listing, a privacy policy, a 12-tester closed test, and care with the ₹-stake wording under the gambling policy.

The app is Play-ready technically (SDK 36), and that can be revisited.

---

## 11. Accessibility and UX

**Invisible improvements**, kept:
- every icon button has a name
- dialogs announce themselves and take focus, then hand it back
- form boxes have labels
- score cells are read by meaning ("Middle drop")
- pinch-zoom works
- no wrong-theme flash at launch

**Visible design is the owner's call.** Guidelines suggested bigger buttons and darker colours. Side-by-side screenshots showed the result was bulkier and duller, so Tejo kept the original bright look, plus a 👑 dealer crown, a short legend, and ✕ to clear a chosen score.

---

## 12. Trade-offs, honestly

| Decision | What we gave up |
|---|---|
| Web UI in a WebView | Slightly less native feel than Kotlin, which is fine for forms and tables |
| One JSON document per game, key-value storage | No queries across games, which a scorecard doesn't need |
| Two stores | Some complexity (a queue, restore-on-launch) in exchange for not losing games |
| Reducer refuses invalid actions | Screens must check first to give friendly messages, so rules are shared to avoid drift |
| Original bright colours | A little below the strict text-contrast guideline on two buttons, a product choice |
| APK distribution | No automatic updates, and users must allow "install unknown apps" |

---

## 13. Folder map

```
rummy-scorecard/
├─ src/
│  ├─ domain/      rules: types, scoring, elimination, seating, dealSplit, rules, roundSummary, announce, validation
│  ├─ state/       gameReducer, gameActions
│  ├─ storage/     localStorageAdapter (two stores, queue, backup/restore, validation)
│  ├─ services/    share (image/text/file), speech, backHandler
│  ├─ hooks/       useBackButton
│  ├─ themes/      themeConfig, ThemeContext
│  ├─ components/  home, setup, scoreboard (ScoreTable, Header, Actions, ShareMenu, Legend, PoolShareModal),
│  │               input (RoundInputModal, ReEntryModal), players, continue, settings, common (Modal, IconButton…)
│  ├─ App.tsx      screen switching, save/announce effects, banners
│  ├─ main.tsx     restore from Android copy → render
│  └─ test/        unit + component tests
├─ e2e/            Playwright browser tests
├─ android/        Capacitor's native project (Gradle, manifest, icons)
├─ .github/workflows/build-apk.yml
├─ lessons/        these lessons
└─ plan_docs/      plan, review findings, phone checklist
```

---

## 14. From zero: how you'd build this again (outline)

1. `npm create vite@latest` (React + TypeScript), add Tailwind.
2. Write `domain/` first: types, scoring, drops, re-entry, dealer rotation, each with unit tests.
3. Add the reducer with actions, enforcing the domain rules, with reducer tests.
4. Build the screens on top of `useReducer`: New Game, Scoreboard, Score entry, Deal.
5. Add storage: localStorage plus the Preferences mirror through a queue, restore on launch, validation.
6. `npm i @capacitor/core @capacitor/cli @capacitor/android`, then `npx cap init` and `npx cap add android`. Add the plugins.
7. Add share (html-to-image → Filesystem → Share) and text-to-speech.
8. Add Playwright for the main flows, ESLint, and axe.
9. Create a signing key outside git. Set up CI: lint → tests → e2e → build → sign from secrets → upload the APK.
10. Review, fix, and show the owner the screens before changing the look.

---

## 15. Questions you should be able to answer

- Why is every change a reducer action, and what happens when an action breaks a rule?
- Why does the app read `localStorage` but also write Preferences? What happens if the WebView is cleared?
- How does Share as Image include rounds that aren't on screen?
- How does the drop split guarantee the payouts add up to the pool?
- Why can't you just delete a leaked signing key from git?
- What's the difference between `useEffect` and `useLayoutEffect`, and where did we need the second one?
- How do you prove a test would catch the bug it's meant to catch?
