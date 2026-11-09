import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../../hooks/useBackButton';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}) => {
  useBackButton(onClose, isOpen, BACK_PRIORITY.GLOBAL_MODAL);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog so screen readers announce it and keyboards land inside.
  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${maxWidth} max-h-[90vh] focus:outline-none flex flex-col rounded-t-xl sm:rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] shadow-xl overflow-hidden transition-colors duration-200`}
      >
        {/* Header - Simple clean header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-primary)] text-white">
          <h2 id={titleId} className="text-sm font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-black/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
};
