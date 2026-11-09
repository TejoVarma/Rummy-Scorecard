import { GameState } from './types';

/** "Round 6. Ravi 45. Amit 120. Kiran out." — or null before the first round. */
export function buildAnnouncement(state: GameState): string | null {
  const { rounds, seats, players, rules } = state;
  if (rounds.length === 0) return null;

  const totals = rounds[rounds.length - 1].cumulativeScores;
  const parts = seats.map(id => {
    const name = players[id]?.name || 'Player';
    const score = totals[id] ?? 0;
    return score >= rules.poolLimit ? `${name} out` : `${name} ${score}`;
  });
  return [`Round ${rounds.length}`, ...parts].join('. ') + '.';
}
