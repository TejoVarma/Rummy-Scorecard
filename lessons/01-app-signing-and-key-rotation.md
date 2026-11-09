# 01 · App signing and rotating a leaked key

## The problem it solves

When a phone installs an update to an app, it must be sure the update came from the same person who made the original. Otherwise anyone could publish a fake "update" that replaces your app and reads its data.

Android solves this with a **signature**. Every APK is signed with a private key. The phone remembers the signature from the first install and refuses any update whose signature doesn't match.

## Everyday analogy: the king's wax seal

- The **keystore** (`.jks` file) is the king's signet ring, kept in a locked box.
- The **password** is the key to that box.
- Every APK you build gets the ring's seal pressed into it.
- The phone is a careful guard. It remembers the seal on the first letter and only accepts later letters with the same seal.
- Anyone who holds the ring can seal letters that look like they came from the king.

Our project had pinned both the ring (`android/app/rummy-release.keystore`) and the box key (`rummyscoreboard`, written in `build.gradle`) to a public notice board, a **public GitHub repo**. Deleting them afterwards does not help. They live on in the git history and in every clone. The only real fix is to **make a new ring and stop using the old one**. That is called **rotating** the key.

## Why it had been committed in the first place

CI (GitHub Actions) builds the APK. A CI machine starts empty every time. If it had no fixed key, it would sign each build with a fresh random debug key. Every update would then carry a different seal, and the phone would refuse to install it over the old app. Committing the key "fixed" that the unsafe way.

The safe way is a **secret store**. GitHub Secrets are encrypted values that the workflow can read while it runs. They never appear in the code or the logs.

## What we changed

### 1. The key leaves the repo

```bash
git rm --cached android/app/rummy-release.keystore
```
`--cached` removes the file from git's tracking but keeps it on disk.

`.gitignore` now ends with:
```
# Signing keys never go in the repo
*.keystore
*.jks
```
`*.keystore` and `*.jks` match any file with those extensions, so a key can never be added again by accident.

### 2. `build.gradle` reads the key from outside

```groovy
// Locally these come from ~/.gradle/gradle.properties, in CI from env vars.
// Without them the release APK is built unsigned instead of failing.
def signingValue = { String name -> System.getenv(name) ?: project.findProperty(name) }
def releaseStoreFile = signingValue('RUMMY_KEYSTORE_FILE')

signingConfigs {
    release {
        if (releaseStoreFile) {
            storeFile file(releaseStoreFile)
            storePassword signingValue('RUMMY_KEYSTORE_PASSWORD')
            keyAlias signingValue('RUMMY_KEY_ALIAS')
            keyPassword signingValue('RUMMY_KEY_PASSWORD')
        }
    }
}
buildTypes {
    release {
        if (releaseStoreFile) {
            signingConfig signingConfigs.release
        }
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

What each part does:
- `signingValue` is a tiny helper. It first looks for an **environment variable** (that's how CI passes secrets). If there isn't one, it looks for a **Gradle property**, which can live in `~/.gradle/gradle.properties` in your home folder, outside every repo. `?:` means "use the left value if it exists, otherwise the right".
- `if (releaseStoreFile)` handles a machine that doesn't have the key. The release build is then produced **unsigned** instead of crashing. That keeps the project buildable by anyone who clones it.
- The old `debug` signing block is gone. Debug builds now use Android's normal auto-generated debug key, which is fine for local testing.

### 3. CI signs the release APK from secrets

```yaml
- name: Restore signing key
  env:
    KEYSTORE_BASE64: ${{ secrets.RUMMY_KEYSTORE_BASE64 }}
  run: |
    echo "$KEYSTORE_BASE64" | base64 --decode > "$RUNNER_TEMP/rummy-release.jks"
    test -s "$RUNNER_TEMP/rummy-release.jks" || { echo "RUMMY_KEYSTORE_BASE64 secret is missing or empty"; exit 1; }

- name: Build signed release APK
  run: |
    cd android
    ./gradlew assembleRelease --stacktrace
  env:
    CI: true
    RUMMY_KEYSTORE_FILE: ${{ runner.temp }}/rummy-release.jks
    RUMMY_KEYSTORE_PASSWORD: ${{ secrets.RUMMY_KEYSTORE_PASSWORD }}
    RUMMY_KEY_ALIAS: ${{ secrets.RUMMY_KEY_ALIAS }}
    RUMMY_KEY_PASSWORD: ${{ secrets.RUMMY_KEY_PASSWORD }}

- name: Upload release APK
  uses: actions/upload-artifact@v4
  with:
    name: RummyScoreboard-APK
    path: android/app/build/outputs/apk/release/RummyScoreboard.apk
    if-no-files-found: error
    retention-days: 14
