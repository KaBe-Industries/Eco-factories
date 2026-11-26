import { config } from '../config';
import { beeRadius, coalPlantRunning, isAcidRain, canBuild, canPlant, canWire, fungiActive, findBuilding, isConsumer, isGridNode, machineRadius, supplierFor, tileDistance, wireCost, wireEnds } from '../sim';
import type { Building, GameState, GridNodeKind, TileKind } from '../sim';
import { BUILDING_ICONS, SPECIES_ICONS } from './labels';
import { OVERLAYS, rampColor, type OverlayMode } from './overlay';
import { isBuildTool, networkColor, plantSpecies, type Tool } from './tools';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const TILE_COLOR_VARS: Record<TileKind, string> = {
  soil: '--soil',
  river: '--river',
  ruin: '--ruin',
  hill: '--hill',
};

/**
 * Overlay colour and opacity for one tile, or null when the tile is not tinted.
 * Soil maps (toxicity, moisture) use a colour ramp at fixed opacity;
 * pollution and pollination use a single colour whose opacity grows.
 */
function overlayFill(state: GameState, mode: OverlayMode, i: number): string | null {
  const ramp = OVERLAYS[mode].ramp;
  const v = overlayValue(state, mode, i);
  if (v === null) return null;
  if (mode === 'toxicity' || mode === 'moisture') {
    const [r, g, b] = rampColor(ramp, v);
    return `rgba(${r},${g},${b},${RAMP_ALPHA})`;
  }
  const [r, g, b] = ramp[0];
  return `rgba(${r},${g},${b},${(v * OVERLAY_MAX_ALPHA).toFixed(3)})`;
}

/** Overlay intensity (0–1) for one tile, or null when the tile is not tinted. */
function overlayValue(state: GameState, mode: OverlayMode, i: number): number | null {
  const t = state.tiles[i];
  switch (mode) {
    case 'none':
      return null;
    case 'toxicity':
      return t.kind === 'river' ? null : t.toxicity / 100;
    case 'moisture':
      return t.kind === 'river' ? null : t.moisture / 100;
    case 'pollution':
      return state.pollution / 100;
    case 'pollination':
      return t.life.pollinated ? 1 : null;
  }
}

/** Maximum opacity of a single-colour overlay tint. */
const OVERLAY_MAX_ALPHA = 0.8;
/** Opacity of ramp overlays. */
const RAMP_ALPHA = 0.85;

export interface MapView {
  overlay: OverlayMode;
  hover: { x: number; y: number } | null;
  /** Building or wire tool picked in the side panel. */
  tool: Tool;
  /** Tile of the selected building or ruin. */
  selected: { x: number; y: number } | null;
  /** Selected wire (clicked to demolish). */
  selectedWireId: number | null;
  /** Wire tool: the node the wire starts from. */
  wireStart: number | null;
  /** Pole chaining: the last pole placed with the pole tool. */
  lastPoleId: number | null;
}

