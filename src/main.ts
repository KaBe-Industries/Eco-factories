import { config } from './config';
import { createInitialState, step } from './sim';
import type { GameState } from './sim';
import { drawMap } from './ui/canvas';
import { renderTopbar } from './ui/topbar';
import { OVERLAYS, type OverlayMode } from './ui/overlay';
import { tooltipHtml } from './ui/tooltip';
import ghostTexts from './content/ghost.json';

let state: GameState = createInitialState(config);
let speedIndex = 1; // 1× by default
let overlay: OverlayMode = 'none';
let hover: { x: number; y: number } | null = null;
let accumulator = 0;
let last = performance.now();

const canvas = document.getElementById('map') as HTMLCanvasElement;
const topbar = document.getElementById('topbar') as HTMLElement;
const side = document.getElementById('sidepanel') as HTMLElement;
const tooltip = document.createElement('div');
tooltip.id = 'tooltip';
document.body.appendChild(tooltip);

function renderSide(): void {
  const buttons = (Object.keys(OVERLAYS) as OverlayMode[])
    .map((m) => `<button data-overlay="${m}" class="${m === overlay ? 'active' : ''}">${OVERLAYS[m].label}</button>`)
    .join('');
  side.innerHTML = `
    <h2>Kořeny – prototyp</h2>
    <p>${ghostTexts.intro}</p>
    <h2>Overlay</h2>
    <div class="button-row">${buttons}</div>
    <p class="legend">${OVERLAYS[overlay].legend}</p>
    <p>Fáze 1: mapa. Stavění přijde ve fázi 2.</p>
  `;
  side.querySelectorAll<HTMLButtonElement>('button[data-overlay]').forEach((b) => {
    b.onclick = () => {
      overlay = b.dataset.overlay as OverlayMode;
      renderSide();
      render();
    };
  });
}

function setSpeed(i: number): void {
  speedIndex = i;
  render();
}

function render(): void {
  renderTopbar(topbar, state, speedIndex, setSpeed);
  drawMap(canvas, state, overlay, hover);
  if (hover) tooltip.innerHTML = tooltipHtml(state, hover.x, hover.y);
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / config.ui.tilePx);
  const y = Math.floor((e.clientY - rect.top) / config.ui.tilePx);
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
  if (!hover || hover.x !== x || hover.y !== y) {
    hover = { x, y };
    render();
  }
  tooltip.style.display = 'block';
  tooltip.style.left = `${e.clientX + 14}px`;
  tooltip.style.top = `${e.clientY + 14}px`;
});
canvas.addEventListener('mouseleave', () => {
  hover = null;
  tooltip.style.display = 'none';
  render();
});

function frame(now: number): void {
  const speed = config.time.speeds[speedIndex];
  accumulator += (now - last) * speed;
  last = now;
  let changed = false;
  while (accumulator >= config.time.msPerTick) {
    state = step(state, config);
    accumulator -= config.time.msPerTick;
    changed = true;
  }
  if (changed) render();
  requestAnimationFrame(frame);
}

renderSide();
render();
requestAnimationFrame(frame);
