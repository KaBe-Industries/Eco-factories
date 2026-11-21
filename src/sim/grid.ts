import type { Config } from '../config';
import { energyOutputOf, energyUseOf } from './buildings';
import type { Building, BuildingKind, GameState, NetworkReport } from './types';

/** Building kinds that are grid nodes (carry power and connect to each other). */
export type GridNodeKind = keyof Config['grid'];

export function isGridNode(config: Config, kind: BuildingKind): kind is GridNodeKind {
  return kind in config.grid;
}

/** Distance in tiles where diagonal steps count as 1 (square ranges). */
export function tileDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Can two grid nodes of these kinds at these positions connect? */
export function nodesLink(
  config: Config,
  a: { kind: GridNodeKind; x: number; y: number },
  b: { kind: GridNodeKind; x: number; y: number },
): boolean {
  return tileDistance(a, b) <= Math.max(config.grid[a.kind].link, config.grid[b.kind].link);
}

/** Does this building ever consume energy (when switched on)? */
export function isConsumer(config: Config, kind: BuildingKind): boolean {
  return kind in config.buildings && config.buildings[kind as keyof Config['buildings']].energyUse > 0;
}

/**
 * The grid node that would power a consumer at (x, y): the nearest node whose
 * supply range reaches it (ties → lower id). null = not connected.
 */
export function supplierFor(state: GameState, config: Config, x: number, y: number): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const n of state.buildings) {
    if (!isGridNode(config, n.kind)) continue;
    const d = tileDistance(n, { x, y });
    if (d > config.grid[n.kind].supply) continue;
    if (d < bestD || (d === bestD && best !== null && n.id < best.id)) {
      best = n;
      bestD = d;
    }
  }
  return best;
}

/** Existing grid nodes a new node of `kind` at (x, y) would connect to. */
export function linksFor(
  state: GameState,
  config: Config,
  kind: GridNodeKind,
  x: number,
  y: number,
): Building[] {
  return state.buildings.filter(
    (n) => isGridNode(config, n.kind) && !(n.x === x && n.y === y) && nodesLink(config, { kind, x, y }, n as Building & { kind: GridNodeKind }),
  );
}

/** Pairs of connected grid nodes, for drawing the lines between them. */
export function gridLinks(state: GameState, config: Config): Array<[Building, Building]> {
  const nodes = state.buildings.filter((b) => isGridNode(config, b.kind)) as Array<Building & { kind: GridNodeKind }>;
  const links: Array<[Building, Building]> = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesLink(config, nodes[i], nodes[j])) links.push([nodes[i], nodes[j]]);
    }
  }
  return links;
}

/**
 * Rebuilds the grids and distributes energy. Each grid has its own production,
 * demand and ratio; consumers outside every grid get no power.
 * Mutates a state that the caller has already copied.
 */
export function updateGrid(s: GameState, config: Config): void {
  const nodes = s.buildings.filter((b) => isGridNode(config, b.kind)) as Array<Building & { kind: GridNodeKind }>;

  // Union-find over grid nodes
  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesLink(config, nodes[i], nodes[j])) parent[find(i)] = find(j);
    }
  }
  const rootMinId = new Map<number, number>();
  nodes.forEach((n, i) => {
    const r = find(i);
    rootMinId.set(r, Math.min(rootMinId.get(r) ?? Infinity, n.id));
  });

  for (const b of s.buildings) b.networkId = null;
  nodes.forEach((n, i) => (n.networkId = rootMinId.get(find(i))!));

  // Consumers join the grid of the nearest node that reaches them
  for (const b of s.buildings) {
    if (isGridNode(config, b.kind) || !isConsumer(config, b.kind)) continue;
    b.networkId = supplierFor(s, config, b.x, b.y)?.networkId ?? null;
  }

  // Per-grid balance
  const reports = new Map<number, NetworkReport>();
  for (const id of new Set(rootMinId.values())) reports.set(id, { id, produced: 0, demanded: 0, ratio: 1 });
  let unconnected = 0;
  for (const b of s.buildings) {
    if (b.networkId === null) {
      if (isConsumer(config, b.kind) && b.enabled) unconnected++;
      continue;
    }
    const r = reports.get(b.networkId)!;
    r.produced += energyOutputOf(s, config, b);
    r.demanded += energyUseOf(config, b);
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
