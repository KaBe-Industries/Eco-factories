import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { applyCommand, canBuild, step, stepMany } from '../src/sim';
import type { GameState } from '../src/sim';
import { bank, blank, fresh, river, ruin, soil } from './helpers';

const build = (s: GameState, kind: any, p: { x: number; y: number }) =>
  applyCommand(s, config, { type: 'build', kind, x: p.x, y: p.y });

describe('building', () => {
  it('places a building and pays its cost', () => {
    const s0 = fresh();
    const p = soil(s0);
    const s1 = build(s0, 'irrigator', p);
    expect(s1.buildings.some((b) => b.kind === 'irrigator' && b.x === p.x && b.y === p.y)).toBe(true);
    expect(s1.material).toBe(s0.material - config.buildings.irrigator.cost);
    expect(s0.buildings.some((b) => b.kind === 'irrigator')).toBe(false); // input untouched
  });

  it('refuses river, ruin, occupied tiles and missing material', () => {
    const s = fresh();
    expect(canBuild(s, config, 'windmill', river(s).x, river(s).y)).toBe('river');
    expect(canBuild(s, config, 'windmill', ruin(s).x, ruin(s).y)).toBe('ruin');
    const p = soil(s);
    const s1 = build(s, 'coalPlant', p);
    expect(canBuild(s1, config, 'coalPlant', p.x, p.y)).toBe('occupied');
    const poor = { ...s, material: 0 };
    expect(canBuild(poor, config, 'coalPlant', p.x, p.y)).toBe('noMaterial');
    expect(build(poor, 'coalPlant', p)).toBe(poor);
  });

  it('filter station only on the river bank', () => {
    const s = { ...fresh(), material: 1000 };
    const away = soil(s);
    expect(canBuild(s, config, 'filterStation', away.x, away.y)).toBe('notRiverBank');
    const b = bank(s);
    expect(canBuild(s, config, 'filterStation', b.x, b.y)).toBeNull();
  });

  it('demolishing returns half the cost and frees the tile', () => {
    const s0 = fresh();
    const p = soil(s0);
    const s1 = build(s0, 'pollenSprayer', p);
    const id = s1.buildings.find((b) => b.kind === 'pollenSprayer')!.id;
    const s2 = applyCommand(s1, config, { type: 'demolish', buildingId: id });
    expect(s2.material).toBe(s1.material + Math.floor(config.buildings.pollenSprayer.cost * config.demolishRefund));
    expect(s2.tiles[p.y * s2.width + p.x].buildingId).toBeNull();
  });

  it('the Databank cannot be switched off or demolished', () => {
    const s = fresh();
    const id = s.buildings.find((b) => b.kind === 'databank')!.id;
    expect(applyCommand(s, config, { type: 'demolish', buildingId: id })).toBe(s);
    expect(applyCommand(s, config, { type: 'toggle', buildingId: id })).toBe(s);
  });
});

describe('energy', () => {
  it('coal plant powers machines right next to it', () => {
    let s = blank();
    s = build(s, 'coalPlant', { x: 2, y: 2 });
    s = build(s, 'soilCleaner', { x: 3, y: 2 });
    s = build(s, 'irrigator', { x: 3, y: 3 }); // diagonal neighbour counts
    s = step(s, config);
    expect(s.energy.produced).toBe(config.buildings.coalPlant.energyOutput);
    expect(s.energy.demanded).toBe(config.buildings.soilCleaner.energyUse + config.buildings.irrigator.energyUse);
    expect(s.energy.networks).toHaveLength(1);
    expect(s.energy.networks[0].ratio).toBe(1);
    expect(s.buildings.every((b) => b.power === 1)).toBe(true);
  });

  it('shortage gives a proportional ratio', () => {
    let s = blank();
    s = build(s, 'coalPlant', { x: 2, y: 2 }); // 10
    for (const p of [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }]) {
      s = build(s, 'soilCleaner', p); // 4 × 3 = 12
    }
    s = step(s, config);
    expect(s.energy.networks[0].ratio).toBeCloseTo(10 / 12);
    expect(s.buildings.find((b) => b.kind === 'soilCleaner')!.power).toBeCloseTo(10 / 12);
  });

  it('switched-off buildings neither produce nor consume', () => {
    let s = blank();
    s = build(s, 'coalPlant', { x: 2, y: 2 });
    s = build(s, 'soilCleaner', { x: 3, y: 2 });
    for (const b of s.buildings) s = applyCommand(s, config, { type: 'toggle', buildingId: b.id });
    s = step(s, config);
    expect(s.energy.produced).toBe(0);
    expect(s.energy.demanded).toBe(0);
    expect(s.energy.unconnected).toBe(0);
    expect(s.buildings.every((b) => b.power === 0)).toBe(true);
  });

  it('windmill output follows wind and gets the hill bonus', () => {
    let s = blank();
    s = build(s, 'windmill', { x: 2, y: 2 });
    s = step(s, config);
    expect(s.energy.produced).toBeCloseTo(config.buildings.windmill.energyOutput * s.wind);

    let h = blank();
    h.tiles[2 * h.width + 2].kind = 'hill';
    h = build(h, 'windmill', { x: 2, y: 2 });
    h = step(h, config);
    expect(h.energy.produced).toBeCloseTo(
      config.buildings.windmill.energyOutput * h.wind * config.windmillHillMultiplier,
    );
  });

  it('wind stays between 0.3 and 1.2 and actually varies', () => {
    let s = fresh();
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 1000; i++) {
      s = step(s, config);
      lo = Math.min(lo, s.wind);
      hi = Math.max(hi, s.wind);
    }
    expect(lo).toBeGreaterThanOrEqual(config.wind.min);
    expect(hi).toBeLessThanOrEqual(config.wind.max);
    expect(hi - lo).toBeGreaterThan(0.4);
  });
});

describe('ruins', () => {
  it('dismantling takes 10 ticks and gives 20 material, leaving soil', () => {
    const s0 = fresh();
    const p = ruin(s0);
    let s = applyCommand(s0, config, { type: 'dismantleRuin', x: p.x, y: p.y });
    s = stepMany(s, config, config.ruins.dismantleTicks - 1);
    expect(s.tiles[p.y * s.width + p.x].kind).toBe('ruin');
    s = step(s, config);
    expect(s.tiles[p.y * s.width + p.x].kind).toBe('soil');
    expect(s.material).toBe(s0.material + config.ruins.material);
  });

  it('cannot dismantle twice or dismantle non-ruins', () => {
    const s0 = fresh();
    const p = ruin(s0);
    const s1 = applyCommand(s0, config, { type: 'dismantleRuin', x: p.x, y: p.y });
    expect(applyCommand(s1, config, { type: 'dismantleRuin', x: p.x, y: p.y })).toBe(s1);
    const q = soil(s0);
    expect(applyCommand(s0, config, { type: 'dismantleRuin', x: q.x, y: q.y })).toBe(s0);
  });
});
