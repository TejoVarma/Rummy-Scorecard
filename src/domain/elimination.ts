import { GameRules, PlayerId, RoundRecord } from './types';

export type DropStatus = 'safe' | 'one_drop' | 'compulsory' | 'out';

export interface PlayerDropAnalysis {
  status: DropStatus;
  remainingMargin: number;
  openDropsRemaining: number;
  canOpenDrop: boolean;
  canMiddleDrop: boolean;
  canTwoOpenDrops: boolean;
}

/**
 * Accurately analyzes player drop status by taking into account:
 * - total cumulative score
 * - pool limit (101, 201, custom)
 * - open drop score
 * - middle drop (MD) score
 *
 * Rules:
 * - 'out': score >= poolLimit
 * - 'compulsory': score + openDrop >= poolLimit (cannot even take open drop; 0 drops remaining)
 * - 'one_drop': can take 1 open drop, but cannot take 2 open drops OR cannot middle drop (MD)
 * - 'safe': can take at least 2 open drops AND can take middle drop (MD)
 */
export function analyzePlayerDrops(
  score: number,
  poolLimit: number,
  openDrop: number,
  middleDrop: number = openDrop * 2
): PlayerDropAnalysis {
  if (score >= poolLimit) {
    return {
      status: 'out',
      remainingMargin: 0,
      openDropsRemaining: -1,
      canOpenDrop: false,
      canMiddleDrop: false,
      canTwoOpenDrops: false,
    };
  }

  const safeOpenDrop = openDrop > 0 ? openDrop : 20;
  const safeMiddleDrop = middleDrop > 0 ? middleDrop : safeOpenDrop * 2;
  const remainingMargin = Math.max(0, poolLimit - 1 - score);

  const canOpenDrop = score + safeOpenDrop < poolLimit;
  const canTwoOpenDrops = score + 2 * safeOpenDrop < poolLimit;
  const canMiddleDrop = score + safeMiddleDrop < poolLimit;
  const openDropsRemaining = Math.max(0, Math.floor(remainingMargin / safeOpenDrop));

  let status: DropStatus;
  if (!canOpenDrop) {
    status = 'compulsory';
  } else if (!canTwoOpenDrops || !canMiddleDrop) {
    status = 'one_drop';
  } else {
    status = 'safe';
  }

  return {
    status,
    remainingMargin,
    openDropsRemaining,
    canOpenDrop,
    canMiddleDrop,
    canTwoOpenDrops,
  };
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
export function calculateReEntryScore(activeScores: number[]): number {
  if (activeScores.length === 0) return 0;
  return Math.max(...activeScores) + 1;
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
 * The score everyone re-entering after this round gets: the highest total among players
 * still in, plus one. Players already re-entered this round don't count, so two players
 * who went out together get the same score whichever order they come back in.
 * Null when nobody is still in.
 */
export function sharedReEntryScore(lastRound: RoundRecord, seats: PlayerId[], poolLimit: number): number | null {
  const reEntered = new Set(lastRound.reEnteredInRound || []);
  const stillIn = seats
    .filter(id => !reEntered.has(id) && !isEliminated(lastRound.cumulativeScores[id] ?? 0, poolLimit))
    .map(id => lastRound.cumulativeScores[id] ?? 0);
  return stillIn.length > 0 ? calculateReEntryScore(stillIn) : null;
}

/**
 * Determines which players are currently eligible for re-entry.
 * In Indian Pool Rummy:
 * 1. Re-entry must be allowed by rules.
 * 2. Only players who got ELIMINATED IN THE MOST RECENT ROUND are eligible to re-enter!
 * 3. The re-entry score (highest active score + 1) must be strictly less than the pool limit.
 */
export function getEligibleForReEntryPlayers(
  rounds: RoundRecord[],
  seats: PlayerId[],
  rules: GameRules,
  isDealSettled: boolean = false
): PlayerId[] {
  if (!rules.allowReEntry || rounds.length === 0 || isDealSettled) {
    return [];
  }

  const lastRound = rounds[rounds.length - 1];
  const latestScores = lastRound.cumulativeScores;

  // If no active players left or game is over, no one can re-enter
  const potentialReEntryScore = sharedReEntryScore(lastRound, seats, rules.poolLimit);
  if (potentialReEntryScore === null || !isEligibleForReEntry(potentialReEntryScore, rules.poolLimit)) {
    return [];
  }

  // Only players who:
  // 1. were eliminated specifically in this last round
  // 2. have NOT already re-entered in this round
  // 3. are currently still eliminated (score >= poolLimit)
  const eliminatedInLastRound = lastRound.eliminatedInRound || [];
  const alreadyReEntered = new Set(lastRound.reEnteredInRound || []);

  return eliminatedInLastRound.filter(
    id =>
      seats.includes(id) &&
      !alreadyReEntered.has(id) &&
      isEliminated(latestScores[id] ?? 0, rules.poolLimit)
  );
}
