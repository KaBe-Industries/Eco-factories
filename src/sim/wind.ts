import type { Config } from '../config';
import { nextRandom } from './rng';
import type { GameState } from './types';

/** Wind from its two parts: a slow sine wave plus a random component. */
export function windAt(config: Config, tick: number, noise: number): number {
  const { min, max, base, sineAmplitude, sinePeriodTicks } = config.wind;
  const sine = sineAmplitude * Math.sin((tick / sinePeriodTicks) * Math.PI * 2);
  return Math.max(min, Math.min(max, base + sine + noise));
}

/** Updates wind in place on a state that `step` has already copied. */
export function updateWind(s: GameState, config: Config): void {
  const { noiseStep, noiseMax } = config.wind;
  const [r, rng] = nextRandom(s.rng);
  s.rng = rng;
  s.windNoise = Math.max(-noiseMax, Math.min(noiseMax, s.windNoise + (r * 2 - 1) * noiseStep));
  s.wind = windAt(config, s.tick, s.windNoise);
}
