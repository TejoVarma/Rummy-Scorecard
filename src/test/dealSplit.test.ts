import { describe, it, expect } from 'vitest';
import {
  calculateProportionalDeal,
  calculateEqualDeal,
  validateCustomDeal,
  formatDealSummary,
} from '../domain/dealSplit';
import { DealSplit } from '../domain/types';

describe('dealSplit domain tests', () => {
  it('calculates points proportional deal correctly where lower score gets higher payout', () => {
    // 201 Pool, Total Pool = 1000
    // Player A has 120 points (Margin: 81)
    // Player B has 160 points (Margin: 41)
    // Total Margin: 122
    // Share A: round(1000 * 81 / 122) = 664
    // Share B: 1000 - 664 = 336
    const payouts = calculateProportionalDeal(201, 1000, [
      { playerId: 'p1', score: 120 },
      { playerId: 'p2', score: 160 },
    ]);

    expect(payouts.p1).toBe(664);
    expect(payouts.p2).toBe(336);
    expect(payouts.p1 + payouts.p2).toBe(1000);
  });

  it('finishes quickly even for a pool too large to add up exactly', () => {
    const payouts = calculateProportionalDeal(201, 1e300, [
      { playerId: 'p1', score: 166 },
      { playerId: 'p2', score: 98 },
      { playerId: 'p3', score: 49 },
    ]);
    expect(Object.keys(payouts)).toHaveLength(3);
  });

  it('guarantees total sum strictly matches total pool with 3 players', () => {
    const payouts = calculateProportionalDeal(201, 700, [
      { playerId: 'p1', score: 50 },
      { playerId: 'p2', score: 120 },
      { playerId: 'p3', score: 170 },
    ]);

    const totalAllocated = payouts.p1 + payouts.p2 + payouts.p3;
    expect(totalAllocated).toBe(700);
    // Leader (lowest score) must get highest payout
    expect(payouts.p1).toBeGreaterThan(payouts.p2);
    expect(payouts.p2).toBeGreaterThan(payouts.p3);
  });

  it('splits equally when players have identical scores', () => {
    const payouts = calculateProportionalDeal(201, 600, [
      { playerId: 'p1', score: 100 },
      { playerId: 'p2', score: 100 },
    ]);

    expect(payouts.p1).toBe(300);
    expect(payouts.p2).toBe(300);
  });

  it('guarantees sum strictly matches total pool even when fractional shares round up (edge case)', () => {
    // 4 players with identical scores in a small pool of 2
    const payouts = calculateProportionalDeal(201, 2, [
      { playerId: 'p1', score: 100 },
      { playerId: 'p2', score: 100 },
      { playerId: 'p3', score: 100 },
      { playerId: 'p4', score: 100 },
    ]);

    const sum = Object.values(payouts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(2);
  });

  it('handles empty active players or zero pool gracefully', () => {
    expect(calculateProportionalDeal(201, 0, [{ playerId: 'p1', score: 10 }])).toEqual({ p1: 0 });
    expect(calculateProportionalDeal(201, 500, [])).toEqual({});
  });

  it('calculates equal deal with remainder correctly allocated', () => {
    const payouts = calculateEqualDeal(1000, ['p1', 'p2', 'p3']);
    expect(payouts.p1).toBe(334); // 333 + 1 remainder
    expect(payouts.p2).toBe(333);
    expect(payouts.p3).toBe(333);
    expect(payouts.p1 + payouts.p2 + payouts.p3).toBe(1000);
  });

  it('validates custom deal allocations accurately', () => {
    const valid = validateCustomDeal(1000, { p1: 600, p2: 400 });
    expect(valid.isValid).toBe(true);
    expect(valid.difference).toBe(0);

    const invalidUnder = validateCustomDeal(1000, { p1: 500, p2: 400 });
    expect(invalidUnder.isValid).toBe(false);
    expect(invalidUnder.difference).toBe(100);

    const invalidOver = validateCustomDeal(1000, { p1: 700, p2: 400 });
    expect(invalidOver.isValid).toBe(false);
    expect(invalidOver.difference).toBe(-100);

    const invalidNegative = validateCustomDeal(1000, { p1: 1500, p2: -500 });
    expect(invalidNegative.isValid).toBe(false);
  });

  it('formats deal summary string cleanly for sharing', () => {
    const deal: DealSplit = {
      mode: 'proportional',
      totalPool: 700,
      timestamp: Date.now(),
      scoresSnapshot: { p1: 120, p2: 168 },
      payouts: { p1: 497, p2: 203 },
    };
    const players = {
      p1: { id: 'p1', name: 'Akka', avatarColor: '#10b981', reEntryCount: 0 },
      p2: { id: 'p2', name: 'Pavan', avatarColor: '#3b82f6', reEntryCount: 1 },
    };

    const text = formatDealSummary(deal, players);
    expect(text).toContain('Pool Deal Split (Total ₹700)');
    expect(text).toContain('Akka: ₹497 (120 pts)');
    expect(text).toContain('Pavan: ₹203 (168 pts)');
  });
});
