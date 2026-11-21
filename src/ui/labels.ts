import type { BuildingKind, TileKind } from '../sim';

export const TILE_LABELS: Record<TileKind, string> = {
  soil: 'Půda',
  river: 'Řeka',
  ruin: 'Ruina',
  hill: 'Kopec',
};

export const BUILDING_LABELS: Record<BuildingKind, string> = {
  databank: 'Databanka',
  coalDump: 'Uhelná skládka',
  coalPlant: 'Uhelná elektrárna',
  windmill: 'Větrník',
  soilCleaner: 'Čistička půdy',
  irrigator: 'Závlaha',
  filterStation: 'Filtrační stanice',
  pollenSprayer: 'Rozprašovač pylu',
  belt: 'Pás',
  sludgeProcessor: 'Zpracovna kalu',
};

export const BUILDING_ICONS: Record<BuildingKind, string> = {
  databank: '🏛️',
  coalDump: '⛰️',
  coalPlant: '🏭',
  windmill: '🌬️',
  soilCleaner: '🧽',
  irrigator: '💧',
  filterStation: '🚰',
  pollenSprayer: '🌼',
  belt: '➡️',
  sludgeProcessor: '♻️',
};
