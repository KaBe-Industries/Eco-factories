import type { Config } from '../config';
import type { Building, BuildingKind, GameState, Inventory, Tile } from './types';

export const STATE_VERSION = 1;

export function emptyInventory(): Inventory {
  return { input: {}, output: {} };
}

export function emptyTile(): Tile {
  return {
    kind: 'soil',
    toxicity: 0,
    moisture: 0,
    life: { fungi: false, plants: false, pollinated: false },
    item: null,
    buildingId: null,
    dismantleProgress: null,
  };
}

export function tileIndex(state: Pick<GameState, 'width'>, x: number, y: number): number {
  return y * state.width + x;
}

export function inBounds(state: Pick<GameState, 'width' | 'height'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function makeBuilding(id: number, kind: BuildingKind, x: number, y: number): Building {
  return {
    id,
    kind,
    x,
    y,
    enabled: true,
    direction: 'E',
    inventory: emptyInventory(),
    progress: 0,
  };
}

/**
 * Creates a fresh game. In phase 0 the map is a blank field;
 * seeded map generation arrives in phase 1.
 */
export function createInitialState(config: Config): GameState {
  const { width, height, seed } = config.map;
  const tiles: Tile[] = Array.from({ length: width * height }, emptyTile);
  return {
    version: STATE_VERSION,
    seed,
    rng: seed,
    tick: 0,
    width,
    height,
    tiles,
    buildings: [],
    nextBuildingId: 1,
    material: config.start.material,
    wind: 0,
    riverQuality: config.start.riverQuality,
    pollution: config.start.pollution,
    bees: 0,
    energy: { produced: 0, demanded: 0, ratio: 1 },
    databank: [
      { species: 'fungi', status: 'locked', thawProgress: 0 },
      { species: 'plants', status: 'locked', thawProgress: 0 },
      { species: 'bees', status: 'locked', thawProgress: 0 },
    ],
    ghost: { shown: [], lastPollutionWarningTick: null, active: null },
    stats: { collapses: 0, maxBeltTiles: 0 },
    stableTicks: 0,
    wonAtTick: null,
  };
}
