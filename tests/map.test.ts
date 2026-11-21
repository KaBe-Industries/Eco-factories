import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { databankPosition, generateMap, isRiverBank } from '../src/sim';

const W = config.map.width;
const H = config.map.height;

function withSeed(seed: number) {
  return { ...config, map: { ...config.map, seed } };
}

const SEEDS = [1, 2, 3, 42, 1234, config.map.seed, 99999, 7777777];

describe('map generation', () => {
  it('same seed gives the same map', () => {
    expect(generateMap(config)).toEqual(generateMap(config));
  });

  it('different seeds give different maps', () => {
    const a = generateMap(withSeed(1)).tiles.map((t) => t.kind).join();
    const b = generateMap(withSeed(2)).tiles.map((t) => t.kind).join();
    expect(a).not.toBe(b);
  });

  for (const seed of SEEDS) {
    describe(`seed ${seed}`, () => {
      const map = generateMap(withSeed(seed));
      const at = (x: number, y: number) => map.tiles[y * W + x];

      it('river is 2–3 tiles wide in every column and continuous', () => {
        let prev: number[] | null = null;
        for (let x = 0; x < W; x++) {
          const rows = [];
          for (let y = 0; y < H; y++) if (at(x, y).kind === 'river') rows.push(y);
          expect(rows.length).toBeGreaterThanOrEqual(config.map.river.minWidth);
          expect(rows.length).toBeLessThanOrEqual(config.map.river.maxWidth);
          // contiguous within the column
          expect(rows[rows.length - 1] - rows[0]).toBe(rows.length - 1);
          // overlaps or touches the previous column so the river is unbroken
          if (prev) expect(rows.some((y) => prev!.includes(y))).toBe(true);
          prev = rows;
        }
      });

      it('has hills and ruins', () => {
        expect(map.tiles.some((t) => t.kind === 'hill')).toBe(true);
        expect(map.tiles.filter((t) => t.kind === 'ruin').length).toBe(config.map.ruins.count);
      });

      it('toxicity is in range and higher on ruins', () => {
        const { soilMin, soilMax, ruinMin, ruinMax } = config.map.toxicity;
        for (const t of map.tiles) {
          if (t.kind === 'soil' || t.kind === 'hill') {
            expect(t.toxicity).toBeGreaterThanOrEqual(soilMin);
            expect(t.toxicity).toBeLessThanOrEqual(soilMax);
          }
          if (t.kind === 'ruin') {
            expect(t.toxicity).toBeGreaterThanOrEqual(ruinMin);
            expect(t.toxicity).toBeLessThanOrEqual(ruinMax);
          }
        }
      });

      it('land is drier further from the river', () => {
        const state = { tiles: map.tiles, width: W, height: H };
        const land = map.tiles.filter((t) => t.kind !== 'river');
        const bank = map.tiles.filter((_, i) => isRiverBank(state, i % W, Math.floor(i / W)));
        const avg = (ts: typeof land) => ts.reduce((s, t) => s + t.moisture, 0) / ts.length;
        expect(avg(bank)).toBeGreaterThan(avg(land) + 15);
        for (const t of land) {
          expect(t.moisture).toBeGreaterThanOrEqual(config.map.moisture.min);
          expect(t.moisture).toBeLessThanOrEqual(100);
        }
      });

      it('databank stands in the centre on dry land', () => {
        const pos = databankPosition(config);
        const bank = map.buildings.find((b) => b.kind === 'databank')!;
        expect(bank).toMatchObject(pos);
        expect(at(pos.x, pos.y).kind).toBe('soil');
        expect(at(pos.x, pos.y).buildingId).toBe(bank.id);
      });
    });
  }
});
