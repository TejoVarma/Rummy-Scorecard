// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { RoundInputModal } from '../components/input/RoundInputModal';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState, PlayerRoundScore } from '../domain/types';

type Pick = Record<string, PlayerRoundScore>;
const show: PlayerRoundScore = { type: 'show', points: 0 };
const drop: PlayerRoundScore = { type: 'open_drop', points: 24 };
const full: PlayerRoundScore = { type: 'full_count', points: 80 };
const out: PlayerRoundScore = { type: 'out', points: 0 };

function play(rounds: Pick[]): GameState {
  let state = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Edit Night',
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
  for (const roundScores of rounds) {
    state = gameReducer(state, { type: 'SUBMIT_ROUND', payload: { roundScores } });
  }
  return state;
}

// Ravi takes Full three times: 240, out after round 3.
const RAVI_OUT = [
  { p1: full, p2: show, p3: drop },
  { p1: full, p2: show, p3: drop },
  { p1: full, p2: show, p3: drop },
];

function openEditor(state: GameState, onSubmitRound = vi.fn()) {
  render(<RoundInputModal isOpen onClose={() => {}} state={state} isEditingLastRound onSubmitRound={onSubmitRound} />);
  return onSubmitRound;
}

function cardFor(name: string) {
  return screen.getByText(name, { exact: true }).closest('div.rounded-xl') as HTMLElement;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('editing the last round', () => {
  it('lists only the players who were still in that round', () => {
    openEditor(play([...RAVI_OUT, { p1: out, p2: drop, p3: show }]));
    expect(screen.queryByText('Ravi', { exact: true })).toBeNull();
    expect(screen.getByText('Amit', { exact: true })).toBeTruthy();
    expect(screen.getByText('Kiran', { exact: true })).toBeTruthy();
  });

  it('keeps a player who was knocked out by that very round', () => {
    openEditor(play(RAVI_OUT));
    expect(screen.getByText('Ravi', { exact: true })).toBeTruthy();
  });

  it("puts the dealer crown on that round's dealer, not the next one", () => {
    const state = play([{ p1: show, p2: drop, p3: drop }]);
    expect(state.rounds[0].dealerPlayerId).toBe('p1');
    expect(state.seats[state.currentDealerIndex]).not.toBe('p1');

    openEditor(state);
    expect(within(cardFor('Ravi')).queryByText(/deal/i)).toBeTruthy();
    expect(within(cardFor('Amit')).queryByText(/deal/i)).toBeNull();
  });

  it('only submits scores for the players who were in, with others kept out', () => {
    const onSubmit = openEditor(play([...RAVI_OUT, { p1: out, p2: drop, p3: show }]));
    fireEvent.click(within(cardFor('Amit')).getByRole('button', { name: 'Show' }));
    fireEvent.click(within(cardFor('Kiran')).getByRole('button', { name: 'Drop' }));
    fireEvent.click(screen.getByRole('button', { name: 'UPDATE SCORE' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const scores = onSubmit.mock.calls[0][0];
    expect(scores.p1).toEqual({ type: 'out', points: 0 });
    expect(scores.p2.type).toBe('show');
    expect(scores.p3.type).toBe('open_drop');
  });

  describe('after a re-entry', () => {
    function reEntered(): GameState {
      const state = play(RAVI_OUT);
      return gameReducer(state, { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p1' } });
    }

    it('warns which re-entry the edit will undo', () => {
      openEditor(reEntered());
      expect(screen.getByText(/will undo ravi's re-entry/i)).toBeTruthy();
    });

    it('asks before saving, and saves nothing if you say no', () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onSubmit = openEditor(reEntered());
      fireEvent.click(screen.getByRole('button', { name: 'UPDATE SCORE' }));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('saves once you confirm', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onSubmit = openEditor(reEntered());
      fireEvent.click(screen.getByRole('button', { name: 'UPDATE SCORE' }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
