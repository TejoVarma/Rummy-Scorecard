import { test, expect, Page, Locator } from '@playwright/test';

async function startGame(page: Page, players: string[], stake?: number) {
  await page.goto('/');
  await page.getByRole('button', { name: /start new game/i }).click();
  await expect(page.getByRole('heading', { name: 'New Game' })).toBeVisible();

  if (stake !== undefined) {
    await page.getByPlaceholder('0').fill(String(stake));
  }

  await page.getByRole('button', { name: 'SELECT PLAYERS' }).click();
  for (const name of players) {
    await page.getByRole('button', { name: /add new player/i }).click();
    await page.getByPlaceholder('Player name').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await page.getByRole('button', { name: new RegExp(`Done \\(${players.length}\\)`) }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
}

function playerCard(page: Page, name: string): Locator {
  return page
    .getByText(name, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
}

// The last row of the score table holds each player's running total, in seat order.
async function totals(page: Page): Promise<string[]> {
  const cells = page.locator('table tbody tr').last().locator('td');
  return (await cells.allInnerTexts()).map(t => t.trim());
}

async function enterRound(page: Page, picks: Record<string, string>) {
  await page.getByRole('button', { name: 'ENTER SCORE' }).click();
  await expect(page.getByRole('heading', { name: 'Add Round Scores' })).toBeVisible();
  for (const [name, button] of Object.entries(picks)) {
    await playerCard(page, name).getByRole('button', { name: button, exact: true }).click();
  }
  await page.getByRole('button', { name: 'SUBMIT' }).click();
}

test('play a round: show, drop and middle drop add up on the scoreboard', async ({ page }) => {
  await startGame(page, ['Ravi', 'Amit', 'Kiran']);
  await enterRound(page, { Ravi: 'Show', Amit: 'Drop', Kiran: 'M Drop' });

  expect(await totals(page)).toEqual(['0', '24', '48']);
  await expect(page.getByRole('button', { name: 'EDIT SCORE' })).toBeEnabled();
});

test('a typed hand score is accepted and capped at full count', async ({ page }) => {
  await startGame(page, ['Ravi', 'Amit']);
  await page.getByRole('button', { name: 'ENTER SCORE' }).click();
  await playerCard(page, 'Ravi').getByRole('button', { name: 'Show', exact: true }).click();
  await playerCard(page, 'Amit').getByRole('textbox').fill('95');
  await expect(playerCard(page, 'Amit').getByRole('textbox')).toHaveValue('80');
  await page.getByRole('button', { name: 'SUBMIT' }).click();
  expect(await totals(page)).toEqual(['0', '80']);
});

test('a round cannot be submitted without exactly one Show', async ({ page }) => {
  await startGame(page, ['Ravi', 'Amit']);
  await page.getByRole('button', { name: 'ENTER SCORE' }).click();
  await playerCard(page, 'Ravi').getByRole('button', { name: 'Drop', exact: true }).click();
  await playerCard(page, 'Amit').getByRole('button', { name: 'Drop', exact: true }).click();
  await page.getByRole('button', { name: 'SUBMIT' }).click();
  await expect(page.getByText(/one player must be marked with show/i)).toBeVisible();
});

test('editing the last round updates the totals once', async ({ page }) => {
  await startGame(page, ['Ravi', 'Amit']);
  await enterRound(page, { Ravi: 'Show', Amit: 'Drop' });

  await page.getByRole('button', { name: 'EDIT SCORE' }).click();
  await expect(page.getByRole('heading', { name: /edit round 1 scores/i })).toBeVisible();
  await playerCard(page, 'Amit').getByRole('button', { name: 'Full', exact: true }).click();
  await page.getByRole('button', { name: 'UPDATE SCORE' }).click();

  expect(await totals(page)).toEqual(['0', '80']);
  await expect(page.getByRole('button', { name: 'EDIT SCORE' })).toBeDisabled();
});

test('the deal button waits for round 1, then opens without freezing', async ({ page }) => {
  await startGame(page, ['Ravi', 'Amit'], 500);
  await expect(page.getByRole('button', { name: /^deal$/i })).toHaveCount(0);

  await enterRound(page, { Ravi: 'Show', Amit: 'Drop' });
  await page.getByRole('button', { name: /^deal$/i }).click();
  await expect(page.getByText(/₹1000/).first()).toBeVisible();
});

test('a match survives a reload and is listed in Continue Game', async ({ page }) => {
  await startGame(page, ['Ravi', 'Amit']);
  await enterRound(page, { Ravi: 'Show', Amit: 'M Drop' });

  await page.reload();
  await page.getByRole('button', { name: /continue game/i }).first().click();
  await page.getByText(/Ravi/).first().click();
  expect(await totals(page)).toEqual(['0', '48']);
});

test('Settings > Start New Match keeps the current match', async ({ page }) => {
  await startGame(page, ['Ravi', 'Amit']);
  await enterRound(page, { Ravi: 'Show', Amit: 'Drop' });

  await page.getByTitle('Settings').first().click();
  await page.getByRole('button', { name: /start new match/i }).click();
  await expect(page.getByRole('heading', { name: 'New Game' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: /continue game/i }).first().click();
  await expect(page.getByText(/Ravi/).first()).toBeVisible();
});

test('a knocked-out player re-enters at the highest active score plus one', async ({ page }) => {
  await startGame(page, ['Ravi', 'Amit', 'Kiran']);
  for (let round = 0; round < 3; round++) {
    await enterRound(page, { Ravi: 'Show', Amit: 'Full', Kiran: 'Drop' });
  }
  expect(await totals(page)).toEqual(['0', '240', '72']);

  await page.getByRole('button', { name: /re-enter amit/i }).click();
  await expect(page.getByRole('textbox')).toHaveValue('73');
  await page.getByRole('button', { name: /confirm re-entry/i }).click();

  expect((await totals(page)).sort()).toEqual(['0', '72', '73']);
  await expect(page.getByRole('button', { name: /re-enter amit/i })).toHaveCount(0);
});
