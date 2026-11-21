import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { applyCommand, canWire, step } from '../src/sim';
import type { BuildableKind, GameState } from '../src/sim';
import { blank, fresh } from './helpers';

function place(s: GameState, kind: BuildableKind, x: number, y: number, wireTo?: number): GameState {
  const next = applyCommand(s, config, { type: 'build', kind, x, y, wireTo });
  if (next === s) throw new Error(`could not build ${kind} at ${x},${y}`);
  return next;
}
const at = (s: GameState, x: number, y: number) => s.buildings.find((b) => b.x === x && b.y === y)!;
function wire(s: GameState, a: [number, number], b: [number, number]): GameState {
  const next = applyCommand(s, config, { type: 'wire', from: at(s, ...a).id, to: at(s, ...b).id });
  if (next === s) throw new Error(`could not wire ${a} → ${b}`);
  return next;
}

describe('electric grid', () => {
  it('a machine right next to a coal plant runs without any pole', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'soilCleaner', 3, 3);
    s = step(s, config);
    expect(at(s, 3, 3).power).toBe(1);
  });

  it('a machine out of reach is not connected and does not run', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'soilCleaner', 4, 2); // 2 tiles away, the plant reaches only 1
    s = step(s, config);
    expect(at(s, 4, 2).networkId).toBeNull();
    expect(at(s, 4, 2).power).toBe(0);
    expect(s.energy.unconnected).toBe(1);
  });

  it('two poles next to each other without a wire are two separate grids', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'pole', 3, 2); // touches the plant, but no wire
    s = place(s, 'pole', 4, 2);
    s = place(s, 'soilCleaner', 5, 4); // reached only by the second pole
    s = step(s, config);
    expect(s.energy.networks).toHaveLength(3);
    expect(at(s, 3, 2).networkId).not.toBe(at(s, 4, 2).networkId);
    expect(at(s, 3, 2).networkId).not.toBe(at(s, 2, 2).networkId);
    expect(at(s, 5, 4).power).toBe(0);
  });

  it('wires carry power to a distant machine and cost 1 per tile', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'pole', 7, 2);
    s = place(s, 'soilCleaner', 9, 4);
    const before = s.material;
    s = wire(s, [2, 2], [7, 2]); // 5 tiles
    expect(s.material).toBe(before - 5 * config.wire.costPerTile);
    s = step(s, config);
    expect(at(s, 9, 4).networkId).toBe(at(s, 2, 2).networkId);
    expect(at(s, 9, 4).power).toBe(1);
    expect(s.energy.networks).toHaveLength(1);
  });

  it('a wire longer than 5 tiles cannot be laid', () => {
    let s = blank();
    s = place(s, 'pole', 2, 2);
    s = place(s, 'pole', 8, 2); // 6 tiles
    s = place(s, 'pole', 7, 7); // 5 tiles diagonally from (2,2)
    expect(canWire(s, config, at(s, 2, 2).id, at(s, 8, 2).id)).toBe('tooLong');
    const tried = applyCommand(s, config, { type: 'wire', from: at(s, 2, 2).id, to: at(s, 8, 2).id });
    expect(tried).toBe(s);
    expect(canWire(s, config, at(s, 2, 2).id, at(s, 7, 7).id)).toBeNull();
  });

  it('wires go only between connection points, once, and need material', () => {
    let s = blank();
    s = place(s, 'pole', 2, 2);
    s = place(s, 'soilCleaner', 4, 2);
    s = place(s, 'pole', 5, 2);
    expect(canWire(s, config, at(s, 2, 2).id, at(s, 4, 2).id)).toBe('notNode');
    s = wire(s, [2, 2], [5, 2]);
    expect(canWire(s, config, at(s, 5, 2).id, at(s, 2, 2).id)).toBe('exists');
    const poor = { ...s, material: 0, wires: [] };
    expect(canWire(poor, config, at(s, 2, 2).id, at(s, 5, 2).id)).toBe('noMaterial');
  });

  it('removing a wire splits the grid and refunds half', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'pole', 6, 2);
    s = place(s, 'pole', 10, 2);
    s = place(s, 'soilCleaner', 12, 2);
    s = wire(s, [2, 2], [6, 2]);
    s = wire(s, [6, 2], [10, 2]);
    s = step(s, config);
    expect(at(s, 12, 2).power).toBe(1);

    const middle = s.wires.find((w) => w.a === at(s, 6, 2).id && w.b === at(s, 10, 2).id)!;
    const before = s.material;
    s = applyCommand(s, config, { type: 'removeWire', wireId: middle.id });
    expect(s.material).toBe(before + Math.floor(4 * config.wire.costPerTile * config.demolishRefund));
    s = step(s, config);
    expect(s.energy.networks).toHaveLength(2);
    expect(at(s, 12, 2).networkId).toBe(at(s, 10, 2).networkId);
    expect(at(s, 12, 2).power).toBe(0);
  });

  it('demolishing a pole takes its wires down and refunds them', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'pole', 6, 2);
    s = place(s, 'pole', 10, 2);
    s = wire(s, [2, 2], [6, 2]);
    s = wire(s, [6, 2], [10, 2]);
    const before = s.material;
    s = applyCommand(s, config, { type: 'demolish', buildingId: at(s, 6, 2).id });
    expect(s.wires).toHaveLength(0);
    const refund =
      Math.floor(config.buildings.pole.cost * config.demolishRefund) +
      2 * Math.floor(4 * config.wire.costPerTile * config.demolishRefund);
    expect(s.material).toBe(before + refund);
    expect(s.energy.networks).toHaveLength(2);
  });

  it('two separate grids have their own balance', () => {
    let s = blank();
    s = place(s, 'coalPlant', 2, 2);
    s = place(s, 'soilCleaner', 3, 2);
    s = place(s, 'coalPlant', 18, 10);
    for (const [x, y] of [[17, 9], [18, 9], [19, 9], [17, 10]]) s = place(s, 'soilCleaner', x, y);
    s = step(s, config);
    expect(at(s, 3, 2).power).toBe(1);
    expect(at(s, 17, 9).power).toBeCloseTo(10 / 12);
    expect(s.energy.produced).toBe(20);
    expect(s.energy.demanded).toBe(15);
  });

  it('a machine in reach of a dead grid and a powered one uses the powered one', () => {
    let s = blank();
    s = place(s, 'pole', 2, 2); // no source
    s = place(s, 'coalPlant', 5, 2);
    s = place(s, 'soilCleaner', 4, 2); // 2 from the pole, 1 from the plant
    s = step(s, config);
    expect(at(s, 4, 2).networkId).toBe(at(s, 5, 2).networkId);
    expect(at(s, 4, 2).power).toBe(1);
  });

  it('the Databank powers 2 tiles around and takes wires', () => {
    let s = fresh();
    s.material = 1000;
    const bank = s.buildings.find((b) => b.kind === 'databank')!;
    for (let x = bank.x - 5; x <= bank.x + 2; x++) {
      if (x !== bank.x) s.tiles[bank.y * s.width + x].kind = 'soil';
    }
    s = place(s, 'coalPlant', bank.x - 5, bank.y);
    s = place(s, 'irrigator', bank.x + 2, bank.y);
    s = step(s, config);
    expect(at(s, bank.x + 2, bank.y).power).toBe(0);
    s = wire(s, [bank.x - 5, bank.y], [bank.x, bank.y]);
    s = step(s, config);
    expect(at(s, bank.x + 2, bank.y).networkId).toBe(at(s, bank.x - 5, bank.y).networkId);
    expect(at(s, bank.x + 2, bank.y).power).toBe(1);
  });
});

