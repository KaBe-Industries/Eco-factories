import { config } from '../config';
import {
  beeRadius,
  canBuild,
  canPlant,
  fungiActive,
  plantsThrive,
  canWire,
  energyOutputOf,
  findBuilding,
  inMachineArea,
  isConsumer,
  isGridNode,
  isRiverBank,
  supplierFor,
  tileDistance,
  wireCost,
} from '../sim';
import type { GameState } from '../sim';
import { BUILD_BLOCK_LABELS, BUILDING_LABELS, PLANT_BLOCK_LABELS, TILE_LABELS, WIRE_BLOCK_LABELS, fmt } from './labels';
import { isBuildTool, plantSpecies, type Tool } from './tools';
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
    const effect = machineEffectLine(building);
    if (effect) lines.push(effect);
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
    const natural = Math.round(t.baseMoisture);
    lines.push(`Vlhkost: ${Math.round(t.moisture)}${Math.round(t.moisture) !== natural ? ` <span class="muted">(přirozeně ${natural})</span>` : ''}`);
    lines.push(...lifeLines(state, t));
    const effects = machineEffectsOn(state, x, y);
    if (effects.length) lines.push(...effects);
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
  } else if (plantSpecies(tool)) {
    const reason = canPlant(state, config, plantSpecies(tool)!, x, y);
    lines.push(
      reason
        ? `<span class="bad">✖ ${PLANT_BLOCK_LABELS[reason]}</span>`
        : `<span class="good">✔ Tady jde vysadit (🧱 ${config.databank.plantCost}).</span>`,
    );
  } else if (isBuildTool(tool)) {
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

/** What a machine does, at its current power. */
export function machineEffectLine(b: NonNullable<ReturnType<typeof findBuilding>>): string | null {
  const m = config.machines;
  const p = b.power;
  switch (b.kind) {
    case 'soilCleaner':
      return `Čistí půdu v okruhu ${m.soilCleaner.radius}: toxicita −${fmt(m.soilCleaner.toxicityPerTick * p, 2)} za tick`;
    case 'irrigator':
      return `Zavlažuje v okruhu ${m.irrigator.radius}: vlhkost +${fmt(m.irrigator.moisturePerTick * p, 2)} za tick`;
    case 'filterStation':
      return `Čistí řeku: kvalita +${fmt(m.filterStation.riverQualityPerTick * p, 2)} za tick`;
    case 'pollenSprayer':
      return `Opyluje v okruhu ${m.pollenSprayer.radius}${p < 1 && p > 0 ? ` (jen každý ${fmt(1 / p, 1)}. tick)` : ''}`;
    default:
      return null;
  }
}

/** Running machines whose area covers tile (x, y). */
function machineEffectsOn(state: GameState, x: number, y: number): string[] {
  const out: string[] = [];
  for (const b of state.buildings) {
    if (b.power <= 0 || !inMachineArea(config, b, x, y)) continue;
    if (b.kind === 'soilCleaner') out.push('<span class="muted">🧽 Čistička tu snižuje toxicitu</span>');
    if (b.kind === 'irrigator') out.push('<span class="muted">💧 Závlaha tu zvyšuje vlhkost</span>');
    if (b.kind === 'pollenSprayer') out.push('<span class="muted">🌼 Rozprašovač tu opyluje</span>');
  }
  return [...new Set(out)];
}

/** What lives on a tile and why it does (not) thrive. */
function lifeLines(state: GameState, t: GameState['tiles'][number]): string[] {
  const out: string[] = [];
  const sp = config.species;
  if (t.life.fungi) {
    out.push(
      fungiActive(config, t)
        ? `🍄 Houby čistí půdu (−${fmt(sp.fungi.toxicityPerTick, 1)} za tick)`
        : `<span class="bad">🍄 Houby spí – toxicita je ${sp.fungi.maxToxicity} nebo víc</span>`,
    );
  }
  if (t.life.plants > 0) {
    let line = `🌾 Rostliny: vzrůst ${fmt(t.life.plants)} %`;
    if (!plantsThrive(config, t)) {
      const why = t.toxicity >= sp.plants.maxToxicity ? 'moc toxická půda' : 'moc sucho';
      line += ` – <span class="bad">vadnou (${why})</span>`;
    } else if (t.life.plants < sp.plants.spreadMinLevel) {
      line += ' – rostou';
    } else {
      line += t.life.pollinated ? ' – opylené, šíří se' : ' – <span class="bad">neopylené, nešíří se</span>';
    }
    out.push(line);
  }
  if (t.life.hive) {
    const r = beeRadius(state, config);
    out.push(r > 0 ? `🐝 Úl: včely opylují v okruhu ${r}` : '<span class="bad">🐝 Úl je prázdný</span>');
  }
  return out;
}
