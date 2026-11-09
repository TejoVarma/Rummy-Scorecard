import React from 'react';

interface IconButtonProps {
  /** What the button does, read out by screen readers and shown as a tooltip. */
  label: string;
  onClick: () => void;
  className?: string;
  /** Compact keeps the small original size, for crowded bars. */
  compact?: boolean;
  children: React.ReactNode;
}

/** An icon-only button that always has a name; 44px to tap unless it's in a crowded bar. */
export const IconButton: React.FC<IconButtonProps> = ({ label, onClick, className = '', compact = false, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`${compact ? 'p-1.5' : 'min-w-[44px] min-h-[44px]'} flex items-center justify-center rounded transition ${className}`}
  >
    {children}
  </button>
);
