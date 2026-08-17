/**
 * REQ-2.1 — Deck surface MaterialRequirement (shadow).
 *
 * Reuses the existing DeckingBoardLmResult + resolveDeckingBoardPricing result.
 * Does not recalculate quantity or call a second rate resolver.
 *
 * Width unknown / no physical lm: emit nothing (no fake lm takeoff).
 * Physical lm known but lm pricing unresolved: priced=false, rateSource=missing.
 */
import {
  buildMaterialRequirement,
  mapMaterialRateSourceToRequirement,
  materialRequirementTotalCost,
} from "@/lib/estimate/material-requirement";
import type { BuildUpMaterialPricing } from "@/lib/estimate/material-rate-pricing";
import type { DeckingBoardLmResult } from "@/lib/estimate/material-buildups";
import {
  getDeckBoardLmMaterialKey,
  getDeckMaterialLabel,
} from "@/lib/estimate/material-rate-keys";
import type { MaterialRequirement } from "@/lib/estimate/requirements";
import type { EstimateWorkArea } from "@/lib/estimate/types";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";

export const DECK_SURFACE_COMPONENT_KEY = "decking.surface";

export function getDeckSurfaceVariantKey(material: string | null): string {
  const normalized = material?.toLowerCase() ?? "";
  if (normalized.includes("kwila")) return "kwila";
  if (normalized.includes("composite")) return "composite";
  if (normalized.includes("hardwood")) return "hardwood";
  if (normalized.includes("pine") || normalized.includes("treated")) {
    return "treated_pine";
  }
  return "treated_pine";
}

function wasteAssumptionSource(
  settings: MaterialWastageSettings | null | undefined
): "company_preference" | "calculator_default" {
  if (
    settings?.deckingWastagePercent != null ||
    settings?.defaultMaterialWastagePercent != null
  ) {
    return "company_preference";
  }
  return "calculator_default";
}

export function maybeBuildDeckSurfaceRequirement(params: {
  workArea: EstimateWorkArea;
  material: string | null;
  materialLabel: string;
  wastagePercent: number;
  boardWidthMm: number | null;
  deckingBoardResult: DeckingBoardLmResult | null;
  deckingPricing: BuildUpMaterialPricing;
  usedLmPricing: boolean;
  materialWastageSettings: MaterialWastageSettings | null;
  factKeys: readonly string[];
}): MaterialRequirement | null {
  const physical = params.deckingBoardResult;
  if (!physical || params.boardWidthMm == null || params.boardWidthMm <= 0) {
    return null;
  }

  const priced = params.usedLmPricing;
  const rateSource = priced
    ? mapMaterialRateSourceToRequirement(params.deckingPricing.resolution.source)
    : "missing";
  const unitCost = priced ? params.deckingPricing.costRate : null;
  const totalCost =
    priced && unitCost != null
      ? materialRequirementTotalCost(physical.totalLm, unitCost)
      : null;

  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_SURFACE_COMPONENT_KEY,
    variantKey: getDeckSurfaceVariantKey(params.material),
    description: `${params.materialLabel} surface boards`,
    confidence: "medium",
    assumptions: [
      {
        key: "decking.coverage_width",
        text: "Board width used as coverage width; gaps, orientation and offcuts are not modelled.",
        source: "calculator_default",
      },
      {
        key: "decking.waste_factor",
        text: `Decking waste ${params.wastagePercent}%.`,
        source: wasteAssumptionSource(params.materialWastageSettings),
      },
    ],
    provenance: {
      calculatorSource: "deck.decking.surface",
      factKeys: [...params.factKeys],
      constraintKeys: [],
    },
    priced,
    materialKey: getDeckBoardLmMaterialKey(params.material),
    category: "DECKING",
    specification: getDeckMaterialLabel(params.material),
    baseQuantity: physical.baseLm,
    baseUnit: "lm",
    wasteFactor: params.wastagePercent / 100,
    purchaseQuantity: physical.totalLm,
    purchaseUnit: "lm",
    conversion: priced ? params.deckingPricing.conversion : undefined,
    rateSource,
    unitCost,
    totalCost,
  });
}
