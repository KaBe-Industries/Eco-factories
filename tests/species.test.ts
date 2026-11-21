import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { applyCommand, beeRadius, canPlant, step, stepMany } from '../src/sim';
import type { BuildableKind, GameState, SpeciesId } from '../src/sim';
import { blank, fresh } from './helpers';

function place(s: GameState, kind: BuildableKind, x: number, y: number): GameState {
  const next = applyCommand(s, config, { type: 'build', kind, x, y });
  if (next === s) throw new Error(`could not build ${kind} at ${x},${y}`);
  return next;
}
const tile = (s: GameState, x: number, y: number) => s.tiles[y * s.width + x];
const floor = (s: GameState, sp: SpeciesId) => s.databank.find((f) => f.species === sp)!;

/** Blank map, uniform soil, given species ready to plant. */
function ready(toxicity: number, moisture: number, ...species: SpeciesId[]): GameState {
  const s = blank();
  for (const t of s.tiles) {
    t.toxicity = toxicity;
    t.moisture = moisture;
    t.baseMoisture = moisture;
  }
  for (const sp of species) floor(s, sp).status = 'ready';
  // keep floors unlocked so updateUnlocks doesn't matter
  for (const f of s.databank) if (f.status === 'locked') f.status = 'unlocked';
  return s;
}
function plantAt(s: GameState, species: SpeciesId, x: number, y: number): GameState {
  const next = applyCommand(s, config, { type: 'plant', species, x, y });
  if (next === s) throw new Error(`could not plant ${species} at ${x},${y}`);
  return next;
}

describe('unlocking floors', () => {
  it('floor 1 unlocks with 10 tiles below toxicity 60, not with 9', () => {
    let s = blank();
    for (const t of s.tiles) t.toxicity = 80;
    for (let i = 0; i < 9; i++) s.tiles[i].toxicity = 50;
    s = step(s, config);
    expect(floor(s, 'fungi').status).toBe('locked');
    s.tiles[9].toxicity = 50;
    s = step(s, config);
    expect(floor(s, 'fungi').status).toBe('unlocked');
  });

  it('a floor does not unlock while the one below is locked', () => {
    let s = blank();
    for (const t of s.tiles) t.toxicity = 80; // floor 1 not met
    for (let i = 0; i < 30; i++) s.tiles[i].life.plants = 50; // floor 3 soil part met
    s.pollution = 0;
    s = step(s, config);
    expect(floor(s, 'fungi').status).toBe('locked');
    expect(floor(s, 'bees').status).toBe('locked');
  });

  it('unlocking is permanent', () => {
    let s = blank();
    for (const t of s.tiles) t.toxicity = 50;
    s = step(s, config);
    for (const t of s.tiles) t.toxicity = 90;
    s = stepMany(s, config, 5);
    expect(floor(s, 'fungi').status).toBe('unlocked');
  });
});

describe('thawing', () => {
  function bankWithPlant(): GameState {
    let s = fresh();
    s.material = 1000;
    const bank = s.buildings.find((b) => b.kind === 'databank')!;
    s.tiles[bank.y * s.width + bank.x - 1].kind = 'soil';
    s = place(s, 'coalPlant', bank.x - 1, bank.y);
    s = applyCommand(s, config, { type: 'wire', from: s.buildings.find((b) => b.kind === 'coalPlant')!.id, to: bank.id });
    floor(s, 'fungi').status = 'unlocked';
    return s;
  }

  it('takes 20 ticks and 8 energy from the Databank grid', () => {
    let s = bankWithPlant();
    s = applyCommand(s, config, { type: 'thaw', species: 'fungi' });
    expect(floor(s, 'fungi').status).toBe('thawing');
    expect(s.energy.demanded).toBe(config.databank.thawEnergyPerTick);
    s = stepMany(s, config, config.databank.thawTicks - 1);
    expect(floor(s, 'fungi').status).toBe('thawing');
    s = step(s, config);
    expect(floor(s, 'fungi').status).toBe('ready');
    s = step(s, config);
    expect(s.energy.demanded).toBe(0);
  });

  it('does not progress without power', () => {
    let s = fresh();
    floor(s, 'fungi').status = 'unlocked';
    s = applyCommand(s, config, { type: 'thaw', species: 'fungi' });
    s = stepMany(s, config, 50);
    expect(floor(s, 'fungi').status).toBe('thawing');
    expect(floor(s, 'fungi').thawProgress).toBe(0);
  });

  it('only one floor thaws at a time and only unlocked floors', () => {
    let s = bankWithPlant();
    expect(applyCommand(s, config, { type: 'thaw', species: 'plants' })).toBe(s); // locked
    floor(s, 'plants').status = 'unlocked';
    s = applyCommand(s, config, { type: 'thaw', species: 'fungi' });
    expect(applyCommand(s, config, { type: 'thaw', species: 'plants' })).toBe(s);
  });
});

