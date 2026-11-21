import type { Config } from '../config';
import { energyOutputOf, energyUseOf } from './buildings';
import type { Building, BuildingKind, GameState, NetworkReport, Wire } from './types';

/** Building kinds that are grid nodes: they power nearby machines and take wires. */
export type GridNodeKind = keyof Config['grid'];

export function isGridNode(config: Config, kind: BuildingKind): kind is GridNodeKind {
  return kind in config.grid;
}

/** Distance in tiles where diagonal steps count as 1 (square ranges). */
export function tileDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Does this building ever consume energy (when switched on)? */
export function isConsumer(config: Config, kind: BuildingKind): boolean {
  return kind in config.buildings && config.buildings[kind as keyof Config['buildings']].energyUse > 0;
}

// ---- Wires ------------------------------------------------------------------

export function wireCost(config: Config, length: number): number {
  return length * config.wire.costPerTile;
}

export function wireRefund(config: Config, length: number): number {
  return Math.floor(wireCost(config, length) * config.demolishRefund);
}

/** Why a wire can't be laid. null = it can. */
export type WireBlockReason = 'missing' | 'notNode' | 'same' | 'exists' | 'tooLong' | 'noMaterial';

export function wireBetween(state: GameState, a: number, b: number): Wire | undefined {
  return state.wires.find((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
}

export function canWire(state: GameState, config: Config, from: number, to: number): WireBlockReason | null {
  const a = state.buildings.find((b) => b.id === from);
  const b = state.buildings.find((o) => o.id === to);
  if (!a || !b) return 'missing';
  if (!isGridNode(config, a.kind) || !isGridNode(config, b.kind)) return 'notNode';
  if (a.id === b.id) return 'same';
  if (wireBetween(state, a.id, b.id)) return 'exists';
  const length = tileDistance(a, b);
  if (length > config.wire.maxLength) return 'tooLong';
  if (state.material < wireCost(config, length)) return 'noMaterial';
  return null;
}

/** Lays a wire on a state the caller has already copied. Assumes canWire passed. */
export function addWire(s: GameState, config: Config, from: number, to: number): void {
  const a = s.buildings.find((b) => b.id === from)!;
  const b = s.buildings.find((o) => o.id === to)!;
  s.material -= wireCost(config, tileDistance(a, b));
  s.wires.push({ id: s.nextWireId++, a: from, b: to });
}

/** Removes a wire and refunds half its cost, on a state the caller has already copied. */
export function removeWire(s: GameState, config: Config, wireId: number): void {
  const w = s.wires.find((o) => o.id === wireId);
  if (!w) return;
  const a = s.buildings.find((b) => b.id === w.a);
  const b = s.buildings.find((o) => o.id === w.b);
  if (a && b) s.material += wireRefund(config, tileDistance(a, b));
  s.wires = s.wires.filter((o) => o.id !== wireId);
}

/** The two end buildings of a wire. */
export function wireEnds(state: GameState, w: Wire): [Building, Building] | null {
  const a = state.buildings.find((b) => b.id === w.a);
  const b = state.buildings.find((o) => o.id === w.b);
  return a && b ? [a, b] : null;
}

// ---- Grids ------------------------------------------------------------------

function isPowered(state: GameState, networkId: number | null): boolean {
  if (networkId === null) return false;
  return (state.energy.networks.find((n) => n.id === networkId)?.produced ?? 0) > 0;
}

/**
 * The grid node that powers a consumer at (x, y). Among nodes whose supply
 * range reaches it, a node of a grid that produces energy wins; then the
 * nearer one; then the older one. null = nothing reaches it.
 */
export function supplierFor(state: GameState, config: Config, x: number, y: number): Building | null {
  let best: Building | null = null;
  let bestKey: [number, number, number] | null = null;
  for (const n of state.buildings) {
    if (!isGridNode(config, n.kind)) continue;
    const d = tileDistance(n, { x, y });
    if (d > config.grid[n.kind].supply) continue;
    const key: [number, number, number] = [isPowered(state, n.networkId) ? 0 : 1, d, n.id];
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
      best = n;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Rebuilds the grids from the wires and distributes energy. Each grid has its
 * own production, demand and ratio; consumers outside every grid get no power.
 * Mutates a state that the caller has already copied.
 */
export function updateGrid(s: GameState, config: Config): void {
  const nodes = s.buildings.filter((b) => isGridNode(config, b.kind));
  const index = new Map(nodes.map((n, i) => [n.id, i]));

  // Union-find over grid nodes joined by wires
  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const w of s.wires) {
    const ia = index.get(w.a);
    const ib = index.get(w.b);
    if (ia !== undefined && ib !== undefined) parent[find(ia)] = find(ib);
  }
  const rootMinId = new Map<number, number>();
  nodes.forEach((n, i) => {
    const r = find(i);
    rootMinId.set(r, Math.min(rootMinId.get(r) ?? Infinity, n.id));
  });

  for (const b of s.buildings) b.networkId = null;
  nodes.forEach((n, i) => (n.networkId = rootMinId.get(find(i))!));

  // Production per grid first, so consumers can prefer a powered grid
  const reports = new Map<number, NetworkReport>();
  for (const id of new Set(rootMinId.values())) reports.set(id, { id, produced: 0, demanded: 0, ratio: 1 });
  for (const n of nodes) reports.get(n.networkId!)!.produced += energyOutputOf(s, config, n);
  s.energy = { ...s.energy, networks: [...reports.values()] };

  for (const b of s.buildings) {
    if (isGridNode(config, b.kind) || !isConsumer(config, b.kind)) continue;
    b.networkId = supplierFor(s, config, b.x, b.y)?.networkId ?? null;
  }

  let unconnected = 0;
  for (const b of s.buildings) {
    if (b.networkId === null) {
      if (isConsumer(config, b.kind) && b.enabled) unconnected++;
      continue;
    }
    reports.get(b.networkId)!.demanded += energyUseOf(config, b);
  }
  for (const r of reports.values()) r.ratio = r.demanded <= 0 ? 1 : Math.min(1, r.produced / r.demanded);

  for (const b of s.buildings) {
    b.power = b.enabled && b.networkId !== null ? reports.get(b.networkId)!.ratio : 0;
  }

  const networks = [...reports.values()].sort((a, b) => a.id - b.id);
  s.energy = {
    produced: networks.reduce((sum, r) => sum + r.produced, 0),
    demanded: networks.reduce((sum, r) => sum + r.demanded, 0),
    unconnected,
    networks,
  };
}

export function networkOf(state: GameState, b: Building): NetworkReport | null {
  return b.networkId === null ? null : (state.energy.networks.find((n) => n.id === b.networkId) ?? null);
}
