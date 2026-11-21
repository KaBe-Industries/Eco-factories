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
  },

  time: {
    /** Real milliseconds per tick at speed 1×. */
    msPerTick: 1000,
    /** Available speed multipliers (0 = paused). */
    speeds: [0, 1, 3] as const,
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
} as const;

export type Config = typeof config;
