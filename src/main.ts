import { config } from './config';
import { applyCommand, createInitialState, isBuildable, step } from './sim';
import type { BuildableKind, Command, GameState } from './sim';
import { drawMap } from './ui/canvas';
import { renderTopbar } from './ui/topbar';
import { renderSidepanel } from './ui/sidepanel';
import { popupHtml, type Selection } from './ui/popup';
import type { OverlayMode } from './ui/overlay';
import { tooltipHtml } from './ui/tooltip';
import { setHtml } from './ui/dom';

// ---- UI state (not part of the simulation) -------------------------------
let state: GameState = createInitialState(config);
let speedIndex = 1; // 1× by default
let lastSpeedIndex = 1;
let overlay: OverlayMode = 'none';
let hover: { x: number; y: number } | null = null;
let tool: BuildableKind | null = null;
let selection: Selection = null;
let accumulator = 0;
let last = performance.now();

const canvas = document.getElementById('map') as HTMLCanvasElement;
const mapWrap = document.getElementById('map-wrap') as HTMLElement;
const topbar = document.getElementById('topbar') as HTMLElement;
const side = document.getElementById('sidepanel') as HTMLElement;
const tooltip = document.createElement('div');
tooltip.id = 'tooltip';
document.body.appendChild(tooltip);
const popup = document.createElement('div');
popup.id = 'popup';
mapWrap.appendChild(popup);

const px = config.ui.tilePx;

function send(command: Command): void {
  state = applyCommand(state, config, command);
  render();
}

function selectedTile(): { x: number; y: number } | null {
  if (!selection) return null;
  if (selection.type === 'ruin') return selection;
  const id = selection.id;
  const b = state.buildings.find((o) => o.id === id);
  return b ? { x: b.x, y: b.y } : null;
}

function render(): void {
  renderTopbar(topbar, state, speedIndex);
  renderSidepanel(side, state, tool, overlay);
  drawMap(canvas, state, { overlay, hover, tool, selected: selectedTile() });
  if (hover) setHtml(tooltip, tooltipHtml(state, hover.x, hover.y, tool));
  const sel = selectedTile();
  const hoveringSelected = !!hover && !!sel && hover.x === sel.x && hover.y === sel.y;
  tooltip.style.visibility = hoveringSelected ? 'hidden' : 'visible';

  const html = popupHtml(state, selection);
  const pos = sel;
  if (html && pos) {
    setHtml(popup, html);
    popup.style.display = 'block';
    // place right of the tile, or left when near the right edge
    const left = pos.x * px + px + 6;
    popup.style.left = `${pos.x > state.width - 7 ? pos.x * px - 6 - popup.offsetWidth : left}px`;
    popup.style.top = `${Math.max(0, pos.y * px - 4)}px`;
  } else {
    selection = null;
    popup.style.display = 'none';
  }
}

function setSpeed(i: number): void {
  if (i !== 0) lastSpeedIndex = i;
  speedIndex = i;
  render();
}

// ---- Input ----------------------------------------------------------------
topbar.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-speed]');
  if (btn) setSpeed(Number(btn.dataset.speed));
});

side.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!btn || btn.disabled) return;
  if (btn.dataset.overlay) overlay = btn.dataset.overlay as OverlayMode;
  if (btn.dataset.build) {
    const kind = btn.dataset.build;
    if (isBuildable(config, kind as BuildableKind)) {
      tool = tool === kind ? null : (kind as BuildableKind);
      selection = null;
    }
  }
  render();
});

popup.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!btn || !selection) return;
  const action = btn.dataset.action;
  if (action === 'close') selection = null;
  else if (action === 'dismantle' && selection.type === 'ruin') {
    send({ type: 'dismantleRuin', x: selection.x, y: selection.y });
    return;
  } else if (selection.type === 'building') {
    if (action === 'toggle') send({ type: 'toggle', buildingId: selection.id });
    if (action === 'demolish') {
      send({ type: 'demolish', buildingId: selection.id });
      selection = null;
    }
  }
  render();
});

function tileAt(e: MouseEvent): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / px);
  const y = Math.floor((e.clientY - rect.top) / px);
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  return { x, y };
}

canvas.addEventListener('mousemove', (e) => {
  const t = tileAt(e);
  if (!t) return;
  if (!hover || hover.x !== t.x || hover.y !== t.y) {
    hover = t;
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

canvas.addEventListener('click', (e) => {
  const t = tileAt(e);
  if (!t) return;
  if (tool) {
    send({ type: 'build', kind: tool, x: t.x, y: t.y });
    return;
  }
  const tile = state.tiles[t.y * state.width + t.x];
  if (tile.buildingId !== null) selection = { type: 'building', id: tile.buildingId };
  else if (tile.kind === 'ruin') selection = { type: 'ruin', x: t.x, y: t.y };
  else selection = null;
  render();
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  tool = null;
  selection = null;
  render();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    tool = null;
    selection = null;
    render();
  } else if (e.key === ' ') {
    e.preventDefault();
    setSpeed(speedIndex === 0 ? lastSpeedIndex : 0);
  }
});

// ---- Game loop --------------------------------------------------------------
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

render();
requestAnimationFrame(frame);
