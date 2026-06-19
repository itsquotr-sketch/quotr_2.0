import type { ProductivityRate } from "@/lib/estimate/types";

const BENCHMARK_PRODUCTIVITY: Record<string, ProductivityRate> = {
  "deck.base_labour_hours_per_m2": {
    key: "deck.base_labour_hours_per_m2",
    label: "Deck base labour",
    hoursPerUnit: 1.2,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "deck.elevated_extra_hours_per_m2": {
    key: "deck.elevated_extra_hours_per_m2",
    label: "Elevated deck extra labour",
    hoursPerUnit: 0.25,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "deck.demolition_hours_per_m2": {
    key: "deck.demolition_hours_per_m2",
    label: "Existing deck removal",
    hoursPerUnit: 0.35,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "deck.balustrade_hours_per_lm": {
    key: "deck.balustrade_hours_per_lm",
    label: "Balustrade labour",
    hoursPerUnit: 0.8,
    unit: "lm",
    sourceLabel: "Benchmark productivity",
  },
  "pergola.base_labour_hours_per_m2": {
    key: "pergola.base_labour_hours_per_m2",
    label: "Pergola base labour",
    hoursPerUnit: 0.9,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "pergola.roofing_hours_per_m2": {
    key: "pergola.roofing_hours_per_m2",
    label: "Pergola roofing labour",
    hoursPerUnit: 0.35,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "retaining_wall.base_labour_hours_per_face_m2": {
    key: "retaining_wall.base_labour_hours_per_face_m2",
    label: "Retaining wall base labour",
    hoursPerUnit: 2.0,
    unit: "face m²",
    sourceLabel: "Benchmark productivity",
  },
  "retaining_wall.excavation_hours_per_face_m2": {
    key: "retaining_wall.excavation_hours_per_face_m2",
    label: "Retaining wall excavation",
    hoursPerUnit: 0.6,
    unit: "face m²",
    sourceLabel: "Benchmark productivity",
  },
  "retaining_wall.drainage_hours_per_m": {
    key: "retaining_wall.drainage_hours_per_m",
    label: "Retaining wall drainage",
    hoursPerUnit: 0.4,
    unit: "m",
    sourceLabel: "Benchmark productivity",
  },
  "external_stairs.labour_hours_per_riser": {
    key: "external_stairs.labour_hours_per_riser",
    label: "External stair labour",
    hoursPerUnit: 1.5,
    unit: "riser",
    sourceLabel: "Benchmark productivity",
  },
  "external_stairs.handrail_hours_allowance": {
    key: "external_stairs.handrail_hours_allowance",
    label: "Handrail labour allowance",
    hoursPerUnit: 3,
    unit: "allowance",
    sourceLabel: "Benchmark productivity",
  },
  "fence.labour_hours_per_lm": {
    key: "fence.labour_hours_per_lm",
    label: "Fence labour",
    hoursPerUnit: 0.6,
    unit: "lm",
    sourceLabel: "Benchmark productivity",
  },
  "fence.gate_hours_allowance": {
    key: "fence.gate_hours_allowance",
    label: "Gate labour allowance",
    hoursPerUnit: 2,
    unit: "allowance",
    sourceLabel: "Benchmark productivity",
  },
  "fence.demolition_hours_per_lm": {
    key: "fence.demolition_hours_per_lm",
    label: "Fence removal labour",
    hoursPerUnit: 0.25,
    unit: "lm",
    sourceLabel: "Benchmark productivity",
  },
  "demolition.labour_hours_per_m2": {
    key: "demolition.labour_hours_per_m2",
    label: "Demolition labour",
    hoursPerUnit: 0.35,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "bathroom.labour_hours_per_m2": {
    key: "bathroom.labour_hours_per_m2",
    label: "Bathroom labour",
    hoursPerUnit: 22,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "bathroom.demolition_hours_allowance": {
    key: "bathroom.demolition_hours_allowance",
    label: "Bathroom demolition",
    hoursPerUnit: 8,
    unit: "allowance",
    sourceLabel: "Benchmark productivity",
  },
  "bathroom.waterproofing_hours_allowance": {
    key: "bathroom.waterproofing_hours_allowance",
    label: "Bathroom waterproofing",
    hoursPerUnit: 6,
    unit: "allowance",
    sourceLabel: "Benchmark productivity",
  },
  "bathroom.tiling_hours_per_m2": {
    key: "bathroom.tiling_hours_per_m2",
    label: "Bathroom tiling",
    hoursPerUnit: 2.0,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "kitchen.labour_hours_per_m2": {
    key: "kitchen.labour_hours_per_m2",
    label: "Kitchen labour",
    hoursPerUnit: 16,
    unit: "m²",
    sourceLabel: "Benchmark productivity",
  },
  "kitchen.demolition_hours_allowance": {
    key: "kitchen.demolition_hours_allowance",
    label: "Kitchen demolition",
    hoursPerUnit: 8,
    unit: "allowance",
    sourceLabel: "Benchmark productivity",
  },
  "kitchen.cabinetry_hours_allowance": {
    key: "kitchen.cabinetry_hours_allowance",
    label: "Kitchen cabinetry labour",
    hoursPerUnit: 20,
    unit: "allowance",
    sourceLabel: "Benchmark productivity",
  },
  "kitchen.benchtop_hours_allowance": {
    key: "kitchen.benchtop_hours_allowance",
    label: "Kitchen benchtop labour",
    hoursPerUnit: 6,
    unit: "allowance",
    sourceLabel: "Benchmark productivity",
  },
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
    sourceLabel: "Benchmark productivity",
  };
}
