import type { Config } from '../config';
import { tileDistance } from './grid';
import type { Building, GameState, Tile } from './types';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Land tiles (not river) within a square radius around a building. */
function landAround(s: GameState, b: Building, radius: number): Tile[] {
  const out: Tile[] = [];
  for (let y = b.y - radius; y <= b.y + radius; y++) {
    for (let x = b.x - radius; x <= b.x + radius; x++) {
      if (x < 0 || y < 0 || x >= s.width || y >= s.height) continue;
      const t = s.tiles[y * s.width + x];
      if (t.kind !== 'river') out.push(t);
    }
  }
  return out;
}

/** Effect radius of a machine, or null if it has no area effect. */
export function machineRadius(config: Config, kind: Building['kind']): number | null {
  switch (kind) {
    case 'soilCleaner':
      return config.machines.soilCleaner.radius;
    case 'irrigator':
      return config.machines.irrigator.radius;
    case 'pollenSprayer':
      return config.machines.pollenSprayer.radius;
    default:
      return null;
  }
}

/** Is tile (x, y) inside the effect area of building b? */
export function inMachineArea(config: Config, b: Building, x: number, y: number): boolean {
  const r = machineRadius(config, b.kind);
  return r !== null && tileDistance(b, { x, y }) <= r;
}

/**
 * Machine effects for one tick. Every effect is scaled by the power the
 * machine receives from its grid (0 when switched off or not connected).
 * Mutates a state that `step` has already copied.
 */
export function updateMachines(s: GameState, config: Config): void {
  for (const t of s.tiles) t.life.pollinated = false;
  const m = config.machines;
  for (const b of s.buildings) {
    if (b.power <= 0) continue;
    switch (b.kind) {
      case 'soilCleaner':
        for (const t of landAround(s, b, m.soilCleaner.radius)) {
          t.toxicity = clamp(t.toxicity - m.soilCleaner.toxicityPerTick * b.power, 0, 100);
        }
        break;
      case 'irrigator':
        for (const t of landAround(s, b, m.irrigator.radius)) {
          t.moisture = clamp(t.moisture + m.irrigator.moisturePerTick * b.power, 0, 100);
        }
        break;
      case 'filterStation':
        s.riverQuality = clamp(s.riverQuality + m.filterStation.riverQualityPerTick * b.power, 0, 100);
        break;
      case 'pollenSprayer':
        // Pollination is yes/no per tick: at partial power the sprayer
        // builds up and pollinates only on some ticks (e.g. every 2nd at 50 %).
        b.progress += b.power;
        if (b.progress >= 1) {
          b.progress -= 1;
          for (const t of landAround(s, b, m.pollenSprayer.radius)) t.life.pollinated = true;
        }
        break;
    }
  }
}

/** Natural processes: extra moisture evaporates, the river slowly worsens. */
export function updateEnvironment(s: GameState, config: Config): void {
  const { moistureDriftPerTick, riverQualityDecayPerTick } = config.environment;
  for (const t of s.tiles) {
    if (t.kind === 'river') continue;
    const diff = t.baseMoisture - t.moisture;
    if (diff === 0) continue;
    // Plants keep the moisture they have (phase 4); otherwise drift back.
    if (diff < 0 && t.life.plants) continue;
    t.moisture += Math.sign(diff) * Math.min(Math.abs(diff), moistureDriftPerTick);
  }
  const floor = config.start.riverQuality;
  if (s.riverQuality > floor) {
    s.riverQuality = Math.max(floor, s.riverQuality - riverQualityDecayPerTick);
  }
}
