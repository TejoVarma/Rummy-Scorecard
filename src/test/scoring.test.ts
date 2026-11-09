import { describe, it, expect } from 'vitest';
import { getPointsForInputType, validateRoundScores, DEFAULT_RULES } from '../domain/scoring';

describe('scoring domain tests', () => {
  it('returns default 24 for open drop and 48 for middle drop in Indian Rummy', () => {
    expect(getPointsForInputType('open_drop', undefined, DEFAULT_RULES)).toBe(24);
    expect(getPointsForInputType('middle_drop', undefined, DEFAULT_RULES)).toBe(48);
    expect(getPointsForInputType('full_count', undefined, DEFAULT_RULES)).toBe(80);
    expect(getPointsForInputType('show', undefined, DEFAULT_RULES)).toBe(0);
  });

  it('caps custom score at full count (80)', () => {
    expect(getPointsForInputType('custom', 35, DEFAULT_RULES)).toBe(35);
    expect(getPointsForInputType('custom', 95, DEFAULT_RULES)).toBe(80);
    expect(getPointsForInputType('custom', -5, DEFAULT_RULES)).toBe(0);
  });

  it('validates that exactly one player has Show (0 pts)', () => {
    const scores = {
      p1: { type: 'show' as const, points: 0 },
      p2: { type: 'open_drop' as const, points: 24 },
      p3: { type: 'middle_drop' as const, points: 48 },
    };
    const res = validateRoundScores(scores, ['p1', 'p2', 'p3'], DEFAULT_RULES);
    expect(res.valid).toBe(true);

    // No winner
    const noWinner = {
      p1: { type: 'open_drop' as const, points: 24 },
      p2: { type: 'open_drop' as const, points: 24 },
    };
    expect(validateRoundScores(noWinner, ['p1', 'p2'], DEFAULT_RULES).valid).toBe(false);

    // Multiple winners
    const multiWinners = {
      p1: { type: 'show' as const, points: 0 },
      p2: { type: 'show' as const, points: 0 },
    };
    expect(validateRoundScores(multiWinners, ['p1', 'p2'], DEFAULT_RULES).valid).toBe(false);
  });
});
