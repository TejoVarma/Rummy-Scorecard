import { describe, it, expect } from 'vitest';
import { getNextDealerIndex, relocateReEnteredPlayer } from '../domain/seating';

describe('seating domain tests', () => {
  it('advances dealer clockwise to next active player', () => {
    const seats = ['p1', 'p2', 'p3', 'p4'];
    const allActive = new Set(['p1', 'p2', 'p3', 'p4']);
    
    // Seat 0 (p1) -> next is Seat 1 (p2)
    expect(getNextDealerIndex(seats, 0, allActive)).toBe(1);
    // Seat 3 (p4) -> wraps to Seat 0 (p1)
    expect(getNextDealerIndex(seats, 3, allActive)).toBe(0);
  });

  it('skips eliminated players when advancing dealer if first player after dealer was not eliminated in this round', () => {
    const seats = ['p1', 'p2', 'p3', 'p4'];
    // p3 was eliminated earlier or in this round, but p2 (first player after p1) is active
    const active = new Set(['p1', 'p2', 'p4']);
    
    // From p1 (index 0), p2 is active, so p2 becomes next dealer
    expect(getNextDealerIndex(seats, 0, active, ['p3'])).toBe(1);
  });

  it('keeps dealer the same (dealer deals again) when the first player after dealer gets eliminated in this round', () => {
    // Exact user scenario: Players p1 to p5. Dealer is p5 (index 4).
    // In this round, p1 (first player after p5) got eliminated.
    // P5 must deal again so p2 gets the open card, instead of jumping to p2 dealing!
    const seats = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const active = new Set(['p2', 'p3', 'p4', 'p5']);
    const eliminatedInRound = ['p1'];

    expect(getNextDealerIndex(seats, 4, active, eliminatedInRound)).toBe(4);
  });

  it('advances to next active player if the dealer himself also got eliminated', () => {
    const seats = ['p1', 'p2', 'p3', 'p4', 'p5'];
    // Both p5 (dealer) and p1 got eliminated
    const active = new Set(['p2', 'p3', 'p4']);
    const eliminatedInRound = ['p1', 'p5'];

    // P5 cannot deal because p5 is eliminated; advances to p2
    expect(getNextDealerIndex(seats, 4, active, eliminatedInRound)).toBe(1);
  });

  it('moves re-entered player immediately to the LEFT of the distributor/dealer', () => {
    // Current seats: Tejo, Bava, Rohini, Siri, Pavan
    // Bava is the dealer. Rohini was eliminated and re-enters.
    const seats = ['Tejo', 'Bava', 'Rohini', 'Siri', 'Pavan'];
    const currentDealer = 'Bava';
    const reEnteringPlayer = 'Rohini';

    const newSeats = relocateReEnteredPlayer(seats, currentDealer, reEnteringPlayer);
    
    // Rohini should now sit to the LEFT of Bava (before Bava)!
    expect(newSeats).toEqual(['Tejo', 'Rohini', 'Bava', 'Siri', 'Pavan']);

    // Another example: Pavan was eliminated and re-enters. Dealer is Siri.
    const newSeats2 = relocateReEnteredPlayer(seats, 'Siri', 'Pavan');
    // Pavan should be placed to the LEFT of Siri (before Siri):
    expect(newSeats2).toEqual(['Tejo', 'Bava', 'Rohini', 'Pavan', 'Siri']);
  });
});
