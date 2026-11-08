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
 * Moves a re-entered player's seating position to sit immediately AFTER (clockwise below)
 * the current card distributor/dealer.
 * 
 * Example:
 * Seats: [P1, P2 (Dealer), P3, P4]
 * P1 was eliminated and re-enters.
 * After relocation: [P2 (Dealer), P1 (Re-entered), P3, P4]
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
    // If dealer wasn't found, append to the end
    return [...remainingSeats, reEnteringPlayerId];
  }

  // 3. Insert immediately after the dealer
  const insertIndex = dealerIndex + 1;
  return [
    ...remainingSeats.slice(0, insertIndex),
    reEnteringPlayerId,
    ...remainingSeats.slice(insertIndex)
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
