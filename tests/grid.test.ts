import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { applyCommand, step } from '../src/sim';
import type { BuildableKind, GameState } from '../src/sim';
import { blank, fresh } from './helpers';

function place(s: GameState, kind: BuildableKind, x: number, y: number): GameState {
  const next = applyCommand(s, config, { type: 'build', kind, x, y });
  if (next === s) throw new Error(`could not build ${kind} at ${x},${y}`);
  return next;
}
const at = (s: GameState, x: number, y: number) => s.buildings.find((b) => b.x === x && b.y === y)!;

describe('electric grid', () => {
  it('a machine out of reach is not connected and does not run', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'soilCleaner', 4, 2); // 2 tiles away, plant reaches only 1
    s = step(s, config);
    const m = at(s, 4, 2);
    expect(m.networkId).toBeNull();
    expect(m.power).toBe(0);
    expect(s.energy.unconnected).toBe(1);
    expect(s.energy.demanded).toBe(0);
  });

  it('poles carry power to a distant machine', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'pole', 6, 2); // 4 tiles from the plant
    s = place(s, 'pole', 10, 3); // 4 tiles from the first pole
    s = place(s, 'soilCleaner', 12, 5); // 2 tiles from the second pole
    s = step(s, config);
    expect(at(s, 12, 5).networkId).toBe(at(s, 2, 2).networkId);
    expect(at(s, 12, 5).power).toBe(1);
    expect(s.energy.networks).toHaveLength(1);
    expect(s.energy.unconnected).toBe(0);
  });

  it('a pole 5 tiles away does not connect', () => {
    let s = blank();
    s = place(s, 'pole', 2, 2);
    s = place(s, 'pole', 7, 2);
    s = step(s, config);
    expect(at(s, 2, 2).networkId).not.toBe(at(s, 7, 2).networkId);
    expect(s.energy.networks).toHaveLength(2);
  });

  it('two separate grids have their own balance', () => {
    let s = blank();
    // Grid A: plenty of power
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'soilCleaner', 3, 2);
    // Grid B: 10 energy for 4 cleaners (12)
    s = place(s, 'coalPlant', 18, 10);
    for (const [x, y] of [[17, 9], [18, 9], [19, 9], [17, 10]]) s = place(s, 'soilCleaner', x, y);
    s = step(s, config);
    expect(s.energy.networks).toHaveLength(2);
    expect(at(s, 3, 2).power).toBe(1);
    expect(at(s, 17, 9).power).toBeCloseTo(10 / 12);
    expect(at(s, 3, 2).networkId).not.toBe(at(s, 17, 9).networkId);
    expect(s.energy.produced).toBe(20);
    expect(s.energy.demanded).toBe(15);
  });

  it('demolishing a pole splits the grid', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'pole', 6, 2);
    s = place(s, 'pole', 10, 2);
    s = place(s, 'soilCleaner', 12, 2);
    s = step(s, config);
    expect(at(s, 12, 2).power).toBe(1);
    expect(s.energy.networks).toHaveLength(1);

    const middle = at(s, 6, 2).id;
    const before = s.material;
    s = applyCommand(s, config, { type: 'demolish', buildingId: middle });
    expect(s.material).toBe(before + Math.floor(config.buildings.pole.cost * config.demolishRefund));
    s = step(s, config);
    expect(s.energy.networks).toHaveLength(2);
    expect(at(s, 12, 2).networkId).toBe(at(s, 10, 2).networkId);
    expect(at(s, 12, 2).networkId).not.toBe(at(s, 2, 2).networkId);
    expect(at(s, 12, 2).power).toBe(0); // its grid has no power source any more
  });

  it('the Databank acts as a pole with reach 2', () => {
    let s = fresh();
    s.material = 1000;
    const bank = s.buildings.find((b) => b.kind === 'databank')!;
    for (let x = bank.x - 5; x <= bank.x + 2; x++) {
      if (x !== bank.x) s.tiles[bank.y * s.width + x].kind = 'soil';
    }
    s = place(s, 'pole', bank.x - 4, bank.y); // links to the Databank
    s = place(s, 'coalPlant', bank.x - 5, bank.y);
    s = place(s, 'irrigator', bank.x + 2, bank.y); // powered by the Databank
    s = step(s, config);
    expect(at(s, bank.x + 2, bank.y).networkId).toBe(at(s, bank.x - 5, bank.y).networkId);
    expect(at(s, bank.x + 2, bank.y).power).toBe(1);
  });

  it('a machine in reach of two grids joins the nearer one', () => {
    let s = blank();
    s = place(s, 'pole', 2, 2);
    s = place(s, 'pole', 8, 2); // 6 apart: two grids
    s = place(s, 'coalPlant', 1, 2);
    s = place(s, 'irrigator', 6, 2); // 4 from the left pole, 2 from the right one
    s = place(s, 'soilCleaner', 4, 2); // 2 from the left pole
    s = step(s, config);
    expect(at(s, 4, 2).networkId).toBe(at(s, 2, 2).networkId);
    expect(at(s, 6, 2).networkId).toBe(at(s, 8, 2).networkId);
  });

  it('grids are recomputed when building, before the next tick', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'soilCleaner', 3, 2);
    expect(at(s, 3, 2).power).toBe(1);
  });
});
