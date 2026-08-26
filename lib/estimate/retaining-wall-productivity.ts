/**
 * RETAINING-WALL-MATURITY-1A — productivity slots.
 * Catalogue identities only. No invented hour benchmarks.
 */

export const RW_PRODUCTIVITY_KEYS = {
  excavationM3: "retaining_wall.excavation.hours_per_m3",
  /** @deprecated Prefer machine/manual keys below. Kept for legacy company rates. */
  excavationMachineM3: "retaining_wall.excavation.machine.hours_per_m3",
  excavationManualM3: "retaining_wall.excavation.manual.hours_per_m3",
  backfillM3: "retaining_wall.backfill.hours_per_m3",
  drainageLm: "retaining_wall.drainage.install.hours_per_lm",
  timberPilesEa: "retaining_wall.timber.piles.install.hours_per_ea",
  timberConcreteHole: "retaining_wall.timber.concrete.place.hours_per_hole",
  timberFaceM2: "retaining_wall.timber.face_boards.install.hours_per_m2",
  sleeperPostsEa: "retaining_wall.sleeper.posts.install.hours_per_ea",
  sleeperConcreteHole: "retaining_wall.sleeper.concrete.place.hours_per_hole",
  sleeperFaceM2: "retaining_wall.sleeper.sleepers.install.hours_per_m2",
  sleeperSleepersEa: "retaining_wall.sleeper.sleepers.install.hours_per_ea",
  masonrySubbaseM2: "retaining_wall.masonry.subbase.compact.hours_per_m2",
  masonryFootingM3: "retaining_wall.masonry.footing.concrete.hours_per_m3",
  masonryRebarLm: "retaining_wall.masonry.rebar.install.hours_per_lm",
  masonryBlockM2: "retaining_wall.masonry.block_lay.hours_per_m2",
  masonryCoreFillM3: "retaining_wall.masonry.core_fill.hours_per_m3",
  masonryWaterproofM2: "retaining_wall.masonry.waterproofing.hours_per_m2",
  plantHoursPerPile: "plant.mini_excavator.hours_per_pile",
  plantHoursPerM3: "plant.mini_excavator.hours_per_m3",
  plantSetupHours: "plant.mini_excavator.setup_hours",
  plantProductiveHoursPerDay: "plant.mini_excavator.productive_hours_per_day",
} as const;

export const RW_PRODUCTIVITY_UNITS: Record<
  (typeof RW_PRODUCTIVITY_KEYS)[keyof typeof RW_PRODUCTIVITY_KEYS],
  "m3" | "m2" | "ea" | "lm" | "hole" | "job" | "day"
> = {
  [RW_PRODUCTIVITY_KEYS.excavationM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.excavationMachineM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.excavationManualM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.backfillM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.drainageLm]: "lm",
  [RW_PRODUCTIVITY_KEYS.timberPilesEa]: "ea",
  [RW_PRODUCTIVITY_KEYS.timberConcreteHole]: "hole",
  [RW_PRODUCTIVITY_KEYS.timberFaceM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.sleeperPostsEa]: "ea",
  [RW_PRODUCTIVITY_KEYS.sleeperConcreteHole]: "hole",
  [RW_PRODUCTIVITY_KEYS.sleeperFaceM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.sleeperSleepersEa]: "ea",
  [RW_PRODUCTIVITY_KEYS.masonrySubbaseM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.masonryFootingM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.masonryRebarLm]: "lm",
  [RW_PRODUCTIVITY_KEYS.masonryBlockM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.masonryCoreFillM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.masonryWaterproofM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.plantHoursPerPile]: "ea",
  [RW_PRODUCTIVITY_KEYS.plantHoursPerM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.plantSetupHours]: "job",
  [RW_PRODUCTIVITY_KEYS.plantProductiveHoursPerDay]: "day",
};
