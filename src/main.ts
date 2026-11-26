import { config } from './config';
import { applyCommand, createInitialState, isBuildable, isGridNode, step, stepMany, wireEnds } from './sim';
import type { BuildableKind, Command, GameState, SpeciesId } from './sim';
import { isBuildTool, plantSpecies, type Tool } from './ui/tools';
import { drawMap } from './ui/canvas';
import { renderTopbar } from './ui/topbar';
import { renderSidepanel } from './ui/sidepanel';
import { popupHtml, type Selection } from './ui/popup';
import type { OverlayMode } from './ui/overlay';
import { tooltipHtml } from './ui/tooltip';
import { setHtml } from './ui/dom';
import { renderGhost } from './ui/ghost';
import { clearSave, loadGame, saveGame, saveKey } from './ui/storage';
import { winHtml } from './ui/winscreen';
import { debugHtml } from './ui/debug';

// ---- UI state (not part of the simulation) -------------------------------
/** Playtest mode: more starting material for trying things out (see config.playtest). */
const playtest = config.playtest.enabled && !new URLSearchParams(location.search).has('ostre');
const SAVE_KEY = saveKey(playtest);

function newGame(): GameState {
  const s = createInitialState(config);
  return playtest ? { ...s, material: config.playtest.startMaterial } : s;
}

let state: GameState = loadGame(SAVE_KEY) ?? newGame();
let lastSavedTick = state.tick;
/** The win screen was closed with "keep playing". */
let winDismissed = state.wonAtTick !== null;
let debugOpen = false;
let speedIndex = 1; // 1× by default
let lastSpeedIndex = 1;
let overlay: OverlayMode = 'none';
let hover: { x: number; y: number } | null = null;
let tool: Tool = null;
let selection: Selection = null;
/** Wire tool: node the next wire starts from. */
let wireStart: number | null = null;
/** Pole tool: last pole placed, the next one gets wired to it (chaining). */
let lastPoleId: number | null = null;
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
const ghost = document.createElement('div');
ghost.id = 'ghost';
mapWrap.appendChild(ghost);
const winOverlay = document.createElement('div');
winOverlay.id = 'win';
document.body.appendChild(winOverlay);
const debugPanel = document.createElement('div');
debugPanel.id = 'debug';
document.body.appendChild(debugPanel);

winOverlay.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-win]');
  if (!btn) return;
  if (btn.dataset.win === 'continue') winDismissed = true;
  if (btn.dataset.win === 'new') startNewGame();
  render();
});

debugPanel.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-debug]');
  if (btn?.dataset.debug === 'skip') {
    state = stepMany(state, config, 100);
    render();
  }
});

function startNewGame(): void {
  clearSave(SAVE_KEY);
  state = newGame();
  lastSavedTick = state.tick;
  winDismissed = false;
  setTool(null);
}

ghost.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-ghost]')) send({ type: 'dismissGhost' });
});

const px = config.ui.tilePx;

/** Sends a command to the simulation. Returns whether it was accepted. */
function send(command: Command): boolean {
  const next = applyCommand(state, config, command);
  const accepted = next !== state;
  state = next;
  render();
  return accepted;
}

function setTool(next: Tool): void {
  tool = next;
  wireStart = null;
  lastPoleId = null;
  selection = null;
}

function selectedTile(): { x: number; y: number } | null {
  if (!selection) return null;
  if (selection.type === 'ruin') return selection;
  if (selection.type === 'wire') {
    const id = selection.id;
    const w = state.wires.find((o) => o.id === id);
    const ends = w && wireEnds(state, w);
    if (!ends) return null;
    return { x: Math.round((ends[0].x + ends[1].x) / 2), y: Math.round((ends[0].y + ends[1].y) / 2) };
  }
  const id = selection.id;
  const b = state.buildings.find((o) => o.id === id);
  return b ? { x: b.x, y: b.y } : null;
}

