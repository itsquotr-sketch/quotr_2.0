/**
 * Setup / onboarding starter rate rows (Stage 3.1C.3-R2C).
 *
 * Primary onboarding:
 * - Core labour (carpenter required commercially; labourer optional)
 * - Component rates actually consumed by calculators for preferred work types
 *
 * Generic scope.* package rates are LEGACY — retained for data compatibility
 * but excluded from primary buildStarterRateRows.
 */

import {
  MATERIAL_RATE_CATALOGUE,
  SCOPE_RATE_CATALOGUE,
} from "@/lib/rates/catalogue";
import type { RateCatalogueEntry } from "@/lib/rates/types";

export type StarterRateField = "cost_rate" | "sell_rate" | "markup_percent";

export type StarterRateSection =
  | "labour"
  | "component"
  | "legacy_scope";

export type StarterRateRowDefinition = {
  item_key: string;
  rate_type: string;
  trade?: string;
  work_area_type?: string;
  label: string;
  unit: string;
  fields: StarterRateField[];
  section: StarterRateSection;
  description?: string;
  /** Catalogue benchmark hint — display only until user adopts. */
  benchmarkCost?: number;
  benchmarkSell?: number;
  authorityHint?: "explicit" | "benchmark" | "legacy";
};

export type EnabledWorkAreaInput = {
  work_area_type: string;
  enabled: boolean;
};

/** Core labour — primary onboarding. */
export const CORE_LABOUR_STARTER_RATES: StarterRateRowDefinition[] = [
  {
    item_key: "labour.carpenter.hour",
    rate_type: "labour",
    trade: "carpenter",
    label: "Carpenter / builder",
    unit: "hour",
    fields: ["cost_rate", "sell_rate"],
    section: "labour",
    description:
      "Primary trade rate Quotr uses for most in-house labour estimates.",
    benchmarkCost: 60,
    benchmarkSell: 90,
    authorityHint: "explicit",
  },
  {
    item_key: "labour.labourer.hour",
    rate_type: "labour",
    trade: "labourer",
    label: "Labourer",
    unit: "hour",
    fields: ["cost_rate", "sell_rate"],
    section: "labour",
    description:
      "Optional. Current calculators use carpenter/builder labour; this is for your records and future use.",
    benchmarkCost: 40,
    benchmarkSell: 65,
    authorityHint: "explicit",
  },
];

/**
 * Legacy generic package rates — NOT primary onboarding.
 * Preserved for existing data / Advanced Rates UI.
 */
export const LEGACY_SCOPE_STARTER_RATES: Record<
  string,
  StarterRateRowDefinition
