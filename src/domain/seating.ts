import { PlayerId } from './types';

/**
 * Advances the dealer token in clockwise seating order among active players.
 * 
 * Special Rummy Rule:
 * If the player who was immediately next in turn after the dealer in this round
 * (the player who took the open card from this dealer) gets eliminated in this round,
 * and the current dealer is still active, the dealer deals again!
 * This ensures the next surviving player gets their rightful chance to take the open card,
 * instead of skipping them straight into having to deal.
 */
export function getNextDealerIndex(
  seats: PlayerId[],
  currentDealerIndex: number,
  activePlayerIds: Set<PlayerId>,
  eliminatedInRound: PlayerId[] = []
): number {
  if (seats.length === 0 || activePlayerIds.size === 0) return 0;

  const currentDealerId = seats[currentDealerIndex];

  // If the current dealer is still active, check if the first player after the dealer
  // got eliminated in this round.
  if (activePlayerIds.has(currentDealerId) && eliminatedInRound.length > 0) {
    // Find the player who was immediately after the dealer in this round
    // (i.e. was active at the start of the round: either currently active or eliminated in this round)
    let firstPlayerAfterDealer: PlayerId | null = null;
    for (let step = 1; step < seats.length; step++) {
      const candidateIndex = (currentDealerIndex + step) % seats.length;
      const candidateId = seats[candidateIndex];
      if (activePlayerIds.has(candidateId) || eliminatedInRound.includes(candidateId)) {
        firstPlayerAfterDealer = candidateId;
        break;
      }
    }

    // If that player got eliminated in this round, the current dealer deals again!
    if (firstPlayerAfterDealer && eliminatedInRound.includes(firstPlayerAfterDealer)) {
      return currentDealerIndex;
    }
  }

  // Otherwise, advance clockwise to the next active player
  let candidateIndex = currentDealerIndex;
  for (let i = 0; i < seats.length; i++) {
    candidateIndex = (candidateIndex + 1) % seats.length;
    if (activePlayerIds.has(seats[candidateIndex])) {
      return candidateIndex;
    }
  }
  return currentDealerIndex;
}

/**
 * Seats re-entering players together just before the dealer, in the order given:
 * the first one furthest from the dealer, the last one right beside them (dealt last).
 */
export function seatReEnteredPlayers(seats: PlayerId[], currentDealerId: PlayerId, reEnteringIds: PlayerId[]): PlayerId[] {
  const coming = new Set(reEnteringIds);
  const remaining = seats.filter(id => !coming.has(id));
  const dealerIndex = remaining.indexOf(currentDealerId);
  if (dealerIndex === -1) return [...reEnteringIds, ...remaining];
  return [...remaining.slice(0, dealerIndex), ...reEnteringIds, ...remaining.slice(dealerIndex)];
}

export function relocateReEnteredPlayer(seats: PlayerId[], currentDealerId: PlayerId, reEnteringPlayerId: PlayerId): PlayerId[] {
  return seatReEnteredPlayers(seats, currentDealerId, [reEnteringPlayerId]);
}
