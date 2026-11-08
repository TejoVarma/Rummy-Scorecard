import { GameRules, ScoreInputType } from './types';

export const DEFAULT_RULES: GameRules = {
  poolLimit: 201,
  openDrop: 24,
  middleDrop: 48,
  fullCount: 80,
  allowReEntry: true,
  reEntryScoreMode: 'highest_plus_one',
};

export const POOL_PRESETS = [201, 200, 101, 100];

/**
 * Returns the exact numeric score given an input type and rule preset.
 */
export function getPointsForInputType(
  type: ScoreInputType,
  customPoints: number | undefined,
  rules: GameRules
): number {
  switch (type) {
    case 'show':
      return 0;
    case 'open_drop':
      return rules.openDrop;
    case 'middle_drop':
      return rules.middleDrop;
    case 'full_count':
      return rules.fullCount;
    case 'out':
      return rules.poolLimit;
    case 'custom': {
      const pts = customPoints ?? 0;
      if (pts < 0) return 0;
      return Math.min(pts, rules.fullCount);
    }
  }
}

/**
 * Validates that round scores contain exactly one 'show' (winner),
 * and all custom hand scores are valid (0 to 80).
 */
export function validateRoundScores(
  scores: Record<string, { type: ScoreInputType; points: number }>,
  activePlayerIds: string[]
): { valid: boolean; error?: string } {
  for (const id of activePlayerIds) {
    const s = scores[id];
    if (!s) {
      return { valid: false, error: 'All active players must have a score recorded.' };
    }
    if (s.type === 'custom') {
      if (s.points < 0 || s.points > 80) {
        return { valid: false, error: 'Custom hand points must be between 0 and 80.' };
      }
    }
  }

  const activeScores = activePlayerIds.map(id => scores[id]);
  const showCount = activeScores.filter(s => s?.type === 'show').length;

  if (showCount === 0) {
    return { valid: false, error: 'One player must be marked with Show (0 pts).' };
  }
  if (showCount > 1) {
    return { valid: false, error: 'Only one player can have Show in a single round.' };
  }

  return { valid: true };
}
