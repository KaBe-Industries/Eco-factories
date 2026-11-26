import type { GameState } from '../sim';
import { parseSave } from '../sim';

/**
 * Browser save slot. Every access is wrapped in try/catch: when storage is
 * blocked or full, the game simply goes on without saving.
 */
export function saveKey(playtest: boolean): string {
  return playtest ? 'koreny-save-test' : 'koreny-save';
}

export function loadGame(key: string): GameState | null {
  try {
    return parseSave(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function saveGame(key: string, state: GameState): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
