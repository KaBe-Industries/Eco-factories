import { config } from '../config';
import { isConsumer, isGridNode, networkOf } from '../sim';
import type { Building, GameState } from '../sim';
import { fmt } from './labels';

/** One-line status of a building's power, shared by tooltip and popup. */
export function powerStatus(b: Building): string | null {
  if (!b.enabled) return 'Vypnuto – nežere energii.';
  if (isConsumer(config, b.kind)) {
    if (b.networkId === null) return '<span class="warn">🔌 Není připojeno k síti – postav sloup do 2 polí.</span>';
    if (b.power < 1) return `<span class="warn">🪫 Jede na ${fmt(b.power * 100)} % – síť má málo energie.</span>`;
    return 'Běží naplno.';
  }
  return null;
}

/** Summary of the grid a building belongs to. */
export function networkLine(state: GameState, b: Building): string | null {
  if (!isGridNode(config, b.kind) && !isConsumer(config, b.kind)) return null;
  const n = networkOf(state, b);
  if (!n) return null;
  return `Síť: výroba ${fmt(n.produced, 1)} / spotřeba ${fmt(n.demanded, 1)} ⚡, výkon ${fmt(n.ratio * 100)} %`;
}
