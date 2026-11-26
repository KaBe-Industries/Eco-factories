import { config } from '../config';
import type { GameState } from '../sim';
import { fmt, plural } from './labels';

/** Game time as minutes and seconds at speed 1×. */
export function gameTime(ticks: number): string {
  const secs = Math.round((ticks * config.time.msPerTick) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export function winHtml(state: GameState): string {
  const t = state.wonAtTick ?? state.tick;
  const c = state.stats.collapses;
  return `<div class="win-card">
    <div class="win-emoji">🌿🐝🏞️</div>
    <h1>Niva je vyléčená</h1>
    <p>Fabrika mlčí a o nivu se stará život sám.</p>
    <div class="win-stats">
      <div><span>Čas</span><b>${fmt(t)} ticků</b><small>${gameTime(t)} při rychlosti 1×</small></div>
      <div><span>Kolapsy</span><b>${c}</b><small>${c === 0 ? 'ani jednou kyselý déšť' : `${plural(c, 'epizoda', 'epizody', 'epizod')} kyselých dešťů`}</small></div>
    </div>
    <div class="button-row center">
      <button data-win="continue">Hrát dál</button>
      <button data-win="new" class="primary">Nová hra</button>
    </div>
  </div>`;
}
