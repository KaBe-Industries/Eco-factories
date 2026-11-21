import type { Config } from '../config';
import { nextRandom } from './rng';
import { emptyTile, makeBuilding } from './state';
import type { Building, GameState, Tile } from './types';

/** Small stateful wrapper around the pure generator, used only during generation. */
function makeRandom(seed: number) {
  let rng = seed;
  const next = (): number => {
    const [v, r] = nextRandom(rng);
    rng = r;
    return v;
  };
  return {
    next,
    int: (min: number, maxInclusive: number) => min + Math.floor(next() * (maxInclusive - min + 1)),
    range: (min: number, max: number) => min + next() * (max - min),
    get state() {
      return rng;
    },
  };
}

const NEIGHBOURS_4: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function databankPosition(config: Config): { x: number; y: number } {
  return { x: Math.floor(config.map.width / 2), y: Math.floor(config.map.height / 2) };
}

export function isRiverBank(state: Pick<GameState, 'tiles' | 'width' | 'height'>, x: number, y: number): boolean {
  const t = state.tiles[y * state.width + x];
  if (!t || t.kind === 'river') return false;
  return NEIGHBOURS_4.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) return false;
    return state.tiles[ny * state.width + nx].kind === 'river';
  });
}

export interface GeneratedMap {
  tiles: Tile[];
  buildings: Building[];
  nextBuildingId: number;
  rng: number;
}

/**
 * Generates the map from the seed in config. Same seed = same map.
 * The river flows from the left edge to the right edge, near the top
 * or the bottom; the Databank stands in the centre.
 */
export function generateMap(config: Config): GeneratedMap {
  const { width, height, seed, river, hills, ruins, toxicity, moisture, databankClearance } = config.map;
  const rand = makeRandom(seed);
  const tiles: Tile[] = Array.from({ length: width * height }, emptyTile);
  const at = (x: number, y: number) => tiles[y * width + x];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const bank = databankPosition(config);
  const nearDatabank = (x: number, y: number) =>
    Math.max(Math.abs(x - bank.x), Math.abs(y - bank.y)) <= databankClearance;

  // --- River -------------------------------------------------------------
  const nearTop = rand.next() < 0.5;
  const baseY = nearTop ? river.offsetFromEdge : height - 1 - river.offsetFromEdge;
  const phase = rand.range(0, Math.PI * 2);
  let riverWidth = rand.int(river.minWidth, river.maxWidth);
  for (let x = 0; x < width; x++) {
    if (x > 0 && rand.next() < river.widthChangeChance) {
      riverWidth = rand.int(river.minWidth, river.maxWidth);
    }
    const centre = baseY + river.wiggleAmplitude * Math.sin(x * river.wiggleFrequency + phase);
    let top = Math.round(centre - (riverWidth - 1) / 2);
    top = Math.max(0, Math.min(height - riverWidth, top));
    for (let y = top; y < top + riverWidth; y++) at(x, y).kind = 'river';
  }

  const isFreeLand = (x: number, y: number) =>
    inside(x, y) && at(x, y).kind === 'soil' && !nearDatabank(x, y);
  const touchesRiver = (x: number, y: number) =>
    NEIGHBOURS_4.some(([dx, dy]) => inside(x + dx, y + dy) && at(x + dx, y + dy).kind === 'river');
  const randomFreeLand = (extra: (x: number, y: number) => boolean): [number, number] | null => {
    for (let attempt = 0; attempt < width * height * 4; attempt++) {
      const x = rand.int(0, width - 1);
      const y = rand.int(0, height - 1);
      if (isFreeLand(x, y) && extra(x, y)) return [x, y];
    }
    return null;
  };

  // --- Hills ---------------------------------------------------------------
  for (let c = 0; c < hills.clusters; c++) {
    const start = randomFreeLand((x, y) => !touchesRiver(x, y));
    if (!start) break;
    const cluster: Array<[number, number]> = [start];
    at(...start).kind = 'hill';
    for (let i = 0; i < hills.extraTilesPerCluster; i++) {
      const [cx, cy] = cluster[rand.int(0, cluster.length - 1)];
      const [dx, dy] = NEIGHBOURS_4[rand.int(0, NEIGHBOURS_4.length - 1)];
      const nx = cx + dx;
      const ny = cy + dy;
      if (isFreeLand(nx, ny) && !touchesRiver(nx, ny)) {
        at(nx, ny).kind = 'hill';
        cluster.push([nx, ny]);
      }
    }
  }

  // --- Ruins ---------------------------------------------------------------
  for (let i = 0; i < ruins.count; i++) {
    const pos = randomFreeLand((x, y) => !touchesRiver(x, y));
    if (!pos) break;
    at(...pos).kind = 'ruin';
  }

  // --- Toxicity: smoothed noise rescaled to the configured range ------------
  const raw = tiles.map(() => rand.next());
  const smooth = raw.map((_, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    let sum = 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (inside(x + dx, y + dy)) {
          sum += raw[(y + dy) * width + x + dx];
          n++;
        }
      }
    }
    return sum / n;
  });
  const lo = Math.min(...smooth);
  const hi = Math.max(...smooth);
  tiles.forEach((t, i) => {
    const norm = hi > lo ? (smooth[i] - lo) / (hi - lo) : 0;
    if (t.kind === 'river') t.toxicity = 0;
    else if (t.kind === 'ruin') t.toxicity = toxicity.ruinMin + norm * (toxicity.ruinMax - toxicity.ruinMin);
    else t.toxicity = toxicity.soilMin + norm * (toxicity.soilMax - toxicity.soilMin);
    t.toxicity = Math.round(t.toxicity);
  });

  // --- Moisture: by distance to the nearest river tile -----------------------
  const dist = riverDistances(tiles, width, height);
  tiles.forEach((t, i) => {
    if (t.kind === 'river') {
      t.moisture = moisture.riverTile;
      t.baseMoisture = moisture.riverTile;
      return;
    }
    const base = moisture.atRiver - (dist[i] - 1) * moisture.lossPerTile;
    const jitter = rand.range(-moisture.jitter, moisture.jitter);
    t.moisture = Math.round(Math.max(moisture.min, Math.min(100, base + jitter)));
    t.baseMoisture = t.moisture;
  });

  // --- Databank ------------------------------------------------------------
  const databank = makeBuilding(1, 'databank', bank.x, bank.y);
  at(bank.x, bank.y).buildingId = databank.id;

  return { tiles, buildings: [databank], nextBuildingId: 2, rng: rand.state };
}

/** Breadth-first distance (4-neighbourhood) from every tile to the nearest river tile. */
function riverDistances(tiles: Tile[], width: number, height: number): number[] {
  const dist = tiles.map((t) => (t.kind === 'river' ? 0 : Infinity));
  const queue: number[] = [];
  dist.forEach((d, i) => d === 0 && queue.push(i));
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % width;
    const y = Math.floor(i / width);
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (dist[j] > dist[i] + 1) {
        dist[j] = dist[i] + 1;
        queue.push(j);
      }
    }
  }
  return dist;
}
