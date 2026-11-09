import { test, expect } from '@playwright/test';
import { gameReducer, INITIAL_STATE } from '../src/state/gameReducer';
import { DEFAULT_RULES } from '../src/domain/scoring';

// Four players at ₹500 (pool ₹2000). Dev is put out in round 1, leaving three:
// Ravi 0 pts (8 drops), Amit 24 (7 drops), Kiran 80 (5 drops).
// Stakes back: ₹1500. ₹500 left, too little for 20 drops, so it's shared 8 : 7 : 5.
function fourPlayerGame() {
  const started = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Drop Deal Night',
      rules: { ...DEFAULT_RULES, entryAmount: 500 },
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
        { id: 'p3', name: 'Kiran', avatarColor: '#f59e0b', reEntryCount: 0 },
        { id: 'p4', name: 'Dev', avatarColor: '#ef4444', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2', 'p3', 'p4'],
      initialDealerIndex: 0,
    },
  });
  return gameReducer(started, {
    type: 'SUBMIT_ROUND',
    payload: {
      roundScores: {
        p1: { type: 'show', points: 0 },
        p2: { type: 'open_drop', points: 24 },
        p3: { type: 'full_count', points: 80 },
        p4: { type: 'out', points: 201 },
      },
    },
  });
}

test('the deal screen splits by drops: stakes back, then drops, then the rest equally', async ({ page }) => {
  await page.addInitScript(game => {
    if (!localStorage.getItem('rummy_active_game_v1')) {
      localStorage.setItem('rummy_active_game_v1', game);
      localStorage.setItem('rummy_saved_games_list_v1', `[${game}]`);
    }
  }, JSON.stringify(fourPlayerGame()));
  await page.goto('/');
  await page.getByText('Ongoing Game').click();

  await page.getByRole('button', { name: /^deal$/i }).click();
  await page.getByRole('button', { name: /by drops/i }).click();

  await expect(page.getByText('0 pts · 8 drops')).toBeVisible();
  await expect(page.getByText('24 pts · 7 drops')).toBeVisible();
  await expect(page.getByText('80 pts · 5 drops')).toBeVisible();
  for (const amount of ['₹700', '₹675', '₹625']) {
    await expect(page.getByText(amount, { exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: /accept deal/i }).click();
  await page.getByRole('button', { name: /yes, finalize deal/i }).click();
  await expect(page.getByRole('button', { name: /view prize pool settlement/i })).toBeVisible();
});
