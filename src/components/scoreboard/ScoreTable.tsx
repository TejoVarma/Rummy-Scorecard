import { forwardRef } from 'react';
import { GameRules, Player, PlayerId, PlayerRoundScore, RoundRecord } from '../../domain/types';
import { PlayerDropAnalysis } from '../../domain/elimination';
import { CELL_CODES, ScoreLegend } from './ScoreLegend';

interface ScoreTableProps {
  seats: PlayerId[];
  players: Record<PlayerId, Player>;
  rounds: RoundRecord[];
  rules: GameRules;
  latestScores: Record<PlayerId, number>;
  currentDealerId: PlayerId;
  dropAnalysisMap: Record<PlayerId, PlayerDropAnalysis>;
  allDropRoundIndices: Set<number>;
  selectedRoundIndex: number | null;
  onSelectRound: (index: number | null) => void;
  /** Up to 6 players fit the screen width; more scroll sideways. */
  isCompactFit: boolean;
}

const CELL = 'w-full max-w-[48px] mx-auto py-1.5 rounded-lg font-bold text-sm text-center';
const TD = 'py-1 px-0.5 text-center border-b border-[var(--color-border)] border-r border-[var(--color-border)] last:border-r-0';

const CODED_TYPES = ['show', 'open_drop', 'middle_drop', 'full_count'] as const;

function ScoreCell({ score, reEntered, rowColour }: { score: PlayerRoundScore; reEntered: boolean; rowColour: string }) {
  if (score.type === 'out') {
    return (
      <div role="img" title={CELL_CODES.out.label} aria-label={CELL_CODES.out.label} className={`${CELL} bg-[#27272a] text-[#71717a]`}>
        {CELL_CODES.out.code}
      </div>
    );
  }
  const coded = CODED_TYPES.find(type => type === score.type);
  if (coded) {
    const { code, label } = CELL_CODES[coded];
    const textColour = coded === 'show' ? 'text-[#facc15]' : 'text-white';
    return (
      <div role="img" title={label} aria-label={label} className={`${CELL} ${rowColour} ${textColour} shadow-sm`}>
        {code}
      </div>
    );
  }
  if (reEntered) {
    return (
      <div
        role="img"
        aria-label={`${CELL_CODES.reEntry.label}: ${score.points}`}
        className={`w-full max-w-[48px] mx-auto py-1 rounded-lg ${rowColour} text-center shadow-sm flex items-center justify-center gap-0.5`}
      >
        <span className="text-[#ef4444] font-extrabold text-xs" title={CELL_CODES.reEntry.label}>
          {CELL_CODES.reEntry.code}
        </span>
        <span className="text-[#4ade80] font-mono font-bold text-[10px] align-sub">{score.points}</span>
      </div>
    );
  }
  return <div className={`${CELL} ${rowColour} text-white shadow-sm font-mono`}>{score.points}</div>;
}

// Names in the header are bolder than the totals underneath them.
function statusColour(isOut: boolean, status: PlayerDropAnalysis['status'] | undefined, variant: 'name' | 'total') {
  const name = variant === 'name';
  if (isOut) return name ? 'text-rose-400/80 line-through' : 'text-rose-400/70 line-through';
  if (status === 'compulsory') return name ? 'text-rose-500 font-extrabold' : 'text-rose-400 font-bold';
  if (status === 'one_drop') return name ? 'text-yellow-400 font-extrabold' : 'text-yellow-400 font-bold';
  return 'text-white font-bold';
}

