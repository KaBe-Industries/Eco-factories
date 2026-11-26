import { describe, expect, it } from 'vitest';
import { config as baseConfig } from '../src/config';

// These tests check machines alone; coal plant soil contamination (phase 5) is tested separately.
const config = { ...baseConfig, coalSoil: { near: 0, far: 0 } };
import { applyCommand, step, stepMany } from '../src/sim';
import type { BuildableKind, GameState } from '../src/sim';
import { blank } from './helpers';

function place(s: GameState, kind: BuildableKind, x: number, y: number): GameState {
  const next = applyCommand(s, config, { type: 'build', kind, x, y });
  if (next === s) throw new Error(`could not build ${kind} at ${x},${y}`);
  return next;
}
const tile = (s: GameState, x: number, y: number) => s.tiles[y * s.width + x];
const at = (s: GameState, x: number, y: number) => s.buildings.find((b) => b.x === x && b.y === y)!;

/** Blank map with uniform toxicity/moisture so effects are easy to measure. */
function field(toxicity = 60, moisture = 30): GameState {
  const s = blank();
  for (const t of s.tiles) {
    t.toxicity = toxicity;
    t.moisture = moisture;
    t.baseMoisture = moisture;
  }
  return s;
}

describe('soil cleaner', () => {
  it('lowers toxicity by 1 per tick within radius 2, not beyond', () => {
    let s = field();
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'soilCleaner', 6, 5);
    s = stepMany(s, config, 10);
    expect(tile(s, 6, 5).toxicity).toBeCloseTo(50);
    expect(tile(s, 8, 7).toxicity).toBeCloseTo(50); // distance 2 (diagonal)
    expect(tile(s, 9, 5).toxicity).toBe(60); // distance 3
  });

  it('works at the grid ratio when energy is short', () => {
    let s = field();
    s = place(s, 'coalPlant', 5, 5); // 10
    for (const [x, y] of [[4, 4], [5, 4], [6, 4], [4, 5]]) s = place(s, 'soilCleaner', x, y); // 12
    s = step(s, config);
    // tile (2,7) is reached only by the cleaner at (4,5)
    expect(tile(s, 2, 7).toxicity).toBeCloseTo(60 - 10 / 12);
  });

  it('does nothing when not connected or switched off', () => {
    let s = field();
    s = place(s, 'soilCleaner', 10, 10); // no grid
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'soilCleaner', 3, 2);
    s = applyCommand(s, config, { type: 'toggle', buildingId: at(s, 3, 2).id });
    s = stepMany(s, config, 5);
    expect(tile(s, 10, 10).toxicity).toBe(60);
    expect(tile(s, 3, 2).toxicity).toBe(60);
  });

  it('never goes below 0', () => {
    let s = field(2);
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'soilCleaner', 6, 5);
    s = stepMany(s, config, 10);
    expect(tile(s, 6, 5).toxicity).toBe(0);
  });
});

describe('irrigation and evaporation', () => {
  it('irrigator raises moisture by 1 per tick within radius 2 (minus evaporation)', () => {
    let s = field(60, 30);
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'irrigator', 6, 5);
    s = step(s, config);
    expect(tile(s, 6, 5).moisture).toBeCloseTo(31 - config.environment.moistureDriftPerTick);
    expect(tile(s, 9, 5).moisture).toBe(30);
  });

  it('caps moisture at 100', () => {
    let s = field(60, 99.5);
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'irrigator', 6, 5);
    s = step(s, config);
    expect(tile(s, 6, 5).moisture).toBeLessThanOrEqual(100);
  });

  it('extra moisture evaporates back to the natural level when the irrigator goes', () => {
    let s = field(60, 30);
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'irrigator', 6, 5);
    s = stepMany(s, config, 20);
    const wet = tile(s, 6, 5).moisture;
    expect(wet).toBeGreaterThan(45);
    s = applyCommand(s, config, { type: 'demolish', buildingId: at(s, 6, 5).id });
    s = stepMany(s, config, 100);
    expect(tile(s, 6, 5).moisture).toBeCloseTo(wet - 100 * config.environment.moistureDriftPerTick);
    s = stepMany(s, config, 1000);
    expect(tile(s, 6, 5).moisture).toBe(30);
  });

  it('plants keep their moisture (no evaporation on overgrown tiles)', () => {
    let s = field(60, 30);
    tile(s, 6, 5).moisture = 70;
    tile(s, 6, 5).life.plants = 50;
    s = stepMany(s, config, 50);
    expect(tile(s, 6, 5).moisture).toBe(70);
  });
});

describe('river', () => {
  it('filter station raises river quality by 0.3 per tick', () => {
    let s = blank();
    for (let x = 0; x < s.width; x++) tile(s, x, 0).kind = 'river';
    s = place(s, 'coalPlant', 5, 2);
    s = place(s, 'filterStation', 5, 1);
    const q = s.riverQuality;
    s = stepMany(s, config, 10);
    expect(s.riverQuality).toBeCloseTo(q + 10 * (config.machines.filterStation.riverQualityPerTick - config.environment.riverQualityDecayPerTick));
  });

  it('without filtering the river slowly falls back to its starting quality, never lower', () => {
    let s = blank();
    s.riverQuality = 40;
    s = stepMany(s, config, 100);
    expect(s.riverQuality).toBeCloseTo(40 - 100 * config.environment.riverQualityDecayPerTick);
    s = stepMany(s, config, 5000);
    expect(s.riverQuality).toBe(config.start.riverQuality);
  });
});

describe('pollen sprayer', () => {
  it('pollinates tiles within radius 3', () => {
    let s = blank();
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'pollenSprayer', 6, 5);
    s = step(s, config);
    expect(tile(s, 9, 8).life.pollinated).toBe(true); // distance 3
    expect(tile(s, 10, 5).life.pollinated).toBe(false); // distance 4
  });

  it('at half power it pollinates every other tick', () => {
    let s = blank();
    s = place(s, 'coalPlant', 5, 5); // 10 energy
    s = place(s, 'pollenSprayer', 6, 5); // 2
    for (const [x, y] of [[4, 4], [5, 4], [6, 4], [4, 5], [4, 6], [5, 6]]) s = place(s, 'soilCleaner', x, y); // 18
    const hits: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      s = step(s, config);
      expect(at(s, 6, 5).power).toBeCloseTo(0.5);
      hits.push(tile(s, 9, 5).life.pollinated);
    }
    expect(hits.filter(Boolean)).toHaveLength(5);
  });
});
