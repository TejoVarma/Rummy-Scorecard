import { describe, it, expect } from 'vitest';
import {
  isEliminated,
  calculateReEntryScore,
  isEligibleForReEntry,
  getActivePlayerIds,
  getEligibleForReEntryPlayers,
  getDropStatus,
  getRemainingDrops,
  analyzePlayerDrops,
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

    it('returns empty when a player eliminated in the round has already re-entered in that round', () => {
      const rounds: RoundRecord[] = [
        {
          roundNumber: 1,
          dealerPlayerId: 'p1',
          scores: {} as any,
          cumulativeScores: { p1: 40, p2: 50, p3: 51 }, // p3 re-entered with score 51!
          seatsSnapshot: seats,
          playersSnapshot: {} as any,
          eliminatedInRound: ['p3'],
          reEnteredInRound: ['p3'], // already re-entered!
          timestamp: 1000,
        },
      ];

      const eligible = getEligibleForReEntryPlayers(rounds, seats, DEFAULT_RULES);
      expect(eligible).toEqual([]);
    });

    it('returns empty when deal is settled (isDealSettled = true)', () => {
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

      const eligible = getEligibleForReEntryPlayers(rounds, seats, DEFAULT_RULES, true);
      expect(eligible).toEqual([]);
    });
  });

  describe('getDropStatus and getRemainingDrops', () => {
    // Standard 201 pool with open drop = 20
    const pool201 = 201;
    const drop20 = 20;

    it('identifies safe players with 2 or more drops remaining', () => {
      // Score 0: 10 drops remaining
      expect(getDropStatus(0, pool201, drop20)).toBe('safe');
      expect(getRemainingDrops(0, pool201, drop20)).toBe(10);

      // Score 160: 2 drops remaining (160 + 20 = 180, 180 + 20 = 200 < 201)
      expect(getDropStatus(160, pool201, drop20)).toBe('safe');
      expect(getRemainingDrops(160, pool201, drop20)).toBe(2);
    });

    it('identifies one_drop players with exactly 1 drop remaining (yellow)', () => {
      // Score 161: 1 drop remaining (161 + 20 = 181, 181 + 20 = 201 >= 201)
      expect(getDropStatus(161, pool201, drop20)).toBe('one_drop');
      expect(getRemainingDrops(161, pool201, drop20)).toBe(1);

      // Score 180 (exact screenshot case): 1 drop remaining (180 + 20 = 200 < 201)
      expect(getDropStatus(180, pool201, drop20)).toBe('one_drop');
      expect(getRemainingDrops(180, pool201, drop20)).toBe(1);
    });

    it('identifies compulsory players with 0 drops remaining (red)', () => {
      // Score 181: 0 drops remaining (181 + 20 = 201 >= 201)
      expect(getDropStatus(181, pool201, drop20)).toBe('compulsory');
      expect(getRemainingDrops(181, pool201, drop20)).toBe(0);

      // Score 200: 0 drops remaining (200 + 20 = 220 >= 201)
      expect(getDropStatus(200, pool201, drop20)).toBe('compulsory');
      expect(getRemainingDrops(200, pool201, drop20)).toBe(0);
    });

    it('identifies eliminated players at or above pool limit', () => {
      expect(getDropStatus(201, pool201, drop20)).toBe('out');
      expect(getRemainingDrops(201, pool201, drop20)).toBe(-1);

      expect(getDropStatus(240, pool201, drop20)).toBe('out');
      expect(getRemainingDrops(240, pool201, drop20)).toBe(-1);
    });

    it('handles 101 pool with open drop = 20', () => {
      const pool101 = 101;
      // Score 60: safe (60 + 20 = 80, 80 + 20 = 100 < 101)
      expect(getDropStatus(60, pool101, drop20)).toBe('safe');
      // Score 80: one_drop (80 + 20 = 100 < 101)
      expect(getDropStatus(80, pool101, drop20)).toBe('one_drop');
      // Score 81: compulsory (81 + 20 = 101 >= 101)
      expect(getDropStatus(81, pool101, drop20)).toBe('compulsory');
      // Score 101: out
      expect(getDropStatus(101, pool101, drop20)).toBe('out');
    });

    it('performs comprehensive drop analysis including middle drop and full count', () => {
      // Score 150 in 201 pool (openDrop: 20, middleDrop: 40, fullCount: 80)
      const safeAnalysis = analyzePlayerDrops(150, 201, 20, 40, 80);
      expect(safeAnalysis.status).toBe('safe');
      expect(safeAnalysis.canOpenDrop).toBe(true);
      expect(safeAnalysis.canMiddleDrop).toBe(true);
      expect(safeAnalysis.canTwoOpenDrops).toBe(true);
      expect(safeAnalysis.canFullCount).toBe(false); // 150 + 80 = 230 >= 201

      // Score 180 (Bava in screenshot): can open drop (200), cannot middle drop (220)
      const oneDropAnalysis = analyzePlayerDrops(180, 201, 20, 40, 80);
      expect(oneDropAnalysis.status).toBe('one_drop');
      expect(oneDropAnalysis.canOpenDrop).toBe(true);
      expect(oneDropAnalysis.canMiddleDrop).toBe(false);
      expect(oneDropAnalysis.canTwoOpenDrops).toBe(false);
      expect(oneDropAnalysis.openDropsRemaining).toBe(1);

      // Score 181: cannot even open drop (201 >= 201)
      const compulsoryAnalysis = analyzePlayerDrops(181, 201, 20, 40, 80);
      expect(compulsoryAnalysis.status).toBe('compulsory');
      expect(compulsoryAnalysis.canOpenDrop).toBe(false);
      expect(compulsoryAnalysis.canMiddleDrop).toBe(false);
      expect(compulsoryAnalysis.openDropsRemaining).toBe(0);

      // Asymmetric drops: openDrop = 15, middleDrop = 45 in 201 pool
      // Score 160: 160 + 15 = 175 < 201, 160 + 30 = 190 < 201, but 160 + 45 = 205 >= 201 (no MD!)
      const asymAnalysis = analyzePlayerDrops(160, 201, 15, 45, 80);
      expect(asymAnalysis.status).toBe('one_drop');
      expect(asymAnalysis.canMiddleDrop).toBe(false);
      expect(asymAnalysis.canTwoOpenDrops).toBe(true);

      // Defensive guard for non-positive openDrop
      expect(getRemainingDrops(50, 201, 0)).toBe(0);
      expect(getRemainingDrops(50, 201, -10)).toBe(0);
    });
  });
});