```

- A secret can only hold **text**, and a keystore is a binary file. So we store it as **base64**, a way of writing any bytes as plain letters and digits. CI decodes it back into a file.
- `$RUNNER_TEMP` is a scratch folder that GitHub deletes after the job.
- The secret is passed in through `env:` and read as `$KEYSTORE_BASE64`, rather than pasted into the script with `${{ ... }}`. That way the value is never part of the script text, which avoids quoting and injection problems.
- `test -s file` means "the file exists and is not empty". If the secret is missing, the job stops with a clear message instead of a confusing Gradle signing error.
- `if-no-files-found: error` makes the job **fail** when the APK wasn't produced. The default only warns, so a broken build would otherwise look green.
- `assembleRelease` builds the release APK, which is not debuggable. That's the right thing to hand to other people.

## What can go wrong (interview angle)

**"A secret got pushed to a public repo. What do you do?"**
1. **Assume it's compromised.** Bots scan GitHub for secrets within minutes.
2. **Rotate it.** Issue a new secret and stop using the old one. For an API key you'd revoke it at the provider.
3. **Move it to a secret store**: GitHub Secrets, AWS Secrets Manager, or a local file outside the repo.
4. Add guard rails: `.gitignore` rules and a secret-scanning tool in CI.
5. Purging git history (with `git filter-repo`) is optional and cosmetic. The old secret is already burned.

**"Why can't users just update to the new version?"** The phone compares signatures. The new key gives a new signature, so Android says "App not installed". Each user must uninstall once, which wipes the app's data. They should back it up first: in our app, Settings → Export, then Import after reinstalling.

**"How does the Play Store avoid this?"** With **Play App Signing**, Google keeps the real app-signing key. You keep only an **upload key**. If the upload key leaks, Google can reset it, and users never need to reinstall.

**"What if I lose the key?"** You can never ship an update that installs over the existing app again. Back up the `.jks` file and its password.

## From zero, by hand

1. **Install Java**, which provides `keytool`:
   ```bash
   brew install openjdk@17
   ls /opt/homebrew/opt/openjdk@17/bin/keytool
   ```
   Expected: the path prints back.

2. **Create the key**, outside any repo:
   ```bash
   mkdir -p ~/keys && chmod 700 ~/keys
   /opt/homebrew/opt/openjdk@17/bin/keytool -genkeypair \
     -keystore ~/keys/rummy-release.jks -storetype PKCS12 \
     -alias rummy -keyalg RSA -keysize 2048 -validity 10000
   ```
   It asks for a password and your name details. Expected last line: `[Storing /Users/<you>/keys/rummy-release.jks]`.

   Check it:
   ```bash
   /opt/homebrew/opt/openjdk@17/bin/keytool -list -keystore ~/keys/rummy-release.jks
   ```
   Expected: a line like `rummy, 09-Nov-2026, PrivateKeyEntry`.

3. **Untrack the old key and block keys forever:**
   ```bash
   git rm --cached android/app/rummy-release.keystore
   printf '\n# Signing keys never go in the repo\n*.keystore\n*.jks\n' >> .gitignore
   git status --short
   ```
   Expected: `D  android/app/rummy-release.keystore` and ` M .gitignore`.

4. **Edit `android/app/build.gradle`** so the `signingConfigs` and `buildTypes` blocks match section 2 above.

5. **Edit `.github/workflows/build-apk.yml`** so the build steps match section 3 above.

6. **Add the 4 GitHub Secrets:**
   ```bash
   brew install gh && gh auth login
   base64 -i ~/keys/rummy-release.jks | gh secret set RUMMY_KEYSTORE_BASE64 -R TejoVarma/Rummy-Scorecard
   gh secret set RUMMY_KEYSTORE_PASSWORD -R TejoVarma/Rummy-Scorecard   # paste the password when asked
   gh secret set RUMMY_KEY_PASSWORD -R TejoVarma/Rummy-Scorecard        # same password
   gh secret set RUMMY_KEY_ALIAS -R TejoVarma/Rummy-Scorecard -b rummy
   gh secret list -R TejoVarma/Rummy-Scorecard
   ```
   Expected: the 4 names are listed. The values are never shown.

7. **Push and check CI.** The "Build signed release APK" job goes green, and the artifact `RummyScoreboard-APK` contains `RummyScoreboard.apk`.

8. **Confirm the APK is signed with the new key:**
   ```bash
   unzip -p RummyScoreboard.apk META-INF/*.RSA 2>/dev/null | /opt/homebrew/opt/openjdk@17/bin/keytool -printcert | head -3
   ```
   Expected: `Owner: CN=TejoVarma, O=Rummy Scoreboard, C=IN`. Newer APKs may use the v2/v3 signature scheme, which this command can't read. In that case use `apksigner verify --print-certs RummyScoreboard.apk` from the Android build tools.

9. **On each phone:** Export backup → uninstall → install the new APK → Import.
