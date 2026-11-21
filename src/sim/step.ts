import type { Config } from '../config';
import type { GameState } from './types';

/**
 * Advances the simulation by one tick. Pure function: never mutates the
 * input, never touches the DOM. Systems are added phase by phase.
 */
export function step(state: GameState, _config: Config): GameState {
  const next = structuredClone(state);
  next.tick += 1;
  return next;
}

/** Runs `count` ticks in a row (debug "skip 100 ticks", bots, tests). */
export function stepMany(state: GameState, config: Config, count: number): GameState {
  let s = state;
  for (let i = 0; i < count; i++) s = step(s, config);
  return s;
}
