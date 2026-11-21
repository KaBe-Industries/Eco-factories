import { config } from '../config';
import { ENERGY_SOURCES, GRID_BUILDINGS, MACHINES } from '../sim';
import type { BuildableKind, GameState } from '../sim';
import { isBuildTool, plantSpecies, type Tool } from './tools';
import { BUILDING_DESCRIPTIONS, BUILDING_ICONS, BUILDING_LABELS, SPECIES_LABELS, fmt } from './labels';
import { setHtml } from './dom';
import { databankHtml } from './databank';
import { OVERLAYS, type OverlayMode } from './overlay';

function buildButton(state: GameState, kind: BuildableKind, tool: Tool): string {
  const c = config.buildings[kind];
  const affordable = state.material >= c.cost;
  const energy =
    c.energyOutput > 0
      ? `+${fmt(c.energyOutput)}${kind === 'windmill' ? ' × vítr' : ''} ⚡`
      : c.energyUse > 0
        ? `−${fmt(c.energyUse)} ⚡`
        : '0 ⚡';
  return `
    <button class="build ${tool === kind ? 'active' : ''}" data-build="${kind}" ${affordable ? '' : 'disabled'}>
      <span class="icon">${BUILDING_ICONS[kind]}</span>
      <span class="name">${BUILDING_LABELS[kind]}</span>
      <span class="meta">🧱 ${c.cost} · ${energy}</span>
      <span class="desc">${BUILDING_DESCRIPTIONS[kind]}</span>
    </button>`;
}

export function renderSidepanel(
  el: HTMLElement,
  state: GameState,
  tool: Tool,
  overlay: OverlayMode,
): void {
  const wireButton = `
    <button class="build ${tool === 'wire' ? 'active' : ''}" data-build="wire">
      <span class="icon">〰️</span>
      <span class="name">Drát</span>
      <span class="meta">🧱 ${config.wire.costPerTile} za pole · max. ${config.wire.maxLength}</span>
      <span class="desc">Spojuje sloupy, elektrárny, větrníky a Databanku do jedné sítě.</span>
    </button>`;
  const hint =
    tool === 'wire'
      ? 'Klikni na sloup, elektrárnu, větrník nebo Databanku a pak na druhý bod. Drát pokračuje z posledního bodu. Esc zruší.'
      : tool === 'pole'
        ? 'Klikni na mapu a postav <b>sloup</b>. Sloupy stavěné za sebou se samy spojí drátem. Esc přeruší řetěz.'
        : plantSpecies(tool)
          ? `Klikni na pole a vysaď <b>${SPECIES_LABELS[plantSpecies(tool)!].toLowerCase()}</b>. Esc zruší výběr.`
          : isBuildTool(tool)
          ? `Klikni na mapu a postav <b>${BUILDING_LABELS[tool]}</b>. Pravé tlačítko nebo Esc zruší výběr.`
          : 'Vyber stavbu a klikni na mapu. Kliknutím na stavbu, drát nebo ruinu je můžeš ovládat. Mezerník = pauza.';
  const overlayButtons = (Object.keys(OVERLAYS) as OverlayMode[])
    .map((m) => `<button data-overlay="${m}" class="${m === overlay ? 'active' : ''}">${OVERLAYS[m].label}</button>`)
    .join('');
  setHtml(
    el,
    `
    <h2>🏛️ Databanka</h2>
    ${databankHtml(state, tool)}
    <h2>Energie</h2>
    <div class="build-list">${ENERGY_SOURCES.map((k) => buildButton(state, k, tool)).join('')}</div>
    <h2>Síť</h2>
    <div class="build-list">${GRID_BUILDINGS.map((k) => buildButton(state, k, tool)).join('')}${wireButton}</div>
    <h2>Stroje</h2>
    <div class="build-list">${MACHINES.map((k) => buildButton(state, k, tool)).join('')}</div>
    <p class="hint">${hint}</p>
    <h2>Overlay</h2>
    <div class="button-row">${overlayButtons}</div>
    <p class="legend">${OVERLAYS[overlay].legend}</p>
  `,
  );
}
