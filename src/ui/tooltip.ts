import { config } from '../config';
import {
  canBuild,
  canWire,
  energyOutputOf,
  findBuilding,
  isConsumer,
  isGridNode,
  isRiverBank,
  supplierFor,
  tileDistance,
  wireCost,
} from '../sim';
import type { GameState } from '../sim';
import { BUILD_BLOCK_LABELS, BUILDING_LABELS, TILE_LABELS, WIRE_BLOCK_LABELS, fmt } from './labels';
import type { Tool } from './tools';
import { networkLine, powerStatus } from './power';

export interface TooltipContext {
  tool: Tool;
  wireStart: number | null;
  lastPoleId: number | null;
}

export function tooltipHtml(state: GameState, x: number, y: number, ctx: TooltipContext): string {
  const { tool, wireStart, lastPoleId } = ctx;
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
  if (tool === 'wire') {
    lines.push(wireHint(state, building, wireStart));
  } else if (tool) {
    const reason = canBuild(state, config, tool, x, y);
    lines.push(
      reason
        ? `<span class="bad">✖ ${BUILD_BLOCK_LABELS[reason]}</span>`
        : `<span class="good">✔ Tady jde postavit ${BUILDING_LABELS[tool].toLowerCase()}.</span>`,
    );
    if (!reason && tool === 'pole' && lastPoleId !== null) {
      const last = findBuilding(state, lastPoleId);
      if (last) {
        const length = tileDistance(last, { x, y });
        const cost = wireCost(config, length);
        if (length > config.wire.maxLength) {
          lines.push(`<span class="bad">Předchozí sloup je ${length} polí daleko – drát se nenatáhne (max. ${config.wire.maxLength}).</span>`);
        } else if (state.material < config.buildings.pole.cost + cost) {
          lines.push('<span class="bad">Na drát k předchozímu sloupu nezbude materiál.</span>');
        } else {
          lines.push(`Napojí se drátem na předchozí sloup (délka ${length}, 🧱 ${cost}).`);
        }
      }
    }
    if (!reason && isConsumer(config, tool)) {
      lines.push(
        supplierFor(state, config, x, y)
          ? 'Bude v dosahu sítě.'
          : '<span class="bad">🔌 Tady nebude připojeno k síti.</span>',
      );
    }
  }
  lines.push(`<span class="muted">Pole ${x + 1}, ${y + 1}</span>`);
  return lines.join('<br>');
}

function wireHint(state: GameState, target: ReturnType<typeof findBuilding>, wireStart: number | null): string {
  if (!target || !isGridNode(config, target.kind)) {
    return '<span class="bad">Drát jde vést jen mezi sloupem, elektrárnou, větrníkem a Databankou.</span>';
  }
  if (wireStart === null) return 'Klikni a veď drát odsud.';
  if (wireStart === target.id) return 'Odsud vede drát. Klikni sem znovu pro zrušení.';
  const start = findBuilding(state, wireStart);
  if (!start) return '';
  const length = tileDistance(start, target);
  const reason = canWire(state, config, wireStart, target.id);
  if (reason) return `<span class="bad">✖ ${WIRE_BLOCK_LABELS[reason]}</span>`;
  return `<span class="good">✔ Drát délky ${length} za 🧱 ${wireCost(config, length)}</span>`;
}
