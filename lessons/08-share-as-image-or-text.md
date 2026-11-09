# 08 · Share the scorecard as an Image or as Text

## The problem it solves

The Share button already had code to turn the scoreboard into a picture, but **on the phone it skipped that and always sent text**. The image path only ran in a desktop browser. Even there, the picture only showed **what fitted on screen**, so in a long game the later rounds were cut off.

Tejo's decision: one **Share** button that asks **Image or Text**, and the user picks.

## Everyday analogy: posting a photo of a whiteboard

1. **Take the photo.** `html-to-image` draws the scoreboard's HTML onto a canvas and saves it as a PNG. It's a screenshot of **one element**, not the whole screen.
2. **Put the print in an envelope.** The web page can't hand raw bytes to Android, so we write the PNG as **base64** (the image spelled out in plain letters). The **Filesystem** plugin saves it as a real file in the app's **cache folder**, a scratch drawer Android may empty whenever it likes. That's fine for a file we only need for a few seconds.
3. **Hand the envelope to the postman.** The **Share** plugin gets the file's address. Android won't let WhatsApp read our private folders, so Capacitor wraps the file in a **FileProvider** link: a temporary, read-only pass for that one file. Our `AndroidManifest.xml` already declares a FileProvider, and `res/xml/file_paths.xml` allows the cache folder.

## Where the code lives

All the sharing logic is in **`src/services/share.ts`**. The screen only calls it. That keeps the screen simple and makes the logic testable on its own.

### 1. The text summary is a pure function

```ts
export function buildScorecardText(state: GameState): string {
  const { title, rules, seats, players, rounds, dealSplit } = state;
  const latest = rounds.length > 0 ? rounds[rounds.length - 1].cumulativeScores : {};
  const entryAmount = rules.entryAmount ?? 0;
  const reEntries = seats.reduce((sum, id) => sum + (players[id]?.reEntryCount ?? 0), 0);
  const totalPool = entryAmount * (seats.length + reEntries);

  const lines = [
    `🎴 *Rummy Scorecard: ${singleLine(title)}*`,
    `Pool: ${rules.poolLimit}${entryAmount > 0 ? ` | Prize Pool: ₹${totalPool}` : ''} | Rounds: ${rounds.length}`,
  ];
  // ...deal payouts if settled, then one line per player: "Amit: 80 pts" or "Amit: 210 pts (Out)"
  return lines.join('\n');
}
```

A **pure function**: the same game in gives the same text out, with no screen, no clicks and no plugins involved. That means it can be unit-tested directly. It used to live inside the click handler, where it couldn't be tested. The `*stars*` make text **bold in WhatsApp**.

### 2. Capturing the **whole** scoreboard

```ts
export async function captureElement(node: HTMLElement, scrollArea: HTMLElement | null): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  const saved = [node, scrollArea].map(el => (el ? el.getAttribute('style') : null));

  try {
    if (scrollArea) {
      Object.assign(scrollArea.style, { overflow: 'visible', flex: 'none', height: 'auto' });
    }
    Object.assign(node.style, { overflow: 'visible', flex: 'none', height: 'auto' });

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#0f172a';
    const blob = await toBlob(node, {
      pixelRatio: 2,
      backgroundColor: bg,
      cacheBust: true,
      width: node.scrollWidth,
      height: node.scrollHeight,
    });
    if (!blob) throw new Error('The scorecard image came out empty');
    return blob;
  } finally {
    // put every style back exactly as it was
  }
}
```

- The rounds table sits in a box with a fixed height that **scrolls**. A screenshot of that box only shows the visible part.
- So, **only for the capture**, we let the box grow to its full height (`overflow: visible; height: auto`), then pass `scrollWidth` and `scrollHeight`, the size of *all* the content, to `toBlob`.
- `finally` puts the original styles back **even if the capture fails**, so the screen never stays broken.
- `pixelRatio: 2` gives a sharp image on phone screens.
- `await import('html-to-image')` is a **dynamic import**. That library is only downloaded when someone actually shares an image, so app start-up stays light.

### 3. Image: native and web paths behind one function

```ts
export async function shareImage(blob: Blob, fileName: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // Android can only hand other apps a real file, so write it to the cache folder first.
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    });
    await Share.share({ title, files: [uri], dialogTitle: 'Share Rummy Scorecard' });
    return;
  }

  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return;
  }
  // otherwise: download the PNG
}
```

- `Capacitor.isNativePlatform()` is `true` inside the Android app and `false` in a browser.
- `blobToBase64` uses a `FileReader` to turn the image into a `data:image/png;base64,....` string, and keeps only the part after the comma.
- In a browser, the **Web Share API** is used if it can share files (mobile Chrome), and otherwise the PNG is downloaded.

`shareText` follows the same pattern. It uses the native share sheet on the phone, Web Share in a browser, and the clipboard as a last resort.

### 4. "Closing the share sheet" is not an error

