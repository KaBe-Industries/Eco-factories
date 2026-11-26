import type { Config } from '../config';
import { isBuildable } from './buildings';
import { machineRadius } from './environment';
import { databankTile, showGhost } from './ghost';
import { isRiverBank } from './map';
import { beeRadius, fungiActive, plantTileCount } from './species';
import type { Building, GameState, SelfSufficiency } from './types';

/** Share done by life: living / (living + machines); 0 when nobody does the job. */
function share(living: number, machines: number): number {
  const sum = living + machines;
  return sum <= 0 ? 0 : living / sum;
}

/** Land tiles within a square radius around (cx, cy), as tile indices. */
function areaIndices(s: GameState, cx: number, cy: number, r: number, landOnly = true): number[] {
  const out: number[] = [];
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= s.width || y >= s.height) continue;
      const i = y * s.width + x;
      if (!landOnly || s.tiles[i].kind !== 'river') out.push(i);
    }
  }
  return out;
}

/**
 * How much of each life function is done by living species rather than machines.
 * Each function compares the capacity of life and of running machines this tick:
 * - soil: active fungi tiles × their cleaning vs cleaners × tiles they reach
 * - irrigation: tiles held moist by plants vs tiles watered by irrigators
 * - river: river cleaning by plants on the bank vs filter stations
 * - pollination: tiles bees reach vs tiles sprayers reach
 * Machines count at the power they actually get.
 */
export function computeSelfSufficiency(s: GameState, config: Config): SelfSufficiency {
  const running = (kind: Building['kind']) => s.buildings.filter((b) => b.kind === kind && b.power > 0);
  const m = config.machines;
  const sp = config.species;

  // Soil cleaning
  let fungiWork = 0;
  for (const t of s.tiles) if (t.life.fungi && fungiActive(config, t)) fungiWork += sp.fungi.toxicityPerTick;
  let cleanerWork = 0;
  for (const b of running('soilCleaner')) {
    cleanerWork += m.soilCleaner.toxicityPerTick * b.power * areaIndices(s, b.x, b.y, m.soilCleaner.radius).length;
  }

  // Irrigation
  const plantTiles = plantTileCount(s);
  let irrigated = 0;
  for (const b of running('irrigator')) irrigated += b.power * areaIndices(s, b.x, b.y, m.irrigator.radius).length;

  // River filtration
  let bankWork = 0;
  s.tiles.forEach((t, i) => {
    if (t.life.plants > 0 && isRiverBank(s, i % s.width, Math.floor(i / s.width))) {
      bankWork += (sp.plants.riverQualityPerBankTile * t.life.plants) / 100;
    }
  });
  let filterWork = 0;
  for (const b of running('filterStation')) filterWork += m.filterStation.riverQualityPerTick * b.power;

  // Pollination: distinct tiles reached
  const beeTiles = new Set<number>();
  const r = beeRadius(s, config);
  if (r > 0) {
    s.tiles.forEach((t, i) => {
      if (t.life.hive) for (const j of areaIndices(s, i % s.width, Math.floor(i / s.width), r, false)) beeTiles.add(j);
    });
  }
  let sprayed = 0;
  for (const b of running('pollenSprayer')) {
    sprayed += b.power * areaIndices(s, b.x, b.y, machineRadius(config, b.kind)!, false).length;
  }

  const result = {
    soil: share(fungiWork, cleanerWork),
    irrigation: share(plantTiles, irrigated),
    river: share(bankWork, filterWork),
    pollination: share(beeTiles.size, sprayed),
    total: 0,
  };
  result.total = (result.soil + result.irrigation + result.river + result.pollination) / 4;
  return result;
}

/** Player buildings and wires still standing that block the win. */
export function remainingMachines(s: GameState, config: Config) {
  const placed = s.buildings.filter((b) => isBuildable(config, b.kind));
  return {
    /** Machines and power plants still switched on (poles excluded). */
    running: placed.filter((b) => b.kind !== 'pole' && b.enabled).length,
    poles: placed.filter((b) => b.kind === 'pole').length,
    wires: s.wires.length,
  };
}

export function machinesCleared(s: GameState, config: Config): boolean {
  const r = remainingMachines(s, config);
  return r.running === 0 && r.poles === 0 && r.wires === 0;
}

/**
 * Updates self-sufficiency and the win check. The biome counts as stable
 * when river quality, bees and plant tiles did not fall since last tick.
 */
export function updateVictory(s: GameState, config: Config): void {
  s.selfSufficiency = computeSelfSufficiency(s, config);
  const plantTiles = plantTileCount(s);
  const EPS = 1e-9;
  const stable =
    s.riverQuality >= s.lastBiome.riverQuality - EPS &&
    s.bees >= s.lastBiome.bees - EPS &&
    plantTiles >= s.lastBiome.plantTiles;
  s.lastBiome = { riverQuality: s.riverQuality, bees: s.bees, plantTiles };

  if (s.wonAtTick !== null) return;
  const ready = machinesCleared(s, config) && s.selfSufficiency.total >= config.win.selfSufficiency - EPS;
  s.stableTicks = ready && stable ? s.stableTicks + 1 : 0;
  if (s.stableTicks >= config.win.stableTicks) {
    s.wonAtTick = s.tick;
    const at = databankTile(s);
    showGhost(s, 'win', at.x, at.y);
  }
}
