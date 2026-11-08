import { describe, it, expect } from 'vitest';
import {
  isEliminated,
  calculateReEntryScore,
  isEligibleForReEntry,
  getActivePlayerIds,
} from '../domain/elimination';
import { DEFAULT_RULES } from '../domain/scoring';

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
});
