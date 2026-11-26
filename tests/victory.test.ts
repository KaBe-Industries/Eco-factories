import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { STATE_VERSION, applyCommand, computeSelfSufficiency, parseSave, step, stepMany } from '../src/sim';
import type { BuildableKind, GameState } from '../src/sim';
import { blank, fresh } from './helpers';

function place(s: GameState, kind: BuildableKind, x: number, y: number): GameState {
  const next = applyCommand(s, config, { type: 'build', kind, x, y });
  if (next === s) throw new Error(`could not build ${kind} at ${x},${y}`);
  return next;
}

/** A healed valley: river on row 0, clean wet soil, fungi and full-grown plants everywhere, a hive. */
function healed(): GameState {
  const s = blank();
  s.tiles.forEach((t, i) => {
    if (i < s.width) {
      t.kind = 'river';
      return;
    }
    t.toxicity = 10;
    t.moisture = 60;
    t.baseMoisture = 60;
    t.life.fungi = true;
    t.life.plants = 100;
  });
  s.tiles[5 * s.width + 5].life.hive = true;
  s.bees = 100;
  s.riverQuality = 90;
  s.pollution = 0;
  s.ghost.active = null;
  return s;
}

describe('self-sufficiency', () => {
  it('is 0 % for a function nobody does and 100 % when only life does it', () => {
    const s = blank();
    expect(computeSelfSufficiency(s, config).total).toBe(0);
    const h = healed();
    const ss = computeSelfSufficiency(h, config);
    expect(ss).toMatchObject({ soil: 1, irrigation: 1, river: 1, pollination: 1, total: 1 });
  });

  it('only machines → 0 %', () => {
    let s = blank();
    for (let x = 0; x < s.width; x++) s.tiles[x].kind = 'river';
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'soilCleaner', 6, 5);
    s = place(s, 'irrigator', 4, 5);
    s = place(s, 'pollenSprayer', 5, 6);
    s = step(s, config);
    const ss = computeSelfSufficiency(s, config);
    expect(ss.soil).toBe(0);
    expect(ss.irrigation).toBe(0);
    expect(ss.pollination).toBe(0);
  });

  it('mixes life and machines proportionally', () => {
    let s = blank();
    for (let i = 0; i < 25; i++) s.tiles[s.width * 10 + i % s.width].life.plants = 50; // 24 distinct tiles
    s = place(s, 'coalPlant', 5, 5);
    s = place(s, 'irrigator', 6, 5); // waters 25 tiles
    s = step(s, config);
    const plantTiles = s.tiles.filter((t) => t.life.plants > 0).length;
    expect(computeSelfSufficiency(s, config).irrigation).toBeCloseTo(plantTiles / (plantTiles + 25));
  });

  it('the total is the average of the four functions', () => {
    const h = healed();
    h.bees = 0; // no pollination at all
    for (const t of h.tiles) t.life.hive = false;
    const ss = computeSelfSufficiency(h, config);
    expect(ss.pollination).toBe(0);
    expect(ss.total).toBeCloseTo(0.75);
  });
});

describe('winning', () => {
  it('a healed valley without machines wins after 60 stable ticks', () => {
    let s = healed();
    s = stepMany(s, config, config.win.stableTicks - 1);
    expect(s.wonAtTick).toBeNull();
    s = step(s, config);
    expect(s.wonAtTick).toBe(s.tick);
    expect([s.ghost.active, ...s.ghost.queue].map((m) => m?.id)).toContain('win');
  });

  it('a running machine blocks the win; a switched-off one does not', () => {
    let s = healed();
    s = place(s, 'windmill', 3, 3);
    s = stepMany(s, config, 100);
    expect(s.wonAtTick).toBeNull();
    s = applyCommand(s, config, { type: 'toggle', buildingId: s.buildings[0].id });
    s = stepMany(s, config, 100);
    expect(s.wonAtTick).not.toBeNull();
  });

  it('poles and wires must be demolished, not just left standing', () => {
    let s = healed();
    s = place(s, 'pole', 3, 3);
    s = stepMany(s, config, 100);
    expect(s.wonAtTick).toBeNull();
    s = place(s, 'pole', 6, 3);
    s = applyCommand(s, config, { type: 'wire', from: s.buildings[0].id, to: s.buildings[1].id });
    s = applyCommand(s, config, { type: 'demolish', buildingId: s.buildings[0].id }); // takes the wire too
    s = applyCommand(s, config, { type: 'demolish', buildingId: s.buildings[0].id });
    expect(s.wires).toHaveLength(0);
    s = stepMany(s, config, 100);
    expect(s.wonAtTick).not.toBeNull();
  });

  it('falling bees reset the stability counter', () => {
    let s = healed();
    s = stepMany(s, config, 30);
    expect(s.stableTicks).toBe(30);
    s.bees = 50; // sudden loss
    s = step(s, config);
    expect(s.stableTicks).toBe(0);
  });

  it('below 95 % self-sufficiency there is no win', () => {
    let s = healed();
    s.bees = 0;
    for (const t of s.tiles) t.life.hive = false;
    s = stepMany(s, config, 200);
    expect(s.wonAtTick).toBeNull();
  });
});

describe('saving', () => {
  it('a saved game loads back identical', () => {
    const s = stepMany(fresh(), config, 5);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });

  it('ignores broken saves and saves from another version', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('not json')).toBeNull();
    expect(parseSave(JSON.stringify({ ...fresh(), version: STATE_VERSION - 1 }))).toBeNull();
  });
});
