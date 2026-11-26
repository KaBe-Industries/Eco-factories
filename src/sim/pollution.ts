import type { Config } from '../config';
import { databankTile, showGhost } from './ghost';
import { tileDistance } from './grid';
import { plantTileCount } from './species';
import type { Building, GameState } from './types';

/** A coal plant pollutes while it is switched on (phase 8 will add: and has coal). */
export function coalPlantRunning(b: Building): boolean {
  return b.kind === 'coalPlant' && b.enabled;
}

/** Pollution change this tick, split by cause (for the UI "why" tooltip). */
export function pollutionBalance(state: GameState, config: Config) {
  const p = config.pollution;
  const plants = state.buildings.filter(coalPlantRunning).length;
  const plantTiles = plantTileCount(state);
  return {
    coalPlants: plants,
    fromCoal: plants * p.coalPlantPerTick,
    natural: p.decayPerTick,
    plantTiles,
    fromPlants: plantTiles * p.perPlantTile,
  };
}

export function isAcidRain(state: GameState, config: Config): boolean {
  return state.pollution > config.pollution.acidRainAbove;
}

/** Toxicity a running coal plant adds per tick at distance d (0 = none). */
export function coalSoilAt(config: Config, d: number): number {
  if (d <= 1) return config.coalSoil.near;
  if (d === 2) return config.coalSoil.far;
  return 0;
}

/** Running coal plants contaminate the soil around them. */
export function updateCoalSoil(s: GameState, config: Config): void {
  for (const b of s.buildings) {
    if (!coalPlantRunning(b)) continue;
    for (let y = b.y - 2; y <= b.y + 2; y++) {
      for (let x = b.x - 2; x <= b.x + 2; x++) {
        if (x < 0 || y < 0 || x >= s.width || y >= s.height) continue;
        const t = s.tiles[y * s.width + x];
        if (t.kind === 'river') continue;
        t.toxicity = Math.min(100, t.toxicity + coalSoilAt(config, tileDistance(b, { x, y })));
      }
    }
  }
}

/**
 * Air pollution: coal plants raise it, it decays by itself and plants absorb it.
 * Also starts and ends acid rain episodes (each start counts as a collapse)
 * and lets the ghost warn before anything happens.
 */
export function updatePollution(s: GameState, config: Config): void {
  const p = config.pollution;
  const bal = pollutionBalance(s, config);
  s.pollution = Math.max(0, Math.min(100, s.pollution + bal.fromCoal - bal.natural - bal.fromPlants));

  // Ghost warning above 40, repeatable at most once per 100 ticks
  if (s.pollution > p.warningAbove) {
    const last = s.ghost.lastPollutionWarningTick;
    if (last === null || s.tick - last >= p.warningRepeatTicks) {
      s.ghost.lastPollutionWarningTick = s.tick;
      const source = s.buildings.find(coalPlantRunning) ?? databankTile(s);
      showGhost(s, 'pollutionWarning', source.x, source.y, false);
    }
  }

  if (!s.acidRainEpisode && s.pollution > p.acidRainAbove) {
    s.acidRainEpisode = true;
    s.stats.collapses += 1;
  } else if (s.acidRainEpisode && s.pollution < p.warningAbove) {
    s.acidRainEpisode = false;
  }
}

/** Acid rain: bees die off, unpollinated plants wilt, soil gets slightly more toxic. */
export function updateAcidRain(s: GameState, config: Config): void {
  if (!isAcidRain(s, config)) return;
  const a = config.acidRain;
  if (s.bees > 0) {
    const hive = s.tiles.findIndex((t) => t.life.hive);
    const at = hive >= 0 ? { x: hive % s.width, y: Math.floor(hive / s.width) } : databankTile(s);
    showGhost(s, 'firstBeeDieOff', at.x, at.y);
    s.bees = Math.max(0, s.bees * (1 - a.beeLossPerTick));
  }
  for (const t of s.tiles) {
    if (t.kind === 'river') continue;
    t.toxicity = Math.min(100, t.toxicity + a.toxicityPerTick);
  }
}
