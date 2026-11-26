import { STATE_VERSION } from './state';
import type { GameState } from './types';

/** Turns a saved JSON string back into a game state; null when it is unusable or from an older version. */
export function parseSave(json: string | null): GameState | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json) as GameState;
    if (!data || data.version !== STATE_VERSION || !Array.isArray(data.tiles)) return null;
    return data;
  } catch {
    return null;
  }
}