```ts
// Closing the share sheet is not an error: browsers reject with an AbortError,
// and Capacitor's Android Share plugin rejects with the message "Share canceled".
export function isShareCancelled(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ('name' in err && err.name === 'AbortError') return true;
  return 'message' in err && err.message === 'Share canceled';
}
```

We read the plugin's **source** (`node_modules/@capacitor/share/android/.../SharePlugin.java` contains `call.reject("Share canceled")`) to learn exactly what it does when the user backs out. This uncovered a **hidden bug in the old code**: on the phone, closing the share sheet was treated as a failure, and the error handler **opened the share sheet a second time**.

### 5. The screen

`ScoreboardScreen.tsx`:
- The header Share button now just opens a **choice**: a `Modal` titled "Share scorecard" with two large buttons, **Image** ("Picture of the full scoreboard") and **Text** ("Totals as a message").
- While one is working, it shows a spinner and both buttons are disabled, so a double tap can't start two shares.
- On success the choice closes. On a real failure the user is **told**: *"Couldn't create the scorecard image. Try Share as Text instead."* The old code failed silently.

## The tests

**Unit and component tests** (`src/test/shareScorecard.test.tsx`), 8 tests:
- `buildScorecardText`: title, pool, rounds and totals; the ₹ prize pool when there's a stake; "(Out)" for knocked-out players; a two-line title stays on one line.
- `isShareCancelled`: browser and Android cancels count as cancels; a real error, `null` or a plain string do not.
- Share button: tapping it shows **Share as Image** and **Share as Text**. Choosing Text calls `shareText` with the summary, and never calls `shareImage`.

`vi.mock('../services/share', ...)` replaces only `shareText` and `shareImage` with fakes (`importOriginal` keeps the real `buildScorecardText`). The component test then checks *which* share was requested, without a real share sheet.

**End-to-end tests** (`e2e/share.spec.ts`), in a real phone-sized Chrome:
- **Image:** loads a **25-round** game (built with the real reducer and placed in `localStorage` before the page loads), confirms the table really scrolls, taps Share → Image, catches the **download**, and reads the PNG's header to get its real height. The file must be named `Sunday_Marathon-round-25.png` and be **taller than the whole table**.
- **Text:** taps Share → Text, then reads the clipboard: `Amit: 6 pts`, `Kiran: 9 pts`, `Rounds: 3`.

The tests switch off `navigator.share` so the browser takes the download and clipboard paths, which a test can inspect.

**Proving the image test can fail:** with the "grow to full height" lines removed, it fails:
```
Expected: > 1113
Received:   582
1 failed
```
That's exactly the "cut off at the screen edge" bug. Then we restored the code.

## What a browser test can't check

The **native** path (Filesystem → FileProvider → Android share sheet → WhatsApp) only runs in the Android app. Check it on the phone with APK v1.4:
1. Share → **Image** → WhatsApp: a picture of the full scoreboard arrives, including the rounds you'd have to scroll to see.
2. Share → **Text** → WhatsApp: the message arrives, with bold title.
3. Open the share sheet and **back out**: no error message, and the sheet does **not** reopen.

## What can go wrong (interview angle)

**"How does a hybrid app share a file with another app?"** Write the file into app-private storage (the cache folder). Share a `content://` URI through a **FileProvider**, which grants temporary read access to that one file. Never make files world-readable.

**"Why the cache folder?"** It's for temporary files. Android can clear it when space runs low, so shared images don't pile up.

**"Why move logic out of the component?"** Pure functions and services are easy to test and reuse. The component becomes a thin layer: show buttons, call the service, show results.

**"How do you know an error is really an error?"** Read what the API actually does, including the source when the docs are silent. User cancellation should be silent. Real failures should be **visible** to the user, with a way forward.

## From zero, by hand

1. `fnm exec --using=22 -- npm install @capacitor/filesystem@8`
2. Write `src/test/shareScorecard.test.tsx` as in this repo, then run `npx vitest run src/test/shareScorecard.test.tsx`. Expected: `6 failed` (the functions and the choice don't exist yet).
3. Write `src/services/share.ts` with `isShareCancelled`, `buildScorecardText`, `shareText`, `captureElement`, `shareImage` and `scorecardFileName` as above.
4. In `ScoreboardScreen.tsx`:
   - replace `handleShareScorecard` with `handleShare(kind)`
   - add `isShareMenuOpen` and `sharingAs` state and `scoreTableScrollRef` (on the scrolling table box)
   - make the header button open the choice
   - add the "Share scorecard" `Modal` with the Image and Text buttons
   - remove the unused `Capacitor` and `Share` imports
5. Run `npx vitest run`. Expected: `Tests  78 passed (78)`.
6. Write `e2e/share.spec.ts` as in this repo, then run `npm run test:e2e`. Expected: `10 passed`.
7. Bump to `versionCode 5` / `versionName "1.4"`, then build and sync. `npx cap sync android` must list `@capacitor/filesystem@8.x` among the plugins. Then `./gradlew assembleRelease`.
8. Run the three phone checks above.
