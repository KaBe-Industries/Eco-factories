import { config } from '../config';
import type { BuildBlockReason, BuildableKind, BuildingKind, Condition, FloorStatus, PlantBlockReason, SpeciesId, TileKind, WireBlockReason } from '../sim';

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
  pole: 'Napájí stavby do 2 polí. S dalšími body ho spoj drátem.',
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

export const WIRE_BLOCK_LABELS: Record<WireBlockReason, string> = {
  missing: 'Tahle stavba už neexistuje.',
  notNode: 'Drát jde vést jen mezi sloupem, elektrárnou, větrníkem a Databankou.',
  same: 'Drát musí vést mezi dvěma různými body.',
  exists: 'Tyhle dva body už drát spojuje.',
  tooLong: `Drát je moc dlouhý (max. ${config.wire.maxLength} polí).`,
  noMaterial: 'Nedostatek materiálu na drát.',
};

export const SPECIES_LABELS: Record<SpeciesId, string> = {
  fungi: 'Houby',
  plants: 'Rákos a pionýrské rostliny',
  bees: 'Včely',
};

export const SPECIES_ICONS: Record<SpeciesId, string> = {
  fungi: '🍄',
  plants: '🌾',
  bees: '🐝',
};

export const SPECIES_REPLACES: Record<SpeciesId, string> = {
  fungi: 'čističku půdy',
  plants: 'závlahu a filtrační stanici',
  bees: 'rozprašovač pylu',
};

export function speciesNeeds(species: SpeciesId): string {
  const sp = config.species;
  switch (species) {
    case 'fungi':
      return `Žijí na polích s toxicitou pod ${sp.fungi.maxToxicity}. Snižují toxicitu a samy se šíří na sousední pole.`;
    case 'plants':
      return `Rostou na polích s toxicitou pod ${sp.plants.maxToxicity} a vlhkostí nad ${sp.plants.minMoisture}. Drží vlhkost, na břehu čistí řeku. Šíří se, jen když jsou opylené.`;
    case 'bees':
      return 'Úl se zakládá na poli s rostlinami. Včely opylují kolem úlů, čím víc jich je, tím dál. Množí se, když mají dost rostlin.';
  }
}

export const FLOOR_STATUS_LABELS: Record<FloorStatus, string> = {
  locked: '🔒 Zamčeno',
  unlocked: '🔓 Odemčeno',
  thawing: '❄️ Rozmrazuje se',
  ready: '✅ Připraveno',
};

export function conditionLabel(c: Condition): string {
  switch (c.id) {
    case 'lowToxTiles':
      return `Pole s toxicitou pod ${c.threshold}: <b>${c.current} / ${c.target}</b>`;
    case 'riverQuality':
      return `Kvalita řeky: <b>${fmt(c.current)} / ${c.target}</b>`;
    case 'plantTiles':
      return `Pole s rostlinami: <b>${c.current} / ${c.target}</b>`;
    case 'pollution':
      return `Znečištění pod ${c.target}: <b>${fmt(c.current)}</b>`;
  }
}

export const PLANT_BLOCK_LABELS: Record<PlantBlockReason, string> = {
  notReady: 'Druh ještě není rozmražený.',
  river: 'Do řeky se vysazovat nedá.',
  occupied: 'Na poli stojí stavba.',
  already: 'Tady už je.',
  tooToxic: 'Půda je tu moc toxická.',
  tooDry: 'Půda je tu moc suchá.',
  needsPlants: 'Úl potřebuje pole s rostlinami.',
  noMaterial: 'Nedostatek materiálu.',
};
