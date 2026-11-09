import { describe, it, expect } from 'vitest';
import { roundWinnerId, isAllDropRound } from '../domain/roundSummary';
import { RoundRecord, PlayerRoundScore } from '../domain/types';

function round(scores: Record<string, PlayerRoundScore>): RoundRecord {
  return {
    roundNumber: 4,
    dealerPlayerId: 'p2',
    scores,
    cumulativeScores: {},
    seatsSnapshot: Object.keys(scores),
    playersSnapshot: {},
    eliminatedInRound: [],
    reEnteredInRound: [],
    timestamp: 1,
  };
}

const alreadyOut: PlayerRoundScore = { type: 'out', points: 0 };

describe('roundWinnerId', () => {
  it('is the player who made the show, even when a knocked-out player sits first', () => {
    const r = round({
      p1: alreadyOut,
      p2: { type: 'show', points: 0 },
      p3: { type: 'custom', points: 30 },
    });
    expect(roundWinnerId(r)).toBe('p2');
  });

  it('does not treat a typed hand score of 0 as the show', () => {
    const r = round({
      p1: { type: 'custom', points: 0 },
      p2: { type: 'show', points: 0 },
    });
    expect(roundWinnerId(r)).toBe('p2');
  });

  it('is null when nobody made a show', () => {
    expect(roundWinnerId(round({ p1: alreadyOut, p2: { type: 'open_drop', points: 24 } }))).toBeNull();
  });
});

describe('isAllDropRound', () => {
  it('is true when everyone still playing dropped except the winner', () => {
    const r = round({
      p1: { type: 'show', points: 0 },
      p2: { type: 'open_drop', points: 24 },
      p3: { type: 'open_drop', points: 24 },
    });
    expect(isAllDropRound(r)).toBe(true);
  });

  it('ignores players who were already out', () => {
    const r = round({
      p1: alreadyOut,
      p2: { type: 'show', points: 0 },
      p3: { type: 'open_drop', points: 24 },
    });
    expect(isAllDropRound(r)).toBe(true);
  });

  it('is false when anyone played on', () => {
    const r = round({
      p1: { type: 'show', points: 0 },
      p2: { type: 'open_drop', points: 24 },
      p3: { type: 'custom', points: 12 },
    });
    expect(isAllDropRound(r)).toBe(false);
  });

  it('is false for a player put out by hand this round', () => {
    const r = round({
      p1: { type: 'show', points: 0 },
      p2: { type: 'out', points: 201 },
    });
    expect(isAllDropRound(r)).toBe(false);
  });
});
