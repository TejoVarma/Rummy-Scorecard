# 29 · Moving a match to another phone (match file)

## The problem

Halfway through a game, the person keeping score has to leave, or their battery dies. Someone else needs to carry on from the same round, with the same totals, dealer, drops and re-entries, on **their** phone.

## Everyday analogy

Handing over the scorebook. You don't read the scores out loud for the other person to copy (that's the Text share). You give them **the book itself**. A match file is the scorebook in an envelope: they open it and carry on writing on the next line.

## Why a file, not a QR code

Both were options. I measured a match as JSON:

| Match | Raw | Compressed |
|---|---|---|
| 3 players, 10 rounds | 7.7 KB | ~0.6 KB |
| 6 players, 25 rounds | 32 KB | ~1.4 KB |
| 8 players, 40 rounds | 65 KB | ~2.2 KB |

- A QR code shown on one screen and scanned by another camera is reliable up to about **1 KB**. Long matches (exactly when you'd want to hand over) wouldn't fit.
- A QR scanner needs a camera plugin and the **camera permission**. Right now the app asks for no permissions.
- A file goes through the normal share sheet: WhatsApp, Bluetooth, Quick Share, email. It works when the other person isn't in the room, and size doesn't matter.

**Decision:** match file first. A QR code for small matches can be added later.

## What the file looks like

```json
{
  "kind": "rummy-scorecard-match",
  "version": 1,
  "exportedAt": 1762675200000,
  "game": { "gameId": "...", "title": "Diwali Pool", "rounds": [ ... ], ... }
}
```

- `kind` tells a match file apart from a full backup (which has `savedGames`) and from any random JSON.
- `version` lets a future app version change the format. An old app refuses a newer file with "Update the app first" instead of misreading it.
- `game` is the exact `GameState` the app already saves, so nothing has to be converted.

## The code

**Making the file** (`src/storage/localStorageAdapter.ts`):

```ts
export function exportMatch(game: GameState): string {
  return JSON.stringify({ kind: MATCH_FILE_KIND, version: MATCH_FILE_VERSION, exportedAt: Date.now(), game });
}
```

**Sharing it** (`ScoreboardScreen.tsx`): Share now offers **Image**, **Text** and **Match file**. The match file reuses `shareTextFile`, the same helper the backup uses. On Android it writes the file to the app's cache folder and opens the share sheet. In a browser it downloads it.

```ts
} else if (kind === 'match') {
  await shareTextFile(exportMatch(state), scorecardFileName(state, 'json'), shareTitle);
}
```

The file is named after the match and round, for example `Diwali_Pool-round-2.json`.

**Reading it** (`readMatchFile`): checks, in order, that it parses as JSON → is a backup (if so, "restore it from Settings") → has the right `kind` → isn't from a newer version → contains a valid match (`isValidGameState`, the same deep check used for backups: every round, score type, seat and deal). It returns either `{ ok: true, game }` or `{ ok: false, message }`. Nothing is written while checking.

**Saving it** (`importMatch`), three cases:

| Phone already has… | What happens | Outcome |
|---|---|---|
| nothing with this `gameId` | added to the saved list | `added` |
| an older copy (fewer rounds) | replaced by the file's copy | `updated` |
| a copy that's further along | the phone copy is kept and opened, with a message | `kept_phone_copy` |

"Further along" uses the same `isFurtherAlong` rule as backups: more rounds wins, then a deal-settled copy, then the more recent change. So **importing an old file never loses rounds**. If the match is the one currently open, the open slot is updated too. Otherwise the app's next auto-save would write the old on-screen copy back over the import.

**The button** (`ContinueGameScreen.tsx`): "Import match from another phone", below the list, and also on the empty screen. It opens the phone's file picker. After a good import, the match opens straight on the scoreboard.

```tsx
<input type="file" aria-label="Import a match file" onChange={handleImportFile} className="hidden" />
```

There's deliberately **no `accept=".json"` filter**. Android's picker filters by file *type*, and chat apps often save a `.json` file with a generic type, which would grey it out. Since the contents are checked anyway, the filter adds risk and no safety.

## What it does not do

- **It's a hand-over, not live sync.** If both phones keep scoring the same match, each has its own version. One person scores at a time. Importing the same match again keeps whichever copy is further along.
- **The match's players aren't added to your Players list.** That avoids two different "Ravi"s with different ids. The match carries its own players.
- **Tapping the file in WhatsApp → "Open with Rummy Scoreboard"** needs an Android *intent filter* and native code. It's not built yet. You save the file, then import it from inside the app.

## Tests

- `src/test/matchTransfer.test.tsx` (27 tests): round trip, wrong file, backup file, newer version, damaged match, absurd stake, built-in seat names, every import outcome (added, updated after asking, declined, already here, kept phone copy, refused for unreadable data), updating the open match, roster untouched, phone full, and the Continue Game button (opens the match, explains a bad file, explains "already further along").
- `src/test/shareScorecard.test.tsx`: Share as Match file produces a file that `readMatchFile` reads back as the same match.
- `e2e/matchTransfer.spec.ts`: two separate browser contexts act as two phones. Phone A shares the match (downloaded). Phone B starts empty, imports it, sees totals `0, 48`, plays a round (`24, 48`), then imports the **old** file again, and the totals stay `24, 48`.
- **Proved by sabotage:** disabling the "keep the phone copy" check and the "update the open match" step made 3 tests fail. With them back, all pass.

## What the reviewers caught (and the fixes)

Three reviewers (security, React, silent failures) read the change. Nothing critical. What they confirmed, all fixed test-first:

| Finding | Fix |
|---|---|
| **A crafted file could freeze the app.** A stake like `7.9e295` passed validation (it's a finite number). On the Deal screen, the rounding step computes "rupees left to hand out" as `pool − sum of floors`, and at that size float error makes it astronomically large, so the loop never ends | Imports also run `validateRules` (whole numbers, sensible order, stake **≤ ₹10 crore**). The rounding loop is capped at one extra rupee per player, which is all it ever legitimately needs |
| A seat named `"constructor"` passed as a player, because `players["constructor"]` finds a built-in function on every JS object | `Object.prototype.hasOwnProperty.call(players, id)`: only the object's **own** keys count |
| The 5 MB backup size limit was reused for one match | Match files have their own **1 MB** limit (a real one is under 100 KB) |
| Importing silently replaced the phone's older copy, so a wrong or forged file could rewrite a match | It **asks first**: "This phone already has "Diwali Pool" (2 rounds). Replace it with the copy in this file (5 rounds)?" Saying no changes nothing |
| An identical copy got the message "this phone has it further along" | A separate `already_here` outcome. It just opens, with no message |
| A **damaged** saved copy of the same match was overwritten (it might have been the real one) | Refused: "This phone has a copy of this match that can't be read, so it wasn't replaced." |
| If the whole saved list was unreadable, the import replaced it, including the Android copy | Refused, and nothing changes |
| The open match could be ahead of its saved copy (after a failed save) and get replaced | The open match counts as "the phone's copy" too, so whichever is further along wins |
| If opening the scoreboard failed, the message said "out of space" although the match had been saved | Saving and opening are handled separately, each with its own message |

**Lesson:** a file from another person is **untrusted input**, even from a friend. "Is it the right shape?" (`isValidGameState`) isn't enough. Also ask "are the values sensible?" (`validateRules`), and check every loop whose length comes from the data.

## What can go wrong (interview angle)

**"How do you move state between two devices with no server?"** Serialise it to a versioned, self-describing format (`kind` + `version`), move it over any channel (share sheet), and validate it fully on the way in. Treat an incoming file like user input from a stranger.

**"What if someone imports an old copy?"** Merge, don't overwrite. Pick a rule for "which copy is newer" (here: more rounds, then settled, then timestamp) and use the **same** rule everywhere (backups and match files).

**"Why not a QR code?"** Capacity. A screen-to-camera QR is reliable to about 1 KB, and a long match is bigger. It would also need a camera permission. Measure before choosing.

**"Why version the file?"** So an old app can recognise a file it doesn't understand and refuse clearly, instead of half-reading it.

## From zero, by hand

1. In `localStorageAdapter.ts`, add `exportMatch`, `readMatchFile` and `importMatch` (as above; `importMatch` reuses `readRawList`, `entryId`, `isFurtherAlong`, `writeList`, `writeLocal` and `mirror`).
2. In `ShareMenu.tsx`, add `'match'` to `ShareKind` and an option `{ kind: 'match', label: 'Match file', hint: 'Continue on another phone', Icon: Smartphone }`. Give the buttons `last:odd:col-span-2`, so a third option takes the full width.
3. In `ScoreboardScreen.tsx`, handle `kind === 'match'` with `shareTextFile(exportMatch(state), scorecardFileName(state, 'json'), shareTitle)`. In `share.ts`, let `scorecardFileName` take the extension.
4. In `ContinueGameScreen.tsx`, add the hidden file input, the button, and `handleImportFile`: size check → `FileReader.readAsText` → `readMatchFile` → `importMatch` → `onResumeGame(game)`.
5. Run `npx vitest run src/test/matchTransfer.test.tsx`. Expected: `27 passed`. Then run `npx playwright test e2e/matchTransfer.spec.ts`. Expected: `1 passed`.
6. Run everything: `npx vitest run && npm run lint && npx tsc -b && npm run test:e2e`. Expected: `255 passed`, clean, clean, `16 passed`.
7. On two phones: Share → Match file → WhatsApp. On the other phone, save the file, then go to Continue Game → Import match from another phone, pick it, and the scoreboard opens on the right round.
