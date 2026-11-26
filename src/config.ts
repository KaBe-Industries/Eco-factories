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
      soilMin: 60,
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
   * Playtest mode for trying the game in the browser without grinding.
   * Only the browser game uses it; tests and balance bots always run with
   * the real numbers above. Add ?ostre to the page address to play the
   * real game. Set enabled: false for the final playtest.
   */
  playtest: {
    enabled: true,
    startMaterial: 500,
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

  /** What running machines do each tick at full power (phase 3). */
  machines: {
    soilCleaner: { radius: 2, toxicityPerTick: 1 },
    irrigator: { radius: 2, moisturePerTick: 1 },
    filterStation: { riverQualityPerTick: 0.3 },
    pollenSprayer: { radius: 3 },
  },

  /** Databank: thawing a species (phase 4). */
  databank: {
    thawEnergyPerTick: 8,
    /** Ticks of thawing at full power. */
    thawTicks: 20,
    /** Material per tile when planting a species. */
    plantCost: 5,
  },

  /** Unlock conditions of the Databank floors (phase 4). */
  unlock: {
    fungi: { tiles: 10, belowToxicity: 60 },
    plants: { riverQuality: 40, tiles: 15, belowToxicity: 30 },
    bees: { plantTiles: 20, belowPollution: 40 },
  },

  /** Living species (phase 4). Chances are per tick and per neighbouring tile. */
  species: {
    fungi: {
      /** Fungi work only on tiles with toxicity below this. */
      maxToxicity: 70,
      toxicityPerTick: 0.5,
      spreadChance: 0.02,
    },
    plants: {
      maxToxicity: 30,
      minMoisture: 40,
      /** Growth level 0–100 of a freshly planted or spread tile. */
      startLevel: 30,
      growthPerTick: 1,
      /** Decline per tick when the tile is too toxic or too dry. */
      wiltPerTick: 0.5,
      /** Only tiles at least this grown can spread. */
      spreadMinLevel: 50,
      spreadChance: 0.05,
      /** River quality added per tick by one fully grown tile on the river bank. */
      riverQualityPerBankTile: 0.02,
    },
    bees: {
      /** Population of a freshly released hive. */
      startPopulation: 10,
      /** Population the plants can feed: this many per plant tile, max 100. */
      populationPerPlantTile: 2,
      /** Change per tick toward that level. */
      growthPerTick: 0.3,
      /** Pollination radius around a hive: base + population / perRadius. */
      baseRadius: 1,
      populationPerRadius: 25,
    },
  },

  /** Air pollution and its consequences (phase 5). */
  pollution: {
    /** Added per tick by each running coal plant. */
    coalPlantPerTick: 0.4,
    /** Natural decrease per tick. */
    decayPerTick: 0.05,
    /** Decrease per tick for each tile with plants. */
    perPlantTile: 0.002,
    /** Above this the ghost warns (repeatable, at most once per warningRepeatTicks). */
    warningAbove: 40,
    warningRepeatTicks: 100,
    /** Above this acid rain falls. */
    acidRainAbove: 50,
  },

  /** Effects of acid rain while pollution is above pollution.acidRainAbove. */
  acidRain: {
    /** Share of bees lost per tick (0.03 = 3 %). */
    beeLossPerTick: 0.03,
    /** Plants without pollination stop growing and lose this much per tick. */
    plantWiltPerTick: 0.3,
    /** Toxicity added per tick to every land tile. */
    toxicityPerTick: 0.05,
  },

  /** Local soil contamination around a running coal plant (phase 5). */
  coalSoil: {
    /** Toxicity per tick on the plant's tile and its direct neighbours. */
    near: 1.5,
    /** Toxicity per tick two tiles away. */
    far: 0.75,
  },

  /** Win condition (phase 6). */
  win: {
    /** Required self-sufficiency, 0–1. */
    selfSufficiency: 0.95,
    /** Ticks the biome must stay stable (river, bees and plants not falling). */
    stableTicks: 60,
  },

  /** Saving to the browser (phase 6). */
  save: {
    /** Autosave every this many ticks. */
    everyTicks: 10,
  },

  /** Natural processes that run without the player (phase 3). */
  environment: {
    /**
     * Moisture drifts back toward the tile's natural level (set by distance
     * from the river) by this much per tick: extra water evaporates.
     */
    moistureDriftPerTick: 0.05,
    /** River quality slowly falls back toward its starting level. */
    riverQualityDecayPerTick: 0.02,
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
