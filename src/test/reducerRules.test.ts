import { describe, it, expect } from 'vitest';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES, validateRoundScores } from '../domain/scoring';
import { validateRules } from '../domain/rules';
import { calculateEqualDeal } from '../domain/dealSplit';
import { GameRules, GameState, PlayerRoundScore, DealSplit } from '../domain/types';

const show: PlayerRoundScore = { type: 'show', points: 0 };
const drop: PlayerRoundScore = { type: 'open_drop', points: 24 };
const full: PlayerRoundScore = { type: 'full_count', points: 80 };

const PLAYERS = [
  { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
  { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
  { id: 'p3', name: 'Kiran', avatarColor: '#f59e0b', reEntryCount: 0 },
];

function start(rules: GameRules = DEFAULT_RULES): GameState {
  return gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: { title: 'Rules', rules, players: PLAYERS, initialSeats: ['p1', 'p2', 'p3'], initialDealerIndex: 0 },
  });
}

function submit(state: GameState, roundScores: Record<string, PlayerRoundScore>): GameState {
  return gameReducer(state, { type: 'SUBMIT_ROUND', payload: { roundScores } });
}

// Ravi out after round 3 (240); Amit 0; Kiran 72.
function raviOut(): GameState {
  let state = start();
  for (let i = 0; i < 3; i++) state = submit(state, { p1: full, p2: show, p3: drop });
  return state;
}

describe('starting a game', () => {
  it('refuses fewer than two players', () => {
    const state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: { title: 'Solo', rules: DEFAULT_RULES, players: [PLAYERS[0]], initialSeats: ['p1'], initialDealerIndex: 0 },
    });
    expect(state).toBe(INITIAL_STATE);
  });

  it('refuses a dealer seat that does not exist', () => {
    const state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: { title: 'X', rules: DEFAULT_RULES, players: PLAYERS, initialSeats: ['p1', 'p2', 'p3'], initialDealerIndex: 3 },
    });
    expect(state).toBe(INITIAL_STATE);
  });

  it('refuses seats that do not match the players', () => {
    const state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: { title: 'X', rules: DEFAULT_RULES, players: PLAYERS, initialSeats: ['p1', 'p1', 'p2'], initialDealerIndex: 0 },
    });
    expect(state).toBe(INITIAL_STATE);
  });

  it('refuses drop values out of order', () => {
    expect(start({ ...DEFAULT_RULES, openDrop: 50, middleDrop: 40 })).toBe(INITIAL_STATE);
  });
});

describe('validateRules', () => {
  it('refuses a stake too large to be real', () => {
    expect(validateRules({ ...DEFAULT_RULES, entryAmount: 100_000_001 })).toMatch(/stake/i);
    expect(validateRules({ ...DEFAULT_RULES, entryAmount: 100_000_000 })).toBeNull();
  });

  it('accepts the defaults', () => {
    expect(validateRules(DEFAULT_RULES)).toBeNull();
  });

  it.each([
    [{ openDrop: 0 }, /open drop/i],
    [{ openDrop: 48, middleDrop: 48 }, /middle drop/i],
    [{ middleDrop: 80, fullCount: 80 }, /full count/i],
    [{ poolLimit: 20 }, /pool/i],
    [{ entryAmount: -5 }, /stake/i],
  ])('rejects %o', (change, message) => {
    expect(validateRules({ ...DEFAULT_RULES, ...change })).toMatch(message);
  });
});