export const ScoreTable = forwardRef<HTMLDivElement, ScoreTableProps>(function ScoreTable(
  {
    seats,
    players,
    rounds,
    rules,
    latestScores,
    currentDealerId,
    dropAnalysisMap,
    allDropRoundIndices,
    selectedRoundIndex,
    onSelectRound,
    isCompactFit,
  },
  scrollRef
) {
  return (
    <div
      ref={scrollRef}
      className={`flex-1 ${isCompactFit ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'} relative bg-[var(--color-bg)]`}
    >
      <table className={`w-full border-collapse ${isCompactFit ? 'table-fixed' : 'min-w-max'}`}>
        <thead className="sticky top-0 z-30 bg-[#1f2937] dark:bg-[#18181b] text-white border-b border-[var(--color-border)] shadow-sm">
          <tr>
            {seats.map(playerId => {
              const player = players[playerId];
              const isDealer = currentDealerId === playerId;
              const isOut = (latestScores[playerId] ?? 0) >= rules.poolLimit;
              const drops = dropAnalysisMap[playerId];
              const reEntryCount = player?.reEntryCount ?? 0;

              return (
                <th
                  key={playerId}
                  style={isCompactFit ? { width: `${100 / seats.length}%` } : { minWidth: '60px' }}
                  className={`py-2 px-1 text-center font-normal border-r border-[var(--color-border)] last:border-r-0 ${
                    isDealer ? 'bg-[var(--color-primary)]/15' : ''
                  }`}
                >
                  <div className="flex flex-col items-center justify-center min-h-[30px]">
                    <span
                      className={`text-xs truncate block max-w-full ${statusColour(isOut, drops?.status, 'name')}`}
                      title={reEntryCount > 0 ? `${player?.name} (re-entry x${reEntryCount})` : player?.name}
                    >
                      {isDealer ? `${CELL_CODES.dealer.code}${player?.name}` : player?.name}
                    </span>
                    {!isOut && drops?.status === 'compulsory' && (
                      <span className="text-[11px] font-extrabold leading-tight tracking-tight text-rose-500 block uppercase mt-0.5">
                        COMPULSORY
                      </span>
                    )}
                    {!isOut && drops?.status === 'one_drop' && (
                      <span className="text-[11px] font-extrabold leading-tight tracking-tight text-yellow-400 block uppercase mt-0.5">
                        {drops.canMiddleDrop ? '1 DROP' : '1 DROP (NO MD)'}
                      </span>
                    )}
                    {reEntryCount > 0 && (
                      <span
                        className={`text-[11px] font-bold leading-tight tracking-tight block mt-0.5 ${
                          isOut ? 'text-rose-400/80 line-through' : 'text-[#ef4444]'
                        }`}
                      >
                        {reEntryCount === 1 ? '(re entry)' : `(re entry #${reEntryCount})`}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-[var(--color-border)]">
          {rounds.length === 0 ? (
            <tr>
              <td colSpan={seats.length} className="py-20 text-center text-xs text-[var(--color-muted)]">
                No rounds recorded yet.
                <br />
                Tap <strong className="text-[var(--color-primary)]">"ENTER SCORE"</strong> below to begin.
              </td>
            </tr>
          ) : (
            <>
              {rounds.map((round, rIdx) => {
                const isSelected = selectedRoundIndex === rIdx;
                const isEdited = Boolean(round.isEdited);
                const rowColour = allDropRoundIndices.has(rIdx) ? 'bg-[#15803d]' : 'bg-[#0078d4]';

                return (
                  <tr
                    key={round.roundNumber}
                    onClick={() => onSelectRound(isSelected ? null : rIdx)}
                    className={`transition-colors cursor-pointer ${isEdited ? 'bg-amber-500/15' : ''} ${
                      isSelected ? 'bg-black/5 dark:bg-white/[0.06]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    {seats.map((playerId, colIdx) => {
                      const score = round.scores[playerId];
                      const editedEdge = isEdited && colIdx === 0 ? 'border-l-4 border-l-amber-500' : '';
                      return (
                        <td
                          key={playerId}
                          className={`${TD} ${score ? 'align-middle' : 'text-[var(--color-muted)] font-mono text-xs'} ${editedEdge}`}
                        >
                          {score ? (
                            <ScoreCell
                              score={score}
                              reEntered={Boolean(round.reEnteredInRound?.includes(playerId))}
                              rowColour={rowColour}
                            />
                          ) : (
                            '-'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              <tr className="bg-black/[0.03] dark:bg-white/[0.02]">
                {seats.map(playerId => {
                  const score = latestScores[playerId] ?? 0;
                  const isOut = score >= rules.poolLimit;
                  const colour = statusColour(isOut, dropAnalysisMap[playerId]?.status, 'total');
                  return (
                    <td
                      key={playerId}
                      className={`${TD} align-middle ${currentDealerId === playerId ? 'bg-[var(--color-primary)]/10' : ''}`}
                    >
                      <div
                        className={`w-full max-w-[48px] mx-auto py-1.5 rounded-lg bg-[#1e293b] dark:bg-[#18181b] text-center font-mono text-sm shadow-sm ${colour}`}
                      >
                        {score}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </>
          )}
        </tbody>
      </table>
      {rounds.length > 0 && <ScoreLegend />}
    </div>
  );
});
