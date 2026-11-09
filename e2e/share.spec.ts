import { test, expect, Page } from '@playwright/test';
import { gameReducer, INITIAL_STATE } from '../src/state/gameReducer';
import { DEFAULT_RULES } from '../src/domain/scoring';
import { GameState } from '../src/domain/types';

// A long game: more rounds than fit on a phone screen, so the table has to scroll.
function longGame(rounds: number): GameState {
  let state = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Sunday Marathon',
      rules: DEFAULT_RULES,
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
        { id: 'p3', name: 'Kiran', avatarColor: '#f59e0b', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2', 'p3'],
      initialDealerIndex: 0,
    },
  });
  for (let i = 0; i < rounds; i++) {
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'custom', points: 2 },
          p3: { type: 'custom', points: 3 },
        },
      },
    });
  }
  return state;
}

async function openSavedGame(page: Page, state: GameState) {
  // Browsers without the Web Share API take the download / clipboard paths, which we can inspect.
  await page.addInitScript(game => {
    if (!localStorage.getItem('rummy_active_game_v1')) {
      localStorage.setItem('rummy_active_game_v1', game);
      localStorage.setItem('rummy_saved_games_list_v1', `[${game}]`);
    }
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'canShare', { value: undefined });
  }, JSON.stringify(state));
  await page.goto('/');
  await page.getByRole('button', { name: /continue game/i }).first().click();
  await page.getByText('Sunday Marathon').first().click();
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('Share as Image downloads a PNG of the whole scoreboard, not just the visible part', async ({ page }) => {
  await openSavedGame(page, longGame(25));

  const scrollArea = page.locator('table').locator('xpath=..');
  const { clientHeight, scrollHeight } = await scrollArea.evaluate(el => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight);

  await page.getByRole('button', { name: 'Share Scorecard' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /share as image/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('Sunday_Marathon-round-25.png');
  const bytes = await download.createReadStream().then(async stream => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  });
  const { height } = pngSize(bytes);
  const pixelRatio = 2;
  expect(height / pixelRatio).toBeGreaterThan(scrollHeight);

  await expect(page.getByRole('button', { name: /share as image/i })).toHaveCount(0);
});

test('Share as Text copies the totals', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  page.on('dialog', dialog => dialog.accept());
  await openSavedGame(page, longGame(3));

  await page.getByRole('button', { name: 'Share Scorecard' }).click();
  await page.getByRole('button', { name: /share as text/i }).click();

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Amit: 6 pts');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Sunday Marathon');
  expect(text).toContain('Rounds: 3');
  expect(text).toContain('Kiran: 9 pts');
});
