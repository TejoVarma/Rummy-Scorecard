// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { buildScorecardText, isShareCancelled } from '../services/share';
import { ScoreboardScreen } from '../components/scoreboard/ScoreboardScreen';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState } from '../domain/types';

const shareMocks = vi.hoisted(() => ({
  shareText: vi.fn().mockResolvedValue(undefined),
  shareImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/share', async importOriginal => ({
  ...(await importOriginal<typeof import('../services/share')>()),
  shareText: shareMocks.shareText,
  shareImage: shareMocks.shareImage,
}));

function playedGame(stake = 0): GameState {
  let state = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Friday Pool',
      rules: { ...DEFAULT_RULES, entryAmount: stake },
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2'],
      initialDealerIndex: 0,
    },
  });
  state = gameReducer(state, {
    type: 'SUBMIT_ROUND',
    payload: {
      roundScores: {
        p1: { type: 'show', points: 0 },
        p2: { type: 'full_count', points: 80 },
      },
    },
  });
  return state;
}

function renderBoard(state: GameState) {
  render(
    <ScoreboardScreen
      state={state}
      onBack={() => {}}
      onOpenScoreInput={() => {}}
      onOpenEditScore={() => {}}
      onOpenSettings={() => {}}
      onPromptReEntry={() => {}}
      onDeleteGame={() => {}}
      onAcceptDeal={() => {}}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('buildScorecardText', () => {
  it('lists the title, pool, rounds and every player total', () => {
    const text = buildScorecardText(playedGame());
    expect(text).toContain('Friday Pool');
    expect(text).toContain('Pool: 201');
    expect(text).toContain('Rounds: 1');
    expect(text).toContain('Ravi: 0 pts');
    expect(text).toContain('Amit: 80 pts');
  });

  it('includes the prize pool when there is a stake', () => {
    expect(buildScorecardText(playedGame(500))).toContain('Prize Pool: ₹1000');
  });

  it('marks players who are out', () => {
    const state = playedGame();
    const last = state.rounds[0];
    const outState = {
      ...state,
      rounds: [{ ...last, cumulativeScores: { p1: 0, p2: 210 } }],
    };
    expect(buildScorecardText(outState)).toContain('Amit: 210 pts (Out)');
  });

  it('keeps a multi-line title on one line', () => {
    const text = buildScorecardText({ ...playedGame(), title: 'Friday\nPool' });
    expect(text.split('\n')[0]).toContain('Friday Pool');
  });
});

describe('isShareCancelled', () => {
  it('treats closing the share sheet as a cancel, in the browser and on Android', () => {
    expect(isShareCancelled(new DOMException('closed', 'AbortError'))).toBe(true);
    expect(isShareCancelled(new Error('Share canceled'))).toBe(true);
  });

  it('treats real failures as failures', () => {
    expect(isShareCancelled(new Error('No space left'))).toBe(false);
    expect(isShareCancelled(null)).toBe(false);
    expect(isShareCancelled('Share canceled')).toBe(false);
  });
});

describe('Share button', () => {
  it('asks whether to share as an image or as text', () => {
    renderBoard(playedGame());
    fireEvent.click(screen.getByTitle('Share Scorecard'));
    expect(screen.getByRole('button', { name: /share as image/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /share as text/i })).toBeTruthy();
  });

  it('shares the text summary when Text is chosen', async () => {
    renderBoard(playedGame());
    fireEvent.click(screen.getByTitle('Share Scorecard'));
    fireEvent.click(screen.getByRole('button', { name: /share as text/i }));
    await waitFor(() => expect(shareMocks.shareText).toHaveBeenCalledTimes(1));
    expect(shareMocks.shareText.mock.calls[0][1]).toContain('Amit: 80 pts');
    expect(shareMocks.shareImage).not.toHaveBeenCalled();
  });
});
