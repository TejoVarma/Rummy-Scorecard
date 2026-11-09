import React from 'react';
import { ArrowLeft, Settings, Share2, Trash2, Volume2 } from 'lucide-react';
import { IconButton } from '../common/IconButton';

interface ScoreboardHeaderProps {
  title: string;
  canAnnounce: boolean;
  onBack: () => void;
  onAnnounce: () => void;
  onShare: () => void;
  onOpenSettings: () => void;
  onDelete: () => void;
}

export const ScoreboardHeader: React.FC<ScoreboardHeaderProps> = ({
  title,
  canAnnounce,
  onBack,
  onAnnounce,
  onShare,
  onOpenSettings,
  onDelete,
}) => (
  <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--color-primary)] text-white shadow-sm shrink-0">
    <div className="flex items-center gap-1 min-w-0">
      <IconButton label="Back to Home" onClick={onBack} className="hover:bg-black/10">
        <ArrowLeft className="w-5 h-5 text-white" />
      </IconButton>
      <h1 className="font-semibold text-base tracking-normal truncate">{title}</h1>
    </div>

    <div className="flex items-center shrink-0">
      {canAnnounce && (
        <IconButton label="Announce scores" onClick={onAnnounce} className="hover:bg-black/10">
          <Volume2 className="w-4 h-4 text-white" />
        </IconButton>
      )}
      <IconButton label="Share Scorecard" onClick={onShare} className="hover:bg-black/10">
        <Share2 className="w-4 h-4 text-white" />
      </IconButton>
      <IconButton label="Settings" onClick={onOpenSettings} className="hover:bg-black/10">
        <Settings className="w-4 h-4 text-white" />
      </IconButton>
      <IconButton
        label="Delete Game"
        onClick={() => {
          if (window.confirm(`Delete "${title}" permanently? Its scores and deal can't be recovered.`)) onDelete();
        }}
        className="hover:bg-rose-600/30 text-rose-200"
      >
        <Trash2 className="w-4 h-4" />
      </IconButton>
    </div>
  </div>
);
