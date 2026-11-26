import { config } from '../config';
import { coalSoilAt, coalPlantRunning, isAcidRain, pollutionBalance, tileDistance } from '../sim';
import type { GameState } from '../sim';
import { fmt, plural } from './labels';

/** Plain-text explanation of where pollution comes from (for title tooltips). */
export function pollutionWhy(state: GameState): string {
  const b = pollutionBalance(state, config);
  const net = b.fromCoal - b.natural - b.fromPlants;
  const lines = [
    `Znečištění ovzduší ${fmt(state.pollution, 1)} (0 až 100).`,
    `+${fmt(b.fromCoal, 2)} za tick: ${b.coalPlants} ${plural(b.coalPlants, 'uhelná elektrárna', 'uhelné elektrárny', 'uhelných elektráren')}`,
    `−${fmt(b.natural, 2)} za tick: samo se čistí`,
    `−${fmt(b.fromPlants, 2)} za tick: ${b.plantTiles} ${plural(b.plantTiles, 'pole', 'pole', 'polí')} s rostlinami`,
    `Celkem ${net >= 0 ? '+' : '−'}${fmt(Math.abs(net), 2)} za tick.`,
    `Nad ${config.pollution.warningAbove}: varování. Nad ${config.pollution.acidRainAbove}: kyselé deště.`,
  ];
  return lines.join('\n');
}

/** Why bees are dying, or null when they are not. */
export function beesWhy(state: GameState): string | null {
  if (!isAcidRain(state, config) || state.bees <= 0) return null;
  const b = pollutionBalance(state, config);
  return `Včely umírají: kyselé deště (znečištění ${fmt(state.pollution)} > ${config.pollution.acidRainAbove}) jich každý tick zabijí ${fmt(config.acidRain.beeLossPerTick * 100)} %. Příčina: ${b.coalPlants} ${plural(b.coalPlants, 'běžící uhelná elektrárna', 'běžící uhelné elektrárny', 'běžících uhelných elektráren')}. Sniž znečištění pod ${config.pollution.warningAbove}.`;
}

/** Toxicity added to tile (x, y) per tick by running coal plants nearby. */
export function coalSoilOn(state: GameState, x: number, y: number): number {
  let sum = 0;
  for (const b of state.buildings) {
    if (coalPlantRunning(b)) sum += coalSoilAt(config, tileDistance(b, { x, y }));
  }
  return sum;
}
