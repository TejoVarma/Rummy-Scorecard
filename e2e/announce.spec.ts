import { test, expect, Page } from '@playwright/test';
import { gameReducer, INITIAL_STATE } from '../src/state/gameReducer';
import { DEFAULT_RULES } from '../src/domain/scoring';

function oneRoundGame() {
  const started = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Voice Night',
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
    payload: {
      roundScores: {
        p1: { type: 'show', points: 0 },
        p2: { type: 'open_drop', points: 24 },
      },
    },
  });
}

// Replace the browser's speech engine with a recorder, so the test can read what would be said.
async function openGameWithRecordedSpeech(page: Page) {
  await page.addInitScript(game => {
    if (!localStorage.getItem('rummy_active_game_v1')) {
      localStorage.setItem('rummy_active_game_v1', game);
      localStorage.setItem('rummy_saved_games_list_v1', `[${game}]`);
    }
    const spoken: string[] = [];
    (window as unknown as { spoken: string[] }).spoken = spoken;
    window.speechSynthesis.speak = utterance => {
      spoken.push(utterance.text);
      setTimeout(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent), 0);
    };
  }, JSON.stringify(oneRoundGame()));
  await page.goto('/');
  await page.getByText('Ongoing Game').click();
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);

test('the speaker button reads the current totals', async ({ page }) => {
  await openGameWithRecordedSpeech(page);
  await page.getByRole('button', { name: 'Announce scores' }).click();
  await expect.poll(() => spoken(page)).toEqual(['Round 1. Ravi 0. Amit 24.']);
});

test('with the setting on, a new round is announced automatically', async ({ page }) => {
  await openGameWithRecordedSpeech(page);

  await page.getByTitle('Settings').first().click();
  await page.getByRole('switch').check();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByText('Ongoing Game').click();
  expect(await spoken(page)).toEqual([]);

  await page.getByRole('button', { name: 'ENTER SCORE' }).click();
  const card = (name: string) =>
    page.getByRole('group', { name, exact: true });
  await card('Ravi').getByRole('button', { name: 'Drop', exact: true }).click();
  await card('Amit').getByRole('button', { name: 'Show', exact: true }).click();
  await page.getByRole('button', { name: 'SUBMIT' }).click();

  await expect.poll(() => spoken(page)).toEqual(['Round 2. Ravi 24. Amit 24.']);
});
