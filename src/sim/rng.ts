/**
 * Deterministic pseudo-random generator (mulberry32). The generator state is
 * a single number stored in GameState, so the same seed always gives the
 * same game – in the browser, in tests and in balance bots.
 */
export function nextRandom(rng: number): [value: number, nextRng: number] {
  let t = (rng + 0x6d2b79f5) | 0;
  const nextRng = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, nextRng];
}
