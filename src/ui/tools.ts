import type { BuildableKind, SpeciesId } from '../sim';

export type PlantTool = `plant:${SpeciesId}`;

/** What the player has picked in the side panel: a building, the wire tool or a species to plant. */
export type Tool = BuildableKind | 'wire' | PlantTool | null;

export function isBuildTool(tool: Tool): tool is BuildableKind {
  return tool !== null && tool !== 'wire' && !tool.startsWith('plant:');
}

export function plantSpecies(tool: Tool): SpeciesId | null {
  return tool !== null && tool.startsWith('plant:') ? (tool.slice(6) as SpeciesId) : null;
}

/** Colours for wires, one per grid (cycled when there are more grids). */
export const NETWORK_COLORS = ['#e4572e', '#2e86de', '#17a589', '#c0399b', '#f1a208', '#7d5ba6', '#3d9970', '#b5651d'];

export function networkColor(networkIds: number[], id: number | null): string {
  if (id === null) return '#888888';
  const i = networkIds.indexOf(id);
  return NETWORK_COLORS[(i < 0 ? 0 : i) % NETWORK_COLORS.length];
}
