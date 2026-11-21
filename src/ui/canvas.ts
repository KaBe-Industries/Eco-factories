import { config } from '../config';
import type { GameState, TileKind } from '../sim';
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

export function drawMap(
  canvas: HTMLCanvasElement,
  state: GameState,
  overlay: OverlayMode,
  hover: { x: number; y: number } | null,
): void {
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

  // Buildings
  ctx.font = `${Math.round(px * 0.7)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  for (const b of state.buildings) {
    const x = b.x * px;
    const y = b.y * px;
    ctx.fillStyle = cssVar('--building-bg');
    ctx.fillRect(x + 2, y + 2, px - 4, px - 4);
    ctx.fillText(BUILDING_ICONS[b.kind], x + px / 2, y + px / 2 + 1);
  }

  // Hover highlight
  if (hover) {
    ctx.strokeStyle = cssVar('--text');
    ctx.lineWidth = 2;
    ctx.strokeRect(hover.x * px + 1, hover.y * px + 1, px - 2, px - 2);
  }
}