describe('pole chaining', () => {
  it('a new pole is wired to the previous one when in reach', () => {
    let s = blank();
    s = place(s, 'pole', 2, 2);
    const first = at(s, 2, 2).id;
    const before = s.material;
    s = place(s, 'pole', 6, 2, first);
    expect(s.wires).toHaveLength(1);
    expect(s.material).toBe(before - config.buildings.pole.cost - 4 * config.wire.costPerTile);
    s = place(s, 'pole', 10, 3, at(s, 6, 2).id);
    expect(s.wires).toHaveLength(2);
    expect(new Set(s.buildings.map((b) => b.networkId)).size).toBe(1);
  });

  it('a pole out of reach is built without a wire', () => {
    let s = blank();
    s = place(s, 'pole', 2, 2);
    s = place(s, 'pole', 9, 2, at(s, 2, 2).id); // 7 tiles
    expect(s.buildings).toHaveLength(2);
    expect(s.wires).toHaveLength(0);
  });

  it('without material for the wire the pole is still built, unwired', () => {
    let s = blank();
    s = place(s, 'pole', 2, 2);
    s = { ...s, material: config.buildings.pole.cost }; // pole yes, wire no
    s = place(s, 'pole', 5, 2, at(s, 2, 2).id);
    expect(s.buildings).toHaveLength(2);
    expect(s.wires).toHaveLength(0);
    expect(s.material).toBe(0);
  });
});
