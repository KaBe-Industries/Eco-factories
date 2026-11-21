import { config } from '../config';
import { canThaw, floorConditions } from '../sim';
import type { GameState } from '../sim';
import {
  FLOOR_STATUS_LABELS,
  SPECIES_ICONS,
  SPECIES_LABELS,
  SPECIES_REPLACES,
  conditionLabel,
  fmt,
  speciesNeeds,
} from './labels';
import { plantSpecies, type Tool } from './tools';

function bar(fraction: number): string {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return `<span class="bar"><span style="width:${pct.toFixed(1)}%"></span></span>`;
}

/** The Databank section of the side panel: floors, unlock progress, thawing, planting. */
export function databankHtml(state: GameState, tool: Tool): string {
  const bank = state.buildings.find((b) => b.kind === 'databank');
  const floors = state.databank.map((f, i) => {
    const head = `<div class="floor-head"><b>${i + 1}. ${SPECIES_ICONS[f.species]} ${SPECIES_LABELS[f.species]}</b><span class="status ${f.status}">${FLOOR_STATUS_LABELS[f.status]}</span></div>`;
    let body = '';
    if (f.status === 'locked') {
      const prevLocked = i > 0 && state.databank[i - 1].status === 'locked';
      body = prevLocked
        ? `<div class="muted">Nejdřív odemkni ${i}. patro.</div>`
        : floorConditions(state, config, f.species)
            .map(
              (c) =>
                `<div class="cond ${c.met ? 'met' : ''}">${c.met ? '✔' : '○'} ${conditionLabel(c)}${
                  c.below ? '' : bar(c.current / c.target)
                }</div>`,
            )
            .join('');
    } else if (f.status === 'unlocked') {
      body = `<button data-thaw="${f.species}" ${canThaw(state, f.species) ? '' : 'disabled'}>❄️ Rozmrazit
        <span class="muted">(${config.databank.thawEnergyPerTick} ⚡ po ${config.databank.thawTicks} ticků)</span></button>
        ${canThaw(state, f.species) ? '' : '<div class="muted">Rozmrazovat jde jen jedno patro najednou.</div>'}`;
    } else if (f.status === 'thawing') {
      const power = bank?.power ?? 0;
      body = `<div>Rozmrazování: <b>${fmt(f.thawProgress, 1)} / ${config.databank.thawTicks}</b> ${bar(f.thawProgress / config.databank.thawTicks)}</div>
        ${
          power < 1
            ? `<div class="warn">Databanka má jen ${fmt(power * 100)} % energie. Připoj ji drátem ke zdroji (potřebuje ${config.databank.thawEnergyPerTick} ⚡).</div>`
            : ''
        }`;
    } else {
      const active = plantSpecies(tool) === f.species;
      body = `<button class="${active ? 'active' : ''}" data-plant="${f.species}" ${state.material >= config.databank.plantCost ? '' : 'disabled'}>
        🌱 ${f.species === 'bees' ? 'Založit úl' : 'Vysadit'} <span class="muted">(🧱 ${config.databank.plantCost} za pole)</span></button>`;
    }
    const info = f.status === 'locked' ? '' : `<div class="muted small">${speciesNeeds(f.species)} Nahrazuje ${SPECIES_REPLACES[f.species]}.</div>`;
    return `<div class="floor ${f.status}">${head}${body}${info}</div>`;
  });
  return floors.join('');
}
