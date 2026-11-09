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
 * Moves a re-entered player's seating position to sit immediately to the LEFT of
 * the current card distributor/dealer (i.e. immediately before the dealer in the seating order).
 * 
 * Example:
 * Seats: [P1, P2, P3 (Dealer), P4]
 * P4 re-enters.
 * After relocation to left of dealer P3: [P1, P2, P4 (Re-entered), P3 (Dealer)]
 */
export function relocateReEnteredPlayer(
  seats: PlayerId[],
  currentDealerId: PlayerId,
  reEnteringPlayerId: PlayerId
): PlayerId[] {
  // 1. Remove re-entering player from their old seat position
  const remainingSeats = seats.filter(id => id !== reEnteringPlayerId);
  
  // 2. Find dealer index in remaining seats
  const dealerIndex = remainingSeats.indexOf(currentDealerId);
  if (dealerIndex === -1) {
    // If dealer wasn't found, place at the start (left)
    return [reEnteringPlayerId, ...remainingSeats];
  }

  // 3. Insert immediately to the LEFT of the dealer (before dealerIndex)
  return [
    ...remainingSeats.slice(0, dealerIndex),
    reEnteringPlayerId,
    ...remainingSeats.slice(dealerIndex)
  ];
}
