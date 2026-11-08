import { GameRules, PlayerId } from './types';

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
