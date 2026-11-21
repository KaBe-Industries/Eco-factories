/**
 * All balance numbers of the game live here. No other file may contain
 * gameplay numbers (costs, speeds, thresholds). New sections are added
 * as the phases from docs/PROTOTYP.md are implemented.
 */
export const config = {
  map: {
    seed: 20261121,
    width: 24,
    height: 16,
    river: {
      /** Rows between the map edge and the river's base line. */
      offsetFromEdge: 3,
      minWidth: 2,
      maxWidth: 3,
      /** Chance per column that the river width changes. */
      widthChangeChance: 0.3,
      /** Vertical wiggle (tiles) and its frequency (radians per column). */
      wiggleAmplitude: 1.5,
      wiggleFrequency: 0.45,
    },
    hills: {
      clusters: 3,
      /** Extra hill tiles grown around each cluster centre. */
      extraTilesPerCluster: 4,
    },
    ruins: {
      count: 10,
    },
    /** Keep hills and ruins at least this far (tiles) from the Databank. */
    databankClearance: 2,
    toxicity: {
      soilMin: 50,
      soilMax: 90,
      ruinMin: 85,
      ruinMax: 100,
    },
    moisture: {
      /** Moisture on a tile right next to the river. */
      atRiver: 85,
      /** Moisture lost per tile of distance from the river. */
      lossPerTile: 7,
      min: 10,
      /** Random variation ± this value. */
      jitter: 5,
      /** Moisture value stored on river tiles themselves. */
      riverTile: 100,
    },
  },

  time: {
    /** Real milliseconds per tick at speed 1×. */
    msPerTick: 1000,
    /** Available speed multipliers (0 = paused). */
    speeds: [0, 1, 3],
  },

  start: {
    material: 60,
    riverQuality: 15,
    pollution: 10,
  },

  /** Phase 8 logistics. Present from the start so the data model is ready. */
  logistics: {
    /** Max items one belt tile carries. */
    beltCapacity: 1,
  },

  ui: {
    tilePx: 36,
  },
};

export type Config = typeof config;
