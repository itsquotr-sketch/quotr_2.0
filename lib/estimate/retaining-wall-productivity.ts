/**
 * RETAINING-WALL-MATURITY-1A — productivity slots.
 * Catalogue identities only. No invented hour benchmarks.
 */

export const RW_PRODUCTIVITY_KEYS = {
  excavationM3: "retaining_wall.excavation.hours_per_m3",
  backfillM3: "retaining_wall.backfill.hours_per_m3",
  timberPilesEa: "retaining_wall.timber.piles.install.hours_per_ea",
  timberFaceM2: "retaining_wall.timber.face_boards.install.hours_per_m2",
  sleeperPostsEa: "retaining_wall.sleeper.posts.install.hours_per_ea",
  sleeperConcreteHole: "retaining_wall.sleeper.concrete.place.hours_per_hole",
  sleeperFaceM2: "retaining_wall.sleeper.sleepers.install.hours_per_m2",
  masonrySubbaseM2: "retaining_wall.masonry.subbase.compact.hours_per_m2",
  masonryFootingM3: "retaining_wall.masonry.footing.concrete.hours_per_m3",
  masonryRebarLm: "retaining_wall.masonry.rebar.install.hours_per_lm",
  masonryBlockM2: "retaining_wall.masonry.block_lay.hours_per_m2",
  masonryCoreFillM3: "retaining_wall.masonry.core_fill.hours_per_m3",
  masonryWaterproofM2: "retaining_wall.masonry.waterproofing.hours_per_m2",
} as const;

export const RW_PRODUCTIVITY_UNITS: Record<
  (typeof RW_PRODUCTIVITY_KEYS)[keyof typeof RW_PRODUCTIVITY_KEYS],
  "m3" | "m2" | "ea" | "lm" | "hole"
> = {
  [RW_PRODUCTIVITY_KEYS.excavationM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.backfillM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.timberPilesEa]: "ea",
  [RW_PRODUCTIVITY_KEYS.timberFaceM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.sleeperPostsEa]: "ea",
  [RW_PRODUCTIVITY_KEYS.sleeperConcreteHole]: "hole",
  [RW_PRODUCTIVITY_KEYS.sleeperFaceM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.masonrySubbaseM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.masonryFootingM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.masonryRebarLm]: "lm",
  [RW_PRODUCTIVITY_KEYS.masonryBlockM2]: "m2",
  [RW_PRODUCTIVITY_KEYS.masonryCoreFillM3]: "m3",
  [RW_PRODUCTIVITY_KEYS.masonryWaterproofM2]: "m2",
};
