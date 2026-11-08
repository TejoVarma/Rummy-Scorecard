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

/**
 * Validates a custom deal split.
 * Returns isValid = true if sum of payouts equals totalPool.
 */
export function validateCustomDeal(
  totalPool: number,
  payouts: Record<PlayerId, number>
): { isValid: boolean; allocatedTotal: number; difference: number } {
  const allocatedTotal = Object.values(payouts).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const difference = totalPool - allocatedTotal;
  return {
    isValid: difference === 0,
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
