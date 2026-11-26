import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { applyCommand, step, stepMany } from '../src/sim';
import type { BuildableKind, GameState } from '../src/sim';
import { blank, fresh } from './helpers';

function place(s: GameState, kind: BuildableKind, x: number, y: number): GameState {
  const next = applyCommand(s, config, { type: 'build', kind, x, y });
  if (next === s) throw new Error(`could not build ${kind} at ${x},${y}`);
  return next;
}
const tile = (s: GameState, x: number, y: number) => s.tiles[y * s.width + x];
const P = config.pollution;

function uniform(s: GameState, toxicity: number, moisture = 60): GameState {
  for (const t of s.tiles) {
    t.toxicity = toxicity;
    t.moisture = moisture;
    t.baseMoisture = moisture;
  }
  return s;
}

describe('air pollution', () => {
  it('a running coal plant adds 0.4 per tick, nature removes 0.05', () => {
    let s = blank();
    s = place(s, 'coalPlant', 3, 3);
    const p0 = s.pollution;
    s = stepMany(s, config, 10);
    expect(s.pollution).toBeCloseTo(p0 + 10 * (P.coalPlantPerTick - P.decayPerTick));
  });

  it('a switched-off coal plant does not pollute; pollution decays to 0', () => {
    let s = blank();
    s = place(s, 'coalPlant', 3, 3);
    s = applyCommand(s, config, { type: 'toggle', buildingId: s.buildings[0].id });
    s = stepMany(s, config, 1000);
    expect(s.pollution).toBe(0);
  });

  it('every tile with plants absorbs 0.002 per tick', () => {
    let s = uniform(blank(), 10);
    for (let i = 0; i < 50; i++) s.tiles[i].life.plants = 50;
    const p0 = s.pollution;
    s = step(s, config);
    const plantTiles = s.tiles.filter((t) => t.life.plants > 0).length;
    expect(s.pollution).toBeCloseTo(p0 - P.decayPerTick - plantTiles * P.perPlantTile);
  });
});

describe('coal plant soil contamination', () => {
  it('+1.5 next to the plant, +0.75 two tiles away, nothing further', () => {
    let s = uniform(blank(), 50);
    s = place(s, 'coalPlant', 5, 5);
    s = step(s, config);
    expect(tile(s, 5, 5).toxicity).toBeCloseTo(50 + config.coalSoil.near);
    expect(tile(s, 6, 6).toxicity).toBeCloseTo(50 + config.coalSoil.near);
    expect(tile(s, 7, 5).toxicity).toBeCloseTo(50 + config.coalSoil.far);
    expect(tile(s, 8, 5).toxicity).toBe(50);
  });

  it('beats a soil cleaner right next to it', () => {
    let s = uniform(blank(), 50);
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'soilCleaner', 6, 5);
    s = stepMany(s, config, 20);
    expect(tile(s, 6, 5).toxicity).toBeGreaterThan(50);
    expect(tile(s, 8, 5).toxicity).toBeLessThan(50); // cleaner wins 2+ tiles from the plant
  });

  it('stops when the plant is switched off', () => {
    let s = uniform(blank(), 50);
    s = place(s, 'coalPlant', 5, 5);
    s = applyCommand(s, config, { type: 'toggle', buildingId: s.buildings[0].id });
    s = stepMany(s, config, 10);
    expect(tile(s, 6, 5).toxicity).toBe(50);
  });
});

describe('acid rain', () => {
  function rainy(): GameState {
    const s = uniform(blank(), 10);
    s.pollution = 80;
    return s;
  }

  it('kills 3 % of bees per tick and makes soil more toxic', () => {
    let s = rainy();
    s.tiles[0].life.plants = 100;
    s.tiles[0].life.hive = true;
    s.bees = 50;
    s = step(s, config);
    // bees first move toward capacity (−0.3), then acid rain takes 3 %
    expect(s.bees).toBeCloseTo((50 - config.species.bees.growthPerTick) * (1 - config.acidRain.beeLossPerTick));
    expect(tile(s, 5, 5).toxicity).toBeCloseTo(10 + config.acidRain.toxicityPerTick);
  });

  it('unpollinated plants wilt, pollinated plants keep growing', () => {
    let s = rainy();
    tile(s, 2, 2).life.plants = 60;
    tile(s, 12, 12).life.plants = 60;
    s = place(s, 'coalPlant', 13, 13); // powers the sprayer (and keeps pollution up)
    s = place(s, 'pollenSprayer', 12, 13);
    s = step(s, config);
    expect(tile(s, 2, 2).life.plants).toBeCloseTo(60 - config.acidRain.plantWiltPerTick);
    expect(tile(s, 12, 12).life.plants).toBe(60 + config.species.plants.growthPerTick);
  });

  it('nothing of this happens at pollution 50 or below', () => {
    let s = uniform(blank(), 10);
    s.pollution = 45;
    tile(s, 2, 2).life.plants = 60;
    s = step(s, config);
    expect(tile(s, 2, 2).life.plants).toBe(60 + config.species.plants.growthPerTick);
    expect(tile(s, 5, 5).toxicity).toBe(10);
  });

  it('each acid rain episode counts as one collapse; it ends below 40', () => {
    let s = blank();
    s.pollution = 49.9;
    s = place(s, 'coalPlant', 3, 3);
    s = stepMany(s, config, 5);
    expect(s.stats.collapses).toBe(1);
    s = stepMany(s, config, 50);
    expect(s.stats.collapses).toBe(1); // still the same episode
    s = applyCommand(s, config, { type: 'toggle', buildingId: s.buildings[0].id });
    s = stepMany(s, config, 800); // falls below 40, episode ends
    expect(s.acidRainEpisode).toBe(false);
    s = applyCommand(s, config, { type: 'toggle', buildingId: s.buildings[0].id });
    s = stepMany(s, config, 200);
    expect(s.stats.collapses).toBe(2);
  });
});

