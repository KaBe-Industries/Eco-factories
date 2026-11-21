import { config } from '../config';
import type { GameState } from '../sim';
import { setHtml } from './dom';
import { fmt } from './labels';

const SPEED_LABELS = ['⏸ Pauza', '▶ 1×', '⏩ 3×'];

/** Renders the top bar. Speed buttons carry data-speed for the click handler in main. */
export function renderTopbar(el: HTMLElement, state: GameState, speedIndex: number): void {
  const { produced, demanded, ratio } = state.energy;
  const short = ratio < 1;
  const speeds = config.time.speeds
    .map((_, i) => `<button data-speed="${i}" class="${i === speedIndex ? 'active' : ''}">${SPEED_LABELS[i]}</button>`)
    .join('');
  if (!el.querySelector('.stats')) {
    el.innerHTML = '<span class="title">🌱 Kořeny</span><span class="stats"></span><span class="speeds"></span>';
  }
  setHtml(el.querySelector('.speeds')!, speeds);
  setHtml(
    el.querySelector('.stats')!,
    `
    <span class="stat" title="Materiál na stavby. Získáš ho rozebráním ruin a staveb.">🧱 Materiál <b>${fmt(Math.floor(state.material))}</b></span>
    <span class="stat ${short ? 'warn' : ''}" title="Výroba / spotřeba. Energie se nedá skladovat.">
      ⚡ Energie <b>${fmt(produced, 1)} / ${fmt(demanded, 1)}</b>
      ${short ? `<span class="badge">stroje jedou na ${fmt(ratio * 100)} %</span>` : ''}
    </span>
    <span class="stat" title="Vítr násobí výkon větrníků (0,3 až 1,2).">🌬️ Vítr <b>${fmt(state.wind, 2)}×</b></span>
    <span class="stat" title="Znečištění ovzduší (0 až 100).">🌫️ Znečištění <b>${fmt(state.pollution)}</b></span>
    <span class="stat">⏱ Tick <b>${fmt(state.tick)}</b></span>`,
  );
}
