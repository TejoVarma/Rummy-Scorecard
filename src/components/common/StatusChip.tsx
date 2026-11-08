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
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-amber-500/20';
      case 're_entered':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-blue-500/20';
      case 'out':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      case 'show':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      case 'drop':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 'mdrop':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      case 'full':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm shadow-sm ${getBadgeClasses()}`}
    >
      {label}
      {subLabel && <span className="text-[10px] opacity-75 font-mono">({subLabel})</span>}
    </span>
  );
};
