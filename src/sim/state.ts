import type { Config } from '../config';
import { databankPosition, generateMap } from './map';
import { windAt } from './wind';
import type { Building, BuildingKind, GameState, Inventory, Tile } from './types';

export const STATE_VERSION = 7;

export function emptyInventory(): Inventory {
  return { input: {}, output: {} };
}

export function emptyTile(): Tile {
  return {
    kind: 'soil',
    toxicity: 0,
    moisture: 0,
    baseMoisture: 0,
    life: { fungi: false, plants: 0, hive: false, pollinated: false },
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
    networkId: null,
    power: 0,
  };
}

/** Creates a fresh game with a map generated from the seed in config. */
export function createInitialState(config: Config): GameState {
  const { width, height, seed } = config.map;
  const map = generateMap(config);
  return {
    version: STATE_VERSION,
    seed,
    rng: map.rng,
    tick: 0,
    width,
    height,
    tiles: map.tiles,
    buildings: map.buildings,
    nextBuildingId: map.nextBuildingId,
    wires: [],
    nextWireId: 1,
    material: config.start.material,
    wind: windAt(config, 0, 0),
    windNoise: 0,
    riverQuality: config.start.riverQuality,
    pollution: config.start.pollution,
    bees: 0,
    energy: { produced: 0, demanded: 0, unconnected: 0, networks: [] },
    databank: [
      { species: 'fungi', status: 'locked', thawProgress: 0 },
      { species: 'plants', status: 'locked', thawProgress: 0 },
      { species: 'bees', status: 'locked', thawProgress: 0 },
    ],
    ghost: {
      shown: ['intro'],
      lastPollutionWarningTick: null,
      active: { id: 'intro', ...databankPosition(config) },
      queue: [],
    },
    stats: { collapses: 0, maxBeltTiles: 0 },
    acidRainEpisode: false,
    selfSufficiency: { soil: 0, irrigation: 0, river: 0, pollination: 0, total: 0 },
    lastBiome: { riverQuality: config.start.riverQuality, bees: 0, plantTiles: 0 },
    stableTicks: 0,
    wonAtTick: null,
  };
}
