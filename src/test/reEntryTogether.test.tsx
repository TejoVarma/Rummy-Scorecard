// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { getEligibleForReEntryPlayers } from '../domain/elimination';
import { GameState } from '../domain/types';
import { ReEntryModal } from '../components/input/ReEntryModal';
import { ScoreboardScreen } from '../components/scoreboard/ScoreboardScreen';

afterEach(cleanup);

// Amit and Kiran both go out in round 3: Amit at 240, Kiran at 210. Ravi (0) and Suresh (72) are still in.
function twoOutTogether(): GameState {
  let state = gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Saturday Pool',
      rules: DEFAULT_RULES,
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
        { id: 'p3', name: 'Kiran', avatarColor: '#f59e0b', reEntryCount: 0 },
        { id: 'p4', name: 'Suresh', avatarColor: '#ef4444', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2', 'p3', 'p4'],
      initialDealerIndex: 0,
    },
  });
  const round = (p3: { type: 'full_count' | 'custom'; points: number }) =>
    gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'full_count', points: 80 },
          p3,
          p4: { type: 'open_drop', points: 24 },
        },
      },
    });
  state = round({ type: 'full_count', points: 80 });
  state = round({ type: 'full_count', points: 80 });
  state = round({ type: 'custom', points: 50 });
  return state;
}

const totals = (s: GameState) => s.rounds[s.rounds.length - 1].cumulativeScores;
const dealerOf = (s: GameState) => s.seats[s.currentDealerIndex];

describe('re-entering two players who went out in the same round', () => {
  it('starts with both out and both allowed back in', () => {
    const state = twoOutTogether();
    expect(totals(state)).toMatchObject({ p1: 0, p2: 240, p3: 210, p4: 72 });
    expect(getEligibleForReEntryPlayers(state.rounds, state.seats, state.rules).sort()).toEqual(['p2', 'p3']);
  });

  it('gives both the same score: highest still in, plus one', () => {
    const state = gameReducer(twoOutTogether(), { type: 'RE_ENTER_PLAYERS', payload: { playerIds: ['p3', 'p2'] } });
    expect(totals(state).p2).toBe(73);
    expect(totals(state).p3).toBe(73);
    expect(state.players.p2.reEntryCount).toBe(1);
    expect(state.players.p3.reEntryCount).toBe(1);
  });

  it('seats them in the order picked, the last one picked next to the dealer', () => {
    const before = twoOutTogether();
    const dealer = dealerOf(before);
    const state = gameReducer(before, { type: 'RE_ENTER_PLAYERS', payload: { playerIds: ['p3', 'p2'] } });

    const d = state.seats.indexOf(dealer);
    const n = state.seats.length;
    expect(state.seats[(d - 1 + n) % n]).toBe('p2');
    expect(state.seats[(d - 2 + n) % n]).toBe('p3');
    expect(dealerOf(state)).toBe(dealer);
    expect(new Set(state.seats)).toEqual(new Set(['p1', 'p2', 'p3', 'p4']));
  });

  it('gives the same score when they are re-entered one after the other', () => {
    let state = gameReducer(twoOutTogether(), { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p3' } });
    expect(getEligibleForReEntryPlayers(state.rounds, state.seats, state.rules)).toEqual(['p2']);
    state = gameReducer(state, { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p2' } });
    expect(totals(state).p3).toBe(73);
    expect(totals(state).p2).toBe(73);
  });

  it('applies a typed score to everyone re-entering', () => {
    const state = gameReducer(twoOutTogether(), {
      type: 'RE_ENTER_PLAYERS',
      payload: { playerIds: ['p2', 'p3'], customReEntryScore: 100 },
    });
    expect(totals(state)).toMatchObject({ p2: 100, p3: 100 });
  });

  it('refuses an empty list, a repeated player or someone who is still in', () => {
    const state = twoOutTogether();
    expect(gameReducer(state, { type: 'RE_ENTER_PLAYERS', payload: { playerIds: [] } })).toBe(state);
    expect(gameReducer(state, { type: 'RE_ENTER_PLAYERS', payload: { playerIds: ['p2', 'p2'] } })).toBe(state);
    expect(gameReducer(state, { type: 'RE_ENTER_PLAYERS', payload: { playerIds: ['p2', 'p4'] } })).toBe(state);
  });
});

describe('Re-entry dialog with two players out', () => {
  function renderDialog(preselected: string[] = []) {
    const onConfirm = vi.fn();
    const state = twoOutTogether();
    render(
      <ReEntryModal
        isOpen
        onClose={() => {}}
        state={state}
        eligiblePlayerIds={['p2', 'p3']}
        initialSelection={preselected}
        onConfirmReEntry={onConfirm}
      />
    );
    return { onConfirm, state };
  }

  it('re-enters both in the order they were tapped, at one shared score', () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kiran' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Amit' }));
    fireEvent.click(screen.getByRole('button', { name: /confirm re-entry/i }));
    expect(onConfirm).toHaveBeenCalledWith(['p3', 'p2'], 73);
  });

  it('tells a screen reader the order picked, and toggles from the keyboard', () => {
    renderDialog();
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Kiran' }), { key: ' ' });
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Amit' }), { key: 'Enter' });
    expect(screen.getByRole('checkbox', { name: 'Kiran, number 1' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Amit, number 2' })).toBeTruthy();
  });

  it('does not mark the score as wrong when nobody is picked', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /confirm re-entry/i }));
    expect(screen.getByLabelText('Re-entry score').getAttribute('aria-invalid')).toBe('false');
  });

  it('shows the seating that will result', () => {
    const { state } = renderDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kiran' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Amit' }));
    const dealerName = state.players[dealerOf(state)].name;
    expect(screen.getByText(`Kiran → Amit → ${dealerName} (dealer)`)).toBeTruthy();
  });

  it('can re-enter just one of them', () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Amit' }));
    fireEvent.click(screen.getByRole('button', { name: /confirm re-entry/i }));
    expect(onConfirm).toHaveBeenCalledWith(['p2'], 73);
  });

  it('asks for at least one player before confirming', () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /confirm re-entry/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/tap/i);
  });
});

describe('re-entry banner on the scoreboard', () => {
  function renderBoard(state: GameState) {
    const onPromptReEntry = vi.fn();
    render(
      <ScoreboardScreen
        state={state}
        onBack={() => {}}
        onOpenScoreInput={() => {}}
        onOpenEditScore={() => {}}
        onOpenSettings={() => {}}
        onAnnounceScores={() => {}}
        onPromptReEntry={onPromptReEntry}
        onDeleteGame={() => {}}
        onAcceptDeal={() => {}}
      />
    );
    return onPromptReEntry;
  }

  it('offers one Re-Enter button that opens the picker when two are out', () => {
    const onPromptReEntry = renderBoard(twoOutTogether());
    expect(screen.queryByRole('button', { name: /re-enter amit/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^re-enter$/i }));
    expect(onPromptReEntry).toHaveBeenCalledWith([]);
  });

  it('keeps the named button when only one is left to re-enter', () => {
    const state = gameReducer(twoOutTogether(), { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p3' } });
    const onPromptReEntry = renderBoard(state);
    fireEvent.click(screen.getByRole('button', { name: /re-enter amit/i }));
    expect(onPromptReEntry).toHaveBeenCalledWith(['p2']);
  });
});
