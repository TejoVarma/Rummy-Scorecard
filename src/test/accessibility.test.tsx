// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import axe from 'axe-core';
import { App } from '../App';
import { ThemeProvider } from '../themes/ThemeContext';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';

// jsdom can't measure colours or layout, so contrast and target size are checked by
// hand (lesson 20/21); everything else axe knows about is checked here.
async function audit(container: HTMLElement) {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return result.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

function savedGame() {
  let state = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Audit Night',
      rules: { ...DEFAULT_RULES, entryAmount: 500 },
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#000', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#000', reEntryCount: 0 },
        { id: 'p3', name: 'Kiran', avatarColor: '#000', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2', 'p3'],
      initialDealerIndex: 0,
    },
  });
  state = gameReducer(state, {
    type: 'SUBMIT_ROUND',
    payload: {
      roundScores: { p1: { type: 'show', points: 0 }, p2: { type: 'open_drop', points: 24 }, p3: { type: 'custom', points: 30 } },
    },
  });
  return state;
}

function renderApp() {
  const view = render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
  return view.container;
}

beforeEach(() => {
  localStorage.clear();
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
  const g = JSON.stringify(savedGame());
  localStorage.setItem('rummy_active_game_v1', g);
  localStorage.setItem('rummy_saved_games_list_v1', `[${g}]`);
  localStorage.setItem('rummy_saved_players_v1', '[{"id":"p1","name":"Ravi"},{"id":"p2","name":"Amit"}]');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('accessibility audit (axe-core)', () => {
  it('Home has no serious problems', async () => {
    expect(await audit(renderApp())).toEqual([]);
  });

  it('the scoreboard has no serious problems', async () => {
    const c = renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    expect(await audit(c)).toEqual([]);
  });

  it('the score entry screen has no serious problems', async () => {
    const c = renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    fireEvent.click(screen.getByRole('button', { name: 'ENTER SCORE' }));
    expect(await audit(c)).toEqual([]);
  });

  it('New Game has no serious problems', async () => {
    const c = renderApp();
    fireEvent.click(screen.getByRole('button', { name: /start new game/i }));
    expect(await audit(c)).toEqual([]);
  });

  it('Continue Game and the player list have no serious problems', async () => {
    const c = renderApp();
    fireEvent.click(screen.getByRole('button', { name: /continue game/i }));
    expect(await audit(c)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: /add players/i }));
    expect(await audit(c)).toEqual([]);
  });

  it('Settings and the deal screen have no serious problems', async () => {
    const c = renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    fireEvent.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(await audit(c)).toEqual([]);
  });
});

describe('screen readers and touch', () => {
  it('every button has a name', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    const unnamed = screen.getAllByRole('button').filter(b => !b.getAttribute('aria-label') && !b.textContent?.trim());
    expect(unnamed.map(b => b.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('popups are announced as dialogs with a title and a named close button', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('the ongoing game is resumed with a real, named button (so keyboards and switch control work)', () => {
    renderApp();
    const resume = screen.getByRole('button', { name: 'Resume ongoing game: Audit Night' });
    expect(resume.tagName).toBe('BUTTON');
    fireEvent.click(resume);
    expect(screen.getByRole('button', { name: 'ENTER SCORE' })).toBeTruthy();
  });

  it('pinch-zoom is allowed', () => {
    const html = readFileSync('index.html', 'utf8');
    const viewport = html.match(/name="viewport" content="([^"]+)"/)?.[1] ?? '';
    expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1/);
  });

  it('deleting a saved player asks first, naming them', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /add players/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ravi' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Ravi/));
    expect(screen.getByText('Ravi')).toBeTruthy();
  });

  it('the score entry screen is announced as a dialog', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    fireEvent.click(screen.getByRole('button', { name: 'ENTER SCORE' }));
    expect(screen.getByRole('dialog', { name: 'Add Round Scores' })).toBeTruthy();
  });

  it('score cells are read by meaning, not by code', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    expect(screen.getByRole('img', { name: 'Show (won the round)' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Drop' })).toBeTruthy();
  });

  it('custom deal amounts are named per player', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    fireEvent.click(screen.getByRole('button', { name: /^deal$/i }));
    fireEvent.click(screen.getByRole('button', { name: /custom/i }));
    expect(screen.getByRole('textbox', { name: 'Payout for Ravi' })).toBeTruthy();
  });

  it('seating buttons on New Game say which player they move', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /start new game/i }));
    fireEvent.click(screen.getByRole('button', { name: 'SELECT PLAYERS' }));
    fireEvent.click(screen.getByText('Ravi'));
    fireEvent.click(screen.getByText('Amit'));
    fireEvent.click(screen.getByRole('button', { name: /done \(2\)/i }));
    expect(screen.getByRole('button', { name: 'Move Amit up' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Ravi' })).toBeTruthy();
  });

  it('the add-player popup is a dialog with a named box', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /add players/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    const dialog = screen.getByRole('dialog', { name: 'Add New Player' });
    expect(within(dialog).getByRole('textbox', { name: 'New player name' })).toBeTruthy();
  });

  it('closing a dialog puts focus back on the button that opened it', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    const settings = screen.getByRole('button', { name: 'Settings' });
    settings.focus();
    fireEvent.click(settings);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(settings);
  });

  it('the player picker is a dialog of checkboxes that work from a keyboard', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /start new game/i }));
    fireEvent.click(screen.getByRole('button', { name: 'SELECT PLAYERS' }));
    const dialog = screen.getByRole('dialog', { name: 'Select Players' });
    const ravi = within(dialog).getByRole('checkbox', { name: 'Ravi' });
    expect(ravi.getAttribute('aria-checked')).toBe('false');
    fireEvent.keyDown(ravi, { key: ' ' });
    expect(ravi.getAttribute('aria-checked')).toBe('true');
  });

  it('a round row opens its details from a keyboard', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ongoing game/i }));
    const row = document.querySelector('tbody tr') as HTMLElement;
    expect(row.tabIndex).toBe(0);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(screen.getByText(/Showing Round 1/)).toBeTruthy();
  });

  it('choice buttons say which one is selected', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /start new game/i }));
    expect(screen.getByRole('button', { name: '201' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '101' }).getAttribute('aria-pressed')).toBe('false');
  });
});

