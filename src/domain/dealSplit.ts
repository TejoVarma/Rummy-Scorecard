import { PlayerId, DealSplit, Player } from './types';

/**
 * Calculates a proportional pool split based on points margin remaining before poolLimit.
 * A player with fewer penalty points has a larger margin to poolLimit, thus earning
 * a proportionally larger share of the prize pool.
 *
 * Margin = max(1, poolLimit - score)
 * Any rounding discrepancies are adjusted against the leader (highest margin).
 */
export function calculateProportionalDeal(
  poolLimit: number,
  totalPool: number,
  activePlayers: { playerId: PlayerId; score: number }[]
): Record<PlayerId, number> {
  const payouts: Record<PlayerId, number> = {};
  if (activePlayers.length === 0 || totalPool <= 0) {
    activePlayers.forEach(p => {
      payouts[p.playerId] = 0;
    });
    return payouts;
  }

  // Margin to elimination (minimum 1 to avoid zero division)
  const margins = activePlayers.map(p => ({
    playerId: p.playerId,
    margin: Math.max(1, poolLimit - p.score),
  }));

  const totalMargin = margins.reduce((sum, m) => sum + m.margin, 0);

  // Largest Remainder Method (Hare-Niemeyer method):
  // Guarantees sum of payouts strictly equals totalPool in 100% of mathematical cases
  const exactShares = margins.map(m => {
    const exact = (m.margin / totalMargin) * totalPool;
    const floor = Math.floor(exact);
    return {
      playerId: m.playerId,
      margin: m.margin,
      exact,
      floor,
      remainder: exact - floor,
    };
  });

  const sumFloor = exactShares.reduce((s, x) => s + x.floor, 0);
  const leftToDistribute = totalPool - sumFloor;

  // Sort by largest remainder descending; break ties by highest margin (leader)
  const sorted = [...exactShares].sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 0.000001) {
      return b.remainder - a.remainder;
    }
    return b.margin - a.margin;
  });

  exactShares.forEach(x => {
    payouts[x.playerId] = x.floor;
  });

  for (let i = 0; i < leftToDistribute; i++) {
    payouts[sorted[i % sorted.length].playerId] += 1;
  }

  return payouts;
}

/**
 * Calculates an equal pool split among active players.
 * Any remainder is allocated to the leader/first player.
 */
export function calculateEqualDeal(
  totalPool: number,
  activePlayerIds: PlayerId[]
): Record<PlayerId, number> {
  const payouts: Record<PlayerId, number> = {};
  if (activePlayerIds.length === 0 || totalPool <= 0) {
    activePlayerIds.forEach(id => {
      payouts[id] = 0;
    });
    return payouts;
  }

  const count = activePlayerIds.length;
  const baseShare = Math.floor(totalPool / count);
  let remainder = totalPool - baseShare * count;

  activePlayerIds.forEach(id => {
    payouts[id] = baseShare + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  });

  return payouts;
}

export interface DropShareInput {
  playerId: PlayerId;
  drops: number;
}

/**
 * Splits the pool by drops, in three steps (a "waterfall"):
 *   1. everyone gets one stake back, re-entries included;
 *   2. each open drop a player still has is worth one stake, paid from what's left; if
 *      there isn't enough to pay every drop, what's left is shared in proportion to drops;
 *   3. anything still left is shared equally.
 * Amounts are whole rupees that add up to the pool; odd rupees go to whoever has more drops.
 */
export function calculateDropDeal(
  totalPool: number,
  stake: number,
  players: DropShareInput[]
): Record<PlayerId, number> {
  const count = players.length;
  if (count === 0) return {};

  // A pool too small to return every stake can only be shared equally.
  const stakeBack = totalPool >= stake * count ? stake : 0;
  let remaining = totalPool - stakeBack * count;

  const totalDrops = players.reduce((sum, p) => sum + p.drops, 0);
  const dropValue = totalDrops * stake;
  const dropShare = (p: DropShareInput) => {
    if (totalDrops === 0 || stake === 0) return 0;
    return dropValue <= remaining ? p.drops * stake : (remaining * p.drops) / totalDrops;
  };
  const dropPaid = players.map(dropShare);
  remaining -= dropPaid.reduce((a, b) => a + b, 0);

  const exact = players.map((p, i) => ({
    player: p,
    order: i,
    amount: stakeBack + dropPaid[i] + remaining / count,
  }));
  return roundToRupees(exact, totalPool);
}

// Largest-remainder rounding: round everyone down, then hand the missing rupees to the
// biggest fractions, breaking ties in favour of more drops.
function roundToRupees(
  shares: { player: DropShareInput; order: number; amount: number }[],
  totalPool: number
): Record<PlayerId, number> {
  const payouts: Record<PlayerId, number> = {};
  const floored = shares.map(s => ({ ...s, floor: Math.floor(s.amount + 1e-9), fraction: 0 }));
  floored.forEach(s => (s.fraction = s.amount - s.floor));
  let missing = Math.round(totalPool - floored.reduce((sum, s) => sum + s.floor, 0));

  // Fractions like 0.67 aren't stored exactly, so two "equal" ones can differ by a hair.
  // Anything closer than a millionth of a rupee counts as a tie, settled by drops.
  const byClaim = [...floored].sort((a, b) => {
    const diff = b.fraction - a.fraction;
    if (Math.abs(diff) > 1e-6) return diff;
    return b.player.drops - a.player.drops || a.order - b.order;
  });
  for (const s of floored) payouts[s.player.playerId] = s.floor;
  for (let i = 0; missing > 0 && byClaim.length > 0; i++, missing--) {
    payouts[byClaim[i % byClaim.length].player.playerId] += 1;
  }
  return payouts;
}

/**
 * Validates a custom deal split.
 * Returns isValid = true if sum of payouts equals totalPool.
 */
export function validateCustomDeal(
  totalPool: number,
  payouts: Record<PlayerId, number>
): { isValid: boolean; allocatedTotal: number; difference: number } {
  const numericValues = Object.values(payouts).map(val => Number(val) || 0);
  const hasNegative = numericValues.some(val => val < 0);
  const allocatedTotal = numericValues.reduce((sum, val) => sum + val, 0);
  const difference = totalPool - allocatedTotal;
  return {
    isValid: difference === 0 && !hasNegative && totalPool >= 0,
    allocatedTotal,
    difference,
  };
}

/**
 * Formats a deal split summary for sharing or display.
 */
export function formatDealSummary(
  dealSplit: DealSplit,
  players: Record<PlayerId, Player>
): string {
  const lines: string[] = [];
  lines.push(`🤝 *Pool Deal Split (Total ₹${dealSplit.totalPool})*`);
  const modeLabel =
    dealSplit.mode === 'proportional'
      ? 'Points Proportional'
      : dealSplit.mode === 'equal'
      ? 'Equal Split'
      : dealSplit.mode === 'drops'
      ? 'Drop Split (stakes back, then drops)'
      : 'Negotiated Deal';
  lines.push(`Mode: ${modeLabel}`);
  lines.push('');

  for (const [id, payout] of Object.entries(dealSplit.payouts)) {
    const name = players[id]?.name || 'Player';
    const score = dealSplit.scoresSnapshot[id];
    const scoreNote = score !== undefined ? ` (${score} pts)` : '';
    lines.push(`• ${name}: ₹${payout}${scoreNote}`);
  }

  return lines.join('\n');
}
