import type { Config } from '../config';
import { updateEnergy, updateRuins } from './buildings';
import type { GameState } from './types';
import { updateWind } from './wind';

/**
 * Advances the simulation by one tick. Pure function: never mutates the
 * input, never touches the DOM. Systems are added phase by phase.
 */
export function step(state: GameState, config: Config): GameState {
  const s = structuredClone(state);
  s.tick += 1;
  updateWind(s, config);
  updateRuins(s, config);
  updateEnergy(s, config);
  return s;
}

/** Runs `count` ticks in a row (debug "skip 100 ticks", bots, tests). */
export function stepMany(state: GameState, config: Config, count: number): GameState {
  let s = state;
  for (let i = 0; i < count; i++) s = step(s, config);
  return s;
}
