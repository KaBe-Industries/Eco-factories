import type { Config } from '../config';
import { updateGrid, addWire, canWire, removeWire } from './grid';
import { canBuild, findBuilding, isBuildable, refundFor } from './buildings';
import { makeBuilding } from './state';
import type { Command, GameState } from './types';

/**
 * Applies one player command and returns the new state. Pure, like `step`.
 * Invalid commands return the state unchanged (same object).
 */
export function applyCommand(state: GameState, config: Config, command: Command): GameState {
  switch (command.type) {
    case 'build': {
      const { kind, x, y } = command;
      if (!isBuildable(config, kind) || canBuild(state, config, kind, x, y) !== null) return state;
      const s = structuredClone(state);
      const b = makeBuilding(s.nextBuildingId++, kind, x, y);
      if (command.direction) b.direction = command.direction;
      s.buildings.push(b);
      s.tiles[y * s.width + x].buildingId = b.id;
      s.material -= config.buildings[kind].cost;
      // Chaining: wire to the previous pole when in reach and affordable
      if (command.wireTo !== undefined && canWire(s, config, b.id, command.wireTo) === null) {
        addWire(s, config, b.id, command.wireTo);
      }
      updateGrid(s, config);
      return s;
    }
    case 'wire': {
      if (canWire(state, config, command.from, command.to) !== null) return state;
      const s = structuredClone(state);
      addWire(s, config, command.from, command.to);
      updateGrid(s, config);
      return s;
    }
    case 'removeWire': {
      if (!state.wires.some((w) => w.id === command.wireId)) return state;
      const s = structuredClone(state);
      removeWire(s, config, command.wireId);
      updateGrid(s, config);
      return s;
    }
    case 'toggle': {
      const b = findBuilding(state, command.buildingId);
      if (!b || !isBuildable(config, b.kind)) return state;
      const s = structuredClone(state);
      const nb = findBuilding(s, b.id)!;
      nb.enabled = !nb.enabled;
      updateGrid(s, config);
      return s;
    }
    case 'demolish': {
      const b = findBuilding(state, command.buildingId);
      if (!b || !isBuildable(config, b.kind)) return state;
      const s = structuredClone(state);
      // Wires attached to the building are taken down too, with refund
      for (const w of s.wires.filter((o) => o.a === b.id || o.b === b.id)) removeWire(s, config, w.id);
      s.buildings = s.buildings.filter((o) => o.id !== b.id);
      s.tiles[b.y * s.width + b.x].buildingId = null;
      s.material += refundFor(config, b.kind);
      updateGrid(s, config);
      return s;
    }
    case 'dismantleRuin': {
      const { x, y } = command;
      const tile = state.tiles[y * state.width + x];
      if (!tile || tile.kind !== 'ruin' || tile.dismantleProgress !== null) return state;
      const s = structuredClone(state);
      s.tiles[y * s.width + x].dismantleProgress = 0;
      return s;
    }
    default:
      // thaw, plant, dismissGhost arrive in later phases
      return state;
  }
}
