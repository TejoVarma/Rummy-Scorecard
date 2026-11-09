import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { GameState } from '../domain/types';

// Closing the share sheet is not an error: browsers reject with an AbortError,
// and Capacitor's Android Share plugin rejects with the message "Share canceled".
export function isShareCancelled(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ('name' in err && err.name === 'AbortError') return true;
  return 'message' in err && err.message === 'Share canceled';
}

function singleLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim();
}

export function buildScorecardText(state: GameState): string {
  const { title, rules, seats, players, rounds, dealSplit } = state;
  const latest = rounds.length > 0 ? rounds[rounds.length - 1].cumulativeScores : {};
  const entryAmount = rules.entryAmount ?? 0;
  const reEntries = seats.reduce((sum, id) => sum + (players[id]?.reEntryCount ?? 0), 0);
  const totalPool = entryAmount * (seats.length + reEntries);

  const lines = [
    `🎴 *Rummy Scorecard: ${singleLine(title)}*`,
    `Pool: ${rules.poolLimit}${entryAmount > 0 ? ` | Prize Pool: ₹${totalPool}` : ''} | Rounds: ${rounds.length}`,
  ];

  if (dealSplit) {
    lines.push('', '🤝 *Match Settled by Deal:*');
    for (const [id, amount] of Object.entries(dealSplit.payouts)) {
      lines.push(`• ${players[id]?.name || 'Player'}: ₹${amount}`);
    }
  }

  lines.push('');
  for (const id of seats) {
    const score = latest[id] ?? 0;
    const out = score >= rules.poolLimit ? ' (Out)' : '';
    lines.push(`${players[id]?.name || 'Player'}: ${score} pts${out}`);
  }
  return lines.join('\n');
}

export async function shareText(title: string, text: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title, text, dialogTitle: 'Share Rummy Scorecard' });
    return;
  }
  if (navigator.share) {
    await navigator.share({ title, text });
    return;
  }
  await navigator.clipboard.writeText(text);
  alert('Scorecard copied. Paste it into any chat.');
}

/**
 * Renders the element to a PNG including any part hidden inside a scrolling area,
 * so long games and wide tables come out complete.
 */
export async function captureElement(node: HTMLElement, scrollArea: HTMLElement | null): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  const saved = [node, scrollArea].map(el => (el ? el.getAttribute('style') : null));

  try {
    if (scrollArea) {
      Object.assign(scrollArea.style, { overflow: 'visible', flex: 'none', height: 'auto' });
    }
    Object.assign(node.style, { overflow: 'visible', flex: 'none', height: 'auto' });

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#0f172a';
    const blob = await toBlob(node, {
      pixelRatio: 2,
      backgroundColor: bg,
      cacheBust: true,
      width: node.scrollWidth,
      height: node.scrollHeight,
    });
    if (!blob) throw new Error('The scorecard image came out empty');
    return blob;
  } finally {
    [node, scrollArea].forEach((el, i) => {
      if (!el) return;
      const previous = saved[i];
      if (previous === null) el.removeAttribute('style');
      else el.setAttribute('style', previous);
    });
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}

export async function shareImage(blob: Blob, fileName: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // Android can only hand other apps a real file, so write it to the cache folder first.
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    });
    await Share.share({ title, files: [uri], dialogTitle: 'Share Rummy Scorecard' });
    return;
  }

  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function scorecardFileName(state: GameState): string {
  const safeTitle = state.title.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'scorecard';
  return `${safeTitle}-round-${state.rounds.length}.png`;
}

/** Hands a text file (such as a backup) to the share sheet on the phone, or downloads it in a browser. */
export async function shareTextFile(text: string, fileName: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title, files: [uri], dialogTitle: title });
    return;
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
