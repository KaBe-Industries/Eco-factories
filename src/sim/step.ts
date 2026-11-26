import type { Config } from '../config';
import { updateGrid } from './grid';
import { updateRuins } from './buildings';
import type { GameState } from './types';
import { updateWind } from './wind';
import { updateAcidRain, updateCoalSoil, updatePollution } from './pollution';
import { updateEnvironment, updateMachines } from './environment';
import { beePollination, updateBees, updateFungi, updatePlants, updateThaw, updateUnlocks } from './species';

/**
 * Advances the simulation by one tick. Pure function: never mutates the
 * input, never touches the DOM. Systems are added phase by phase.
 */
export function step(state: GameState, config: Config): GameState {
  const s = structuredClone(state);
  s.tick += 1;
  updateWind(s, config);
  updateRuins(s, config);
  updateGrid(s, config);
  updateMachines(s, config);
  beePollination(s, config);
  updateThaw(s, config);
  updateFungi(s, config);
  updatePlants(s, config);
  updateBees(s, config);
  updateCoalSoil(s, config);
  updatePollution(s, config);
  updateAcidRain(s, config);
  updateEnvironment(s, config);
  updateUnlocks(s, config);
  return s;
}

/** Runs `count` ticks in a row (debug "skip 100 ticks", bots, tests). */
export function stepMany(state: GameState, config: Config, count: number): GameState {
  let s = state;
  for (let i = 0; i < count; i++) s = step(s, config);
  return s;
}
