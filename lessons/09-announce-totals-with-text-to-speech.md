# 09 · Announcing the totals out loud (text-to-speech)

## The problem it solves

At the table, everyone wants the totals after each round, and reading the phone aloud every time gets old. Tejo's decisions:
- say **the totals only**, in **English**
- speak **automatically after each round** when a switch is on
- have a **🔊 button** to replay it at any time

## Everyday analogy: the station announcer

- **The script writer** turns the scoreboard into one sentence: *"Round 6. Ravi 45. Amit 120. Kiran out."*
- **The announcer** is the phone's text-to-speech engine, reading the script aloud.
- **The timetable rule** decides *when* to announce. That's the subtle part. A real announcer doesn't repeat the last train every time someone walks into the station.

## 1. The script writer: a pure function

`src/domain/announce.ts`:

```ts
/** "Round 6. Ravi 45. Amit 120. Kiran out." — or null before the first round. */
export function buildAnnouncement(state: GameState): string | null {
  const { rounds, seats, players, rules } = state;
  if (rounds.length === 0) return null;

  const totals = rounds[rounds.length - 1].cumulativeScores;
  const parts = seats.map(id => {
    const name = players[id]?.name || 'Player';
    const score = totals[id] ?? 0;
    return score >= rules.poolLimit ? `${name} out` : `${name} ${score}`;
  });
  return [`Round ${rounds.length}`, ...parts].join('. ') + '.';
}
```

- It lives in `domain/` because it's game knowledge ("what are the totals, who's out"), not phone plumbing.
- Full stops between parts make the voice **pause**, which is easier to follow at a noisy table.
- `"Kiran out"` instead of `"Kiran 240"`: nobody needs the exact score of a player who's out.
- `null` before round 1 means "nothing to say", so callers simply skip.

## 2. The announcer: the plugin

`@capacitor-community/text-to-speech@8` (version 8, because it has no version for Capacitor 7, which is why we upgraded straight to 8 in lesson 05).

We read the plugin's own files instead of guessing:
- `android/src/main/AndroidManifest.xml` already declares `<queries><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent></queries>`. From Android 11, an app must **declare** which other apps it talks to, and the speech engine is one of them. This gets **merged** into our app's manifest automatically. We confirmed it's in the built APK with `aapt2 dump xmltree ... | grep TTS_SERVICE`.
- `dist/esm/web.js` falls back to the browser's `speechSynthesis` API, so the **same code** speaks in Chrome. That's why the browser tests can exercise it.
- `QueueStrategy.Flush` means a new announcement **interrupts** one still playing. If you edit a round straight after submitting, you hear only the corrected totals.

`src/services/speech.ts`:

```ts
import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';

// Indian English reads names like "Kiran" and "Ravi" more naturally; fall back to the
// phone's default voice when that language isn't installed.
export async function speak(text: string): Promise<void> {
  const options = { text, rate: 0.95, queueStrategy: QueueStrategy.Flush };
  try {
    await TextToSpeech.speak({ ...options, lang: 'en-IN' });
  } catch {
    await TextToSpeech.speak(options);
  }
}
```

`rate: 0.95` is slightly slower than normal, which suits names and numbers.

## 3. The switch (saved setting)

`src/storage/localStorageAdapter.ts`:

```ts
const ANNOUNCE_KEY = 'rummy_announce_after_round_v1';

export function loadAnnounceAfterRound(): boolean {
  try {
    return localStorage.getItem(ANNOUNCE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAnnounceAfterRound(on: boolean): void {
  try {
    localStorage.setItem(ANNOUNCE_KEY, String(on));
  } catch (e) {
    console.error('Failed to save the announce setting', e);
  }
}
```

It's **off by default**. A phone that suddenly starts talking at the table is a surprise nobody asked for. Settings shows it as a switch (`<input type="checkbox" role="switch">`) labelled *"Announce scores after each round · Reads the totals aloud in English"*.

## 4. The timetable rule: *when* to speak

Speak when a round is **submitted or edited**. **Don't** speak when:
- the app opens
- a saved game is resumed
- a new game starts
- someone re-enters
- the switch is turned on

`src/App.tsx`:

```tsx
const lastSeenRound = useRef<{ gameId: string; round: string } | null>(null);

// Speak only when a round is submitted or edited in the game already on screen,
// not when a game is opened, resumed or started.
useEffect(() => {
  const last = state.rounds[state.rounds.length - 1];
  const seen = { gameId: state.gameId, round: last ? `${state.rounds.length}@${last.timestamp}` : '' };
  const previous = lastSeenRound.current;
  lastSeenRound.current = seen;

  if (!previous || previous.gameId !== seen.gameId || previous.round === seen.round) return;
  if (announceAfterRound && last) {
    const text = buildAnnouncement(state);
    if (text) speak(text).catch(e => console.error('Text-to-speech failed', e));
  }
}, [state, announceAfterRound]);
```

How each case plays out:

