import { PlayerId, PlayerRoundScore, RoundRecord } from './types';

// Players knocked out in an earlier round still get an entry in later rounds,
// stored as { type: 'out', points: 0 }. They weren't playing, so they're ignored here.
function wasPlaying(score: PlayerRoundScore): boolean {
  return !(score.type === 'out' && score.points === 0);
}

export function roundWinnerId(round: RoundRecord): PlayerId | null {
  const winner = Object.entries(round.scores).find(([, score]) => score.type === 'show');
  return winner ? winner[0] : null;
}

/** Everyone still playing dropped at the start, except the one player who showed. */
export function isAllDropRound(round: RoundRecord): boolean {
  const playing = Object.values(round.scores).filter(wasPlaying);
  const shows = playing.filter(s => s.type === 'show').length;
  const drops = playing.filter(s => s.type === 'open_drop').length;
  return shows === 1 && drops > 0 && shows + drops === playing.length;
}
