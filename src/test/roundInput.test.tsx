// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { RoundInputModal } from '../components/input/RoundInputModal';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameRules, GameState } from '../domain/types';

function started(rules: GameRules = DEFAULT_RULES): GameState {
  return gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Entry',
      rules,
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#000', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#000', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2'],
      initialDealerIndex: 0,
    },
  });
}

function open(state = started()) {
  const onSubmitRound = vi.fn();
  render(<RoundInputModal isOpen onClose={() => {}} state={state} onSubmitRound={onSubmitRound} />);
  return onSubmitRound;
}

const card = (name: string) => screen.getByRole('group', { name });

afterEach(cleanup);

describe('score entry screen', () => {
  it('each option sends the points from the rules', () => {
    const onSubmit = open(started({ ...DEFAULT_RULES, openDrop: 25, middleDrop: 50, fullCount: 80 }));
    fireEvent.click(within(card('Ravi')).getByRole('button', { name: 'Show' }));
    fireEvent.click(within(card('Amit')).getByRole('button', { name: 'M Drop' }));
    fireEvent.click(screen.getByRole('button', { name: 'SUBMIT' }));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      p1: { type: 'show', points: 0 },
      p2: { type: 'middle_drop', points: 50 },
    });
  });

  it('only one player can have the Show', () => {
    open();
    fireEvent.click(within(card('Ravi')).getByRole('button', { name: 'Show' }));
    fireEvent.click(within(card('Amit')).getByRole('button', { name: 'Show' }));
    expect(within(card('Ravi')).queryByRole('button', { name: /clear show/i })).toBeNull();
    expect(within(card('Amit')).getByRole('button', { name: 'Clear Show for Amit' })).toBeTruthy();
  });

  it('a chosen option is a real button that clears it', () => {
    open();
    fireEvent.click(within(card('Ravi')).getByRole('button', { name: 'Drop' }));
    fireEvent.click(within(card('Ravi')).getByRole('button', { name: 'Clear Drop for Ravi' }));
    expect(within(card('Ravi')).getByRole('textbox', { name: 'Score for Ravi' })).toBeTruthy();
  });

  it('the typed score box has a name and caps at full count', () => {
    open();
    const box = within(card('Amit')).getByRole('textbox', { name: 'Score for Amit' });
    fireEvent.change(box, { target: { value: '95' } });
    expect((box as HTMLInputElement).value).toBe('80');
  });
});
