import { config } from '../config';
import { energyOutputOf, energyUseOf, findBuilding, isBuildable, refundFor } from '../sim';
import type { GameState } from '../sim';
import { BUILDING_ICONS, BUILDING_LABELS, fmt } from './labels';

export type Selection = { type: 'building'; id: number } | { type: 'ruin'; x: number; y: number } | null;

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
  const b = findBuilding(state, sel.id);
  if (!b) return null;
  const head = `<div class="popup-head"><b>${BUILDING_ICONS[b.kind]} ${BUILDING_LABELS[b.kind]}</b><button class="close" data-action="close">✕</button></div>`;
  if (!isBuildable(config, b.kind)) {
    return `${head}<p>Tuhle stavbu nejde vypnout ani zbourat.</p>`;
  }
  const out = energyOutputOf(state, config, b);
  const use = energyUseOf(config, b);
  let status: string;
  if (!b.enabled) status = 'Vypnuto – nežere energii.';
  else if (out > 0) status = `Vyrábí ${fmt(out, 1)} ⚡`;
  else if (use > 0 && state.energy.ratio < 1)
    status = `<span class="warn">Jede na ${fmt(state.energy.ratio * 100)} % – málo energie.</span>`;
  else status = `Běží, spotřeba ${fmt(use)} ⚡`;
  return `${head}
    <p>${status}</p>
    <div class="button-row">
      <button data-action="toggle">${b.enabled ? '⏸ Vypnout' : '▶ Zapnout'}</button>
      <button data-action="demolish">🔨 Rozebrat (+${refundFor(config, b.kind)} 🧱)</button>
    </div>`;
}
