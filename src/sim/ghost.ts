import type { GameState } from './types';

/**
 * Shows a ghost message at a tile. One-shot messages are shown at most once;
 * if another message is open, the new one waits in the queue.
 * Mutates a state the caller has already copied.
 */
export function showGhost(s: GameState, id: string, x: number, y: number, once = true): void {
  if (once && s.ghost.shown.includes(id)) return;
  if (!s.ghost.shown.includes(id)) s.ghost.shown.push(id);
  const msg = { id, x, y };
  if (s.ghost.active === null) s.ghost.active = msg;
  else s.ghost.queue.push(msg);
}

/** Closes the open message and shows the next waiting one. */
export function dismissGhost(s: GameState): void {
  s.ghost.active = s.ghost.queue.shift() ?? null;
}

export function databankTile(s: GameState): { x: number; y: number } {
  const b = s.buildings.find((o) => o.kind === 'databank');
  return b ? { x: b.x, y: b.y } : { x: Math.floor(s.width / 2), y: Math.floor(s.height / 2) };
}
