// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScoreboardScreen } from '../components/scoreboard/ScoreboardScreen';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState } from '../domain/types';

function board(rounds: number): GameState {
  let state = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Legend',
      rules: DEFAULT_RULES,
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#000', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#000', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2'],
      initialDealerIndex: 0,
    },
  });
  for (let i = 0; i < rounds; i++) {
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: { roundScores: { p1: { type: 'show', points: 0 }, p2: { type: 'middle_drop', points: 48 } } },
    });
  }
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
      onAnnounceScores={() => {}}
      onPromptReEntry={() => {}}
      onDeleteGame={() => {}}
      onAcceptDeal={() => {}}
    />
  );
}

afterEach(cleanup);

describe('scoreboard legend', () => {
  it('explains the row colours and every cell code in a few words', () => {
    renderBoard(board(1));
    const legend = screen.getByRole('region', { name: /legend/i });
    for (const text of [
      /all drop/i,
      /normal/i,
      /R\s*show/i,
      /D\s*drop/i,
      /MD\s*mid drop/i,
      /FC\s*full/i,
      /X\s*out/i,
      /RE\s*re-entry/i,
      /dealer/i,
    ]) {
      expect(legend.textContent).toMatch(text);
    }
  });

  it('is not shown before any round is played', () => {
    renderBoard(board(0));
    expect(screen.queryByRole('region', { name: /legend/i })).toBeNull();
  });

  it('gives score cells a readable name for screen readers', () => {
    renderBoard(board(1));
    expect(screen.getByLabelText('Show (won the round)')).toBeTruthy();
    expect(screen.getByLabelText('Middle drop')).toBeTruthy();
  });

  it('marks the dealer with a crown instead of an asterisk', () => {
    renderBoard(board(1));
    const dealerCell = screen.getAllByRole('columnheader').find(th => th.textContent?.includes('(dealer)'));
    expect(dealerCell).toBeTruthy();
    expect(dealerCell!.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText(/^\*/)).toBeNull();
    const legend = screen.getByRole('region', { name: /legend/i });
    expect(legend.querySelector('svg')).not.toBeNull();
  });
});