describe('submitting a round', () => {
  it('accepts a normal round', () => {
    expect(submit(start(), { p1: show, p2: drop, p3: full }).rounds).toHaveLength(1);
  });

  it('refuses two shows', () => {
    const state = start();
    expect(submit(state, { p1: show, p2: show, p3: drop })).toBe(state);
  });

  it('refuses a missing player', () => {
    const state = start();
    expect(submit(state, { p1: show, p2: drop })).toBe(state);
  });

  it('refuses negative or fractional points', () => {
    const state = start();
    expect(submit(state, { p1: show, p2: drop, p3: { type: 'custom', points: -10 } })).toBe(state);
    expect(submit(state, { p1: show, p2: drop, p3: { type: 'custom', points: 12.5 } })).toBe(state);
  });

  it('refuses points that do not match the button', () => {
    const state = start();
    expect(submit(state, { p1: show, p2: { type: 'open_drop', points: 999 }, p3: drop })).toBe(state);
  });

  it('never adds points to a player who is already out', () => {
    const state = submit(raviOut(), { p1: { type: 'custom', points: 40 }, p2: drop, p3: show });
    expect(state.rounds).toHaveLength(4);
    expect(state.rounds[3].cumulativeScores.p1).toBe(240);
    expect(state.rounds[3].scores.p1).toEqual({ type: 'out', points: 0 });
  });

  it('accepts a hand score up to a custom full count (step 4.4)', () => {
    const rules = { ...DEFAULT_RULES, fullCount: 100 };
    const state = submit(start(rules), { p1: show, p2: { type: 'custom', points: 90 }, p3: drop });
    expect(state.rounds[0].cumulativeScores.p2).toBe(90);
  });

  it('validateRoundScores uses the configured full count', () => {
    const rules = { ...DEFAULT_RULES, fullCount: 100 };
    const scores = { p1: show, p2: { type: 'custom' as const, points: 90 } };
    expect(validateRoundScores(scores, ['p1', 'p2'], rules).valid).toBe(true);
    expect(validateRoundScores(scores, ['p1', 'p2'], DEFAULT_RULES).error).toMatch(/0 and 80/);
  });
});

describe('re-entry', () => {
  it('allows the player knocked out in the last round', () => {
    const state = gameReducer(raviOut(), { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p1' } });
    expect(state.rounds[2].cumulativeScores.p1).toBe(73);
  });

  it('refuses a player knocked out in an earlier round', () => {
    const roundLater = submit(raviOut(), { p1: { type: 'out', points: 0 }, p2: drop, p3: show });
    expect(roundLater.rounds).toHaveLength(4);
    expect(gameReducer(roundLater, { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p1' } })).toBe(roundLater);
  });

  it('refuses a custom re-entry score at or above the pool limit', () => {
    const state = raviOut();
    expect(gameReducer(state, { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p1', customReEntryScore: 201 } })).toBe(state);
    expect(gameReducer(state, { type: 'RE_ENTER_PLAYER', payload: { playerId: 'p1', customReEntryScore: Number.NaN } })).toBe(state);
  });
});

describe('after a deal is accepted', () => {
  function settled(): GameState {
    const state = submit(start({ ...DEFAULT_RULES, entryAmount: 100 }), { p1: show, p2: drop, p3: full });
    const dealSplit: DealSplit = {
      mode: 'equal',
      payouts: calculateEqualDeal(300, ['p1', 'p2', 'p3']),
      scoresSnapshot: state.rounds[0].cumulativeScores,
      totalPool: 300,
      timestamp: 1,
    };
    return gameReducer(state, { type: 'ACCEPT_DEAL', payload: { dealSplit } });
  }

  it('settles the game', () => {
    const state = settled();
    expect(state.status).toBe('completed');
    expect(state.dealSplit?.totalPool).toBe(300);
  });

  it('refuses edits, so the settled scores cannot change', () => {
    const state = settled();
    expect(gameReducer(state, { type: 'EDIT_LAST_ROUND', payload: { roundScores: { p1: drop, p2: show, p3: full } } })).toBe(state);
  });

  it('refuses a second deal', () => {
    const state = settled();
    const again = { ...state.dealSplit!, payouts: { p1: 300, p2: 0, p3: 0 } };
    expect(gameReducer(state, { type: 'ACCEPT_DEAL', payload: { dealSplit: again } })).toBe(state);
  });

  it('refuses payouts that do not add up to the pool', () => {
    const state = submit(start({ ...DEFAULT_RULES, entryAmount: 100 }), { p1: show, p2: drop, p3: full });
    const dealSplit: DealSplit = {
      mode: 'custom',
      payouts: { p1: 500, p2: 0, p3: 0 },
      scoresSnapshot: {},
      totalPool: 300,
      timestamp: 1,
    };
    expect(gameReducer(state, { type: 'ACCEPT_DEAL', payload: { dealSplit } })).toBe(state);
  });
});
