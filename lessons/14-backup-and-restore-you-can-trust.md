# 14 · Backup and restore you can trust

## The problem it solves

Settings has **Export Backup** and **Restore Data**. Both directions had risks:

| Problem | What could happen |
|---|---|
| Restore **replaced everything, without asking** | Picking an old backup wiped newer matches. It even said "Successfully restored 0 matches" after wiping them |
| Restore wrote **players before checking the games** | A bad file could change some data and not the rest |
| **Shallow checks, no version or size limit** | A wrong or huge file could freeze the app or load broken data |
| Export on the phone sent the whole backup **as a text message** | Big backups can exceed Android's limit for shared text and fail |
| An unreadable or empty file **did nothing** | No message at all |

## Everyday analogy: moving boxes into a furnished house

1. **Check every box at the door before carrying anything in** (validate the whole file first, write nothing until it passes).
2. **Tell the owner what's arriving and ask** ("12 matches and 6 players. OK?").
3. **Add what's missing, don't throw out what's there** (merge, don't replace). If the same match is in both, keep the copy with **more rounds played**.
4. **Pack the backup as a proper box** (a `.json` file), not shouted through the letterbox (a giant text message).

## Step 1: check the whole file, write nothing

`src/storage/localStorageAdapter.ts`:

```ts
export const MAX_BACKUP_BYTES = 5_000_000;
const BACKUP_VERSION = 1;
const NOT_A_BACKUP = 'This is not a Rummy Scorecard backup file.';

/** Reads and checks a whole backup file without writing anything. */
export function readBackup(json: string): { ok: true; backup: RestorableBackup } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: NOT_A_BACKUP };
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.savedGames) || !Array.isArray(parsed.savedPlayers)) {
    return { ok: false, message: NOT_A_BACKUP };
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    return { ok: false, message: 'This backup was made by a newer version of the app. Update the app first.' };
  }

  const games = parsed.savedGames.filter(isValidGameState);
  const active = parsed.activeGame;
  if (isValidGameState(active) && !games.some(g => g.gameId === active.gameId)) games.unshift(active);

  return {
    ok: true,
    backup: {
      games,
      players: parsed.savedPlayers.filter(isRosterPlayer),
      skippedGames: parsed.savedGames.length - parsed.savedGames.filter(isValidGameState).length,
    },
  };
}
```

- The return type is a **discriminated union**: `{ ok: true, backup }` or `{ ok: false, message }`. After `if (!result.ok)`, TypeScript knows `result.message` exists. Otherwise it knows `result.backup` exists. The caller can't forget to handle the error case.
- **Version check:** files carry `version: 1`. A file from a *newer* app version is refused with a clear message instead of being half-understood. That's forward compatibility.
- Each match is checked with `isValidGameState`, which since lesson 03 checks every round. Damaged ones are **counted**, so the user can be told.

## Step 2: merge, never replace

```ts
export async function restoreBackup(
  backup: RestorableBackup
): Promise<{ added: number; updated: number; playersAdded: number }> {
  const list = readRawList() ?? [];
  let added = 0;
  let updated = 0;

  for (const incoming of backup.games) {
    const index = list.findIndex(entry => entryId(entry) === incoming.gameId);
    if (index < 0) {
      list.push(incoming);
      added++;
      continue;
    }
    const existing = list[index];
    const existingRounds = isValidGameState(existing) ? existing.rounds.length : -1;
    if (incoming.rounds.length > existingRounds) {
      list[index] = incoming;
      updated++;
    }
  }

  const roster = loadPlayerRoster();
  const known = new Set(roster.map(p => p.id));
  const newPlayers = backup.players.filter(p => !known.has(p.id));

  if (!(await writeList(list))) throw new Error('Could not store the restored matches');
  if (newPlayers.length > 0 && !savePlayerRoster([...roster, ...newPlayers])) {
    throw new Error('Could not store the restored players');
  }
  await mirrorQueue;

  return { added, updated, playersAdded: newPlayers.length };
}
```

- Matches are matched by `gameId`. A match **in both** keeps the copy with **more rounds**, since the further-played copy is the one you want. An unreadable local entry (`-1`) loses to any valid incoming copy.
- New players are added. **Existing names are kept** (you may have renamed someone since).
- **The match currently open isn't touched.** Restoring shouldn't swap the game in front of you.
- If the phone can't store the result, it **throws**, and Settings shows *"Couldn't restore the backup"* instead of a false success (added after the Phase 4 review, lesson 16).
- `await mirrorQueue` waits until the Android copy has every write (the ordered queue from lesson 13) **before** the app reloads.

## Step 3: Settings asks, explains and reports

`src/components/settings/SettingsModal.tsx`:

