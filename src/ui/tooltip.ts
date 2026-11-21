import { isRiverBank } from '../sim';
import type { GameState } from '../sim';
import { BUILDING_LABELS, TILE_LABELS } from './labels';

export function tooltipHtml(state: GameState, x: number, y: number): string {
  const t = state.tiles[y * state.width + x];
  const lines: string[] = [];
  const building = t.buildingId !== null ? state.buildings.find((b) => b.id === t.buildingId) : undefined;
  lines.push(`<b>${building ? BUILDING_LABELS[building.kind] : TILE_LABELS[t.kind]}</b>`);
  if (building?.kind === 'databank') lines.push('Uchovává semena a spory. Nedá se zbourat.');
  if (t.kind === 'river') {
    lines.push(`Kvalita řeky: ${Math.round(state.riverQuality)}`);
  } else {
    lines.push(`Toxicita: ${Math.round(t.toxicity)}`);
    lines.push(`Vlhkost: ${Math.round(t.moisture)}`);
    if (t.kind === 'hill') lines.push('Větrník tu dává ×1,5 energie.');
    if (t.kind === 'ruin') lines.push('Dá se rozebrat na materiál.');
    if (isRiverBank(state, x, y)) lines.push('Břeh řeky');
  }
  lines.push(`<span class="muted">Pole ${x + 1}, ${y + 1}</span>`);
  return lines.join('<br>');
}
