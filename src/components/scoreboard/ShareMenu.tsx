import React from 'react';
import { FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';

export type ShareKind = 'image' | 'text';

const OPTIONS = [
  { kind: 'image', label: 'Image', hint: 'Picture of the full scoreboard', Icon: ImageIcon },
  { kind: 'text', label: 'Text', hint: 'Totals as a message', Icon: FileText },
] as const;

interface ShareMenuProps {
  isOpen: boolean;
  sharingAs: ShareKind | null;
  onClose: () => void;
  onShare: (kind: ShareKind) => void;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ isOpen, sharingAs, onClose, onShare }) => (
  <Modal isOpen={isOpen} onClose={() => !sharingAs && onClose()} title="Share scorecard">
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map(({ kind, label, hint, Icon }) => (
        <button
          key={kind}
          type="button"
          onClick={() => onShare(kind)}
          disabled={sharingAs !== null}
          aria-label={`Share as ${label}`}
          className="min-h-[96px] p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)] disabled:opacity-50 transition flex flex-col items-center justify-center gap-1.5 text-center"
        >
          {sharingAs === kind ? (
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
          ) : (
            <Icon className="w-6 h-6 text-[var(--color-primary)]" />
          )}
          <span className="font-semibold text-sm">{label}</span>
          <span className="text-[11px] text-[var(--color-muted)] leading-tight">{hint}</span>
        </button>
      ))}
    </div>
  </Modal>
);
