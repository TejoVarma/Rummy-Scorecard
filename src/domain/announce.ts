import { GameState } from './types';

/**
 * "Round 6. Ravi 45. Amit 120. Kiran out." — or null before the first round.
 * A player is called out once, in the round they go out; after that they're left out
 * until they re-enter.
 */
export function buildAnnouncement(state: GameState): string | null {
  const { rounds, seats, players, rules } = state;
  if (rounds.length === 0) return null;

  const totals = rounds[rounds.length - 1].cumulativeScores;
  const before = rounds.length > 1 ? rounds[rounds.length - 2].cumulativeScores : {};
  const isOut = (score: number | undefined) => (score ?? 0) >= rules.poolLimit;

  const parts = seats.flatMap(id => {
    const name = players[id]?.name || 'Player';
    if (!isOut(totals[id])) return [`${name} ${totals[id] ?? 0}`];
    return isOut(before[id]) ? [] : [`${name} out`];
  });
  return [`Round ${rounds.length}`, ...parts].join('. ') + '.';
}
