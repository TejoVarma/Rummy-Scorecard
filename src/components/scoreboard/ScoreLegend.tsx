import React from 'react';
import { Crown } from 'lucide-react';

/** What each score-cell code means. The cells and the legend both read from here. */
export const CELL_CODES = {
  show: { code: 'R', label: 'Show (won the round)' },
  open_drop: { code: 'D', label: 'Drop' },
  middle_drop: { code: 'MD', label: 'Middle drop' },
  full_count: { code: 'FC', label: 'Full count' },
  out: { code: 'X', label: 'Out' },
  reEntry: { code: 'RE', label: 'Re-entry (with the score they came back on)' },
} as const;

const Swatch: React.FC<{ className: string; label: string }> = ({ className, label }) => (
  <span className="flex items-center gap-1.5">
    <span aria-hidden className={`inline-block w-3.5 h-3.5 rounded ${className}`} />
    {label}
  </span>
);

export const ScoreLegend: React.FC = () => (
  <section
    aria-label="Legend"
    className="px-3 py-2.5 border-t border-[var(--color-border)] text-[11px] leading-snug text-[var(--color-muted)] space-y-1.5"
  >
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <Swatch className="bg-[#15803d]" label="All-drop round" />
      <Swatch className="bg-[#0078d4]" label="Normal round" />
      <Swatch className="bg-[#27272a]" label="Already out" />
    </div>
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {Object.values(CELL_CODES).map(({ code, label }) => (
        <span key={code}>
          <strong className="font-mono text-[var(--color-text)]">{code}</strong> {label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <Crown aria-hidden className="w-3.5 h-3.5 text-amber-400" /> Dealer
      </span>
    </div>
  </section>
);