describe('ghost of the bee', () => {
  it('greets the player at the Databank on start', () => {
    const s = fresh();
    expect(s.ghost.active?.id).toBe('intro');
    const bank = s.buildings.find((b) => b.kind === 'databank')!;
    expect(s.ghost.active).toMatchObject({ x: bank.x, y: bank.y });
  });

  it('comments on the first coal plant once; messages queue and close in order', () => {
    let s = uniform(blank(), 50);
    s.ghost = { shown: ['intro'], lastPollutionWarningTick: null, active: { id: 'intro', x: 0, y: 0 }, queue: [] };
    s = place(s, 'coalPlant', 3, 3);
    expect(s.ghost.queue.map((m) => m.id)).toEqual(['firstCoal']);
    s = place(s, 'coalPlant', 8, 8);
    expect(s.ghost.queue).toHaveLength(1);
    s = applyCommand(s, config, { type: 'dismissGhost' });
    expect(s.ghost.active).toMatchObject({ id: 'firstCoal', x: 3, y: 3 });
    s = applyCommand(s, config, { type: 'dismissGhost' });
    expect(s.ghost.active).toBeNull();
  });

  it('warns above pollution 40, before acid rain, at most once per 100 ticks', () => {
    let s = blank();
    s.ghost.active = null;
    s.pollution = 40.5;
    s = place(s, 'coalPlant', 3, 3);
    s = applyCommand(s, config, { type: 'dismissGhost' }); // "first coal plant" message
    s = step(s, config);
    expect(s.ghost.active?.id).toBe('pollutionWarning');
    expect(s.pollution).toBeLessThan(P.acidRainAbove);
    s = applyCommand(s, config, { type: 'dismissGhost' });
    s = stepMany(s, config, 50);
    expect(s.ghost.active?.id).not.toBe('pollutionWarning');
    s = stepMany(s, config, 50);
    const all = [s.ghost.active, ...s.ghost.queue].map((m) => m?.id);
    expect(all).toContain('pollutionWarning');
  });

  it('explains the first bee die-off', () => {
    let s = uniform(blank(), 10);
    s.ghost.active = null;
    s.pollution = 80;
    s.tiles[0].life.plants = 100;
    s.tiles[0].life.hive = true;
    s.bees = 50;
    s = step(s, config);
    const all = [s.ghost.active, ...s.ghost.queue].map((m) => m?.id);
    expect(all).toContain('firstBeeDieOff');
  });

  it('cheers when a machine is switched off because a species took over', () => {
    let s = uniform(blank(), 50);
    s.ghost.active = null;
    s = place(s, 'coalPlant', 3, 3);
    s = applyCommand(s, config, { type: 'dismissGhost' });
    s = place(s, 'soilCleaner', 4, 3);
    s = applyCommand(s, config, { type: 'toggle', buildingId: s.buildings[1].id });
    expect(s.ghost.active).toBeNull(); // no fungi yet
    s = applyCommand(s, config, { type: 'toggle', buildingId: s.buildings[1].id });
    tile(s, 10, 10).life.fungi = true;
    s = applyCommand(s, config, { type: 'toggle', buildingId: s.buildings[1].id });
    expect(s.ghost.active?.id).toBe('firstMachineReplaced');
  });

  it('gives a hint when a Databank floor unlocks', () => {
    let s = uniform(blank(), 40);
    s.ghost.active = null;
    s = step(s, config);
    expect(s.ghost.active?.id).toBe('unlock_fungi');
  });
});
