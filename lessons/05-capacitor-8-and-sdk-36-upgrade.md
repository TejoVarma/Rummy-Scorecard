# 05 · Upgrading Capacitor 6 → 8 and Android SDK 34 → 36

## The problem it solves

Google Play only accepts apps that **target** a recent Android version. Our app targeted **SDK 34 (Android 14)**. Play needs 35 or higher, and **36 (Android 16)** is current.

**Capacitor** is the layer that wraps our React web app into an Android app. Capacitor 6 only knows up to SDK 34, so moving up means upgrading Capacitor.

We went **straight to 8**, skipping 7, because the plugin needed for the "announce totals" feature, `@capacitor-community/text-to-speech`, only has versions for Capacitor 6 and 8. There's no version for 7. One move instead of two.

## Everyday analogy: moving house

The web app is the **furniture**. Capacitor plus the Android SDK is the **house**. We're moving into a newer house that meets today's building code (Play's rules).

- Most furniture fits as it is. Our React code needed **no changes**: 70/70 tests passed and `tsc` was clean straight away.
- The **tools** used to build the house all have to be newer models: Node, Java and Gradle.
- The new house has **floor-to-ceiling windows** (edge-to-edge), so the old curtains had to be re-measured.

## What changed

| Part | Before | After | Where |
|---|---|---|---|
| Capacitor + plugins | 6.x | 8.x | `package.json` |
| `compileSdkVersion` / `targetSdkVersion` | 34 | 36 | `android/variables.gradle` |
| `minSdkVersion` | 22 (Android 5.1) | **24 (Android 7.0)** | `android/variables.gradle` |
| Android Gradle plugin | 8.2.1 | 8.13.0 | `android/build.gradle` |
| Gradle wrapper | 8.2.1 | 8.14.3 | `android/gradle/wrapper/gradle-wrapper.properties` |
| Node | 18 | 22 (pinned in `.nvmrc`) | `.nvmrc`, CI `node-version-file` |
| Java | 17 | 21 | CI `java-version: '21'` |
| App version | 1.2 (code 3) | **1.3 (code 4)** | `android/app/build.gradle` |

`minSdk 24` means phones older than Android 7.0 (2016) can no longer install the app. Capacitor 8 requires that.

## How we did it

### 1. Read the official guides for every version we skip

We needed both the **6→7** guide and the **7→8** guide, because each one only describes its own step. Where they conflict, the newer one wins.

### 2. A branch, so `main` stays untouched

```bash
git switch -c chore/capacitor-8
```

### 3. Node 22, but only for this project

Capacitor 8's CLI requires Node 22 or higher. Other projects on the Mac use Node 18, so instead of upgrading Node globally we used **fnm**, a Node version manager:

```bash
brew install fnm
fnm install 22
echo "22" > .nvmrc
fnm exec --using=22 -- node -v      # v22.x  (just for this command)
node -v                             # v18.x  (global default unchanged)
```

`.nvmrc` is a one-line file stating which Node version the project wants. CI reads the same file, so the Mac and CI can never drift apart:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version-file: .nvmrc
```

To have fnm switch automatically whenever you `cd` into the folder, add this line to `~/.zshrc`:
```bash
eval "$(fnm env --use-on-cd)"
```

### 4. Upgrade the packages, then let the official tool do the mechanical work

```bash
fnm exec --using=22 -- npm install @capacitor/core@8 @capacitor/android@8 @capacitor/app@8 @capacitor/preferences@8 @capacitor/share@8
fnm exec --using=22 -- npm install -D @capacitor/cli@8
fnm exec --using=22 -- npx cap migrate --noprompt --packagemanager npm
```

- We pinned `@8` rather than `@latest`, because `latest` could jump to a future version 9.
- `cap migrate` normally asks questions. `--noprompt --packagemanager npm` answers them up front.
- Its output reported success on most steps, and one failure:
  ```
  ✔ Migrating AndroidManifest.xml by adding density to Activity configChanges.
  ✖ Upgrading gradle wrapper - failed!
  ✔ Migrating root build.gradle file.
  ✔ Migrating app build.gradle file.
  ✔ Migrating variables.gradle file.
  ```

### 5. Finish what the tool couldn't, and check what it did

The wrapper version is set by hand in `android/gradle/wrapper/gradle-wrapper.properties`:
```
distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-all.zip
```

Then we checked every file the tool touched against the guide:
- `variables.gradle` has the exact values from the guide (SDK 36/36/24 and the new androidx versions).
- The AGP classpath is `8.13.0`.
- The manifest `configChanges` now includes `density`, which stops the WebView reloading when the screen size changes.
- `app/build.gradle` uses the new `=` syntax, for example `namespace = "..."`. The old space syntax only produces warnings today, but the guide says it will break in a future version.

**Always check a migration tool's output by hand.** It even tells you it can't do everything.

### 6. Edge-to-edge: the one behaviour change that mattered

From SDK 35, Android draws apps **behind** the status bar (clock, battery) and the navigation bar.

Capacitor 8's built-in **SystemBars** plugin decides what to do. We read its source in `node_modules/@capacitor/android/.../plugin/SystemBars.java`:
- If the page's viewport meta contains **`viewport-fit=cover`** and the WebView is new enough, Capacitor passes the bar sizes to CSS as `--safe-area-inset-*` variables, and **the page must pad itself**.
- Otherwise, Capacitor **pads the WebView itself**, so the app sits between the bars exactly as it did before.

Our `index.html` had `viewport-fit=cover`, but none of our CSS used safe-area padding. On Android 15 and 16, the headers would have slid under the clock. The smallest correct fix was to **remove `viewport-fit=cover`**:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

The other option was to add `padding-top: var(--safe-area-inset-top)` to every screen header and full-screen modal. That's more work and more places to forget. We'd only choose it if we wanted colours to run behind the bars.

### 7. Build and check the APK on the Mac

We installed the Android SDK through Homebrew, so nothing has to be pushed to build:

```bash
brew install openjdk@21
brew install --cask android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

Signing values for local builds live in `~/.gradle/gradle.properties`, outside every repo and readable only by you (`chmod 600`):
```
RUMMY_KEYSTORE_FILE=/Users/<you>/keys/rummy-release.jks
RUMMY_KEYSTORE_PASSWORD=<password>
RUMMY_KEY_ALIAS=rummy
RUMMY_KEY_PASSWORD=<password>
```

Build and check:
```bash
fnm exec --using=22 -- npm run build
fnm exec --using=22 -- npx cap sync android
(cd android && ./gradlew assembleRelease)
BT=$ANDROID_HOME/build-tools/36.0.0
$BT/apksigner verify --print-certs android/app/build/outputs/apk/release/RummyScoreboard.apk
$BT/aapt2 dump badging android/app/build/outputs/apk/release/RummyScoreboard.apk | grep -oE "versionName='[^']+'|targetSdkVersion:'[0-9]+'"
```
Expected:
```
BUILD SUCCESSFUL in 5m 4s
Signer #1 certificate DN: CN=TejoVarma, O=Rummy Scoreboard, C=IN
versionName='1.3'
targetSdkVersion:'36'
```
The first build takes about 5 minutes, because Gradle downloads itself and its dependencies. Later builds are much faster.

## What can go wrong (interview angle)

**"How do you approach a major framework upgrade?"**
1. Read the migration guide for **every** version you skip.
2. Work on a branch.
3. Pin the target version (`@8`, not `@latest`).
4. Let the official migration tool do the mechanical parts, then **check its output against the guide**.
5. Run the tests and the type checker.
6. **Test on a real device.** Behaviour changes, like edge-to-edge here, don't show up as build errors.

**"Why not upgrade Node globally?"** Other projects may depend on Node 18. A version manager plus a per-project `.nvmrc` gives each project its own version. Pointing CI at the same file stops "works on my machine" bugs.

**"The build passed. Are you done?"** No. On Android 15+, edge-to-edge only shows up on a real phone running Android 15 or newer. A green build doesn't prove the layout is right.

**"What happens to users on old phones?"** `minSdk 24` drops Android 5.x and 6.x. Check your audience before raising it. For a scorecard shared among friends with recent phones, that's fine.

## From zero, by hand

1. `git switch -c chore/capacitor-8`
2. `brew install fnm && fnm install 22 && echo "22" > .nvmrc`
3. Install the packages and run `cap migrate` as in step 4. Expected: the ✔/✖ list shown above, ending in `[success] Migration to Capacitor ^8.0.0 is complete.`
4. Set the wrapper URL to `gradle-8.14.3-all.zip`.
5. Check `variables.gradle`: `minSdkVersion = 24`, `compileSdkVersion = 36`, `targetSdkVersion = 36`.
6. Run `fnm exec --using=22 -- npx tsc -b && fnm exec --using=22 -- npx vitest run`. Expected: `tsc` prints nothing, and `Tests  70 passed (70)`.
7. In `.github/workflows/build-apk.yml`, set `node-version-file: .nvmrc` and `java-version: '21'`.
8. In `index.html`, remove `, viewport-fit=cover` from the viewport meta.
9. In `android/app/build.gradle`, set `versionCode 4` and `versionName "1.3"`.
10. Install the SDK, set up `~/.gradle/gradle.properties`, build and check as in step 7. Expected: the four lines shown there.
11. On a phone running Android 15 or newer: the scoreboard header sits **below** the clock and battery, and the bottom buttons sit **above** the navigation bar.
