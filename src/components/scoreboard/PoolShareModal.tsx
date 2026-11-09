import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { GameState, DealMode, DealSplit, PlayerId } from '../../domain/types';
import {
  calculateProportionalDeal,
  calculateEqualDeal,
  calculateDropDeal,
  validateCustomDeal,
  formatDealSummary,
} from '../../domain/dealSplit';
import { Handshake, Share2, AlertCircle, Check, Scale, Equal, Edit3, Layers } from 'lucide-react';
import { analyzePlayerDrops } from '../../domain/elimination';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { useBackButton, BACK_PRIORITY } from '../../hooks/useBackButton';
import { isShareCancelled } from '../../services/share';

interface PoolShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  onAcceptDeal: (dealSplit: DealSplit) => void;
}

// Shared so the memo below sees the same object every render before round 1.
const NO_SCORES: Record<PlayerId, number> = {};

export const PoolShareModal: React.FC<PoolShareModalProps> = ({
  isOpen,
  onClose,
  state,
  onAcceptDeal,
}) => {
  const { rules, seats, players, rounds, dealSplit, status } = state;

  // Active players
  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const latestScores = lastRound?.cumulativeScores ?? NO_SCORES;

  const activePlayers = useMemo(() => {
    const describe = (id: PlayerId, score: number) => ({
      playerId: id,
      name: players[id]?.name || 'Player',
      score,
      margin: Math.max(1, rules.poolLimit - score),
      drops: Math.max(
        0,
        analyzePlayerDrops(score, rules.poolLimit, rules.openDrop, rules.middleDrop, rules.fullCount).openDropsRemaining
      ),
    });
    if (dealSplit) {
      return Object.keys(dealSplit.payouts).map(id =>
        describe(id, dealSplit.scoresSnapshot[id] ?? latestScores[id] ?? 0)
      );
    }
    return seats
      .filter(id => (latestScores[id] ?? 0) < rules.poolLimit)
      .map(id => describe(id, latestScores[id] ?? 0));
  }, [seats, latestScores, rules, players, dealSplit]);

  // Pool calculation
  const entryAmount = rules.entryAmount ?? 0;
  const totalReEntries = seats.reduce((sum, id) => sum + (players[id]?.reEntryCount ?? 0), 0);
  const totalPoolAmount = dealSplit?.totalPool ?? entryAmount * (seats.length + totalReEntries);

  const [mode, setMode] = useState<DealMode>(dealSplit?.mode || 'proportional');
  const [customPayouts, setCustomPayouts] = useState<Record<PlayerId, string>>({});
  const [isCopied, setIsCopied] = useState(false);
  const [showConfirmAccept, setShowConfirmAccept] = useState(false);

  // Synchronize modal state whenever opened or when deal changes
  useEffect(() => {
    if (isOpen) {
      setMode(dealSplit?.mode || 'proportional');
      setShowConfirmAccept(false);
      setIsCopied(false);
      if (dealSplit?.payouts) {
        const res: Record<PlayerId, string> = {};
        for (const [id, val] of Object.entries(dealSplit.payouts)) {
          res[id] = String(val);
        }
        setCustomPayouts(res);
      } else {
        const proportional = calculateProportionalDeal(rules.poolLimit, totalPoolAmount, activePlayers);
        const res: Record<PlayerId, string> = {};
        for (const [id, val] of Object.entries(proportional)) {
          res[id] = String(val);
        }
        setCustomPayouts(res);
      }
    }
  }, [isOpen, dealSplit, rules.poolLimit, totalPoolAmount, activePlayers]);

  // Intercept back button to dismiss nested confirmation before closing modal
  useBackButton(
    () => setShowConfirmAccept(false),
    isOpen && showConfirmAccept,
    BACK_PRIORITY.NESTED_MODAL,
    'pool_share_confirm'
  );

  // Computed payouts based on mode
  const calculatedPayouts = useMemo(() => {
    if (dealSplit) return dealSplit.payouts;
    if (mode === 'proportional') {
      return calculateProportionalDeal(rules.poolLimit, totalPoolAmount, activePlayers);
    }
    if (mode === 'equal') {
      return calculateEqualDeal(totalPoolAmount, activePlayers.map(p => p.playerId));
    }
    if (mode === 'drops') {
      return calculateDropDeal(totalPoolAmount, entryAmount, activePlayers);
    }
    // Custom mode
    const numPayouts: Record<PlayerId, number> = {};
    activePlayers.forEach(p => {
      numPayouts[p.playerId] = parseInt(customPayouts[p.playerId], 10) || 0;
    });
    return numPayouts;
  }, [mode, rules.poolLimit, totalPoolAmount, entryAmount, activePlayers, customPayouts, dealSplit]);

  const customValidation = useMemo(() => {
    if (mode !== 'custom') return { isValid: true, difference: 0, allocatedTotal: totalPoolAmount };
    return validateCustomDeal(totalPoolAmount, calculatedPayouts);
  }, [mode, totalPoolAmount, calculatedPayouts]);

  const handleShareDeal = async () => {
    const activeScoresSnapshot: Record<PlayerId, number> = {};
    activePlayers.forEach(p => {
      activeScoresSnapshot[p.playerId] = p.score;
    });

    const currentDeal: DealSplit = dealSplit || {
      mode,
      payouts: calculatedPayouts,
      scoresSnapshot: activeScoresSnapshot,
      totalPool: totalPoolAmount,
      timestamp: Date.now(),
    };

    const text = formatDealSummary(currentDeal, players);

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'Rummy Pool Deal Split',
          text,
          dialogTitle: 'Share Deal Split',
        });
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Rummy Pool Deal Split',
          text,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        alert("Sharing isn't available here. Take a screenshot of the deal instead.");
      }
    } catch (err) {
      if (!isShareCancelled(err)) {
        console.warn('Share deal failed, attempting clipboard fallback:', err);
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
          } else {
            alert("Couldn't share the deal. Take a screenshot of it instead.");
          }
        } catch (clipErr) {
          console.warn('Clipboard write failed:', clipErr);
          alert("Couldn't share or copy the deal. Take a screenshot of it instead.");
        }
      }
    }
  };

  const handleConfirmAccept = () => {
    const activeScoresSnapshot: Record<PlayerId, number> = {};
    activePlayers.forEach(p => {
      activeScoresSnapshot[p.playerId] = p.score;
    });

    const newDeal: DealSplit = {
      mode,
      payouts: calculatedPayouts,
      scoresSnapshot: activeScoresSnapshot,
      totalPool: totalPoolAmount,
      timestamp: Date.now(),
    };

    onAcceptDeal(newDeal);
    setShowConfirmAccept(false);
    onClose();
  };

  const isAlreadySettled = Boolean(dealSplit);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pool Deal / Prize Split" maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Pool Summary Card */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#064e3b] to-[#022c22] border border-[#059669]/50 text-white flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
              Total Prize Pool
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono text-2xl font-extrabold text-emerald-300">
                ₹{totalPoolAmount}
              </span>
              {entryAmount > 0 && (
                <span className="text-xs text-emerald-200/80 font-mono">
                  (₹{entryAmount} × {seats.length + totalReEntries})
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
              Active Players
            </span>
            <span className="font-mono text-base font-bold text-white">
              {activePlayers.length} remaining
            </span>
          </div>
        </div>

        {/* Existing settled status notice */}
        {isAlreadySettled && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300 block">Match Settled by Deal</span>
              <p className="opacity-90 leading-relaxed">
                This match was finalized via an agreed prize pool deal. Payouts are final and irrevocable.
              </p>
            </div>
          </div>
        )}

        {/* Mode Selector Tabs (only when not yet settled) */}
        {!isAlreadySettled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-muted)]">Split Calculation Mode</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[var(--color-subtle)] border border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setMode('proportional')}
                className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  mode === 'proportional'
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Scale className="w-3.5 h-3.5" /> Points (Fair)
              </button>

              <button
                type="button"
                onClick={() => setMode('equal')}
                className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  mode === 'equal'
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Equal className="w-3.5 h-3.5" /> Equal Split
              </button>

              <button
                type="button"
                onClick={() => setMode('drops')}
                className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  mode === 'drops'
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> By Drops
              </button>

              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  mode === 'custom'
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Custom
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-muted)] italic px-1">
              {mode === 'proportional' &&
                `Fair points split: players with lower scores have higher drops/points margin to ${rules.poolLimit} and receive a larger share.`}
              {mode === 'equal' && 'Evenly splits the total pool among all remaining active players.'}
              {mode === 'drops' &&
                `Everyone gets their ₹${entryAmount} stake back, each drop left is worth ₹${entryAmount}, and anything left over is shared equally.`}
              {mode === 'custom' && 'Negotiate and enter custom amounts agreed by the players.'}
            </p>
          </div>
        )}

        {/* Players Payout Table */}
        <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-card)] divide-y divide-[var(--color-border)]">
          <div className="px-3.5 py-2 bg-[var(--color-subtle)] flex items-center justify-between text-[11px] font-bold text-[var(--color-muted)]">
            <span>PLAYER & SCORE</span>
            <span>PAYOUT SHARE</span>
          </div>

          {activePlayers.map(player => {
            const payout = calculatedPayouts[player.playerId] ?? 0;
            const scoreSnapshot = dealSplit?.scoresSnapshot[player.playerId] ?? player.score;

            return (
              <div
                key={player.playerId}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: players[player.playerId]?.avatarColor || '#3b82f6' }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-[var(--color-text)] block truncate">
                      {player.name}
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)] block font-mono">
                      {mode === 'drops'
                        ? `${scoreSnapshot} pts · ${player.drops} drop${player.drops === 1 ? '' : 's'}`
                        : `${scoreSnapshot} pts (${rules.poolLimit - scoreSnapshot} margin)`}
                    </span>
                  </div>
                </div>

                {mode === 'custom' && !isAlreadySettled ? (
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-xs text-emerald-500">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={customPayouts[player.playerId] ?? ''}
                      onChange={e => {
                        const clean = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                        setCustomPayouts(prev => ({
                          ...prev,
                          [player.playerId]: clean,
                        }));
                      }}
                      className="w-20 px-2 py-1 text-right font-mono font-bold text-sm rounded bg-[var(--color-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                ) : (
                  <div className="text-right">
                    <strong className="font-mono text-sm font-bold text-emerald-500 block">
                      ₹{payout}
                    </strong>
                    {totalPoolAmount > 0 && (
                      <span className="text-[10px] text-[var(--color-muted)] font-mono block">
                        {((payout / totalPoolAmount) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Custom Mode Balance Validator */}
        {mode === 'custom' && !isAlreadySettled && (
          <div
            className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
              customValidation.isValid
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}
          >
            <span>Allocated: ₹{customValidation.allocatedTotal} of ₹{totalPoolAmount}</span>
            <span>
              {customValidation.isValid
                ? '✓ Balanced'
                : customValidation.difference > 0
                ? `Remaining: ₹${customValidation.difference}`
                : `Over by: ₹${Math.abs(customValidation.difference)}`}
            </span>
          </div>
        )}

        {/* Confirmation dialogue for accepting deal */}
        {showConfirmAccept && (
          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 space-y-2.5 text-xs text-[var(--color-text)]">
            <span className="font-bold text-amber-400 block text-sm">
              Confirm Deal & End Match?
            </span>
            <p className="text-[var(--color-muted)] leading-relaxed">
              Are all players in agreement? This will finalize the match and record the payouts permanently in game history.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmAccept(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--color-border)] text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmAccept}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition"
              >
                Yes, Finalize Deal
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Share Breakdown Button */}
          <button
            type="button"
            onClick={handleShareDeal}
            className="w-full py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-subtle)] hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-[var(--color-text)] transition flex items-center justify-center gap-2"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4 text-[var(--color-primary)]" />}
            {isCopied ? 'Deal Copied to Clipboard!' : 'Share / Copy Deal Breakdown'}
          </button>

          {/* Accept Deal Button (when game is active) */}
          {!isAlreadySettled && status === 'playing' && !showConfirmAccept && (
            <button
              type="button"
              disabled={!customValidation.isValid}
              onClick={() => setShowConfirmAccept(true)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-md active:scale-[0.99] transition flex items-center justify-center gap-2"
            >
              <Handshake className="w-4 h-4" /> ACCEPT DEAL & FINISH MATCH
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
