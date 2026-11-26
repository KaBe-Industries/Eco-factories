import type { Config } from '../config';
import { updateGrid, addWire, canWire, removeWire } from './grid';
import { canBuild, findBuilding, isBuildable, refundFor } from './buildings';
import { makeBuilding } from './state';
import { canPlant, canThaw, livingReplacementFor, plant } from './species';
import { dismissGhost, showGhost } from './ghost';
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
      const tile = s.tiles[y * s.width + x];
      tile.buildingId = b.id;
      // A building replaces plants and hives on its tile; fungi live on in the soil.
      tile.life.plants = 0;
      tile.life.hive = false;
      s.material -= config.buildings[kind].cost;
      // Chaining: wire to the previous pole when in reach and affordable
      if (command.wireTo !== undefined && canWire(s, config, b.id, command.wireTo) === null) {
        addWire(s, config, b.id, command.wireTo);
      }
      if (kind === 'coalPlant') showGhost(s, 'firstCoal', x, y);
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
      if (!nb.enabled && livingReplacementFor(s, nb.kind)) showGhost(s, 'firstMachineReplaced', nb.x, nb.y);
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
      if (livingReplacementFor(s, b.kind)) showGhost(s, 'firstMachineReplaced', b.x, b.y);
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
    case 'thaw': {
      if (!canThaw(state, command.species)) return state;
      const s = structuredClone(state);
      s.databank.find((f) => f.species === command.species)!.status = 'thawing';
      updateGrid(s, config);
      return s;
    }
    case 'plant': {
      const { species, x, y } = command;
      if (canPlant(state, config, species, x, y) !== null) return state;
      const s = structuredClone(state);
      plant(s, config, species, x, y);
      return s;
    }
    case 'dismissGhost': {
      if (state.ghost.active === null) return state;
      const s = structuredClone(state);
      dismissGhost(s);
      return s;
    }
    default:
      return state;
  }
}
