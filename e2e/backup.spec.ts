import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gameReducer, INITIAL_STATE } from '../src/state/gameReducer';
import { DEFAULT_RULES } from '../src/domain/scoring';

function savedMatch(title: string) {
  const started = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title,
      rules: DEFAULT_RULES,
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2'],
      initialDealerIndex: 0,
    },
  });
  return gameReducer(started, {
    type: 'SUBMIT_ROUND',
    payload: { roundScores: { p1: { type: 'show', points: 0 }, p2: { type: 'open_drop', points: 24 } } },
  });
}

test('a backup file restores matches on a wiped phone, and restoring adds rather than replaces', async ({ page }) => {
  const original = savedMatch('Saturday Classic');
  await page.addInitScript(game => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('rummy_saved_games_list_v1', `[${game}]`);
      localStorage.setItem('rummy_saved_players_v1', '[{"id":"p1","name":"Ravi"},{"id":"p2","name":"Amit"}]');
    }
  }, JSON.stringify(original));
  page.on('dialog', dialog => dialog.accept());

  await page.goto('/');
  await page.getByTitle('Settings').first().click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /export backup/i }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^rummy_scorecard_backup_\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = await download.path();
  expect(JSON.parse(await readFile(backupPath, 'utf8')).savedGames[0].title).toBe('Saturday Classic');

  // Wipe everything, as if the app's data had been cleared, then add a different match.
  const other = savedMatch('Sunday Rematch');
  await page.evaluate(game => {
    localStorage.clear();
    localStorage.setItem('rummy_saved_games_list_v1', `[${game}]`);
  }, JSON.stringify({ ...other, gameId: 'game_other' }));
  await page.reload();

  await page.getByTitle('Settings').first().click();
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await page.waitForLoadState('load');

  await page.getByRole('button', { name: /continue game/i }).first().click();
  await expect(page.getByText('Saturday Classic')).toBeVisible();
  await expect(page.getByText('Sunday Rematch')).toBeVisible();
});
