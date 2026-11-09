import { describe, it, expect } from 'vitest';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { RoundRecord } from '../domain/types';

describe('gameReducer integration tests', () => {
  it('initializes game and runs a round', () => {
    const players = [
      { id: 'p1', name: 'Tejo', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p2', name: 'Bava', avatarColor: '#10b981', reEntryCount: 0 },
      { id: 'p3', name: 'Rohini', avatarColor: '#f59e0b', reEntryCount: 0 },
    ];

    // 1. Start Game
    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Sunday Match',
        rules: DEFAULT_RULES,
        players,
        initialSeats: ['p1', 'p2', 'p3'],
        initialDealerIndex: 0,
      },
    });

    expect(state.status).toBe('playing');
    expect(state.currentDealerIndex).toBe(0); // p1 is dealer

    // 2. Submit Round 1
    // p1 shows (0), p2 drops (24), p3 middle drops (48)
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'open_drop', points: 24 },
          p3: { type: 'middle_drop', points: 48 },
        },
      },
    });

    expect(state.rounds.length).toBe(1);
    expect(state.rounds[0].cumulativeScores).toEqual({ p1: 0, p2: 24, p3: 48 });
    // Dealer advances to p2 (index 1)
    expect(state.currentDealerIndex).toBe(1);
  });

  it('handles re-entry: calculates highest + 1 and shifts seat after the dealer', () => {
    const players = [
      { id: 'p1', name: 'Tejo', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p2', name: 'Bava', avatarColor: '#10b981', reEntryCount: 0 },
      { id: 'p3', name: 'Rohini', avatarColor: '#f59e0b', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Re-entry test',
        rules: { ...DEFAULT_RULES, poolLimit: 100 },
        players,
        initialSeats: ['p1', 'p2', 'p3'],
        initialDealerIndex: 0, // p1 is dealer
      },
    });

    // p3 gets 105 points and is eliminated
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'middle_drop', points: 48 },
          p3: { type: 'custom', points: 105 },
        },
      },
    });

    // In Round 1, p1 dealt. Next dealer for round 2 is p2 (Bava).
    expect(state.currentDealerIndex).toBe(1);
    expect(state.seats[state.currentDealerIndex]).toBe('p2');

    // p3 re-enters!
    // Active players: p1 (0), p2 (48). Highest is 48, so re-entry score should be 49.
    // In seats ['p1', 'p2', 'p3'], current dealer is 'p2'.
    // Relocated seats should place 'p3' immediately after 'p2'!
    state = gameReducer(state, {
      type: 'RE_ENTER_PLAYER',
      payload: { playerId: 'p3' },
    });

    const lastRound = state.rounds[0];
    expect(lastRound.cumulativeScores['p3']).toBe(49);
    // Seating order: p3 sits to the LEFT of dealer p2: ['p1', 'p3', 'p2']
    expect(state.seats).toEqual(['p1', 'p3', 'p2']);
    expect(state.players['p3'].reEntryCount).toBe(1);
  });

  it('undos a round cleanly restoring previous state', () => {
    const players = [
      { id: 'p1', name: 'Tejo', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p2', name: 'Bava', avatarColor: '#10b981', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Undo test',
        rules: DEFAULT_RULES,
        players,
        initialSeats: ['p1', 'p2'],
        initialDealerIndex: 0,
      },
    });

    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'open_drop', points: 24 },
        },
      },
    });

    expect(state.rounds.length).toBe(1);

    // Now undo
    state = gameReducer(state, { type: 'UNDO_ROUND' });
    expect(state.rounds.length).toBe(0);
    expect(state.currentDealerIndex).toBe(0);
    expect(state.players['p1'].reEntryCount).toBe(0);
  });

  it('rotates dealer skipping eliminated players', () => {
    const players = [
      { id: 'p1', name: 'Tejo', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p2', name: 'Bava', avatarColor: '#10b981', reEntryCount: 0 },
      { id: 'p3', name: 'Rohini', avatarColor: '#f59e0b', reEntryCount: 0 },
      { id: 'p4', name: 'Siri', avatarColor: '#ec4899', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Skip Eliminated Dealer Test',
        rules: { ...DEFAULT_RULES, poolLimit: 100 },
        players,
        initialSeats: ['p1', 'p2', 'p3', 'p4'],
        initialDealerIndex: 0, // p1 is dealer
      },
    });

    // Round 1: p1 is dealer. p2 (next to dealer) gets 105 points and is eliminated!
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'custom', points: 105 }, // eliminated!
          p3: { type: 'open_drop', points: 24 },
          p4: { type: 'open_drop', points: 24 },
        },
      },
    });

    // Since p2 got eliminated in this round, p1 deals again so p3 gets the open card!
    expect(state.currentDealerIndex).toBe(0);
    expect(state.seats[state.currentDealerIndex]).toBe('p1');

    // Round 2: p1 deals again to p3, p4. Nobody eliminated.
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'open_drop', points: 24 },
          p3: { type: 'show', points: 0 },
          p4: { type: 'open_drop', points: 24 },
        },
      },
    });

    // Now dealer advances clockwise, skipping already-eliminated p2 and going to p3!
    expect(state.currentDealerIndex).toBe(2);
    expect(state.seats[state.currentDealerIndex]).toBe('p3');
  });

  it('edits last round scores correctly and recalculates cumulative totals', () => {
    const players = [
      { id: 'p1', name: 'Tejo', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p2', name: 'Bava', avatarColor: '#10b981', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Edit round test',
        rules: DEFAULT_RULES,
        players,
        initialSeats: ['p1', 'p2'],
        initialDealerIndex: 0,
      },
    });

    // Submit Round 1 with initial scores: p1 = 0, p2 = 24 (Open drop)
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'open_drop', points: 24 },
        },
      },
    });

    expect(state.rounds[0].cumulativeScores).toEqual({ p1: 0, p2: 24 });

    // Now edit Round 1: change p2's score to middle drop (48)
    state = gameReducer(state, {
      type: 'EDIT_LAST_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'middle_drop', points: 48 },
        },
      },
    });

    expect(state.rounds.length).toBe(1);
    expect(state.rounds[0].cumulativeScores).toEqual({ p1: 0, p2: 48 });
    expect(state.rounds[0].scores['p2'].type).toBe('middle_drop');
    expect(state.rounds[0].isEdited).toBe(true);

    // Attempting a second edit should be ignored (edit once only)
    state = gameReducer(state, {
      type: 'EDIT_LAST_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'full_count', points: 80 },
        },
      },
    });
    expect(state.rounds[0].cumulativeScores['p2']).toBe(48);
    expect(state.rounds[0].scores['p2'].type).toBe('middle_drop');
  });

  it('restores playing status and unsets winner when an eliminated player re-enters', () => {
    const players = [
      { id: 'p1', name: 'Tejo', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p2', name: 'Bava', avatarColor: '#10b981', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Two player pool',
        rules: { ...DEFAULT_RULES, poolLimit: 101 },
        players,
        initialSeats: ['p1', 'p2'],
        initialDealerIndex: 0,
      },
    });

    // p2 gets 105 points and is eliminated -> p1 is declared winner
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'custom', points: 105 },
        },
      },
    });

    expect(state.status).toBe('completed');
    expect(state.winnerPlayerId).toBe('p1');

    // p2 re-enters before the next round!
    // Active player is p1 with score 0. Re-entry score = 0 + 1 = 1 (< 101).
    state = gameReducer(state, {
      type: 'RE_ENTER_PLAYER',
      payload: { playerId: 'p2' },
    });

    // Game must resume playing, winner unset!
    expect(state.status).toBe('playing');
    expect(state.winnerPlayerId).toBeUndefined();
    expect(state.rounds[0].cumulativeScores['p2']).toBe(1);
  });

  it('keeps dealer unchanged when the player after the dealer gets eliminated in that round', () => {
    const players = [
      { id: 'p1', name: 'Player 1', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p2', name: 'Player 2', avatarColor: '#10b981', reEntryCount: 0 },
      { id: 'p3', name: 'Player 3', avatarColor: '#f59e0b', reEntryCount: 0 },
      { id: 'p4', name: 'Player 4', avatarColor: '#ec4899', reEntryCount: 0 },
      { id: 'p5', name: 'Player 5', avatarColor: '#8b5cf6', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: '5-player pool match',
        rules: { ...DEFAULT_RULES, poolLimit: 201 },
        players,
        initialSeats: ['p1', 'p2', 'p3', 'p4', 'p5'],
        initialDealerIndex: 4, // Player 5 is dealing
      },
    });

    expect(state.currentDealerIndex).toBe(4);
    expect(state.seats[state.currentDealerIndex]).toBe('p5');

    // Round 1: Player 5 deals. Player 1 (first player after p5) gets eliminated (score 205).
    // Player 5 should deal again so Player 2 gets the open card!
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'custom', points: 205 }, // eliminated!
          p2: { type: 'open_drop', points: 24 },
          p3: { type: 'middle_drop', points: 48 },
          p4: { type: 'middle_drop', points: 48 },
          p5: { type: 'show', points: 0 },
        },
      },
    });

    // Dealer MUST remain p5 (index 4), not skip to p2!
    expect(state.currentDealerIndex).toBe(4);
    expect(state.seats[state.currentDealerIndex]).toBe('p5');
  });

  it('cancels re-entry and restores original seating order when editing the last round', () => {
    const players = [
      { id: 'p1', name: 'Tejo', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p2', name: 'Bava', avatarColor: '#10b981', reEntryCount: 0 },
      { id: 'p3', name: 'Rohini', avatarColor: '#f59e0b', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Re-entry Cancel on Edit Test',
        rules: { ...DEFAULT_RULES, poolLimit: 100 },
        players,
        initialSeats: ['p1', 'p2', 'p3'],
        initialDealerIndex: 0, // p1 is dealer
      },
    });

    // Round 1: p3 gets 105 points and is eliminated!
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'middle_drop', points: 48 },
          p3: { type: 'custom', points: 105 },
        },
      },
    });

    expect(state.seats).toEqual(['p1', 'p2', 'p3']);

    // p3 re-enters!
    state = gameReducer(state, {
      type: 'RE_ENTER_PLAYER',
      payload: { playerId: 'p3' },
    });

    // Seating was relocated to left of dealer p2: ['p1', 'p3', 'p2']
    expect(state.seats).toEqual(['p1', 'p3', 'p2']);
    expect(state.players['p3'].reEntryCount).toBe(1);

    // Now edit Round 1: suppose p3 actually had open drop (24 points) instead of 105!
    state = gameReducer(state, {
      type: 'EDIT_LAST_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'middle_drop', points: 48 },
          p3: { type: 'open_drop', points: 24 }, // NOT eliminated!
        },
      },
    });

    // Re-entry must be cancelled! Seating order must be restored to original ['p1', 'p2', 'p3']
    expect(state.seats).toEqual(['p1', 'p2', 'p3']);
    // Re-entry count must be restored to 0
    expect(state.players['p3'].reEntryCount).toBe(0);
    expect(state.players['p3'].reEntryScore).toBeUndefined();
    // Round cumulative scores reflect the edited score 24
    expect(state.rounds[0].cumulativeScores['p3']).toBe(24);
    expect(state.rounds[0].reEnteredInRound).toEqual([]);
  });

  it('completes game on ACCEPT_DEAL and permanently settles match without cancellation', () => {
    const players = [
      { id: 'p1', name: 'Akka', avatarColor: '#10b981', reEntryCount: 0 },
      { id: 'p2', name: 'Pavan', avatarColor: '#3b82f6', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Deal Test',
        rules: { ...DEFAULT_RULES, poolLimit: 201, entryAmount: 100 },
        players,
        initialSeats: ['p1', 'p2'],
        initialDealerIndex: 0,
      },
    });

    expect(state.status).toBe('playing');
    expect(state.dealSplit).toBeUndefined();

    state = gameReducer(state, {
      type: 'ACCEPT_DEAL',
      payload: {
        dealSplit: {
          mode: 'proportional',
          payouts: { p1: 140, p2: 60 },
          scoresSnapshot: { p1: 50, p2: 120 },
          totalPool: 200,
          timestamp: 12345678,
        },
      },
    });

    expect(state.status).toBe('completed');
    expect(state.dealSplit).toBeDefined();
    expect(state.dealSplit?.payouts).toEqual({ p1: 140, p2: 60 });

    // While deal is accepted, re-entry is completely blocked
    const stateWhileDealSettled = state;
    const reEntryAttemptState = gameReducer(state, {
      type: 'RE_ENTER_PLAYER',
      payload: { playerId: 'p2' },
    });
    expect(reEntryAttemptState).toBe(stateWhileDealSettled);
  });

  it('safely handles RE_ENTER_PLAYER when lastRound.reEnteredInRound is undefined', () => {
    const players = [
      { id: 'p1', name: 'P1', avatarColor: '#10b981', reEntryCount: 0 },
      { id: 'p2', name: 'P2', avatarColor: '#3b82f6', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Legacy Round Test',
        rules: { ...DEFAULT_RULES, poolLimit: 101, allowReEntry: true },
        players,
        initialSeats: ['p1', 'p2'],
        initialDealerIndex: 0,
      },
    });

    // Round 1: p2 gets 105 points and is eliminated
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'show', points: 0 },
          p2: { type: 'custom', points: 105 },
        },
      },
    });

    // Simulate legacy round without reEnteredInRound field
    const legacyRound: Partial<RoundRecord> = { ...state.rounds[0] };
    delete legacyRound.reEnteredInRound;
    state = { ...state, rounds: [legacyRound as RoundRecord] };

    // Re-entering p2 must not throw TypeError: lastRound.reEnteredInRound is not iterable
    expect(() => {
      state = gameReducer(state, {
        type: 'RE_ENTER_PLAYER',
        payload: { playerId: 'p2' },
      });
    }).not.toThrow();

    expect(state.players['p2'].reEntryCount).toBe(1);
    expect(state.rounds[0].reEnteredInRound).toEqual(['p2']);
  });

  it('restores original seats on UNDO_ROUND when round 1 had re-entry relocation', () => {
    const players = [
      { id: 'p1', name: 'P1', avatarColor: '#10b981', reEntryCount: 0 },
      { id: 'p2', name: 'P2', avatarColor: '#3b82f6', reEntryCount: 0 },
      { id: 'p3', name: 'P3', avatarColor: '#f59e0b', reEntryCount: 0 },
    ];

    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Undo Round 1 Seating Test',
        rules: { ...DEFAULT_RULES, poolLimit: 101, allowReEntry: true },
        players,
        initialSeats: ['p1', 'p2', 'p3'],
        initialDealerIndex: 1, // p2 deals
      },
    });

    // Round 1: p3 eliminated
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: {
        roundScores: {
          p1: { type: 'open_drop', points: 20 },
          p2: { type: 'show', points: 0 },
          p3: { type: 'custom', points: 105 },
        },
      },
    });

    // p3 re-enters and seats relocate
    state = gameReducer(state, {
      type: 'RE_ENTER_PLAYER',
      payload: { playerId: 'p3' },
    });
    expect(state.seats).not.toEqual(['p1', 'p2', 'p3']);

    // Undo Round 1
    state = gameReducer(state, { type: 'UNDO_ROUND' });

    // Seating order must be restored to original initialSeats
    expect(state.seats).toEqual(['p1', 'p2', 'p3']);
    expect(state.rounds.length).toBe(0);
  });
});
