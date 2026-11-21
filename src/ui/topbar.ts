import { config } from '../config';
import type { GameState } from '../sim';

const SPEED_LABELS = ['⏸ Pauza', '▶ 1×', '⏩ 3×'];

export function renderTopbar(
  el: HTMLElement,
  state: GameState,
  speedIndex: number,
  onSpeed: (i: number) => void,
): void {
  el.innerHTML = `
    <span class="title">🌱 Kořeny</span>
    <span class="stat">Materiál <b>${Math.floor(state.material)}</b></span>
    <span class="stat">Tick <b>${state.tick}</b></span>
    <span class="speeds"></span>
  `;
  const speeds = el.querySelector('.speeds') as HTMLElement;
  config.time.speeds.forEach((_, i) => {
    const b = document.createElement('button');
    b.textContent = SPEED_LABELS[i];
    if (i === speedIndex) b.classList.add('active');
    b.onclick = () => onSpeed(i);
    speeds.appendChild(b);
  });
}