```tsx
const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) {
    alert('That file is too big to be a Rummy Scorecard backup.');
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => alert("Couldn't read that file. Please pick the backup again.");
  reader.onload = async () => {
    const result = readBackup(String(reader.result ?? ''));
    if (!result.ok) {
      alert(result.message);
      return;
    }
    // ...empty backup → say so
    const ok = window.confirm(
      `Restore 1 match and 1 player from this backup?\n\n` +
        `Nothing you already have will be deleted. If a match is in both, the copy with more rounds is kept.`
    );
    if (!ok) return;
    const { added, updated, playersAdded } = await restoreBackup(result.backup);
    alert(`Restored ${added} new and ${updated} updated matches, and ${playersAdded} new players.`);
    window.location.reload();
  };
  reader.readAsText(file);
};
```

- **The size check comes before reading.** `file.size` is known without reading the file, so a huge file never freezes the app.
- `reader.onerror` covers files the phone can't read.
- `e.target.value = ''` resets the file input, so picking the **same** file again still fires `onChange`.
- The confirm states the counts and promises that nothing is deleted. If damaged matches were found, it adds *"N damaged match(es) in the file will be skipped."*
- After restoring it reports exactly what changed, then reloads so the app reads the merged data.

## Step 4: export a real file

`src/services/share.ts`:

```ts
/** Hands a text file (such as a backup) to the share sheet on the phone, or downloads it in a browser. */
export async function shareTextFile(text: string, fileName: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title, files: [uri], dialogTitle: title });
    return;
  }
  // ...browser: download as application/json
}
```

It's the same route as the scorecard image (lesson 08). The difference is `encoding: Encoding.UTF8`, which writes **text** (without it, Filesystem expects base64 data). On the phone you get `rummy_scorecard_backup_2026-11-09.json`, which you can save to Drive or send on WhatsApp. Closing the share sheet isn't treated as an error (`isShareCancelled`).

## The tests

**Unit and component tests** (`src/test/backup.test.tsx`, 11 tests, with the in-memory Preferences fake from lesson 13):
- Rejects not-JSON, a newer version, and missing lists, each with the right message.
- Counts damaged matches to skip, and includes the active match when it isn't in the list.
- **Merge:** existing g1 kept plus g2 added, Kiran added next to Ravi, giving `{ added: 1, updated: 0, playersAdded: 1 }`.
- **More rounds wins:** local g1 has 5 rounds vs backup 2 → keep local. Local g2 has 1 vs backup 4 → take the backup.
- The open match is untouched.
- **Round trip:** what `exportAllData` writes, `readBackup` reads.
- **Settings:** the confirm shows "1 match … 1 player" and "nothing you already have will be deleted", and saying **no** changes nothing. A file one byte over the limit gets "too big" without being read. A text file gets "not a Rummy Scorecard backup".

The old `importAllData` test was **ported** to `readBackup` + `restoreBackup`, because it checks a real behaviour (export then restore gives everything back).

**End-to-end** (`e2e/backup.spec.ts`), in real Chrome:
1. A saved match "Saturday Classic" → Settings → **Export Backup**. A real `rummy_scorecard_backup_YYYY-MM-DD.json` downloads, and the test reads it.
2. Wipe all storage and add a different match, "Sunday Rematch". Reload.
3. Settings → choose the downloaded file in the real file input → accept the confirm and report.
4. Continue Game lists **both** matches.

Totals: **148/148** unit tests, **14/14** browser tests, build ✅.

## What can go wrong (interview angle)

**"How do you design an import feature safely?"**
- Validate the entire input before any write (so it's all or nothing).
- Show the user what will happen and get consent.
- Prefer merge over replace.
- Version your file format.
- Cap the size before reading.
- Report the outcome precisely.

**"Why a discriminated union for results?"** It makes the error path impossible to ignore at compile time. TypeScript forces you to check `ok` before touching `backup`.

**"What's the conflict rule when merging?"** Decide explicitly and document it. Here it's "more rounds wins", because rounds only ever go up during a game. Other apps use "last modified wins", or ask the user.

## From zero, by hand

1. Write `src/test/backup.test.tsx` as in this repo. Run it. Expected: failures (the functions don't exist).
2. In `localStorageAdapter.ts`, delete `importAllData`. Add `MAX_BACKUP_BYTES`, `BACKUP_VERSION`, `NOT_A_BACKUP`, `RestorableBackup`, `isRosterPlayer`, `readBackup` and `restoreBackup` as above.
3. In `share.ts`, import `Encoding` and add `shareTextFile`.
4. In `SettingsModal.tsx`, replace `handleExportData` and `handleImportFile` with the versions above. Import `readBackup`, `restoreBackup`, `MAX_BACKUP_BYTES`, `shareTextFile` and `isShareCancelled`. Remove the `Capacitor`/`Share` imports.
5. Port the old test in `localStorageAdapter.test.ts` to `readBackup` + `restoreBackup` (make it `async`).
6. Add `e2e/backup.spec.ts`.
7. Run `npx vitest run && npx tsc -b && npm run lint && npm run build && npm run test:e2e`. Expected: `148 passed`, clean, clean, `built in …`, `14 passed`.
