# 🎴 Rummy Scoreboard Pro

> A standalone, modern, 100% offline-first Android application designed specifically for **Indian Pool Rummy** (201, 200, 101, 100, and Custom Pool matches). Built with **React 18**, **TypeScript**, **Tailwind CSS**, and packaged natively with **Capacitor 6**.

[![Android APK Build](https://github.com/TejoVarma/Rummy-Scorecard/actions/workflows/build-apk.yml/badge.svg)](https://github.com/TejoVarma/Rummy-Scorecard/actions/workflows/build-apk.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Zero Ads](https://img.shields.io/badge/Ads-Zero%20Ads-brightgreen.svg)]()
[![100% Offline](https://img.shields.io/badge/Privacy-100%25%20Offline-blue.svg)]()
[![Test Suite](https://img.shields.io/badge/Vitest-15%2F15%20Passing-success.svg)]()

---

## 🃏 Why Rummy Scoreboard Pro?

Most rummy scorecard apps on the Play Store are clunky, loaded with banner ads, force you to perform mental math, and fail to reflect how physical card games are actually played at the table.

**Rummy Scoreboard Pro** was engineered to solve the real-world frustrations of home and club rummy nights:

| Problem in Existing Apps | Rummy Scoreboard Pro Solution |
| :--- | :--- |
| **Ambiguous Re-Entry Stars (`*`)** | In other apps, a red star is slapped next to a re-entered player without any clarity. We provide **clear status badges** (`RE @ 145`) and full historical transparency. |
| **Whose turn to deal?** | Players often argue about who dealt last. A glowing **Distributor Badge (🎴)** rotates clockwise automatically after each round among active players. |
| **Seating Confusion after Re-entry** | In physical Indian Rummy, a re-entered player moves their chair to sit **immediately after (below) the dealer**. Our app **automatically relocates the player's seating order** right after the distributor! |
| **Annoying Banner & Video Ads** | **Zero ads forever.** No distractions, no tracking, and no paid upgrades required. |
| **Hidden Cumulative Scores** | You used to have to open sub-menus to see who is leading. Our **Sticky Dual-Axis Table** keeps each player's **live total, rank (#1, #2), and warning color** pinned to the top at all times. |
| **Accidental Score Typos** | Full **1-Tap Lossless Undo** immediately restores cumulative scores, dealer pointer, and previous seating arrangements. |

---

## 🌟 Key Features

### 1. 🎴 Real-World Indian Rummy Rule Presets
* **Open Drop:** `24` points *(customizable)*
* **Middle Drop (MD):** `48` points *(customizable)*
* **Full Count (Cap):** `80` points *(customizable)*
* **Target Pool Limits:** One-tap presets for **201**, **200**, **101**, **100**, or any custom target score (e.g. 250, 300).
* **Smart Re-Entry Math:** Automatically calculates re-entry score as:
  $$\text{Re-entry Score} = \text{Highest Active Score} + 1$$

### 2. 👥 Player Roster & Seating Order (Highest to Least)
* **Saved Player Roster:** Easily manage your family and friends roster with avatars, quick edit, and delete options.
* **Automatic Dealer Assignment:** Tap or arrange players in seating order from **Highest card (#1) to Least card (Last)**. The least player automatically deals Round 1, and the deal rotates clockwise among surviving active players.
* **Unlimited $N$ Players:** Smooth horizontal scrolling handles **2 to 10+ players** without cramping or clipping names.

### 3. ⚡ 1-Tap Rapid Score Entry
* Enter scores for 6+ players in **under 5 seconds**:
  * 🟢 **Show (0):** Tapping Show on the winner automatically assigns 0 points to them.
  * 🟠 **Drop (24):** 1-tap open drop.
  * 🟡 **MD (48):** 1-tap middle drop.
  * 🟣 **Full (80):** 1-tap full count / wrong show.
  * 🔴 **Out (X):** Manual elimination / withdrawal.
  * 🔢 **Custom Input:** Keypad for custom remaining points (e.g., 7, 22, 53).

### 4. 🎨 4 Luxury Casino Table Themes & Dark Mode
Select your favorite felt aesthetic from Settings:
1. 🟢 **Casino Green:** Classic Monte Carlo / Indian club emerald green felt.
2. 🔵 **Royal Sapphire:** Deep navy and sapphire blue.
3. ⚫ **OLED Velvet Black:** Pure pitch black with gold accents (maximum battery saver).
4. 🔴 **Crimson Poker:** Warm burgundy and wine red.
* Full support for both **Dark Mode** and **Light Mode**.

### 5. 🎉 Fluid Micro-Animations & Celebration
* **Winner Confetti Cannon:** Smooth canvas particle confetti explosion and glowing trophy badge when a player wins the match.
* **Pulsating Dealer Halo:** Subtle ambient amber pulse highlighting the current card distributor.
* **Tactile Spring Touch:** Button press micro-interactions (`active:scale-95`) and smooth spring modal slide-ups.

### 6. 🔒 Air-Tight Security & 100% Offline Privacy
* **Zero Internet Permissions:** `android.permission.INTERNET` is completely omitted from the Android Manifest. The OS will strictly deny any outbound socket connection.
* **Strict Content Security Policy (CSP):** `<meta http-equiv="Content-Security-Policy">` prevents arbitrary inline scripts, frames, or external network requests.
* **Backup Extraction Protection:** `android:allowBackup="false"` prevents extraction via USB/ADB debugging.
* **Object Prototype Poisoning Guard:** Storage keys and themes are strictly validated against allowlists to prevent prototype pollution or crash loops.
* **Persistent Local Storage:** Backed by `@capacitor/preferences` with fallback to `localStorage`.

---

## 📱 How to Download the APK

Every push to this repository automatically compiles a fresh Android release APK via **GitHub Actions** (100% free and automated):

1. Go to the **[Actions Tab](https://github.com/TejoVarma/Rummy-Scorecard/actions)** in this repository.
2. Click on the latest workflow run (e.g., `Build Android APK`).
3. Scroll down to the **Artifacts** section at the bottom.
4. Download **`RummyScoreboard-Debug-APK`**.
5. Transfer the `.apk` file to your Android phone (or download directly on your phone browser), tap to install, and enjoy your game!

---

## 🛠️ Development & Local Setup

### Prerequisites
* Node.js 18+
* npm 9+

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/TejoVarma/Rummy-Scorecard.git
cd Rummy-Scorecard

# 2. Install dependencies
npm install

# 3. Start local interactive dev server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to test the full UI, themes, seating order, and score matrix.

### Running Automated Tests
```bash
# Run 15 unit tests with Vitest
npm test

# Run tests with test coverage breakdown (>88% domain coverage)
npm run test -- --coverage
```

### Compiling Web Production Bundle
```bash
npm run build
```

### Syncing to Android Native Wrapper
```bash
npx cap sync android
```

### Building the APK Locally (requires Android Studio)
```bash
npx cap open android
```
In Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

## 🏗️ Project Architecture

```
rummy-scorecard/
├── .github/workflows/
│   └── build-apk.yml               # Automated cloud APK build workflow
├── android/                        # Capacitor Android native project
│   └── app/src/main/
│       ├── AndroidManifest.xml     # Zero-permission hardened manifest
│       └── res/                    # Native splash screens, icons, XML
├── src/
│   ├── domain/                     # Pure functional business logic (100% immutable)
│   │   ├── types.ts                # TypeScript domain models
│   │   ├── scoring.ts              # 24/48/80 presets & validation
│   │   ├── seating.ts              # Dealer advance & re-entry relocation algorithm
│   │   └── elimination.ts          # Highest + 1 calculation & eligibility
│   ├── state/                      # State Machine & Reducers
│   │   ├── gameActions.ts          # Discriminated action unions
│   │   └── gameReducer.ts          # Pure reducer with snapshot undo support
│   ├── storage/                    # Persistence layer
│   │   └── localStorageAdapter.ts  # Capacitor Preferences + localStorage with guards
│   ├── themes/                     # Theme engine
│   │   ├── themeConfig.ts          # 4 luxury color palettes
│   │   └── ThemeContext.tsx        # Secure theme provider with Prototype DoS protection
│   ├── components/                 # Modular UI (strictly <350 lines per file)
│   │   ├── common/                 # Modals, Chips, Confetti particles
│   │   ├── setup/                  # N-Player Setup Wizard & Seating Order
│   │   ├── scoreboard/             # Sticky Dual-Axis Score Matrix
│   │   ├── input/                  # 1-Tap Round Score Input & Re-Entry Modal
│   │   └── settings/               # Themes & match controls
│   ├── App.tsx                     # Top-level screen coordinator
│   └── test/                       # Comprehensive Vitest test suite
└── capacitor.config.ts             # Capacitor 6 configuration
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Built with ❤️ for hassle-free rummy game nights.
