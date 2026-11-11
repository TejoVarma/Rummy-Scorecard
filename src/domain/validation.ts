import { GameState } from './types';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const optional = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);
const valuesAreNumbers = (v: unknown) => isPlainObject(v) && Object.values(v).every(isFiniteNumber);

const SCORE_TYPES = new Set(['show', 'open_drop', 'middle_drop', 'full_count', 'penalty', 'custom', 'out']);

// The screens read every round while drawing, so anything malformed is rejected here
// rather than allowed to crash a screen. Fields added in later versions are optional.
function isValidRound(round: unknown): boolean {
  if (!isPlainObject(round)) return false;
  if (!isPlainObject(round.scores)) return false;
  const scoresOk = Object.values(round.scores).every(
    s => isPlainObject(s) && SCORE_TYPES.has(s.type as string) && isFiniteNumber(s.points)
  );
  if (!scoresOk || !valuesAreNumbers(round.cumulativeScores)) return false;
  if (!isStringList(round.seatsSnapshot)) return false;
  if (!optional(round.eliminatedInRound, isStringList)) return false;
  if (!optional(round.reEnteredInRound, isStringList)) return false;
  if (!optional(round.playersSnapshot, isPlainObject)) return false;
  return true;
}

function isValidDeal(deal: unknown): boolean {
  return (
    isPlainObject(deal) &&
    valuesAreNumbers(deal.payouts) &&
    valuesAreNumbers(deal.scoresSnapshot) &&
    isFiniteNumber(deal.totalPool)
  );
}

/** Whether stored or imported data is a game every screen can safely show. */
export function isValidGameState(obj: unknown): obj is GameState {
  if (!isPlainObject(obj)) return false;
  const c = obj;

  if (typeof c.gameId !== 'string' || !c.gameId) return false;
  if (typeof c.title !== 'string' || !isFiniteNumber(c.createdAt)) return false;
  if (!['setup', 'playing', 'completed'].includes(c.status as string)) return false;

  if (!isPlainObject(c.rules)) return false;
  const { poolLimit, openDrop, middleDrop, fullCount, entryAmount } = c.rules;
  if (![poolLimit, openDrop, middleDrop, fullCount].every(isFiniteNumber)) return false;
  if (!optional(entryAmount, isFiniteNumber)) return false;

  const players = c.players;
  if (!isPlainObject(players)) return false;
  for (const [id, player] of Object.entries(players)) {
    if (!isPlainObject(player) || player.id !== id || typeof player.name !== 'string') return false;
    if (!Number.isInteger(player.reEntryCount) || (player.reEntryCount as number) < 0) return false;
  }

  if (!isStringList(c.seats) || c.seats.length === 0) return false;
  if (new Set(c.seats).size !== c.seats.length || !c.seats.every(id => Object.prototype.hasOwnProperty.call(players, id))) return false;
  if (!Number.isInteger(c.currentDealerIndex)) return false;
  const dealer = c.currentDealerIndex as number;
  if (dealer < 0 || dealer >= c.seats.length) return false;

  if (!Array.isArray(c.rounds) || !c.rounds.every(isValidRound)) return false;
  if (!optional(c.winnerPlayerId, x => typeof x === 'string')) return false;
  if (!optional(c.dealSplit, isValidDeal)) return false;
  return true;
}
