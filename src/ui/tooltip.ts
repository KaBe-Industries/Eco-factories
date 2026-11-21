import { config } from '../config';
import { canBuild, energyOutputOf, isRiverBank } from '../sim';
import type { BuildableKind, GameState } from '../sim';
import { BUILD_BLOCK_LABELS, BUILDING_LABELS, TILE_LABELS, fmt } from './labels';

export function tooltipHtml(state: GameState, x: number, y: number, tool: BuildableKind | null = null): string {
  const t = state.tiles[y * state.width + x];
  const lines: string[] = [];
  const building = t.buildingId !== null ? state.buildings.find((b) => b.id === t.buildingId) : undefined;
  lines.push(`<b>${building ? BUILDING_LABELS[building.kind] : TILE_LABELS[t.kind]}</b>`);
  if (building?.kind === 'databank') lines.push('Uchovává semena a spory. Nedá se zbourat.');
  if (building && !building.enabled) lines.push('Vypnuto');
  if (building?.kind === 'windmill' && building.enabled) {
    lines.push(`Vyrábí ${fmt(energyOutputOf(state, config, building), 1)} ⚡`);
  }
  if (t.kind === 'river') {
    lines.push(`Kvalita řeky: ${Math.round(state.riverQuality)}`);
  } else {
    lines.push(`Toxicita: ${Math.round(t.toxicity)}`);
    lines.push(`Vlhkost: ${Math.round(t.moisture)}`);
    if (t.kind === 'hill') lines.push('Větrník tu dává ×1,5 energie.');
    if (t.kind === 'ruin') {
      lines.push(
        t.dismantleProgress === null
          ? 'Klikni a rozeber ji na materiál.'
          : `Rozebírá se: ${t.dismantleProgress} / ${config.ruins.dismantleTicks}`,
      );
    }
    if (isRiverBank(state, x, y)) lines.push('Břeh řeky');
  }
  if (tool) {
    const reason = canBuild(state, config, tool, x, y);
    lines.push(
      reason
        ? `<span class="bad">✖ ${BUILD_BLOCK_LABELS[reason]}</span>`
        : `<span class="good">✔ Tady jde postavit ${BUILDING_LABELS[tool].toLowerCase()}.</span>`,
    );
  }
  lines.push(`<span class="muted">Pole ${x + 1}, ${y + 1}</span>`);
  return lines.join('<br>');
}
