import type { BuildBlockReason, BuildableKind, BuildingKind, TileKind } from '../sim';

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
  pole: 'Sloup',
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
  pole: '🗼',
  belt: '➡️',
  sludgeProcessor: '♻️',
};


export const BUILDING_DESCRIPTIONS: Record<BuildableKind, string> = {
  coalPlant: 'Levná a silná energie. Znečišťuje ovzduší.',
  windmill: 'Čistá energie podle větru. Na kopci ×1,5.',
  soilCleaner: 'Snižuje toxicitu půdy v okruhu 2.',
  irrigator: 'Zvyšuje vlhkost půdy v okruhu 2.',
  filterStation: 'Čistí řeku. Jen na břehu řeky.',
  pollenSprayer: 'Opyluje rostliny v okruhu 3.',
  pole: 'Vede energii. Spojí se se sloupy do 4 polí, napájí stavby do 2 polí.',
};

export const BUILD_BLOCK_LABELS: Record<BuildBlockReason, string> = {
  outOfMap: 'Mimo mapu.',
  river: 'Do řeky se stavět nedá.',
  ruin: 'Ruinu je nejdřív potřeba rozebrat.',
  occupied: 'Pole je obsazené.',
  notRiverBank: 'Filtrační stanice musí stát na břehu řeky.',
  noMaterial: 'Nedostatek materiálu.',
};

/** Czech number formatting (decimal comma). */
export function fmt(n: number, digits = 0): string {
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Czech plural: 1 síť, 2–4 sítě, 5+ sítí. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
