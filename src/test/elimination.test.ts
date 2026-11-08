import { describe, it, expect } from 'vitest';
import {
  isEliminated,
  calculateReEntryScore,
  isEligibleForReEntry,
  getActivePlayerIds,
  getEligibleForReEntryPlayers,
} from '../domain/elimination';
import { DEFAULT_RULES } from '../domain/scoring';
import { RoundRecord } from '../domain/types';

describe('elimination domain tests', () => {
  it('detects elimination at or above pool limit (e.g. 201)', () => {
    expect(isEliminated(200, 201)).toBe(false);
    expect(isEliminated(201, 201)).toBe(true);
    expect(isEliminated(245, 201)).toBe(true);
  });

  it('calculates re-entry score as highest active score + 1', () => {
    const activeScores = [45, 120, 168, 88];
    // Highest is 168, so re-entry should be 169
    expect(calculateReEntryScore(activeScores, DEFAULT_RULES)).toBe(169);
  });

  it('determines re-entry eligibility', () => {
    expect(isEligibleForReEntry(169, 201)).toBe(true);
    expect(isEligibleForReEntry(201, 201)).toBe(false);
    expect(isEligibleForReEntry(202, 201)).toBe(false);
  });

  it('filters active players correctly', () => {
    const players = ['p1', 'p2', 'p3', 'p4'];
    const cumulative = { p1: 180, p2: 201, p3: 94, p4: 215 };
    const active = getActivePlayerIds(players, cumulative, 201);
    expect(active.has('p1')).toBe(true);
    expect(active.has('p3')).toBe(true);
    expect(active.has('p2')).toBe(false);
    expect(active.has('p4')).toBe(false);
  });

  describe('getEligibleForReEntryPlayers', () => {
    const seats = ['p1', 'p2', 'p3'];

    it('returns players eliminated in the most recent round', () => {
      const rounds: RoundRecord[] = [
        {
          roundNumber: 1,
          dealerPlayerId: 'p1',
          scores: {} as any,
          cumulativeScores: { p1: 40, p2: 50, p3: 205 },
          seatsSnapshot: seats,
          playersSnapshot: {} as any,
          eliminatedInRound: ['p3'],
          reEnteredInRound: [],
          timestamp: 1000,
        },
      ];

      const eligible = getEligibleForReEntryPlayers(rounds, seats, DEFAULT_RULES);
      expect(eligible).toEqual(['p3']);
    });

    it('denies re-entry for a player eliminated in an earlier round if a subsequent round has been played', () => {
      const rounds: RoundRecord[] = [
        // Round 1: p3 eliminated
        {
          roundNumber: 1,
          dealerPlayerId: 'p1',
          scores: {} as any,
          cumulativeScores: { p1: 40, p2: 50, p3: 205 },
          seatsSnapshot: seats,
          playersSnapshot: {} as any,
          eliminatedInRound: ['p3'],
          reEnteredInRound: [],
          timestamp: 1000,
        },
        // Round 2: p3 did not re-enter. Round 2 is played by p1 and p2.
        {
          roundNumber: 2,
          dealerPlayerId: 'p2',
          scores: {} as any,
          cumulativeScores: { p1: 64, p2: 50, p3: 205 },
          seatsSnapshot: seats,
          playersSnapshot: {} as any,
          eliminatedInRound: [], // nobody eliminated in round 2
          reEnteredInRound: [],
          timestamp: 2000,
        },
      ];

      // Since p3 was eliminated in round 1 and round 2 has already completed without them,
      // p3 is NOT eligible to re-enter for round 3!
      const eligible = getEligibleForReEntryPlayers(rounds, seats, DEFAULT_RULES);
      expect(eligible).toEqual([]);
    });

    it('returns empty when re-entry score would equal or exceed the pool limit', () => {
      const rounds: RoundRecord[] = [
        {
          roundNumber: 1,
          dealerPlayerId: 'p1',
          scores: {} as any,
          // Highest active score is 200. Re-entry score = 200 + 1 = 201 (>= 201 poolLimit)
          cumulativeScores: { p1: 200, p2: 80, p3: 205 },
          seatsSnapshot: seats,
          playersSnapshot: {} as any,
          eliminatedInRound: ['p3'],
          reEnteredInRound: [],
          timestamp: 1000,
        },
      ];

      const eligible = getEligibleForReEntryPlayers(rounds, seats, DEFAULT_RULES);
      expect(eligible).toEqual([]);
    });

    it('returns empty when allowReEntry is false', () => {
      const rounds: RoundRecord[] = [
        {
          roundNumber: 1,
          dealerPlayerId: 'p1',
          scores: {} as any,
          cumulativeScores: { p1: 40, p2: 50, p3: 205 },
          seatsSnapshot: seats,
          playersSnapshot: {} as any,
          eliminatedInRound: ['p3'],
          reEnteredInRound: [],
          timestamp: 1000,
        },
      ];

      const eligible = getEligibleForReEntryPlayers(rounds, seats, { ...DEFAULT_RULES, allowReEntry: false });
      expect(eligible).toEqual([]);
    });
  });
});
