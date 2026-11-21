import { config } from '../config';
import type { GameState } from '../sim';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function drawMap(canvas: HTMLCanvasElement, state: GameState): void {
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
  ctx.fillStyle = cssVar('--soil');
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = cssVar('--grid');
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
}