function render(): void {
  renderTopbar(topbar, state, speedIndex, playtest);
  renderSidepanel(side, state, tool, overlay);
  renderGhost(ghost, state);
  const showWin = state.wonAtTick !== null && !winDismissed;
  if (showWin) setHtml(winOverlay, winHtml(state));
  winOverlay.style.display = showWin ? 'flex' : 'none';
  debugPanel.style.display = debugOpen ? 'block' : 'none';
  if (debugOpen) setHtml(debugPanel, debugHtml(state));
  drawMap(canvas, state, {
    overlay,
    hover,
    tool,
    selected: selection?.type === 'wire' ? null : selectedTile(),
    selectedWireId: selection?.type === 'wire' ? selection.id : null,
    wireStart,
    lastPoleId,
  });
  if (hover) setHtml(tooltip, tooltipHtml(state, hover.x, hover.y, { tool, wireStart, lastPoleId }));
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
  if (btn.dataset.action === 'new') {
    if (confirm('Začít novou hru? Rozehraná hra se smaže.')) startNewGame();
    render();
    return;
  }
  if (btn.dataset.overlay) overlay = btn.dataset.overlay as OverlayMode;
  if (btn.dataset.thaw) send({ type: 'thaw', species: btn.dataset.thaw as SpeciesId });
  if (btn.dataset.plant) {
    const t = `plant:${btn.dataset.plant}` as Tool;
    setTool(tool === t ? null : t);
  }
  if (btn.dataset.build) {
    const kind = btn.dataset.build;
    if (kind === 'wire') setTool(tool === 'wire' ? null : 'wire');
    else if (isBuildable(config, kind as BuildableKind)) setTool(tool === kind ? null : (kind as BuildableKind));
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
  } else if (action === 'removeWire' && selection.type === 'wire') {
    send({ type: 'removeWire', wireId: selection.id });
    selection = null;
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

/** Wire under the mouse (within a few pixels of its line), if any. */
function wireAt(e: MouseEvent): number | null {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  let best: number | null = null;
  let bestD = WIRE_CLICK_PX;
  for (const w of state.wires) {
    const ends = wireEnds(state, w);
    if (!ends) continue;
    const [ax, ay] = [ends[0].x * px + px / 2, ends[0].y * px + px / 2];
    const [bx, by] = [ends[1].x * px + px / 2, ends[1].y * px + px / 2];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((mx - ax) * (bx - ax) + (my - ay) * (by - ay)) / len2));
    const d = Math.hypot(mx - (ax + t * (bx - ax)), my - (ay + t * (by - ay)));
    if (d < bestD) {
      bestD = d;
      best = w.id;
    }
  }
  return best;
}
/** How close (in pixels) a click must be to a wire to select it. */
const WIRE_CLICK_PX = 7;

function clickWireTool(t: { x: number; y: number }): void {
  const tile = state.tiles[t.y * state.width + t.x];
  const b = tile.buildingId !== null ? state.buildings.find((o) => o.id === tile.buildingId) : undefined;
  if (!b || !isGridNode(config, b.kind)) {
    wireStart = null;
  } else if (wireStart === null) {
    wireStart = b.id;
  } else if (wireStart === b.id) {
    wireStart = null;
  } else if (send({ type: 'wire', from: wireStart, to: b.id })) {
    wireStart = b.id; // continue the line from the point just reached
  }
  render();
}

function clickPoleTool(t: { x: number; y: number }): void {
  const id = state.nextBuildingId;
  const ok = send({ type: 'build', kind: 'pole', x: t.x, y: t.y, wireTo: lastPoleId ?? undefined });
  if (ok) lastPoleId = id;
  render();
}

canvas.addEventListener('click', (e) => {
  const t = tileAt(e);
  if (!t) return;
  if (tool === 'wire') return clickWireTool(t);
  if (tool === 'pole') return clickPoleTool(t);
  const species = plantSpecies(tool);
  if (species) {
    send({ type: 'plant', species, x: t.x, y: t.y });
    return;
  }
  if (isBuildTool(tool)) {
    send({ type: 'build', kind: tool, x: t.x, y: t.y });
    return;
  }
  const tile = state.tiles[t.y * state.width + t.x];
  const wire = wireAt(e);
  if (tile.buildingId !== null) selection = { type: 'building', id: tile.buildingId };
  else if (wire !== null) selection = { type: 'wire', id: wire };
  else if (tile.kind === 'ruin') selection = { type: 'ruin', x: t.x, y: t.y };
  else selection = null;
  render();
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  setTool(null);
  render();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    setTool(null);
    render();
  } else if (e.key === ' ') {
    e.preventDefault();
    setSpeed(speedIndex === 0 ? lastSpeedIndex : 0);
  } else if (e.key === 'd' || e.key === 'D') {
    debugOpen = !debugOpen;
    render();
  }
});

// ---- Game loop --------------------------------------------------------------
/** Most ticks simulated in one animation frame. */
const MAX_TICKS_PER_FRAME = 10;

window.addEventListener('beforeunload', () => saveGame(SAVE_KEY, state));

function frame(now: number): void {
  const speed = config.time.speeds[speedIndex];
  accumulator += (now - last) * speed;
  last = now;
  let changed = false;
  // After a long pause (e.g. a background tab) don't try to catch up all at once
  accumulator = Math.min(accumulator, config.time.msPerTick * MAX_TICKS_PER_FRAME);
  while (accumulator >= config.time.msPerTick) {
    state = step(state, config);
    accumulator -= config.time.msPerTick;
    changed = true;
  }
  if (changed) {
    if (state.tick - lastSavedTick >= config.save.everyTicks) {
      saveGame(SAVE_KEY, state);
      lastSavedTick = state.tick;
    }
    render();
  }
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(frame);
