import React from 'react';
import { Handshake } from 'lucide-react';
import { DealSplit } from '../../domain/types';

interface ScoreboardActionsProps {
  dealSplit?: DealSplit;
  hasWinner: boolean;
  hasRounds: boolean;
  isLastRoundEdited: boolean;
  onEnterScore: () => void;
  onEditScore: () => void;
  onOpenDeal: () => void;
}

export const ScoreboardActions: React.FC<ScoreboardActionsProps> = ({
  dealSplit,
  hasWinner,
  hasRounds,
  isLastRoundEdited,
  onEnterScore,
  onEditScore,
  onOpenDeal,
}) => (
  <div className="p-3 bg-[var(--color-bg)] border-t border-[var(--color-border)] space-y-2 shrink-0">
    {dealSplit ? (
      <button
        type="button"
        onClick={onOpenDeal}
        className="w-full py-3 rounded-full font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow transition active:scale-[0.99] flex items-center justify-center gap-2"
      >
        <Handshake className="w-4 h-4" /> View Prize Pool Settlement (₹{dealSplit.totalPool})
      </button>
    ) : (
      <>
        <button
          type="button"
          onClick={onEnterScore}
          disabled={hasWinner}
          className="w-full py-3 rounded-full font-bold text-sm bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 text-white shadow transition active:scale-[0.99] tracking-wider"
        >
          ENTER SCORE
        </button>

        <button
          type="button"
          onClick={onEditScore}
          disabled={!hasRounds || isLastRoundEdited}
          className="w-full min-h-[44px] rounded-full font-semibold text-xs border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-40 transition active:scale-[0.99] tracking-wider"
        >
          EDIT SCORE
        </button>

        {hasRounds && !hasWinner && (
          <button
            type="button"
            onClick={onOpenDeal}
            className="w-full min-h-[44px] rounded-full font-semibold text-xs border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 transition flex items-center justify-center gap-1.5 active:scale-[0.99] tracking-wider"
          >
            <Handshake className="w-3.5 h-3.5" /> SHARE POOL / MAKE DEAL
          </button>
        )}
      </>
    )}
  </div>
);
