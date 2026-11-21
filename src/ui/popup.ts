import { config } from '../config';
import { energyOutputOf, energyUseOf, findBuilding, isBuildable, refundFor, tileDistance, wireEnds, wireRefund } from '../sim';
import type { GameState } from '../sim';
import { BUILDING_ICONS, BUILDING_LABELS, fmt } from './labels';
import { networkLine, powerStatus } from './power';

export type Selection =
  | { type: 'building'; id: number }
  | { type: 'ruin'; x: number; y: number }
  | { type: 'wire'; id: number }
  | null;

/**
 * HTML for the small panel next to a selected building or ruin.
 * Returns null when the selection no longer exists.
 */
export function popupHtml(state: GameState, sel: Selection): string | null {
  if (!sel) return null;
  if (sel.type === 'ruin') {
    const t = state.tiles[sel.y * state.width + sel.x];
    if (t.kind !== 'ruin') return null;
    const body =
      t.dismantleProgress === null
        ? `<p>Rozebráním získáš 🧱 ${config.ruins.material} materiálu. Trvá to ${config.ruins.dismantleTicks} ticků.</p>
           <button data-action="dismantle">🔨 Rozebrat ruinu</button>`
        : `<p>Rozebírá se: ${t.dismantleProgress} / ${config.ruins.dismantleTicks} ticků.</p>`;
    return `<div class="popup-head"><b>🏚️ Ruina</b><button class="close" data-action="close">✕</button></div>${body}`;
  }
  if (sel.type === 'wire') {
    const w = state.wires.find((o) => o.id === sel.id);
    const ends = w && wireEnds(state, w);
    if (!w || !ends) return null;
    const length = tileDistance(ends[0], ends[1]);
    return `<div class="popup-head"><b>〰️ Drát</b><button class="close" data-action="close">✕</button></div>
      <p>Délka ${length} ${length === 1 ? 'pole' : length < 5 ? 'pole' : 'polí'}, spojuje ${BUILDING_LABELS[ends[0].kind].toLowerCase()} a ${BUILDING_LABELS[ends[1].kind].toLowerCase()}.</p>
      <button data-action="removeWire">🔨 Rozebrat drát (+${wireRefund(config, length)} 🧱)</button>`;
  }
  const b = findBuilding(state, sel.id);
  if (!b) return null;
  const head = `<div class="popup-head"><b>${BUILDING_ICONS[b.kind]} ${BUILDING_LABELS[b.kind]}</b><button class="close" data-action="close">✕</button></div>`;
  const lines: string[] = [];
  const out = energyOutputOf(state, config, b);
  const use = energyUseOf(config, b);
  if (out > 0) lines.push(`Vyrábí ${fmt(out, 1)} ⚡`);
  if (use > 0) lines.push(`Spotřeba ${fmt(use)} ⚡`);
  const status = powerStatus(b);
  if (status) lines.push(status);
  const net = networkLine(state, b);
  if (net) lines.push(`<span class="muted">${net}</span>`);
  if (!isBuildable(config, b.kind)) {
    return `${head}<p>${[...lines, 'Tuhle stavbu nejde vypnout ani zbourat.'].join('<br>')}</p>`;
  }
  const wires = state.wires.filter((w) => w.a === b.id || w.b === b.id);
  if (wires.length > 0) {
    lines.push(`<span class="muted">Rozebráním se rozeberou i ${wires.length === 1 ? 'jeho drát' : `jeho dráty (${wires.length})`}.</span>`);
  }
  return `${head}
    <p>${lines.join('<br>')}</p>
    <div class="button-row">
      <button data-action="toggle">${b.enabled ? '⏸ Vypnout' : '▶ Zapnout'}</button>
      <button data-action="demolish">🔨 Rozebrat (+${refundFor(config, b.kind)} 🧱)</button>
    </div>`;
}
