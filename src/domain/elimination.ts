import { GameRules, PlayerId, RoundRecord } from './types';

export type DropStatus = 'safe' | 'one_drop' | 'compulsory' | 'out';

/**
 * Calculates whether a player is safe, has 1 drop left, is compulsory (0 drops), or is eliminated.
 * - 'out': score >= poolLimit
 * - 'compulsory': score + openDrop >= poolLimit (0 open drops remaining, must play!)
 * - 'one_drop': score + openDrop < poolLimit BUT score + 2 * openDrop >= poolLimit (exactly 1 open drop remaining)
 * - 'safe': score + 2 * openDrop < poolLimit (2 or more drops remaining)
 */
export function getDropStatus(score: number, poolLimit: number, openDrop: number): DropStatus {
  if (score >= poolLimit) {
    return 'out';
  }
  if (score + openDrop >= poolLimit) {
    return 'compulsory';
  }
  if (score + 2 * openDrop >= poolLimit) {
    return 'one_drop';
  }
  return 'safe';
}

/**
 * Returns the exact number of open drops remaining before elimination.
 * Returns 0 if compulsory, or -1 if already eliminated.
 */
export function getRemainingDrops(score: number, poolLimit: number, openDrop: number): number {
  if (score >= poolLimit) return -1;
  const margin = poolLimit - 1 - score;
  return Math.max(0, Math.floor(margin / openDrop));
}

/**
 * Checks whether a cumulative score has reached or crossed the pool limit.
 */
export function isEliminated(score: number, poolLimit: number): boolean {
  return score >= poolLimit;
}

/**
 * Calculates the exact re-entry score.
 * Formula: Highest active player score + 1.
 */
export function calculateReEntryScore(
  activeScores: number[],
  rules: GameRules
): number {
  if (activeScores.length === 0) return 0;
  
  if (rules.reEntryScoreMode === 'highest_plus_one') {
    const highest = Math.max(...activeScores);
    return highest + 1;
  }
  
  return Math.max(...activeScores);
}

/**
 * Determines whether a player is eligible to re-enter.
 * Standard Indian Rummy condition: Re-entry score must be strictly less than the pool limit.
 */
export function isEligibleForReEntry(
  reEntryScore: number,
  poolLimit: number
): boolean {
  return reEntryScore < poolLimit;
}

/**
 * Identifies all active player IDs given cumulative scores and pool limit.
 */
export function getActivePlayerIds(
  playerIds: PlayerId[],
  cumulativeScores: Record<PlayerId, number>,
  poolLimit: number
): Set<PlayerId> {
  const active = new Set<PlayerId>();
  for (const id of playerIds) {
    const score = cumulativeScores[id] ?? 0;
    if (!isEliminated(score, poolLimit)) {
      active.add(id);
    }
  }
  return active;
}

/**
 * Determines which players are currently eligible for re-entry.
 * In Indian Pool Rummy:
 * 1. Re-entry must be allowed by rules.
 * 2. Only players who got eliminated in the MOST RECENT round have the chance to re-enter for the very next round.
 *    If a subsequent round has already been played without them re-entering, their window has closed.
 * 3. The player must still be eliminated (has not already re-entered).
 * 4. Re-entry score (highest active score + 1) must be strictly less than the pool limit.
 */
export function getEligibleForReEntryPlayers(
  rounds: RoundRecord[],
  seats: PlayerId[],
  rules: GameRules
): PlayerId[] {
  if (!rules.allowReEntry || rounds.length === 0) {
    return [];
  }

  const lastRound = rounds[rounds.length - 1];
  const latestScores = lastRound.cumulativeScores;

  // Players who crossed the pool limit in the most recent round
  const candidates = (lastRound.eliminatedInRound ?? []).filter(
    id => (latestScores[id] ?? 0) >= rules.poolLimit
  );

  if (candidates.length === 0) {
    return [];
  }

  // Active player scores (players still under pool limit)
  const activeScores = seats
    .filter(id => (latestScores[id] ?? 0) < rules.poolLimit)
    .map(id => latestScores[id] ?? 0);

  if (activeScores.length === 0) {
    return [];
  }

  const potentialReEntryScore = calculateReEntryScore(activeScores, rules);
  if (!isEligibleForReEntry(potentialReEntryScore, rules.poolLimit)) {
    return [];
  }

  return candidates;
}
