import { test, expect, Page } from '@playwright/test';
import { gameReducer, INITIAL_STATE } from '../src/state/gameReducer';
import { DEFAULT_RULES } from '../src/domain/scoring';

function matchAfterTwoRounds() {
  let state = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Diwali Pool',
      rules: DEFAULT_RULES,
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2'],
      initialDealerIndex: 0,
    },
  });
  for (let i = 0; i < 2; i++) {
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: { roundScores: { p1: { type: 'show', points: 0 }, p2: { type: 'open_drop', points: 24 } } },
    });
  }
  return state;
}

async function totals(page: Page): Promise<string[]> {
  const cells = page.locator('table tbody tr').last().locator('td');
  return (await cells.allInnerTexts()).map(t => t.trim());
}

test('a match shared from one phone opens on another and carries on from the same round', async ({ browser }) => {
  // Phone A: the match in progress. Without the Web Share API the file is downloaded instead.
  const phoneA = await (await browser.newContext()).newPage();
  await phoneA.addInitScript(game => {
    localStorage.setItem('rummy_active_game_v1', game);
    localStorage.setItem('rummy_saved_games_list_v1', `[${game}]`);
    Object.defineProperty(navigator, 'share', { value: undefined });
  }, JSON.stringify(matchAfterTwoRounds()));
  await phoneA.goto('/');
  await phoneA.getByRole('button', { name: /continue game/i }).first().click();
  await phoneA.getByText('Diwali Pool').first().click();
  await phoneA.getByTitle('Share Scorecard').click();
  const downloading = phoneA.waitForEvent('download');
  await phoneA.getByRole('button', { name: /share as match file/i }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('Diwali_Pool-round-2.json');
  const matchFile = await download.path();

  // Phone B: a fresh phone with nothing saved.
  const phoneB = await (await browser.newContext()).newPage();
  await phoneB.goto('/');
  await phoneB.getByRole('button', { name: /continue game/i }).first().click();
  await expect(phoneB.getByText('No Saved Games')).toBeVisible();
  await phoneB.getByLabel('Import a match file').setInputFiles(matchFile);

  await expect.poll(() => totals(phoneB)).toEqual(['0', '48']);

  await phoneB.getByRole('button', { name: 'ENTER SCORE' }).click();
  await phoneB.getByRole('group', { name: 'Ravi', exact: true }).getByRole('button', { name: 'Drop', exact: true }).click();
  await phoneB.getByRole('group', { name: 'Amit', exact: true }).getByRole('button', { name: 'Show', exact: true }).click();
  await phoneB.getByRole('button', { name: 'SUBMIT' }).click();
  await expect.poll(() => totals(phoneB)).toEqual(['24', '48']);

  // Importing the old file again must not undo the round just played.
  phoneB.on('dialog', dialog => dialog.accept());
  await phoneB.getByRole('button', { name: 'Back' }).first().click();
  await phoneB.getByRole('button', { name: /continue game/i }).first().click();
  await phoneB.getByLabel('Import a match file').setInputFiles(matchFile);
  await expect(phoneB.getByRole('button', { name: 'ENTER SCORE' })).toBeVisible();
  await expect.poll(() => totals(phoneB)).toEqual(['24', '48']);
});
