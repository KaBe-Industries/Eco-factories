/**
 * The complete game state. It is plain data (JSON-serialisable), so it can
 * be saved to localStorage, compared in tests and run headless by bots.
 *
 * Logistics (phase 8) is part of the model from day one:
 *  - every building has an inventory with input and output slots,
 *  - every tile can carry one item (used by belts).
 * Phases 0–7 leave these empty.
 */

export type TileKind = 'soil' | 'river' | 'ruin' | 'hill';

/** Items that can sit on a tile or in a building inventory (phase 8). */
export type ItemKind = 'coal' | 'sludge';

export type Direction = 'N' | 'E' | 'S' | 'W';

export type BuildingKind =
  // fixed, pre-placed
  | 'databank'
  | 'coalDump'
  // energy
  | 'coalPlant'
  | 'windmill'
  // machines
  | 'soilCleaner'
  | 'irrigator'
  | 'filterStation'
  | 'pollenSprayer'
  // electric grid (phase 2b)
  | 'pole'
  // logistics (phase 8)
  | 'belt'
  | 'sludgeProcessor';

/** Living species placed on tiles. Bees are a global population instead. */
export interface TileLife {
  fungi: boolean;
  /** Plant growth level 0–100; 0 = no plants. */
  plants: number;
  /** A bee hive released on this tile (bee population itself is global). */
  hive: boolean;
  /** Pollinated this tick (by a sprayer or bees). */
  pollinated: boolean;
}

export interface Tile {
  kind: TileKind;
  /** 0–100, only meaningful on soil/hill/ruin. */
  toxicity: number;
  /** 0–100 */
  moisture: number;
  /** Natural moisture of the tile (from distance to the river). Moisture drifts back to it. */
  baseMoisture: number;
  life: TileLife;
  /** Item lying on this tile (belts carry items this way). */
  item: ItemKind | null;
  /** Id of the building occupying this tile, if any. */
  buildingId: number | null;
  /** Ticks of dismantling done so far on a ruin, null if not dismantling. */
  dismantleProgress: number | null;
}

/** Item counts by kind, e.g. { coal: 3 }. Missing key = 0. */
export type ItemStack = Partial<Record<ItemKind, number>>;

export interface Inventory {
  input: ItemStack;
  output: ItemStack;
}

export interface Building {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
  /** Player switch. A disabled building uses no energy. */
  enabled: boolean;
  /** Orientation; used by belts (phase 8). */
  direction: Direction;
  inventory: Inventory;
  /** Generic work counter for timed actions (burning, producing sludge…). */
  progress: number;
  /**
   * Grid this building belongs to (recomputed every tick), or null when it
   * is not connected. Id = lowest building id in the grid.
   */
  networkId: number | null;
  /** Share of its energy demand the building receives this tick (0–1). */
  power: number;
}

/** A wire laid by the player between two grid nodes (phase 2b). */
export interface Wire {
  id: number;
  /** Building ids of the two ends. */
  a: number;
  b: number;
}

export type SpeciesId = 'fungi' | 'plants' | 'bees';

export type FloorStatus = 'locked' | 'unlocked' | 'thawing' | 'ready';

export interface DatabankFloor {
  species: SpeciesId;
  status: FloorStatus;
  /** Ticks of thawing done. */
  thawProgress: number;
}

export interface NetworkReport {
  id: number;
  produced: number;
  demanded: number;
  /** produced / demanded, capped at 1. All consumers in the grid run at this ratio. */
  ratio: number;
}

export interface EnergyReport {
  /** Sum over all grids. */
  produced: number;
  /** Sum of demand of connected consumers. */
  demanded: number;
  /** Switched-on consumers not connected to any grid. */
  unconnected: number;
  networks: NetworkReport[];
}

export interface GhostState {
  /** Ids of one-shot messages already shown. */
  shown: string[];
  /** Tick of the last repeatable pollution warning, or null. */
  lastPollutionWarningTick: number | null;
  /** Message currently displayed, or null. */
  active: { id: string; x: number; y: number } | null;
}

export interface GameStats {
  collapses: number;
  /** Highest number of belt tiles at once (phase 8 balance report). */
  maxBeltTiles: number;
}

export interface GameState {
  /** Data model version, for save compatibility. */
  version: number;
  seed: number;
  /** Current state of the deterministic random generator. */
  rng: number;
  tick: number;
  width: number;
  height: number;
  /** Row-major: index = y * width + x. */
  tiles: Tile[];
  buildings: Building[];
  nextBuildingId: number;
  wires: Wire[];
  nextWireId: number;

  material: number;
  /** Current wind multiplier for windmills. */
  wind: number;
  /** Random component of the wind (smoothed random walk). */
  windNoise: number;
  riverQuality: number;
  pollution: number;
  /** Bee population 0–100. */
  bees: number;

  energy: EnergyReport;
  databank: DatabankFloor[];
  ghost: GhostState;
  stats: GameStats;

  /** Consecutive ticks the biome has been stable while win conditions hold. */
  stableTicks: number;
  wonAtTick: number | null;
}

/** Player actions. The UI never edits the state directly; it sends commands. */
export type Command =
  | {
      type: 'build';
      kind: BuildingKind;
      x: number;
      y: number;
      direction?: Direction;
      /** Chaining: also lay a wire from the new building to this one, if possible. */
      wireTo?: number;
    }
  | { type: 'wire'; from: number; to: number }
  | { type: 'removeWire'; wireId: number }
  | { type: 'toggle'; buildingId: number }
  | { type: 'demolish'; buildingId: number }
  | { type: 'dismantleRuin'; x: number; y: number }
  | { type: 'thaw'; species: SpeciesId }
  | { type: 'plant'; species: SpeciesId; x: number; y: number }
  | { type: 'dismissGhost' };
