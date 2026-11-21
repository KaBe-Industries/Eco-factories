import { config } from '../config';
import { canBuild, gridLinks, isConsumer, isGridNode, linksFor, supplierFor } from '../sim';
import type { BuildableKind, GameState, GridNodeKind, TileKind } from '../sim';
import { BUILDING_ICONS } from './labels';
import { OVERLAYS, rampColor, type OverlayMode } from './overlay';

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
  /** Building selected in the build menu (placement preview). */
  tool: BuildableKind | null;
  /** Tile of the selected building or ruin. */
  selected: { x: number; y: number } | null;
}

export function drawMap(canvas: HTMLCanvasElement, state: GameState, view: MapView): void {
  const { overlay, hover, tool, selected } = view;
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

  // Power coverage while placing a building: tiles some grid node reaches
  if (tool) {
    ctx.fillStyle = cssVar('--coverage');
    for (let ty = 0; ty < state.height; ty++) {
      for (let tx = 0; tx < state.width; tx++) {
        if (state.tiles[ty * state.width + tx].kind === 'river') continue;
        if (supplierFor(state, config, tx, ty)) ctx.fillRect(tx * px, ty * px, px, px);
      }
    }
  }

  // Power lines between connected grid nodes
  ctx.strokeStyle = cssVar('--wire');
  ctx.lineWidth = 2;
  for (const [a, b] of gridLinks(state, config)) {
    ctx.beginPath();
    ctx.moveTo(...center(a));
    ctx.lineTo(...center(b));
    ctx.stroke();
  }

  // Buildings
  ctx.font = `${Math.round(px * 0.7)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  const smallFont = `${Math.round(px * 0.32)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  const iconFont = ctx.font;
  for (const b of state.buildings) {
    const x = b.x * px;
    const y = b.y * px;
    ctx.globalAlpha = b.enabled ? 1 : 0.35;
    if (b.kind === 'pole') {
      drawPole(ctx, x, y, px);
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
    if (tool) {
      const ok = canBuild(state, config, tool, hover.x, hover.y) === null;
      if (isGridNode(config, tool)) drawGridPreview(ctx, state, tool, hover, px, ok);
      ctx.fillStyle = ok ? 'rgba(60, 180, 90, 0.45)' : 'rgba(220, 50, 50, 0.45)';
      ctx.fillRect(hx, hy, px, px);
      ctx.globalAlpha = 0.6;
      if (tool === 'pole') drawPole(ctx, hx, hy, px);
      else ctx.fillText(BUILDING_ICONS[tool], hx + px / 2, hy + px / 2 + 1);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = cssVar('--text');
      ctx.lineWidth = 2;
      ctx.strokeRect(hx + 1, hy + 1, px - 2, px - 2);
    }
  }
}

/** A pole: a small post with a cross-arm, drawn without a tile background so wires stay visible. */
function drawPole(ctx: CanvasRenderingContext2D, x: number, y: number, px: number): void {
  ctx.fillStyle = cssVar('--pole');
  ctx.fillRect(x + px * 0.44, y + px * 0.2, px * 0.12, px * 0.62);
  ctx.fillRect(x + px * 0.26, y + px * 0.26, px * 0.48, px * 0.1);
  ctx.beginPath();
  ctx.arc(x + px / 2, y + px / 2, px * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

/** Supply area, link area and future wires of a grid node being placed. */
function drawGridPreview(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  kind: GridNodeKind,
  at: { x: number; y: number },
  px: number,
  ok: boolean,
): void {
  const { link, supply } = config.grid[kind];
  const square = (r: number) => [(at.x - r) * px, (at.y - r) * px, (2 * r + 1) * px, (2 * r + 1) * px] as const;
  ctx.fillStyle = cssVar('--coverage-preview');
  ctx.fillRect(...square(supply));
  ctx.strokeStyle = cssVar('--wire');
  ctx.lineWidth = 2;
  ctx.strokeRect(...square(supply));
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(...square(link));
  if (ok) {
    ctx.lineWidth = 2;
    for (const n of linksFor(state, config, kind, at.x, at.y)) {
      ctx.beginPath();
      ctx.moveTo(at.x * px + px / 2, at.y * px + px / 2);
      ctx.lineTo(n.x * px + px / 2, n.y * px + px / 2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}
