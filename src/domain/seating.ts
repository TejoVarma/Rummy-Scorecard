import { PlayerId } from './types';

/**
 * Advances the dealer token to the next active player in clockwise seating order.
 */
export function getNextDealerIndex(
  seats: PlayerId[],
  currentDealerIndex: number,
  activePlayerIds: Set<PlayerId>
): number {
  if (seats.length === 0 || activePlayerIds.size === 0) return 0;
  
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

/**
 * Re-orders a player list by moving a player from fromIndex to toIndex.
 */
export function reorderSeats(
  seats: PlayerId[],
  fromIndex: number,
  toIndex: number
): PlayerId[] {
  if (fromIndex < 0 || fromIndex >= seats.length) return seats;
  if (toIndex < 0 || toIndex >= seats.length) return seats;
  if (fromIndex === toIndex) return seats;

  const result = [...seats];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}
