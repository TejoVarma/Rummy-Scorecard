import { GameRules, ScoreInputType } from './types';

export const DEFAULT_RULES: GameRules = {
  poolLimit: 201,
  openDrop: 24,
  middleDrop: 48,
  fullCount: 80,
  allowReEntry: true,
  entryAmount: 0,
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
 * Checks a round before it's saved: every player still in has a score, each score
 * matches its button under these rules, typed hand scores are 0 to full count,
 * and exactly one player made the show.
 */
export function validateRoundScores(
  scores: Record<string, { type: ScoreInputType; points: number } | undefined>,
  activePlayerIds: string[],
  rules: GameRules
): { valid: boolean; error?: string } {
  for (const id of activePlayerIds) {
    const s = scores[id];
    if (!s) {
      return { valid: false, error: 'All active players must have a score recorded.' };
    }
    if (!Number.isInteger(s.points)) {
      return { valid: false, error: 'Scores must be whole numbers.' };
    }
    if (s.type === 'custom') {
      if (s.points < 0 || s.points > rules.fullCount) {
        return { valid: false, error: `Custom hand points must be between 0 and ${rules.fullCount}.` };
      }
    } else if (s.points !== getPointsForInputType(s.type, undefined, rules)) {
      return { valid: false, error: 'A score does not match the chosen option.' };
    }
  }

  const showCount = activePlayerIds.filter(id => scores[id]?.type === 'show').length;
  if (showCount === 0) {
    return { valid: false, error: 'One player must be marked with Show (0 pts).' };
  }
  if (showCount > 1) {
    return { valid: false, error: 'Only one player can have Show in a single round.' };
  }

  return { valid: true };
}
