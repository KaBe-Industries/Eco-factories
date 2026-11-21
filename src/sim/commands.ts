import type { Config } from '../config';
import type { Command, GameState } from './types';

/**
 * Applies one player command and returns the new state. Pure, like `step`.
 * Commands are implemented in later phases; unknown or invalid commands
 * return the state unchanged.
 */
export function applyCommand(state: GameState, _config: Config, _command: Command): GameState {
  return state;
}
