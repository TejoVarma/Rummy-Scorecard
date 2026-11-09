import React from 'react';

interface IconButtonProps {
  /** What the button does, read out by screen readers and shown as a tooltip. */
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

/** An icon-only button with a name and a 44px touch target, so neither can be forgotten. */
export const IconButton: React.FC<IconButtonProps> = ({ label, onClick, className = '', children }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition ${className}`}
  >
    {children}
  </button>
);
