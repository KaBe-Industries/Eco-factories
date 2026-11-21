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

  /**
   * Buildings the player can place. energyOutput is per tick at full
   * power; energyUse is the demand of a running machine.
   */
  buildings: {
    coalPlant: { cost: 15, energyUse: 0, energyOutput: 10 },
    windmill: { cost: 35, energyUse: 0, energyOutput: 4 },
    soilCleaner: { cost: 20, energyUse: 3, energyOutput: 0 },
    irrigator: { cost: 15, energyUse: 2, energyOutput: 0 },
    filterStation: { cost: 30, energyUse: 4, energyOutput: 0 },
    pollenSprayer: { cost: 20, energyUse: 2, energyOutput: 0 },
    pole: { cost: 2, energyUse: 0, energyOutput: 0 },
  },

  /**
   * Electric grid (phase 2b). Distances are in tiles, measured as a square
   * around the building (diagonal neighbours count as distance 1).
   * supply: machines within this distance of a grid node are powered by it.
   * Grid nodes connect to each other only through wires laid by the player.
   */
  grid: {
    pole: { supply: 2 },
    coalPlant: { supply: 1 },
    windmill: { supply: 1 },
    databank: { supply: 2 },
  },

  wire: {
    /** Longest wire in tiles. */
    maxLength: 5,
    /** Material per tile of wire length. */
    costPerTile: 1,
  },

  /** Share of the cost returned when a building is demolished. */
  demolishRefund: 0.5,

  /** Windmill output multiplier when standing on a hill. */
  windmillHillMultiplier: 1.5,

  wind: {
    min: 0.3,
    max: 1.2,
    /** Average wind the sine wave oscillates around. */
    base: 0.75,
    sineAmplitude: 0.3,
    /** Length of one full calm–gusty cycle in ticks. */
    sinePeriodTicks: 120,
    /** Max change of the random part per tick. */
    noiseStep: 0.04,
    /** Max size of the random part. */
    noiseMax: 0.2,
  },

  ruins: {
    dismantleTicks: 10,
    material: 20,
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
