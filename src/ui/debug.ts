import { config } from '../config';
import type { GameState } from '../sim';
import { fmt } from './labels';

/** Hidden debug panel (key D): all global values and a skip button. */
export function debugHtml(state: GameState): string {
  const ss = state.selfSufficiency;
  const rows: Array<[string, string]> = [
    ['Tick', fmt(state.tick)],
    ['Seed', String(state.seed)],
    ['Materiál', fmt(state.material, 2)],
    ['Vítr', fmt(state.wind, 3)],
    ['Energie výroba / spotřeba', `${fmt(state.energy.produced, 2)} / ${fmt(state.energy.demanded, 2)}`],
    ['Sítí', String(state.energy.networks.length)],
    ['Nepřipojené stroje', String(state.energy.unconnected)],
    ['Kvalita řeky', fmt(state.riverQuality, 3)],
    ['Znečištění', fmt(state.pollution, 3)],
    ['Kyselé deště (epizoda)', state.acidRainEpisode ? 'ano' : 'ne'],
    ['Včely', fmt(state.bees, 2)],
    ['Patra', state.databank.map((f) => `${f.species}: ${f.status}`).join(', ')],
    ['Soběstačnost', `${fmt(ss.total * 100, 1)} % (půda ${fmt(ss.soil * 100)}, voda ${fmt(ss.irrigation * 100)}, řeka ${fmt(ss.river * 100)}, pyl ${fmt(ss.pollination * 100)})`],
    ['Stabilní ticky', `${state.stableTicks} / ${config.win.stableTicks}`],
    ['Kolapsy', String(state.stats.collapses)],
    ['Výhra v ticku', state.wonAtTick === null ? '–' : String(state.wonAtTick)],
  ];
  return `<div class="debug-head"><b>🐞 Debug</b><span class="muted">klávesa D</span></div>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    <div class="button-row"><button data-debug="skip">⏭ Přeskoč 100 ticků</button></div>`;
}