export function drawMap(canvas: HTMLCanvasElement, state: GameState, view: MapView): void {
  const { overlay, hover, tool, selected, selectedWireId, wireStart, lastPoleId } = view;
  const px = config.ui.tilePx;
  const dpr = window.devicePixelRatio || 1;
  const w = state.width * px;
  const h = state.height * px;
  if (canvas.width !== w * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors: Record<TileKind, string> = {
    soil: cssVar(TILE_COLOR_VARS.soil),
    river: cssVar(TILE_COLOR_VARS.river),
    ruin: cssVar(TILE_COLOR_VARS.ruin),
    hill: cssVar(TILE_COLOR_VARS.hill),
  };

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  state.tiles.forEach((t, i) => {
    const x = (i % state.width) * px;
    const y = Math.floor(i / state.width) * px;
    ctx.fillStyle = colors[t.kind];
    ctx.fillRect(x, y, px, px);

    if (t.kind === 'hill') {
      ctx.fillStyle = cssVar('--hill-mark');
      ctx.beginPath();
      ctx.moveTo(x + px * 0.2, y + px * 0.75);
      ctx.lineTo(x + px * 0.5, y + px * 0.25);
      ctx.lineTo(x + px * 0.8, y + px * 0.75);
      ctx.closePath();
      ctx.fill();
    } else if (t.kind === 'river') {
      ctx.strokeStyle = cssVar('--river-mark');
      ctx.lineWidth = 1.5;
      for (const fy of [0.38, 0.66]) {
        ctx.beginPath();
        ctx.moveTo(x + px * 0.2, y + px * fy);
        ctx.quadraticCurveTo(x + px * 0.35, y + px * (fy - 0.1), x + px * 0.5, y + px * fy);
        ctx.quadraticCurveTo(x + px * 0.65, y + px * (fy + 0.1), x + px * 0.8, y + px * fy);
        ctx.stroke();
      }
    } else if (t.kind === 'ruin') {
      ctx.fillStyle = cssVar('--ruin-mark');
      ctx.fillRect(x + px * 0.2, y + px * 0.45, px * 0.25, px * 0.35);
      ctx.fillRect(x + px * 0.5, y + px * 0.3, px * 0.3, px * 0.5);
    }

    if (t.dismantleProgress !== null) {
      ctx.fillStyle = cssVar('--progress-bg');
      ctx.fillRect(x + 4, y + px - 8, px - 8, 4);
      ctx.fillStyle = cssVar('--accent');
      ctx.fillRect(x + 4, y + px - 8, ((px - 8) * t.dismantleProgress) / config.ruins.dismantleTicks, 4);
    }

    const fill = overlayFill(state, overlay, i);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, px, px);
    }
    drawLife(ctx, t, x, y, px);
  });

  // Grid
  ctx.strokeStyle = cssVar('--grid');
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * px + 0.5, 0);
    ctx.lineTo(x * px + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= state.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * px + 0.5);
    ctx.lineTo(w, y * px + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const center = (b: { x: number; y: number }): [number, number] => [b.x * px + px / 2, b.y * px + px / 2];
  const networkIds = state.energy.networks.map((n) => n.id);

  // Pollution overlay: smoke around running coal plants shows where it comes from
  if (overlay === 'pollution') {
    for (const b of state.buildings) {
      if (!coalPlantRunning(b)) continue;
      const [cx, cy] = [b.x * px + px / 2, b.y * px + px / 2];
      const g = ctx.createRadialGradient(cx, cy, px * 0.3, cx, cy, px * 3);
      g.addColorStop(0, 'rgba(40, 35, 30, 0.6)');
      g.addColorStop(1, 'rgba(40, 35, 30, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - px * 3, cy - px * 3, px * 6, px * 6);
    }
  }

  // Power coverage while placing a building: tiles some grid node reaches
  if (isBuildTool(tool)) {
    ctx.fillStyle = cssVar('--coverage');
    for (let ty = 0; ty < state.height; ty++) {
      for (let tx = 0; tx < state.width; tx++) {
        if (state.tiles[ty * state.width + tx].kind === 'river') continue;
        if (supplierFor(state, config, tx, ty)) ctx.fillRect(tx * px, ty * px, px, px);
      }
    }
  }

  // Wires, coloured by grid; dashed when the grid has no power source
  for (const w of state.wires) {
    const ends = wireEnds(state, w);
    if (!ends) continue;
    const net = state.energy.networks.find((n) => n.id === ends[0].networkId);
    const selectedWire = w.id === selectedWireId;
    ctx.strokeStyle = networkColor(networkIds, ends[0].networkId);
    ctx.lineWidth = selectedWire ? 5 : 2.5;
    ctx.setLineDash(net && net.produced > 0 ? [] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(...center(ends[0]));
    ctx.lineTo(...center(ends[1]));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings
  ctx.font = `${Math.round(px * 0.7)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  const smallFont = `${Math.round(px * 0.32)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  const iconFont = ctx.font;
  for (const b of state.buildings) {
    const x = b.x * px;
    const y = b.y * px;
    ctx.globalAlpha = b.enabled ? 1 : 0.35;
    if (b.kind === 'pole') {
      drawPole(ctx, x, y, px, state.wires.some((w) => w.a === b.id || w.b === b.id) ? networkColor(networkIds, b.networkId) : null);
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = cssVar('--building-bg');
      ctx.fillRect(x + 2, y + 2, px - 4, px - 4);
      ctx.globalAlpha = b.enabled ? 1 : 0.35;
      ctx.font = iconFont;
      ctx.fillText(BUILDING_ICONS[b.kind], x + px / 2, y + px / 2 + 1);
    }
    ctx.globalAlpha = 1;
    ctx.font = smallFont;
    if (!b.enabled) {
      ctx.fillText('⏸', x + px - 8, y + 9);
    } else if (isConsumer(config, b.kind) && b.networkId === null) {
      ctx.fillText('🔌', x + px - 8, y + 9);
    } else if (isConsumer(config, b.kind) && b.power < 1) {
      ctx.fillText('🪫', x + px - 8, y + 9);
    }
  }
  ctx.font = iconFont;

  // Wire tool: rings on connection points; from a start point, which ones are in reach
  if (tool === 'wire') {
    const start = wireStart !== null ? findBuilding(state, wireStart) : undefined;
    if (start) {
      const r = config.wire.maxLength;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = cssVar('--wire-reach');
      ctx.lineWidth = 1.5;
      ctx.strokeRect((start.x - r) * px, (start.y - r) * px, (2 * r + 1) * px, (2 * r + 1) * px);
      ctx.setLineDash([]);
    }
    for (const n of state.buildings) {
      if (!isGridNode(config, n.kind)) continue;
      let color = cssVar('--wire-point');
      if (start) {
        if (n.id === start.id) color = cssVar('--accent');
        else color = canWire(state, config, start.id, n.id) === null ? cssVar('--good') : 'rgba(128,128,128,0.6)';
      }
      ring(ctx, ...center(n), px * 0.42, color);
    }
    if (start && hover) {
      const target = state.buildings.find((b) => b.x === hover.x && b.y === hover.y && isGridNode(config, b.kind));
      if (target && target.id !== start.id) {
        const ok = canWire(state, config, start.id, target.id) === null;
        ctx.strokeStyle = ok ? cssVar('--good') : cssVar('--bad');
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(...center(start));
        ctx.lineTo(...center(target));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // Effect area of the selected or hovered machine
  const areaOf = (pos: { x: number; y: number } | null) => {
    if (!pos) return;
    const b = state.buildings.find((o) => o.x === pos.x && o.y === pos.y);
    const r = b ? machineRadius(config, b.kind) : null;
    if (b && r !== null) drawEffectArea(ctx, b, r, px);
  };
  if (hover && !tool && state.tiles[hover.y * state.width + hover.x].life.hive) {
    const r = beeRadius(state, config);
    if (r > 0) drawEffectArea(ctx, hover, r, px);
  }
  if (!tool) {
    areaOf(selected);
    if (!selected || !hover || hover.x !== selected.x || hover.y !== selected.y) areaOf(hover);
  }

  // Acid rain: slanted streaks over the whole map
  if (isAcidRain(state, config)) {
    ctx.strokeStyle = 'rgba(120, 170, 90, 0.45)';
    ctx.lineWidth = 1.5;
    const offset = (state.tick * 7) % 28;
    for (let i = -h; i < w; i += 28) {
      for (let j = -28; j < h; j += 56) {
        ctx.beginPath();
        ctx.moveTo(i + offset + j * 0.3, j + offset);
        ctx.lineTo(i + offset + j * 0.3 - 6, j + offset + 16);
        ctx.stroke();
      }
    }
  }

  // Selection
  if (selected) {
    ctx.strokeStyle = cssVar('--accent');
    ctx.lineWidth = 3;
    ctx.strokeRect(selected.x * px + 1.5, selected.y * px + 1.5, px - 3, px - 3);
  }

  // Hover: placement preview or plain highlight
  if (hover) {
    const hx = hover.x * px;
    const hy = hover.y * px;
    const species = plantSpecies(tool);
    if (species) {
      const ok = canPlant(state, config, species, hover.x, hover.y) === null;
      ctx.fillStyle = ok ? 'rgba(60, 180, 90, 0.45)' : 'rgba(220, 50, 50, 0.45)';
      ctx.fillRect(hx, hy, px, px);
      ctx.globalAlpha = 0.7;
      ctx.fillText(SPECIES_ICONS[species], hx + px / 2, hy + px / 2 + 1);
      ctx.globalAlpha = 1;
    } else if (isBuildTool(tool)) {
      const ok = canBuild(state, config, tool, hover.x, hover.y) === null;
      if (isGridNode(config, tool)) drawSupplyPreview(ctx, tool, hover, px);
      const r = machineRadius(config, tool);
      if (r !== null) drawEffectArea(ctx, hover, r, px);
      if (tool === 'pole' && ok && lastPoleId !== null) {
        const last = findBuilding(state, lastPoleId);
        if (last) drawChainPreview(ctx, state, last, hover, px);
      }
      ctx.fillStyle = ok ? 'rgba(60, 180, 90, 0.45)' : 'rgba(220, 50, 50, 0.45)';
      ctx.fillRect(hx, hy, px, px);
      ctx.globalAlpha = 0.6;
      if (tool === 'pole') drawPole(ctx, hx, hy, px, null);
      else ctx.fillText(BUILDING_ICONS[tool], hx + px / 2, hy + px / 2 + 1);
      ctx.globalAlpha = 1;
    } else if (!tool) {
      ctx.strokeStyle = cssVar('--text');
      ctx.lineWidth = 2;
      ctx.strokeRect(hx + 1, hy + 1, px - 2, px - 2);
    }
  }
}

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** A pole: a small post with a cross-arm, drawn without a tile background so wires stay visible. */
function drawPole(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, cap: string | null): void {
  ctx.fillStyle = cssVar('--pole');
  ctx.fillRect(x + px * 0.44, y + px * 0.2, px * 0.12, px * 0.62);
  ctx.fillRect(x + px * 0.26, y + px * 0.26, px * 0.48, px * 0.1);
  ctx.beginPath();
  ctx.arc(x + px / 2, y + px / 2, px * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = cap ?? cssVar('--pole');
  ctx.fill();
}

/** Supply area of a grid node being placed. */
function drawSupplyPreview(
  ctx: CanvasRenderingContext2D,
  kind: GridNodeKind,
  at: { x: number; y: number },
  px: number,
): void {
  const r = config.grid[kind].supply;
  const rect = [(at.x - r) * px, (at.y - r) * px, (2 * r + 1) * px, (2 * r + 1) * px] as const;
  ctx.fillStyle = cssVar('--coverage-preview');
  ctx.fillRect(...rect);
  ctx.strokeStyle = cssVar('--wire-reach');
  ctx.lineWidth = 2;
  ctx.strokeRect(...rect);
}

/** Dashed wire to the previously placed pole, green when chaining will work. */
function drawChainPreview(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  last: Building,
  at: { x: number; y: number },
  px: number,
): void {
  const length = tileDistance(last, at);
  const ok =
    length <= config.wire.maxLength &&
    state.material >= config.buildings.pole.cost + wireCost(config, length);
  ctx.strokeStyle = ok ? cssVar('--good') : cssVar('--bad');
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(last.x * px + px / 2, last.y * px + px / 2);
  ctx.lineTo(at.x * px + px / 2, at.y * px + px / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Dashed outline of the area a machine affects. */
function drawEffectArea(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, r: number, px: number): void {
  ctx.strokeStyle = cssVar('--effect');
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect((at.x - r) * px + 1, (at.y - r) * px + 1, (2 * r + 1) * px - 2, (2 * r + 1) * px - 2);
  ctx.setLineDash([]);
}

/** Fungi (small caps), plants (green blades by growth) and hives on a tile. */
function drawLife(ctx: CanvasRenderingContext2D, t: GameState['tiles'][number], x: number, y: number, px: number): void {
  if (t.life.plants > 0) {
    const h = px * 0.15 + (px * 0.45 * t.life.plants) / 100;
    ctx.strokeStyle = cssVar('--plant');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const fx of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      const bx = x + px * fx;
      const by = y + px * 0.92;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + px * 0.06, by - h * 0.6, bx + (fx < 0.5 ? -1 : 1) * px * 0.05, by - h);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  if (t.life.fungi) {
    ctx.globalAlpha = fungiActive(config, t) ? 1 : 0.45;
    for (const [fx, fy, r] of [[0.24, 0.36, 0.16], [0.5, 0.24, 0.12], [0.44, 0.5, 0.1]]) {
      const cx = x + px * fx;
      const cy = y + px * fy;
      ctx.fillStyle = cssVar('--fungi-stem');
      ctx.fillRect(cx - px * 0.025, cy, px * 0.05, px * r * 1.1);
      ctx.beginPath();
      ctx.arc(cx, cy + 1, px * r, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = cssVar('--fungi');
      ctx.fill();
      ctx.strokeStyle = cssVar('--fungi-stem');
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (t.life.hive) {
    const old = ctx.font;
    ctx.font = `${Math.round(px * 0.42)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.fillText('🐝', x + px * 0.72, y + px * 0.28);
    ctx.font = old;
  }
}