> = {
  deck: {
    item_key: "scope.deck.m2",
    rate_type: "scope",
    work_area_type: "deck",
    label: "Deck overall benchmark ($/m²)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
    description:
      "Overall package benchmark — not used by detailed Deck calculators today.",
  },
  retaining_wall: {
    item_key: "scope.retaining_wall.m2",
    rate_type: "scope",
    work_area_type: "retaining_wall",
    label: "Retaining wall overall benchmark ($/m² face)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  bathroom: {
    item_key: "scope.bathroom.m2",
    rate_type: "scope",
    work_area_type: "bathroom",
    label: "Bathroom overall benchmark ($/m²)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  kitchen: {
    item_key: "scope.kitchen.m2",
    rate_type: "scope",
    work_area_type: "kitchen",
    label: "Kitchen overall benchmark ($/m²)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  fence: {
    item_key: "scope.fence.lm",
    rate_type: "scope",
    work_area_type: "fence",
    label: "Fence overall benchmark ($/lm)",
    unit: "lm",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  pergola: {
    item_key: "scope.pergola.m2",
    rate_type: "scope",
    work_area_type: "pergola",
    label: "Pergola overall benchmark ($/m²)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  demolition: {
    item_key: "scope.demolition.hour",
    rate_type: "scope",
    work_area_type: "demolition",
    label: "Demolition overall benchmark ($/hr)",
    unit: "hour",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  internal_walls: {
    item_key: "scope.internal_walls.m2",
    rate_type: "scope",
    work_area_type: "internal_walls",
    label: "Internal walls overall benchmark ($/m²)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  ceilings: {
    item_key: "scope.ceilings.m2",
    rate_type: "scope",
    work_area_type: "ceilings",
    label: "Ceilings overall benchmark ($/m²)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  doors: {
    item_key: "scope.doors.each",
    rate_type: "scope",
    work_area_type: "doors",
    label: "Doors overall benchmark (each)",
    unit: "each",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  flooring: {
    item_key: "scope.flooring.m2",
    rate_type: "scope",
    work_area_type: "flooring",
    label: "Flooring overall benchmark ($/m²)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
  painting: {
    item_key: "scope.painting.m2",
    rate_type: "scope",
    work_area_type: "painting",
    label: "Painting overall benchmark ($/m²)",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "legacy_scope",
    authorityHint: "legacy",
  },
};

/** @deprecated Use LEGACY_SCOPE_STARTER_RATES — kept for verify/compat imports. */
export const SCOPE_STARTER_RATES = LEGACY_SCOPE_STARTER_RATES;

function catalogueToComponentRow(
  entry: RateCatalogueEntry
): StarterRateRowDefinition {
  return {
    item_key: entry.item_key,
    rate_type: entry.rate_type,
    trade: entry.trade,
    work_area_type: entry.work_area_type,
    label: entry.label,
    unit: entry.unit,
    fields: ["cost_rate", "sell_rate"],
    section: "component",
    description: entry.description,
    benchmarkCost: entry.defaultCostRate,
    benchmarkSell: entry.defaultSellRate,
    authorityHint: "benchmark",
  };
}

/**
 * Component rates Quotr calculators actually consume for a work type.
 * Prefer recommended + used_now; cap per work type for Setup brevity.
 */
export function getComponentStarterRatesForWorkType(
  workAreaType: string,
  limit = 3
): StarterRateRowDefinition[] {
  return MATERIAL_RATE_CATALOGUE.filter(
    (entry) =>
      entry.work_area_type === workAreaType &&
      entry.calculatorSupport === "used_now" &&
      entry.recommended
  )
    .slice(0, limit)
    .map(catalogueToComponentRow);
}

export function buildStarterRateRows(enabledWorkAreas: EnabledWorkAreaInput[]): {
  rows: StarterRateRowDefinition[];
  preferredWorkTypes: string[];
  unsupportedTypes: string[];
} {
  const preferredWorkTypes = enabledWorkAreas
    .filter((area) => area.enabled)
    .map((area) => area.work_area_type);

  const componentRows: StarterRateRowDefinition[] = [];
  const unsupportedTypes: string[] = [];

  for (const workAreaType of preferredWorkTypes) {
    const components = getComponentStarterRatesForWorkType(workAreaType);
    if (components.length === 0) {
      unsupportedTypes.push(workAreaType);
    } else {
      componentRows.push(...components);
    }
  }

  return {
    rows: [...CORE_LABOUR_STARTER_RATES, ...componentRows],
    preferredWorkTypes,
    unsupportedTypes,
  };
}

export function isLegacyScopePackageKey(itemKey: string): boolean {
  return (
    itemKey.startsWith("scope.") ||
    SCOPE_RATE_CATALOGUE.some((entry) => entry.item_key === itemKey)
  );
}

export function formatRateUnit(unit: string): string {
  switch (unit) {
    case "m2":
      return "per m²";
    case "lm":
      return "per lineal metre";
    case "hour":
      return "per hour";
    case "each":
      return "each";
    case "allowance":
      return "allowance";
    case "riser":
      return "per riser";
    default:
      return `per ${unit}`;
  }
}
