# Rummy Scoreboard Pro

An offline Android scorecard for **Indian pool rummy** (201, 101 or any custom pool). It keeps the running totals, warns when a player is on their last drop, handles re-entries and the dealer's seat, and splits the prize pool when the table makes a deal. No account, no ads, and everything stays on the phone.

[![Build signed APK](https://github.com/TejoVarma/Rummy-Scorecard/actions/workflows/build-apk.yml/badge.svg)](https://github.com/TejoVarma/Rummy-Scorecard/actions/workflows/build-apk.yml)

## What it does

- **Fast score entry:** one tap for Show, Drop, Middle drop, Full count or Out, or type a hand score (capped at full count).
- **Drop warnings:** names turn yellow on the last drop and red when a drop is no longer possible.
- **Dealer and re-entry:** a 👑 marks the dealer and moves each round. A knocked-out player can re-enter at the highest score + 1 and is seated next to the dealer.
- **Prize-pool deals:** split by points, equally, **by drops** (stakes back → each drop worth one stake → rest equal), or custom. Amounts are whole rupees that always add up to the pool.
- **Share:** send the scoreboard to WhatsApp as an **image** (the full table, not just the screen) or as **text**.
- **Announce:** read the totals aloud after each round, or on demand.
- **Safe data:** saved on the phone with a second copy in Android storage, backup and restore to a `.json` file, and a clear warning if anything can't be saved.

## Download

Every push to `main` builds a signed APK in GitHub Actions: open the latest run → **Artifacts** → `RummyScoreboard-APK`, unzip, and install `RummyScoreboard.apk`. New versions install over old ones and keep your games. The app isn't on the Play Store.

## Run it locally

Needs Node 22 (pinned in `.nvmrc`).

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # unit and component tests (Vitest)
npm run test:e2e     # browser tests (Playwright, phone-sized Chrome)
npm run lint
npm run build
```

### Build the APK yourself

Needs JDK 21 and the Android SDK (platform 36). Signing values come from environment variables or `~/.gradle/gradle.properties` (`RUMMY_KEYSTORE_FILE`, `RUMMY_KEYSTORE_PASSWORD`, `RUMMY_KEY_ALIAS`, `RUMMY_KEY_PASSWORD`). Without them the release APK is built unsigned.

```bash
npm run build:release   # → android/app/build/outputs/apk/release/RummyScoreboard.apk
```

## How it's built

| Layer | What's there |
|---|---|
| `src/domain` | Pure game rules: scoring, drops, re-entry, dealer rotation, deal splits, rule checks |
| `src/state` | One reducer that applies every change and refuses anything that breaks the rules |
| `src/storage` | localStorage plus an ordered mirror to Capacitor Preferences, backup and restore |
| `src/services` | Share (image and text files via Filesystem + Share) and text-to-speech |
| `src/components` | Screens: home, new game, scoreboard, score entry, deal, settings |
| `e2e/` | Playwright tests of the main game flows |

Stack: React 18, TypeScript, Vite, Tailwind CSS, Capacitor 8 (Android, target SDK 36), Vitest, Playwright, ESLint. CI runs lint, unit tests and browser tests, then builds the signed APK.
