import { config } from './config';
import { createInitialState, step } from './sim';
import type { GameState } from './sim';
import { drawMap } from './ui/canvas';
import { renderTopbar } from './ui/topbar';
import ghostTexts from './content/ghost.json';

let state: GameState = createInitialState(config);
let speedIndex = 1; // 1× by default
let accumulator = 0;
let last = performance.now();

const canvas = document.getElementById('map') as HTMLCanvasElement;
const topbar = document.getElementById('topbar') as HTMLElement;
const side = document.getElementById('sidepanel') as HTMLElement;

side.innerHTML = `
  <h2>Kořeny – prototyp</h2>
  <p>${ghostTexts.intro}</p>
  <p>Fáze 0: kostra projektu. Mapa, stavby a život přibudou v dalších fázích.</p>
`;

function setSpeed(i: number): void {
  speedIndex = i;
  render();
}

function render(): void {
  renderTopbar(topbar, state, speedIndex, setSpeed);
  drawMap(canvas, state);
}

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