describe('planting', () => {
  it('costs 5 material and needs the species to be ready', () => {
    let s = ready(50, 50);
    expect(canPlant(s, config, 'fungi', 3, 3)).toBe('notReady');
    floor(s, 'fungi').status = 'ready';
    const before = s.material;
    s = plantAt(s, 'fungi', 3, 3);
    expect(s.material).toBe(before - config.databank.plantCost);
    expect(tile(s, 3, 3).life.fungi).toBe(true);
  });

  it('respects what each species needs', () => {
    const s = ready(50, 30, 'fungi', 'plants', 'bees');
    tile(s, 1, 1).toxicity = 75;
    expect(canPlant(s, config, 'fungi', 1, 1)).toBe('tooToxic');
    expect(canPlant(s, config, 'plants', 2, 2)).toBe('tooToxic'); // 50 ≥ 30
    tile(s, 2, 2).toxicity = 10;
    expect(canPlant(s, config, 'plants', 2, 2)).toBe('tooDry'); // 30 ≤ 40
    expect(canPlant(s, config, 'bees', 2, 2)).toBe('needsPlants');
  });

  it('a building replaces plants and hives on its tile', () => {
    let s = ready(10, 60, 'plants', 'bees');
    s = plantAt(s, 'plants', 4, 4);
    s = plantAt(s, 'bees', 4, 4);
    s = place(s, 'pole', 4, 4);
    expect(tile(s, 4, 4).life.plants).toBe(0);
    expect(tile(s, 4, 4).life.hive).toBe(false);
  });
});

describe('fungi', () => {
  it('lower toxicity by 0.5 per tick below 70, sleep at 70 and above', () => {
    let s = ready(65, 50, 'fungi');
    s = plantAt(s, 'fungi', 5, 5);
    s = plantAt(s, 'fungi', 10, 10);
    tile(s, 10, 10).toxicity = 75;
    s = stepMany(s, config, 10);
    expect(tile(s, 5, 5).toxicity).toBeCloseTo(60);
    expect(tile(s, 10, 10).toxicity).toBe(75);
  });

  it('spread to neighbours below 70 but not into toxic soil', () => {
    let s = ready(50, 50, 'fungi');
    // a toxic wall at x = 8
    for (let y = 0; y < s.height; y++) tile(s, 8, y).toxicity = 90;
    s = plantAt(s, 'fungi', 5, 5);
    s = stepMany(s, config, 600);
    const fungi = (x: number, y: number) => tile(s, x, y).life.fungi;
    expect(fungi(4, 5) && fungi(6, 5) && fungi(5, 4)).toBe(true);
    for (let y = 0; y < s.height; y++) expect(fungi(8, y)).toBe(false);
    expect(fungi(10, 5)).toBe(false);
  });
});

describe('plants', () => {
  it('grow where clean and wet, wilt where not', () => {
    let s = ready(10, 60, 'plants');
    s = plantAt(s, 'plants', 5, 5);
    s = plantAt(s, 'plants', 10, 10);
    tile(s, 10, 10).toxicity = 50;
    s = stepMany(s, config, 10);
    expect(tile(s, 5, 5).life.plants).toBe(config.species.plants.startLevel + 10 * config.species.plants.growthPerTick);
    expect(tile(s, 10, 10).life.plants).toBe(config.species.plants.startLevel - 10 * config.species.plants.wiltPerTick);
    s = stepMany(s, config, 200);
    expect(tile(s, 10, 10).life.plants).toBe(0);
  });

  it('spread only when pollinated', () => {
    let lonely = ready(10, 60, 'plants');
    lonely = plantAt(lonely, 'plants', 5, 5);
    lonely = stepMany(lonely, config, 300);
    expect(lonely.tiles.filter((t) => t.life.plants > 0)).toHaveLength(1);

    let sprayed = ready(10, 60, 'plants');
    sprayed = plantAt(sprayed, 'plants', 5, 5);
    sprayed = place(sprayed, 'coalPlant', 7, 7);
    sprayed = place(sprayed, 'pollenSprayer', 6, 6);
    sprayed = stepMany(sprayed, config, 300);
    expect(sprayed.tiles.filter((t) => t.life.plants > 0).length).toBeGreaterThan(5);
  });

  it('grown plants on the river bank raise river quality', () => {
    let s = ready(10, 60, 'plants');
    for (let x = 0; x < s.width; x++) tile(s, x, 0).kind = 'river';
    for (let x = 0; x < 10; x++) s = plantAt(s, 'plants', x, 1);
    for (const t of s.tiles) if (t.life.plants > 0) t.life.plants = 100;
    const q = s.riverQuality;
    s = step(s, config);
    const gain = 10 * config.species.plants.riverQualityPerBankTile - config.environment.riverQualityDecayPerTick;
    expect(s.riverQuality).toBeCloseTo(q + gain);
  });
});

describe('bees', () => {
  it('a hive needs plants; the population grows toward what plants can feed', () => {
    let s = ready(10, 60, 'plants', 'bees');
    for (let x = 0; x < 10; x++) s = plantAt(s, 'plants', x, 5);
    s = plantAt(s, 'bees', 3, 5);
    expect(s.bees).toBe(config.species.bees.startPopulation);
    s = stepMany(s, config, 400);
    // at least 10 plant tiles × 2 = 20; plants may have spread meanwhile
    const plantTiles = s.tiles.filter((t) => t.life.plants > 0).length;
    expect(s.bees).toBeCloseTo(Math.min(100, plantTiles * config.species.bees.populationPerPlantTile), 0);
  });

  it('pollinate around hives, further with a bigger population', () => {
    let s = ready(10, 60, 'plants', 'bees');
    s = plantAt(s, 'plants', 10, 8);
    s = plantAt(s, 'bees', 10, 8);
    s.bees = 10;
    expect(beeRadius(s, config)).toBe(1);
    s.bees = 60;
    expect(beeRadius(s, config)).toBe(3);
    // keep population high for one tick: capacity is low, it only drops by growthPerTick
    s = step(s, config);
    expect(tile(s, 13, 8).life.pollinated).toBe(true);
    expect(tile(s, 14, 8).life.pollinated).toBe(false);
  });

  it('without a hive the population dies out slowly', () => {
    const s0 = ready(10, 60);
    s0.bees = 5;
    const s = stepMany(s0, config, 100);
    expect(s.bees).toBe(0);
  });
});
