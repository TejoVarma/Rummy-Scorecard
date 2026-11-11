// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { RoundInputModal } from '../components/input/RoundInputModal';
import { ScoreboardScreen } from '../components/scoreboard/ScoreboardScreen';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES, getPointsForInputType, validateRoundScores } from '../domain/scoring';
import { isValidGameState } from '../domain/validation';
import { roundWinnerId } from '../domain/roundSummary';
import { GameState } from '../domain/types';

afterEach(cleanup);

const IDS = ['p1', 'p2', 'p3'];

function started(): GameState {
  return gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Closed Joker',
      rules: DEFAULT_RULES,
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#000', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#000', reEntryCount: 0 },
        { id: 'p3', name: 'Kiran', avatarColor: '#000', reEntryCount: 0 },
      ],
      initialSeats: IDS,
      initialDealerIndex: 0,
    },
  });
}

const PENALTY = { type: 'penalty' as const, points: 80 };
const stopped = { p1: PENALTY, p2: { type: 'custom' as const, points: 20 }, p3: { type: 'custom' as const, points: 20 } };
const carriedOn = { p1: PENALTY, p2: { type: 'show' as const, points: 0 }, p3: { type: 'custom' as const, points: 35 } };

describe('Penalty (wrong show)', () => {
  it('is worth full count', () => {
    expect(getPointsForInputType('penalty', undefined, DEFAULT_RULES)).toBe(DEFAULT_RULES.fullCount);
  });

  it('lets a stopped game be saved without a Show', () => {
    expect(validateRoundScores(stopped, IDS, DEFAULT_RULES)).toEqual({ valid: true });
  });

  it('lets a game that carried on have both the Penalty and the winner', () => {
    expect(validateRoundScores(carriedOn, IDS, DEFAULT_RULES)).toEqual({ valid: true });
  });

  it('still needs a Show when nobody has a Penalty', () => {
    const noWinner = { p1: { type: 'custom' as const, points: 20 }, p2: { type: 'custom' as const, points: 20 }, p3: { type: 'open_drop' as const, points: 24 } };
    expect(validateRoundScores(noWinner, IDS, DEFAULT_RULES)).toMatchObject({ valid: false, error: expect.stringMatching(/penalty/i) });
  });

  it('must be the full count, not any number', () => {
    expect(validateRoundScores({ ...stopped, p1: { type: 'penalty', points: 30 } }, IDS, DEFAULT_RULES).valid).toBe(false);
  });

  it('adds up in the game, with no round winner when the game was stopped', () => {
    const state = gameReducer(started(), { type: 'SUBMIT_ROUND', payload: { roundScores: stopped } });
    expect(state.rounds).toHaveLength(1);
    expect(state.rounds[0].cumulativeScores).toEqual({ p1: 80, p2: 20, p3: 20 });
    expect(roundWinnerId(state.rounds[0])).toBeNull();
    expect(isValidGameState(state)).toBe(true);
  });

  it('names the real winner when the game carried on', () => {
    const state = gameReducer(started(), { type: 'SUBMIT_ROUND', payload: { roundScores: carriedOn } });
    expect(roundWinnerId(state.rounds[0])).toBe('p2');
  });
});

describe('score entry with a Penalty', () => {
  const card = (name: string) => screen.getByRole('group', { name });

  it('submits a stopped game: Penalty for one, typed 20 for the rest', () => {
    const onSubmitRound = vi.fn();
    render(<RoundInputModal isOpen onClose={() => {}} state={started()} onSubmitRound={onSubmitRound} />);

    fireEvent.click(within(card('Ravi')).getByRole('button', { name: 'Penalty' }));
    fireEvent.change(within(card('Amit')).getByRole('textbox', { name: 'Score for Amit' }), { target: { value: '20' } });
    fireEvent.change(within(card('Kiran')).getByRole('textbox', { name: 'Score for Kiran' }), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'SUBMIT' }));

    expect(onSubmitRound).toHaveBeenCalledWith(stopped);
  });
});

describe('the scoreboard after a Penalty', () => {
  it('marks the cell as a penalty and congratulates nobody', () => {
    const state = gameReducer(started(), { type: 'SUBMIT_ROUND', payload: { roundScores: stopped } });
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
    expect(screen.getByRole('img', { name: /penalty/i }).textContent).toBe('P');
    expect(screen.getByLabelText('Legend').textContent).toMatch(/Penalty/);
    expect(screen.queryByText(/congrats/i)).toBeNull();
  });
});
