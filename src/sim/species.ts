import type { Config } from '../config';
import { isRiverBank } from './map';
import { nextRandom } from './rng';
import type { DatabankFloor, GameState, SpeciesId, Tile } from './types';

const NEIGHBOURS_4: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function random(s: GameState): number {
  const [v, rng] = nextRandom(s.rng);
  s.rng = rng;
  return v;
}

const isLand = (t: Tile) => t.kind !== 'river';

// ---- Counting -----------------------------------------------------------------

export function countTiles(state: GameState, pred: (t: Tile) => boolean): number {
  let n = 0;
  for (const t of state.tiles) if (pred(t)) n++;
  return n;
}

export function plantTileCount(state: GameState): number {
  return countTiles(state, (t) => t.life.plants > 0);
}

// ---- Unlock conditions --------------------------------------------------------

export type ConditionId = 'lowToxTiles' | 'riverQuality' | 'plantTiles' | 'pollution';

export interface Condition {
  id: ConditionId;
  /** Threshold the condition is about (e.g. toxicity 60), for the label. */
  threshold: number;
  current: number;
  target: number;
  /** true = current must be below target. */
  below: boolean;
  met: boolean;
}

export function floorConditions(state: GameState, config: Config, species: SpeciesId): Condition[] {
  const u = config.unlock;
  const lowTox = (limit: number) => countTiles(state, (t) => isLand(t) && t.toxicity < limit);
  const c = (id: ConditionId, threshold: number, current: number, target: number, below = false): Condition => ({
    id,
    threshold,
    current,
    target,
    below,
    met: below ? current < target : current >= target,
  });
  switch (species) {
    case 'fungi':
      return [c('lowToxTiles', u.fungi.belowToxicity, lowTox(u.fungi.belowToxicity), u.fungi.tiles)];
    case 'plants':
      return [
        c('riverQuality', 0, state.riverQuality, u.plants.riverQuality),
        c('lowToxTiles', u.plants.belowToxicity, lowTox(u.plants.belowToxicity), u.plants.tiles),
      ];
    case 'bees':
      return [
        c('plantTiles', 0, plantTileCount(state), u.bees.plantTiles),
        c('pollution', 0, state.pollution, u.bees.belowPollution, true),
      ];
  }
}

export function floorOf(state: GameState, species: SpeciesId): DatabankFloor {
  return state.databank.find((f) => f.species === species)!;
}

/** Floors unlock in order, each once its conditions hold. Unlocking is permanent. */
export function updateUnlocks(s: GameState, config: Config): void {
  for (let i = 0; i < s.databank.length; i++) {
    const f = s.databank[i];
    if (f.status !== 'locked') continue;
    if (i > 0 && s.databank[i - 1].status === 'locked') break;
    if (floorConditions(s, config, f.species).every((c) => c.met)) f.status = 'unlocked';
  }
}

// ---- Thawing ------------------------------------------------------------------

export function canThaw(state: GameState, species: SpeciesId): boolean {
  return floorOf(state, species).status === 'unlocked' && !state.databank.some((f) => f.status === 'thawing');
}

/** Thawing advances with the power the Databank gets from its grid. */
export function updateThaw(s: GameState, config: Config): void {
  const f = s.databank.find((o) => o.status === 'thawing');
  if (!f) return;
  const bank = s.buildings.find((b) => b.kind === 'databank');
  f.thawProgress = Math.min(config.databank.thawTicks, f.thawProgress + (bank?.power ?? 0));
  if (f.thawProgress >= config.databank.thawTicks) f.status = 'ready';
}

// ---- Planting -----------------------------------------------------------------

export type PlantBlockReason = 'notReady' | 'river' | 'occupied' | 'already' | 'tooToxic' | 'tooDry' | 'needsPlants' | 'noMaterial';

export function canPlant(
  state: GameState,
  config: Config,
  species: SpeciesId,
  x: number,
  y: number,
): PlantBlockReason | null {
  if (floorOf(state, species).status !== 'ready') return 'notReady';
  const t = state.tiles[y * state.width + x];
  if (!t || t.kind === 'river') return 'river';
  const sp = config.species;
  switch (species) {
    case 'fungi':
      if (t.life.fungi) return 'already';
      if (t.toxicity >= sp.fungi.maxToxicity) return 'tooToxic';
      break;
    case 'plants':
      if (t.buildingId !== null) return 'occupied';
      if (t.life.plants > 0) return 'already';
      if (t.toxicity >= sp.plants.maxToxicity) return 'tooToxic';
      if (t.moisture <= sp.plants.minMoisture) return 'tooDry';
      break;
    case 'bees':
      if (t.buildingId !== null) return 'occupied';
      if (t.life.hive) return 'already';
      if (t.life.plants <= 0) return 'needsPlants';
      break;
  }
  if (state.material < config.databank.plantCost) return 'noMaterial';
  return null;
}

