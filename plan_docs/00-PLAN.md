# Rummy Scorecard: improvement plan

**Product in one line:** an Android scorecard for Indian pool rummy (101/201) that tracks drops, re-entries, the dealer and the prize-pool deal.
**Stack:** React 18 + TypeScript + Vite + Tailwind, wrapped with Capacitor for Android. Vitest for tests. No backend; all data is stored on the phone.
**Mode:** learning mode. Claude teaches each step, then builds it, and writes a lesson file.
**Source of findings:** `plan_docs/review-2026-11-09.md`. Numbers like R#3 refer to that file.

## Decisions log

| Date | Decision |
|---|---|
| 2026-11-09 | Drop-based pool split **revived and built** (Tejo's rule, any number of players): stakes back → each drop worth one stake (pro rata if short) → rest equal; nearest ₹1, odd rupee to most drops; one stake back even after re-entry. Superseded the earlier "dropped" entry below. |
| 2026-11-09 | Drop-based pool split (3+ players): **dropped**. Too many table-specific rules (rounding, who covers the shortfall, ties). The existing Custom split covers it. |
| 2026-11-09 | Share: one Share button that asks **Image or Text**; the user picks. |
| 2026-11-09 | "Minimum = stake" option for Proportional split: **not wanted**. |
| 2026-11-09 | Old keystore: removed from the repo and rotated. Purging git history is skipped, because the old key is burned either way. |
| 2026-11-09 | `plan_docs/` and `lessons/` are **published** in the public repo. |
| 2026-11-09 | Announce: **totals only**, in **English**, spoken **automatically after each round (on/off switch) plus a replay button**. |
| 2026-11-09 | **No limit on saved matches** (Tejo): local storage only, ~5–10 MB ≈ several hundred matches; the save-failure banner covers a full phone. Replaces the 30/50 cap. |
| 2026-11-09 | **Distribution: APK only, no Play Store for now.** Signed `RummyScoreboard.apk` from CI or a local build, shared directly. Revisit Play later (needs a $25 account, AAB, store listing, privacy policy, a 12-tester closed test, and care with the ₹ stake wording under the gambling policy). |
| 2026-11-09 | Capacitor 8, not 7: the text-to-speech plugin has no Capacitor 7 version. Node 22 pinned per project with fnm + `.nvmrc` (global Node 18 kept). Android SDK installed locally so builds are verified without pushing. |
| 2026-11-09 | Platform upgrade (Capacitor + targetSdk) comes **before** the new features, so the new plugins are installed only once, on the new version. |

## Phase 1: safety fixes (P0)

| Step | What | Review # | You'll learn |
|---|---|---|---|
| ✅ 1.1 | Rotate the signing key: new keystore kept outside git, passwords from `~/.gradle/gradle.properties`, add `*.keystore` and `*.jks` to `.gitignore`, `git rm --cached` the old one | R#1 | How Android app signing works, why a leaked key is permanent, and how to keep secrets out of a repo |
| ✅ 1.2 | Fix the PoolShareModal infinite render loop, and hide the header Deal button until round 1 | R#2 | Why `?? {}` breaks `useMemo`, and how effect → setState → render loops happen |
| ✅ 1.3 | Make ErrorBoundary Reset clear the real keys, and make startup skip a saved game that won't load | R#3 | Error boundaries, and designing a crash screen the user can actually escape |
| ✅ 1.4 | "Start New Match" goes to setup and keeps the old game in history | R#4 | Separating destructive actions from navigation |

Exit: tests are green, the APK is signed with the new key, and each bug has a regression test where it can have one.

## Phase 2: platform upgrade

| Step | What | Review # | You'll learn |
|---|---|---|---|
| ✅ 2.1 | Capacitor 6 → 8.6, targetSdk/compileSdk 36, minSdk 24, Node 22 (`.nvmrc`), Java 21, edge-to-edge handled by dropping `viewport-fit=cover`. App v1.3 | R#5 | Mobile SDK levels, Play Store policy, and doing a framework upgrade |
| ✅ 2.2 | CI: Node 22 (`.nvmrc`), ESLint 10 + react-hooks (27 errors fixed, none disabled), `permissions: contents: read`, coverage limited to `src/` (honest 52%), vitest 2 → 5. Dev-only audit leftover: minimatch inside ESLint, accepted | R#22, R#23 | CI hygiene and lint as a quality gate |

Exit: the app builds and runs on a phone at the new SDK, and CI is green with lint.

## Phase 3: new features

| Step | What | You'll learn |
|---|---|---|
| ✅ 3.1 | **Share Image + Share Text on the phone** (v1.4; also fixed the share sheet reopening after a cancel). Render the scorecard to a PNG (`html-to-image`, already installed), write it to the cache folder (`@capacitor/filesystem`), and open the share sheet with the file (`@capacitor/share` `files`). The Share button asks "Image or Text". | Turning DOM into an image, Base64 and blobs, how Android shares files (FileProvider), and native vs web code paths |
| ✅ 3.2 | **Announce totals** (v1.5). A text-to-speech plugin (the version is chosen in the research step to match the Capacitor version), with a browser `speechSynthesis` fallback. Text: "Round 6. Ravi 45. Amit 120. Kiran out." A Settings switch "Announce after each round" (saved). A 🔊 replay button on the scoreboard. Announcements also run after an edit. | Capacitor plugins, text-to-speech, and a pure "message builder" function with unit tests |
| ✅ 3.3 | **Deal by drops** (v1.7): new "By Drops" option in the Deal screen, `calculateDropDeal` in `domain/dealSplit.ts`. |

Exit: tested on a real phone. The image arrives in WhatsApp. The voice speaks after submit and on replay, and is silent when switched off.

## Phase 4: correctness and data safety (P1)

| Step | What | Review # |
|---|---|---|
| ✅ 4.1 | Winner and all-drop detection use `type === 'show'` only | R#7 |
| ✅ 4.2 | Edit form: only active players, the correct dealer crown, and a warning if a re-entry will be cancelled | R#8, R#9 |
| ✅ 4.3 | Move the rules into the reducer: round-score validation, re-entry eligibility, a deal lock on edit/undo/accept, and START_GAME checks | R#10 |
| ✅ 4.4 | `validateRoundScores` uses `rules.fullCount` | R#11 |
| ✅ 4.5 | Storage: restore from Preferences at startup, report failed saves, keep corrupt data instead of overwriting it, run saves one at a time, and warn before the 30-game cap evicts a game | R#6, R#13-15 |
| ✅ 4.6 | Backup: strict validation, confirm before import, merge by gameId, version check, size cap, export as a file | R#12, R#17 |
| ✅ 4.7 | Fix the wizard title month and input handling | R#16, R#25 |

## Phase 5: quality and accessibility (P2)

Add a colour legend on the scoreboard (🟩 all-drop round, 🟦 normal round, grey = already out), asked about on 2026-11-09. R#18-21, R#24, R#26, R#27: remove the dead UNDO/REORDER/custom_fixed code, re-enable pinch-zoom, use real buttons and 44px tap targets, use `aria-label`s, split ScoreboardScreen and RoundInputModal into smaller components, and add RTL tests for the score-entry flow.

## Phase 6: final testing

| Step | What |
|---|---|
| 6.1 | Run the five ECC reviewers again (typescript, react, security, silent-failure, code) plus `verification-loop`; fix whatever they confirm |
| 🟡 6.2 | **First round done 2026-11-09:** 8 flows in `e2e/game.spec.ts` (scores, cap, one-Show rule, edit, deal, reload, start-new-match, re-entry), running in CI. Extend after the features. Playwright e2e in the repo (`e2e-testing` skill), at a phone-sized screen: new game, scores, drops, re-entry, deal, edit, share choice. Runs in CI |
| 6.3 | Real-phone checklist for native-only behaviour: Image/Text share sheet, voice announcement, back button, install and update of the signed APK |

## Open questions

None right now.
