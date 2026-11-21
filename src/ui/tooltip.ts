import { config } from '../config';
import { canBuild, energyOutputOf, isConsumer, isGridNode, isRiverBank, linksFor, supplierFor } from '../sim';
import type { BuildableKind, GameState } from '../sim';
import { BUILD_BLOCK_LABELS, BUILDING_LABELS, TILE_LABELS, fmt, plural } from './labels';
import { networkLine, powerStatus } from './power';

export function tooltipHtml(state: GameState, x: number, y: number, tool: BuildableKind | null = null): string {
  const t = state.tiles[y * state.width + x];
  const lines: string[] = [];
  const building = t.buildingId !== null ? state.buildings.find((b) => b.id === t.buildingId) : undefined;
  lines.push(`<b>${building ? BUILDING_LABELS[building.kind] : TILE_LABELS[t.kind]}</b>`);
  if (building?.kind === 'databank') lines.push('Uchovává semena a spory. Nedá se zbourat.');
  if (building) {
    const out = energyOutputOf(state, config, building);
    if (out > 0) lines.push(`Vyrábí ${fmt(out, 1)} ⚡`);
    const status = powerStatus(building);
    if (status) lines.push(status);
    const net = networkLine(state, building);
    if (net) lines.push(net);
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
    if (!reason && isGridNode(config, tool)) {
      const n = linksFor(state, config, tool, x, y).length;
      lines.push(
        n > 0
          ? `Napojí se na ${n} ${plural(n, 'stavbu', 'stavby', 'staveb')} sítě.`
          : '<span class="bad">Nenapojí se na žádnou síť.</span>',
      );
    }
    if (!reason && isConsumer(config, tool)) {
      lines.push(
        supplierFor(state, config, x, y)
          ? 'Bude připojeno k síti.'
          : '<span class="bad">🔌 Tady nebude připojeno k síti.</span>',
      );
    }
  }
  lines.push(`<span class="muted">Pole ${x + 1}, ${y + 1}</span>`);
  return lines.join('<br>');
}