/** Plants a species on a copied state. Assumes canPlant passed. */
export function plant(s: GameState, config: Config, species: SpeciesId, x: number, y: number): void {
  const t = s.tiles[y * s.width + x];
  s.material -= config.databank.plantCost;
  if (species === 'fungi') t.life.fungi = true;
  if (species === 'plants') t.life.plants = config.species.plants.startLevel;
  if (species === 'bees') {
    t.life.hive = true;
    s.bees = Math.max(s.bees, config.species.bees.startPopulation);
  }
}

// ---- Living processes -----------------------------------------------------------

/** Can plants live on this tile right now? */
export function plantsThrive(config: Config, t: Tile): boolean {
  const p = config.species.plants;
  return t.toxicity < p.maxToxicity && t.moisture > p.minMoisture;
}

export function fungiActive(config: Config, t: Tile): boolean {
  return t.toxicity < config.species.fungi.maxToxicity;
}

function forNeighbours(s: GameState, i: number, fn: (t: Tile) => void): void {
  const x = i % s.width;
  const y = Math.floor(i / s.width);
  for (const [dx, dy] of NEIGHBOURS_4) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
    fn(s.tiles[ny * s.width + nx]);
  }
}

/** Fungi clean the soil where it is not too toxic and creep to neighbouring tiles. */
export function updateFungi(s: GameState, config: Config): void {
  const f = config.species.fungi;
  const spreading: Tile[] = [];
  s.tiles.forEach((t, i) => {
    if (!t.life.fungi || !fungiActive(config, t)) return;
    t.toxicity = Math.max(0, t.toxicity - f.toxicityPerTick);
    forNeighbours(s, i, (n) => {
      if (isLand(n) && !n.life.fungi && fungiActive(config, n) && random(s) < f.spreadChance) spreading.push(n);
    });
  });
  for (const t of spreading) t.life.fungi = true;
}

/**
 * Plants grow where it is clean and wet enough, wilt where it is not, and
 * spread only from pollinated tiles. Grown plants on the bank clean the river.
 */
export function updatePlants(s: GameState, config: Config): void {
  const p = config.species.plants;
  const spreading: Tile[] = [];
  s.tiles.forEach((t, i) => {
    if (t.life.plants <= 0) return;
    if (plantsThrive(config, t)) {
      t.life.plants = Math.min(100, t.life.plants + p.growthPerTick);
    } else {
      t.life.plants = Math.max(0, t.life.plants - p.wiltPerTick);
      if (t.life.plants === 0) t.life.hive = false;
    }
    if (t.life.pollinated && t.life.plants >= p.spreadMinLevel) {
      forNeighbours(s, i, (n) => {
        if (isLand(n) && n.buildingId === null && n.life.plants <= 0 && plantsThrive(config, n) && random(s) < p.spreadChance) {
          spreading.push(n);
        }
      });
    }
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    if (isRiverBank(s, x, y)) {
      s.riverQuality = Math.min(100, s.riverQuality + (p.riverQualityPerBankTile * t.life.plants) / 100);
    }
  });
  for (const t of spreading) if (t.life.plants <= 0) t.life.plants = p.startLevel;
}

/** Pollination radius of every hive at the current population (0 = none). */
export function beeRadius(state: GameState, config: Config): number {
  if (state.bees <= 0) return 0;
  const b = config.species.bees;
  return b.baseRadius + Math.floor(state.bees / b.populationPerRadius);
}

/** Bees pollinate around their hives. Runs after the machines reset pollination. */
export function beePollination(s: GameState, config: Config): void {
  const r = beeRadius(s, config);
  if (r === 0) return;
  s.tiles.forEach((t, i) => {
    if (!t.life.hive) return;
    const hx = i % s.width;
    const hy = Math.floor(i / s.width);
    for (let y = hy - r; y <= hy + r; y++) {
      for (let x = hx - r; x <= hx + r; x++) {
        if (x < 0 || y < 0 || x >= s.width || y >= s.height) continue;
        s.tiles[y * s.width + x].life.pollinated = true;
      }
    }
  });
}

/** Population the plants can feed right now. */
export function beeCapacity(state: GameState, config: Config): number {
  return Math.min(100, plantTileCount(state) * config.species.bees.populationPerPlantTile);
}

/** Bee population moves toward what the plants can feed, as long as a hive exists. */
export function updateBees(s: GameState, config: Config): void {
  if (!s.tiles.some((t) => t.life.hive)) {
    s.bees = Math.max(0, s.bees - config.species.bees.growthPerTick);
    return;
  }
  const target = beeCapacity(s, config);
  const step = config.species.bees.growthPerTick;
  if (s.bees < target) s.bees = Math.min(target, s.bees + step);
  else s.bees = Math.max(target, s.bees - step);
}
