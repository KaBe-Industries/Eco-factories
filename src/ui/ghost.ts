import { config } from '../config';
import type { GameState } from '../sim';
import ghostTexts from '../content/ghost.json';
import { setHtml } from './dom';

const TEXTS = ghostTexts as Record<string, string>;

/** Positions and fills the ghost's speech bubble next to its tile. Hidden when nothing is open. */
export function renderGhost(el: HTMLElement, state: GameState): void {
  const msg = state.ghost.active;
  if (!msg) {
    el.style.display = 'none';
    return;
  }
  const waiting = state.ghost.queue.length;
  setHtml(
    el,
    `<div class="ghost-head"><span>👻🐝 Duch včely</span><button class="close" data-ghost="close" title="Zavřít">✕</button></div>
     <p>${TEXTS[msg.id] ?? msg.id}</p>
     <button data-ghost="close">${waiting > 0 ? `Dál (${waiting})` : 'Rozumím'}</button>`,
  );
  el.style.display = 'block';
  const px = config.ui.tilePx;
  const mapW = state.width * px;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const left = Math.max(0, Math.min(mapW - w, msg.x * px + px / 2 - w / 2));
  const above = msg.y * px - h - 10;
  el.style.left = `${left}px`;
  el.style.top = `${above >= 0 ? above : msg.y * px + px + 10}px`;
  el.classList.toggle('below', above < 0);
}
