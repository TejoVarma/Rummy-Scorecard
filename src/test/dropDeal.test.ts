import { describe, it, expect } from 'vitest';
import { calculateDropDeal } from '../domain/dealSplit';

const STAKE = 500;

function split(pool: number, drops: number[]) {
  const players = drops.map((d, i) => ({ playerId: `p${i + 1}`, drops: d }));
  const payouts = calculateDropDeal(pool, STAKE, players);
  return players.map(p => payouts[p.playerId]);
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('drop split: stakes back, then drops, then the rest equally', () => {
  it.each([
    // Tejo's three-player cases (₹500 stake)
    ['A: different drops, money left over', 4500, [3, 1, 0], [2334, 1333, 833]],
    ['B: not enough to pay every drop, shared 4 : 2', 3000, [4, 2, 0], [1500, 1000, 500]],
    ['C: two players tied on drops', 3000, [2, 2, 0], [1250, 1250, 500]],
    ['D: nobody has drops, everything equal', 3000, [0, 0, 0], [1000, 1000, 1000]],
    // Tejo's two-player examples
    ['2 drops vs none', 3000, [2, 0], [2000, 1000]],
    ['5 drops vs none: the other player keeps only the stake', 3000, [5, 0], [2500, 500]],
    ['6 drops vs none after a re-entry', 3500, [6, 0], [3000, 500]],
  ])('%s', (_, pool, drops, expected) => {
    const result = split(pool, drops);
    expect(result).toEqual(expected);
    expect(sum(result)).toBe(pool);
  });

  it('never pays anyone less than their stake', () => {
    for (const drops of [[8, 0, 0], [1, 9, 0, 0], [0, 0, 12]]) {
      const pool = drops.length * STAKE + 700;
      expect(Math.min(...split(pool, drops))).toBeGreaterThanOrEqual(STAKE);
    }
  });

  it('rounds to whole rupees and still adds up to the exact pool', () => {
    for (const [pool, drops] of [[4700, [3, 1, 0]], [5100, [2, 2, 1, 0]], [3100, [1, 1, 1]]] as const) {
      const result = split(pool, [...drops]);
      expect(result.every(Number.isInteger)).toBe(true);
      expect(sum(result)).toBe(pool);
    }
  });

  it('gives an odd rupee to the player with the most drops', () => {
    // ₹1000 left after stakes and drops, split three ways: 333.33 each, one rupee over.
    const [p1, p2, p3] = split(4500, [3, 1, 0]);
    expect(p1 - 1500 - 500).toBe(334);
    expect(p2).toBe(1333);
    expect(p3).toBe(833);
  });

  it('with no stake set, just splits the pool equally', () => {
    const payouts = calculateDropDeal(0, 0, [{ playerId: 'a', drops: 2 }, { playerId: 'b', drops: 0 }]);
    expect(payouts).toEqual({ a: 0, b: 0 });
  });
});
