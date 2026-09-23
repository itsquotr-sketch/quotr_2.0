/**
 * EST-BENCHMARK-01A — existing condition → productivity adjustment paths.
 *
 * Do not invent multipliers. Map each consumed condition onto the existing
 * getCombinedLabourAccessFactor / getLabourAdjustmentParts rule, or record
 * that the condition is captured with no hours effect in V1.
 */

export const PROJECT_CONDITION_PRODUCTIVITY_PATHS = [
  {
    condition: "site_access",
    operations: "All in-house labour on consuming Work Areas",
    existingRule:
      "getLabourAdjustmentParts.accessAddend: Difficult/restricted/very poor +0.10; Moderate +0.05; Easy 0. Composed in getCombinedLabourAccessFactor (cap 1.35).",
    ceilings: "applied via commercializeCeilings labour hours",
    internalWalls: "applied via calculateInternalWalls accessFactor on framing/lining hours",
    doors: "applied via commercializeDoors labour hours (shared getCombinedLabourAccessFactor; no Doors-specific multiplier)",
    flooring: "applied via commercializeFlooring labour hours (shared getCombinedLabourAccessFactor; no Flooring-specific multiplier)",
    quantityEffect: "none",
  },
  {
    condition: "material_carry_distance",
    operations: "In-house labour that moves incoming materials",
    existingRule:
      "parseCarryDistanceCategory: short ≤10 m +0; moderate 10–30 m or unknown +0.05; long >30 m +0.10. getLabourAdjustmentParts.carryAddend.",
    ceilings: "applied via getCombinedLabourAccessFactor",
    internalWalls: "applied via getCombinedLabourAccessFactor (explains hosted hours > raw hours)",
    doors: "applied via getCombinedLabourAccessFactor",
    flooring: "applied via getCombinedLabourAccessFactor",
    quantityEffect: "none — material quantities unchanged",
  },
  {
    condition: "occupied_site",
    operations: "On-site labour",
    existingRule: "isOccupiedSiteRestriction → occupiedAddend +0.05",
    ceilings: "applied via getCombinedLabourAccessFactor",
    internalWalls: "applied via getCombinedLabourAccessFactor",
    doors: "applied via getCombinedLabourAccessFactor",
    flooring: "applied via getCombinedLabourAccessFactor",
    quantityEffect: "none",
  },
  {
    condition: "working_hours",
    operations: "On-site labour",
    existingRule: "isWorkingHoursRestriction → hoursAddend +0.05",
    ceilings: "applied via getCombinedLabourAccessFactor",
    internalWalls: "applied via getCombinedLabourAccessFactor",
    doors: "applied via getCombinedLabourAccessFactor",
    flooring: "applied via getCombinedLabourAccessFactor",
    quantityEffect: "none",
  },
  {
    condition: "site_slope",
    operations: "Outdoor labour",
    existingRule: "slopeAddend +0.05 when sloped. Interior Ceilings/IW do not consume this.",
    ceilings: "not consumed",
    internalWalls: "not consumed",
    doors: "not consumed as a Doors-specific rule; shared labour factor may still include slope when present",
    flooring: "not consumed as a Flooring-specific rule; shared labour factor may still include slope when present",
    quantityEffect: "none",
  },
  {
    condition: "high_level_access",
    operations: "none in V1 hours",
    existingRule:
      "Captured and disclosed only. No existing working-height hours multiplier. Do not silently price 4.8 m work as 2.4 m labour.",
    ceilings: "Ready-relevant when portion height_m > 3.0. No invented hours factor.",
    internalWalls: "Ready-relevant when wall height_m > 3.0. No invented hours factor.",
    doors: "Not consumed. No invented Doors working-height hours factor.",
    flooring: "Not consumed. No invented Flooring working-height hours factor.",
    quantityEffect: "none",
  },
] as const;
