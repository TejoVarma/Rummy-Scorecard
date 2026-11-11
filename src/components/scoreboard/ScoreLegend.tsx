import React from 'react';
import { Crown } from 'lucide-react';

/** What each score-cell code means. The cells and the legend both read from here. */
export const CELL_CODES = {
  show: { code: 'R', label: 'Show (won the round)', short: 'Show' },
  open_drop: { code: 'D', label: 'Drop', short: 'Drop' },
  middle_drop: { code: 'MD', label: 'Middle drop', short: 'Mid drop' },
  full_count: { code: 'FC', label: 'Full count', short: 'Full' },
  penalty: { code: 'P', label: 'Penalty (wrong show)', short: 'Penalty' },
  out: { code: 'X', label: 'Out', short: 'Out' },
  reEntry: { code: 'RE', label: 'Re-entry (with the score they came back on)', short: 'Re-entry' },
} as const;

const Swatch: React.FC<{ className: string; label: string }> = ({ className, label }) => (
  <span className="flex items-center gap-1">
    <span aria-hidden className={`inline-block w-3 h-3 rounded ${className}`} />
    {label}
  </span>
);

export const ScoreLegend: React.FC = () => (
  <section
    aria-label="Legend"
    className="px-3 py-2 border-t border-[var(--color-border)] text-[11px] text-[var(--color-muted)] flex flex-wrap items-center gap-x-3 gap-y-1"
  >
    <Swatch className="bg-[#15803d]" label="All drop" />
    <Swatch className="bg-[#0078d4]" label="Normal" />
    {Object.values(CELL_CODES).map(({ code, short }) => (
      <span key={code}>
        <strong className="font-mono text-[var(--color-text)]">{code}</strong> {short}
      </span>
    ))}
    <span className="flex items-center gap-1">
      <Crown aria-hidden className="w-3.5 h-3.5 text-amber-400" /> Dealer
    </span>
  </section>
);
