import { describe, it, expect } from 'vitest';
import { getNextDealerIndex, relocateReEnteredPlayer, reorderSeats } from '../domain/seating';

describe('seating domain tests', () => {
  it('advances dealer clockwise to next active player', () => {
    const seats = ['p1', 'p2', 'p3', 'p4'];
    const allActive = new Set(['p1', 'p2', 'p3', 'p4']);
    
    // Seat 0 (p1) -> next is Seat 1 (p2)
    expect(getNextDealerIndex(seats, 0, allActive)).toBe(1);
    // Seat 3 (p4) -> wraps to Seat 0 (p1)
    expect(getNextDealerIndex(seats, 3, allActive)).toBe(0);
  });

  it('skips eliminated players when advancing dealer', () => {
    const seats = ['p1', 'p2', 'p3', 'p4'];
    // p2 is eliminated
    const active = new Set(['p1', 'p3', 'p4']);
    
    // From p1 (index 0), next should skip p2 and go to p3 (index 2)
    expect(getNextDealerIndex(seats, 0, active)).toBe(2);
  });

  it('moves re-entered player immediately AFTER the distributor/dealer', () => {
    // Current seats: Tejo, Bava, Rohini, Siri, Pavan
    // Bava is the dealer. Rohini was eliminated and re-enters.
    const seats = ['Tejo', 'Bava', 'Rohini', 'Siri', 'Pavan'];
    const currentDealer = 'Bava';
    const reEnteringPlayer = 'Rohini';

    const newSeats = relocateReEnteredPlayer(seats, currentDealer, reEnteringPlayer);
    
    // Rohini should now sit right after Bava!
    expect(newSeats).toEqual(['Tejo', 'Bava', 'Rohini', 'Siri', 'Pavan']);

    // Another example where re-entering player is earlier in seats array:
    // Tejo was eliminated and re-enters. Dealer is Siri.
    const newSeats2 = relocateReEnteredPlayer(seats, 'Siri', 'Tejo');
    // Siri is at index in remaining: ['Bava', 'Rohini', 'Siri', 'Pavan']
    // Tejo should be placed right after Siri: ['Bava', 'Rohini', 'Siri', 'Tejo', 'Pavan']
    expect(newSeats2).toEqual(['Bava', 'Rohini', 'Siri', 'Tejo', 'Pavan']);
  });

  it('re-orders seats correctly', () => {
    const seats = ['A', 'B', 'C', 'D'];
    expect(reorderSeats(seats, 0, 2)).toEqual(['B', 'C', 'A', 'D']);
    expect(reorderSeats(seats, 3, 0)).toEqual(['D', 'A', 'B', 'C']);
  });
});
