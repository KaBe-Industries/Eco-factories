import { config } from '../src/config';
import { createInitialState, isRiverBank } from '../src/sim';
import type { GameState, TileKind } from '../src/sim';

export function fresh(): GameState {
  return createInitialState(config);
}

/** First free tile matching a predicate (no building on it). */
export function findTile(
  s: GameState,
  pred: (kind: TileKind, x: number, y: number) => boolean,
): { x: number; y: number } {
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const t = s.tiles[y * s.width + x];
      if (t.buildingId === null && pred(t.kind, x, y)) return { x, y };
    }
  }
  throw new Error('no matching tile');
}

export const soil = (s: GameState) => findTile(s, (k, x, y) => k === 'soil' && !isRiverBank(s, x, y));
export const bank = (s: GameState) => findTile(s, (k, x, y) => k === 'soil' && isRiverBank(s, x, y));
export const hill = (s: GameState) => findTile(s, (k) => k === 'hill');
export const ruin = (s: GameState) => findTile(s, (k) => k === 'ruin');
export const river = (s: GameState) => findTile(s, (k) => k === 'river');
