import type { Config } from '../config';
import { isRiverBank } from './map';
import type { Building, BuildingKind, GameState } from './types';

/** Building kinds the player can place (have an entry in config.buildings). */
export type BuildableKind = keyof Config['buildings'];

export function isBuildable(config: Config, kind: BuildingKind): kind is BuildableKind {
  return kind in config.buildings;
}

export const ENERGY_SOURCES: readonly BuildableKind[] = ['coalPlant', 'windmill'];
export const MACHINES: readonly BuildableKind[] = ['soilCleaner', 'irrigator', 'filterStation', 'pollenSprayer'];
export const GRID_BUILDINGS: readonly BuildableKind[] = ['pole'];

/** Why a building can't be placed. null = it can. */
export type BuildBlockReason =
  | 'outOfMap'
  | 'river'
  | 'ruin'
  | 'occupied'
  | 'notRiverBank'
  | 'noMaterial';

export function canBuild(
  state: GameState,
  config: Config,
  kind: BuildableKind,
  x: number,
  y: number,
): BuildBlockReason | null {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return 'outOfMap';
  const tile = state.tiles[y * state.width + x];
  if (tile.kind === 'river') return 'river';
  if (tile.kind === 'ruin') return 'ruin';
  if (tile.buildingId !== null) return 'occupied';
  if (kind === 'filterStation' && !isRiverBank(state, x, y)) return 'notRiverBank';
  if (state.material < config.buildings[kind].cost) return 'noMaterial';
  return null;
}

export function refundFor(config: Config, kind: BuildableKind): number {
  return Math.floor(config.buildings[kind].cost * config.demolishRefund);
}

export function findBuilding(state: GameState, id: number): Building | undefined {
  return state.buildings.find((b) => b.id === id);
}

/** Energy a building produces this tick at full power (0 when switched off). */
export function energyOutputOf(state: GameState, config: Config, b: Building): number {
  if (!b.enabled || !isBuildable(config, b.kind)) return 0;
  const base = config.buildings[b.kind].energyOutput;
  if (b.kind === 'windmill') {
    const onHill = state.tiles[b.y * state.width + b.x].kind === 'hill';
    return base * state.wind * (onHill ? config.windmillHillMultiplier : 1);
  }
  return base;
}

/** Energy a building needs this tick at full power (0 when switched off). */
export function energyUseOf(config: Config, b: Building): number {
  if (!b.enabled || !isBuildable(config, b.kind)) return 0;
  return config.buildings[b.kind].energyUse;
}

/** Advances ruin dismantling; finished ruins turn into soil and give material. */
export function updateRuins(s: GameState, config: Config): void {
  for (const t of s.tiles) {
    if (t.dismantleProgress === null) continue;
    t.dismantleProgress += 1;
    if (t.dismantleProgress >= config.ruins.dismantleTicks) {
      t.dismantleProgress = null;
      t.kind = 'soil';
      s.material += config.ruins.material;
    }
  }
}
