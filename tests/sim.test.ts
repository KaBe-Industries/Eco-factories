import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { createInitialState, nextRandom, step, stepMany } from '../src/sim';

describe('initial state', () => {
  it('has a tile for every cell of the grid', () => {
    const s = createInitialState(config);
    expect(s.tiles).toHaveLength(config.map.width * config.map.height);
  });

  it('uses starting values from config', () => {
    const s = createInitialState(config);
    expect(s.material).toBe(config.start.material);
    expect(s.riverQuality).toBe(config.start.riverQuality);
    expect(s.pollution).toBe(config.start.pollution);
  });

  it('is ready for logistics: tiles can hold items', () => {
    const s = createInitialState(config);
    expect(s.tiles.every((t) => t.item === null)).toBe(true);
  });

  it('is JSON-serialisable (needed for saving)', () => {
    const s = createInitialState(config);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('step', () => {
  it('advances the tick', () => {
    const s = createInitialState(config);
    expect(step(s, config).tick).toBe(1);
    expect(stepMany(s, config, 100).tick).toBe(100);
  });

  it('does not mutate the previous state', () => {
    const s = createInitialState(config);
    const copy = structuredClone(s);
    step(s, config);
    expect(s).toEqual(copy);
  });
});

describe('rng', () => {
  it('is deterministic and in [0, 1)', () => {
    const [a, r1] = nextRandom(42);
    const [b] = nextRandom(42);
    const [c] = nextRandom(r1);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
});
