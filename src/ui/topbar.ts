import { config } from '../config';
import type { GameState } from '../sim';
import { setHtml } from './dom';
import { fmt, plural } from './labels';

const SPEED_LABELS = ['⏸ Pauza', '▶ 1×', '⏩ 3×'];

/** Renders the top bar. Speed buttons carry data-speed for the click handler in main. */
export function renderTopbar(el: HTMLElement, state: GameState, speedIndex: number, playtest: boolean): void {
  const { produced, demanded, unconnected, networks } = state.energy;
  const short = networks.filter((n) => n.ratio < 1);
  const speeds = config.time.speeds
    .map((_, i) => `<button data-speed="${i}" class="${i === speedIndex ? 'active' : ''}">${SPEED_LABELS[i]}</button>`)
    .join('');
  const shortBadge =
    short.length === 0
      ? ''
      : short.length === 1 && networks.length === 1
        ? `<span class="badge">stroje jedou na ${fmt(short[0].ratio * 100)} %</span>`
        : `<span class="badge">nedostatek v ${short.length} ${plural(short.length, 'síti', 'sítích', 'sítích')}</span>`;
  if (!el.querySelector('.stats')) {
    el.innerHTML = `<span class="title">🌱 Kořeny</span>${
      playtest
        ? '<span class="badge playtest" title="Víc materiálu na start, aby šlo rychle zkoušet. Ostrá hra: přidej ?ostre na konec adresy.">🧪 Testovací režim</span>'
        : ''
    }<span class="stats"></span><span class="speeds"></span>`;
  }
  setHtml(el.querySelector('.speeds')!, speeds);
  setHtml(
    el.querySelector('.stats')!,
    `
    <span class="stat" title="Materiál na stavby. Získáš ho rozebráním ruin a staveb.">🧱 Materiál <b>${fmt(Math.floor(state.material))}</b></span>
    <span class="stat ${short.length ? 'warn' : ''}" title="Výroba / spotřeba všech sítí dohromady. Energie se nedá skladovat.">
      ⚡ Energie <b>${fmt(produced, 1)} / ${fmt(demanded, 1)}</b>${shortBadge}
    </span>
    ${
      unconnected > 0
        ? `<span class="stat warn" title="Zapnuté stroje, které nejsou v dosahu žádné sítě.">🔌 <b>${unconnected}</b> ${plural(unconnected, 'stroj není připojený', 'stroje nejsou připojené', 'strojů není připojených')}</span>`
        : ''
    }
    <span class="stat" title="Vítr násobí výkon větrníků (0,3 až 1,2).">🌬️ Vítr <b>${fmt(state.wind, 2)}×</b></span>
    <span class="stat" title="Kvalita vody v řece (0 až 100). Zlepšuje ji filtrační stanice, sama se pomalu zhoršuje.">🏞️ Řeka <b>${fmt(state.riverQuality)}</b></span>
    ${
      state.bees > 0 || state.databank.find((f) => f.species === 'bees')!.status !== 'locked'
        ? `<span class="stat" title="Populace včel (0 až 100).">🐝 Včely <b>${fmt(state.bees)}</b></span>`
        : ''
    }
    <span class="stat" title="Znečištění ovzduší (0 až 100).">🌫️ Znečištění <b>${fmt(state.pollution)}</b></span>
    <span class="stat">⏱ Tick <b>${fmt(state.tick)}</b></span>`,
  );
}
