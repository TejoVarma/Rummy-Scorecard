// The browser share sheet rejects with an AbortError when the user just closes it.
export function isShareCancelled(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError';
}