| What happened | `previous` vs `seen` | Speaks? |
|---|---|---|
| App just opened | `previous` is `null` | No |
| Resumed another game, or started a new one | `gameId` differs | No (just remembered) |
| Round submitted | same game, round count changed | **Yes** |
| Round edited | same game and count, **timestamp** changed (the reducer stamps edits) | **Yes** |
| Re-entry | the reducer updates the last round **without** changing its timestamp | No |
| Switch turned on | rounds unchanged | No |

- `useRef` holds a value that **survives re-renders without causing one**. It's the right tool for "what did I see last time?".
- The `round` key combines **count and timestamp**, so both new rounds and edits count as changes.

The 🔊 button calls `announceScores`, which **does** tell the user if speech fails: *"Couldn't read the scores aloud. Check that a text-to-speech voice is installed on this phone."* The automatic announcement only logs failures, because popping up an alert after every round would be worse than silence.

## The tests

**Unit and component tests** (`src/test/announce.test.tsx`), 8 tests:
- `buildAnnouncement`: `"Round 1. Ravi 0. Amit 24. Kiran 80."`; `"Kiran out"` once over the limit; `null` before round 1.
- The setting is off until switched on, and remembers both on and off.
- In the real `App`, with `speak` mocked:
  - **on**: submitting a round speaks `"Round 2. Ravi 0. Amit 48. Kiran 160."`
  - **off**: nothing is said
  - **opening a saved game**: nothing is said
  - **🔊 button**: speaks even with the switch off

**Proving the key rule:** we removed the "different game or first look" guard, and *"does not speak just because a saved game was opened"* **failed**. Then we restored it.

**End-to-end tests** (`e2e/announce.spec.ts`) run through the **real plugin** in Chrome. `window.speechSynthesis.speak` is swapped for a recorder before the page loads, so the test can read exactly what would have been said:
- 🔊 records `["Round 1. Ravi 0. Amit 24."]`
- Switch on in Settings → reload (the setting survives, and reopening says nothing) → enter round 2 → records `["Round 2. Ravi 24. Amit 24."]`

## Check on the phone (v1.5)

A browser can't check the phone's real voice engine:
1. Tap 🔊 on the scoreboard: you hear the totals.
2. Settings → turn **Announce scores after each round** on → submit a round: it speaks once.
3. Edit that round: you hear the corrected totals.
4. Close the app, reopen and resume the game: it stays **quiet**.
5. If there's no sound at all, check the phone's text-to-speech settings (Settings → Accessibility → Text-to-speech) and media volume.

## What can go wrong (interview angle)

**"How do you trigger a side effect only for certain state changes?"** Remember the previous value in a `useRef`, compare it with the current one, and act only on the transitions you care about. Don't react to every render.

**"Why is the text a separate pure function?"** It can be tested without a phone, a voice or React. The screen and the speech service stay thin.

**"What about Android 11+ package visibility?"** Apps must declare the external services they look up. TTS needs `<queries>` with `TTS_SERVICE`. Here the plugin brings it, and we verified it in the merged manifest.

**"Should failures be silent?"** It depends on who asked. If the user tapped 🔊 and nothing happens, tell them. For the automatic announcement, log it instead of nagging every round.

## From zero, by hand

1. `fnm exec --using=22 -- npm install @capacitor-community/text-to-speech@8`
2. Write `src/test/announce.test.tsx` as in this repo, then run `npx vitest run src/test/announce.test.tsx`. Expected: it fails with *Failed to resolve import "../domain/announce"*.
3. Create `src/domain/announce.ts` and `src/services/speech.ts`, and add `loadAnnounceAfterRound` / `saveAnnounceAfterRound` (plus `ANNOUNCE_KEY`) to the storage adapter, all as above.
4. In `App.tsx`:
   - add the `announceAfterRound` state (initialised with `loadAnnounceAfterRound`)
   - add `handleToggleAnnounce`, `announceScores`, the `lastSeenRound` ref and the effect
   - pass `onAnnounceScores` to `ScoreboardScreen`, and `announceAfterRound` / `onToggleAnnounce` to `SettingsModal`
5. In `ScoreboardScreen.tsx`, add the `onAnnounceScores` prop and a `Volume2` button labelled "Announce scores", shown once there's a round. In `SettingsModal.tsx`, add the two props and the switch.
6. Add `onAnnounceScores={() => {}}` wherever older tests render `ScoreboardScreen`. `tsc` will point to them.
7. Run `npx vitest run`. Expected: `Tests  86 passed (86)`. Run `npm run test:e2e` with `e2e/announce.spec.ts`. Expected: `12 passed`.
8. Bump to `versionCode 6` / `"1.5"`, build and sync. Expected: the sync lists `@capacitor-community/text-to-speech@8.0.2`, and `aapt2 dump xmltree <apk> --file AndroidManifest.xml | grep TTS_SERVICE` prints `TTS_SERVICE`.
9. Do the phone checks above.
