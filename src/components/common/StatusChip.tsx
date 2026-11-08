import React from 'react';

interface StatusChipProps {
  label: string;
  variant: 'dealer' | 're_entered' | 'out' | 'show' | 'drop' | 'mdrop' | 'full';
  subLabel?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ label, variant, subLabel }) => {
  const getBadgeClasses = () => {
    switch (variant) {
      case 'dealer':
        return 'bg-[#0284c7]/20 text-[#38bdf8] border-[#0284c7]/40';
      case 're_entered':
        return 'bg-[#0369a1]/20 text-[#38bdf8] border-[#0284c7]/30';
      case 'out':
        return 'bg-rose-950/40 text-rose-300 border-rose-800/40';
      case 'show':
        return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40';
      case 'drop':
        return 'bg-orange-950/40 text-orange-300 border-orange-800/40';
      case 'mdrop':
        return 'bg-amber-950/40 text-amber-300 border-amber-800/40';
      case 'full':
        return 'bg-purple-950/40 text-purple-300 border-purple-800/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${getBadgeClasses()}`}
    >
      {label}
      {subLabel && <span className="opacity-80 font-mono">({subLabel})</span>}
    </span>
  );
};
