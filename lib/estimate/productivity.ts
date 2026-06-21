import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import type { ProductivityRate } from "@/lib/estimate/types";

const PRODUCTIVITY_SOURCE = getRateSourceLabel("productivity");

function productivityEntry(
  key: string,
  label: string,
  hoursPerUnit: number,
  unit: string
): ProductivityRate {
  return {
    key,
    label,
    hoursPerUnit,
    unit,
    sourceLabel: PRODUCTIVITY_SOURCE,
  };
}

const BENCHMARK_PRODUCTIVITY: Record<string, ProductivityRate> = {
  "deck.base_labour_hours_per_m2": productivityEntry(
    "deck.base_labour_hours_per_m2",
    "Deck base labour",
    1.2,
    "m²"
  ),
  "deck.elevated_extra_hours_per_m2": productivityEntry(
    "deck.elevated_extra_hours_per_m2",
    "Elevated deck extra labour",
    0.25,
    "m²"
  ),
  "deck.demolition_hours_per_m2": productivityEntry(
    "deck.demolition_hours_per_m2",
    "Existing deck removal",
    0.35,
    "m²"
  ),
  "deck.balustrade_hours_per_lm": productivityEntry(
    "deck.balustrade_hours_per_lm",
    "Balustrade labour",
    0.8,
    "lm"
  ),
  "pergola.base_labour_hours_per_m2": productivityEntry(
    "pergola.base_labour_hours_per_m2",
    "Pergola base labour",
    0.9,
    "m²"
  ),
  "pergola.roofing_hours_per_m2": productivityEntry(
    "pergola.roofing_hours_per_m2",
    "Pergola roofing labour",
    0.35,
    "m²"
  ),
  "retaining_wall.base_labour_hours_per_face_m2": productivityEntry(
    "retaining_wall.base_labour_hours_per_face_m2",
    "Retaining wall base labour",
    2.0,
    "face m²"
  ),
  "retaining_wall.excavation_hours_per_face_m2": productivityEntry(
    "retaining_wall.excavation_hours_per_face_m2",
    "Retaining wall excavation",
    0.6,
    "face m²"
  ),
  "retaining_wall.drainage_hours_per_m": productivityEntry(
    "retaining_wall.drainage_hours_per_m",
    "Retaining wall drainage",
    0.4,
    "m"
  ),
  "external_stairs.labour_hours_per_riser": productivityEntry(
    "external_stairs.labour_hours_per_riser",
    "External stair labour",
    1.5,
    "riser"
  ),
  "external_stairs.handrail_hours_allowance": productivityEntry(
    "external_stairs.handrail_hours_allowance",
    "Handrail labour allowance",
    3,
    "allowance"
  ),
  "fence.labour_hours_per_lm": productivityEntry(
    "fence.labour_hours_per_lm",
    "Fence labour",
    0.6,
    "lm"
  ),
  "fence.gate_hours_allowance": productivityEntry(
    "fence.gate_hours_allowance",
    "Gate labour allowance",
    2,
    "allowance"
  ),
  "fence.demolition_hours_per_lm": productivityEntry(
    "fence.demolition_hours_per_lm",
    "Fence removal labour",
    0.25,
    "lm"
  ),
  "demolition.labour_hours_per_m2": productivityEntry(
    "demolition.labour_hours_per_m2",
    "Demolition labour",
    0.35,
    "m²"
  ),
  "bathroom.labour_hours_per_m2": productivityEntry(
    "bathroom.labour_hours_per_m2",
    "Bathroom labour",
    22,
    "m²"
  ),
  "bathroom.demolition_hours_allowance": productivityEntry(
    "bathroom.demolition_hours_allowance",
    "Bathroom demolition",
    8,
    "allowance"
  ),
  "bathroom.waterproofing_hours_allowance": productivityEntry(
    "bathroom.waterproofing_hours_allowance",
    "Bathroom waterproofing",
    6,
    "allowance"
  ),
  "bathroom.tiling_hours_per_m2": productivityEntry(
    "bathroom.tiling_hours_per_m2",
    "Bathroom tiling",
    2.0,
    "m²"
  ),
  "kitchen.labour_hours_per_m2": productivityEntry(
    "kitchen.labour_hours_per_m2",
    "Kitchen labour",
    16,
    "m²"
  ),
  "kitchen.demolition_hours_allowance": productivityEntry(
    "kitchen.demolition_hours_allowance",
    "Kitchen demolition",
    8,
    "allowance"
  ),
  "kitchen.cabinetry_hours_allowance": productivityEntry(
    "kitchen.cabinetry_hours_allowance",
    "Kitchen cabinetry labour",
    20,
    "allowance"
  ),
  "kitchen.benchtop_hours_allowance": productivityEntry(
    "kitchen.benchtop_hours_allowance",
    "Kitchen benchtop labour",
    6,
    "allowance"
  ),
};

export function resolveProductivity(params: {
  productivityKey: string;
  unit?: string;
  fallbackHoursPerUnit: number;
}): ProductivityRate {
  const benchmark = BENCHMARK_PRODUCTIVITY[params.productivityKey];

  if (benchmark) {
    return benchmark;
  }

  return {
    key: params.productivityKey,
    label: params.productivityKey,
    hoursPerUnit: params.fallbackHoursPerUnit,
    unit: params.unit ?? "unit",
    sourceLabel: PRODUCTIVITY_SOURCE,
  };
}
