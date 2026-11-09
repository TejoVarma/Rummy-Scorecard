import { DealSplit, GameRules, GameState, Player, PlayerId } from './types';
import { getActivePlayerIds } from './elimination';
import { validateCustomDeal } from './dealSplit';

const isWholeNumber = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** The first rule a game setup breaks, as a message for the player, or null when it's fine. */
export function validateRules(rules: GameRules): string | null {
  const { poolLimit, openDrop, middleDrop, fullCount, entryAmount = 0 } = rules;
  if (![poolLimit, openDrop, middleDrop, fullCount].every(isWholeNumber)) {
    return 'Scores must be whole numbers.';
  }
  if (openDrop <= 0) return 'Open Drop must be greater than 0.';
  if (openDrop >= middleDrop) return 'Open Drop must be less than Middle Drop.';
  if (middleDrop >= fullCount) return 'Middle Drop must be less than Full Count.';
  if (openDrop >= poolLimit) return 'Open Drop must be less than the pool score.';
  if (!isWholeNumber(entryAmount) || entryAmount < 0) return 'The stake must be a whole number of rupees, 0 or more.';
  return null;
}

export interface StartGameInput {
  rules: GameRules;
  players: Player[];
  initialSeats: PlayerId[];
  initialDealerIndex: number;
}

export function validateStartGame({ rules, players, initialSeats, initialDealerIndex }: StartGameInput): string | null {
  if (players.length < 2) return 'Please select at least 2 players.';
  const ids = new Set(players.map(p => p.id));
  if (ids.size !== players.length) return 'Each player can only be selected once.';
  if (players.some(p => !p.name.trim())) return 'Every player needs a name.';
  const seatsMatch = initialSeats.length === ids.size && new Set(initialSeats).size === ids.size && initialSeats.every(id => ids.has(id));
  if (!seatsMatch) return 'The seating must include every player exactly once.';
  if (!isWholeNumber(initialDealerIndex) || initialDealerIndex < 0 || initialDealerIndex >= initialSeats.length) {
    return 'Please choose a dealer.';
  }
  return validateRules(rules);
}

export function totalPool(state: GameState): number {
  const entry = state.rules.entryAmount ?? 0;
  const reEntries = state.seats.reduce((sum, id) => sum + (state.players[id]?.reEntryCount ?? 0), 0);
  return entry * (state.seats.length + reEntries);
}

/** A deal can be made once, mid-game, among the players still in, and must share out the whole pool. */
export function validateDeal(state: GameState, deal: DealSplit): string | null {
  if (state.dealSplit) return 'This match is already settled.';
  if (state.status !== 'playing' || state.rounds.length === 0) return 'A deal can only be made during a match.';

  const latest = state.rounds[state.rounds.length - 1].cumulativeScores;
  const active = getActivePlayerIds(state.seats, latest, state.rules.poolLimit);
  const paid = Object.keys(deal.payouts);
  if (paid.length !== active.size || !paid.every(id => active.has(id))) {
    return 'The deal must include exactly the players still in.';
  }
  if (!Object.values(deal.payouts).every(isWholeNumber)) return 'Payouts must be whole rupees.';
  if (deal.totalPool !== totalPool(state)) return 'The deal must share out the whole prize pool.';
  if (!validateCustomDeal(deal.totalPool, deal.payouts).isValid) return 'The payouts must add up to the prize pool.';
  return null;
}
