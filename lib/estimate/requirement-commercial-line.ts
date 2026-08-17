/**
 * REQ-4B — MaterialRequirement → estimate line adapter.
 *
 * Cost is already resolved on the requirement. Sell uses the existing
 * commercial model (legacy sellRate / paired series, or cost-first margin).
 * Pricing still consumes estimate lines, not raw requirements.
 */
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  buildAmounts,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { requireEstimateQuantityRateMoney } from "@/lib/estimate/estimate-commercial-engine-adapter";
import type { OrganisationSettings } from "@/components/setup/types";
import type { MaterialRequirement } from "@/lib/estimate/requirements";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

export function isPricedMaterialRequirement(
  requirement: MaterialRequirement
): requirement is MaterialRequirement & {
  priced: true;
  unitCost: number;
  totalCost: number;
} {
  return (
    requirement.priced === true &&
    requirement.unitCost != null &&
    requirement.totalCost != null
  );
}

function defaultMarginPercent(
  organisationSettings: OrganisationSettings | null
): number {
  return organisationSettings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT;
}

/**
 * Replace a legacy Deck surface (or other semantic) line with requirement cost
 * while preserving existing sell-rate semantics.
 */
export function adaptPricedMaterialRequirementToEstimateLine(params: {
  requirement: MaterialRequirement;
  legacyLine: EstimateLineItemInput;
  organisationSettings: OrganisationSettings | null;
}): EstimateLineItemInput {
  const { requirement, legacyLine, organisationSettings } = params;
  if (!isPricedMaterialRequirement(requirement)) {
    throw new Error(
      "adaptPricedMaterialRequirementToEstimateLine requires a priced material requirement"
    );
  }

  const recommendedCost = requirement.totalCost;
  let recommendedSell: number;

  if (legacyLine.sellRate != null) {
    recommendedSell = requireEstimateQuantityRateMoney({
      quantity: requirement.purchaseQuantity,
      unitCost: requirement.unitCost,
      unitSell: legacyLine.sellRate,
    }).recommendedSell;
  } else {
    const derived = requireEstimateQuantityRateMoney({
      quantity: requirement.purchaseQuantity,
      unitCost: requirement.unitCost,
      unitSell: requirement.unitCost / (1 - defaultMarginPercent(organisationSettings) / 100),
    });
    recommendedSell = derived.recommendedSell;
  }

  return {
    ...legacyLine,
    componentKey: requirement.componentKey,
    category: legacyLine.category === "materials" ? "materials" : "materials",
    quantity: requirement.purchaseQuantity,
    unit: requirement.purchaseUnit,
    costRate: requirement.unitCost,
    sellRate: legacyLine.sellRate,
    sellDerivedFromMargin: legacyLine.sellDerivedFromMargin,
    ...buildAmounts(recommendedCost, recommendedSell, organisationSettings),
  };
}

export function adaptPricedMaterialRequirementWithoutLegacy(params: {
  requirement: MaterialRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
}): EstimateLineItemInput {
  const { requirement, organisationSettings } = params;
  if (!isPricedMaterialRequirement(requirement)) {
    throw new Error(
      "adaptPricedMaterialRequirementWithoutLegacy requires a priced material requirement"
    );
  }

  const margin = defaultMarginPercent(organisationSettings);
  const unitSell =
    requirement.unitCost / (1 - margin / 100);
  const line = createRateLineItem({
    workAreaId: requirement.workAreaId,
    workAreaName: params.workAreaName,
    label: "Decking materials",
    category: "materials",
    quantity: requirement.purchaseQuantity,
    unit: requirement.purchaseUnit,
    costRate: requirement.unitCost,
    sellRate: unitSell,
    rateSource: requirement.rateSource,
    componentKey: requirement.componentKey,
    sellDerivedFromMargin: true,
    sortOrder: params.sortOrder,
    organisationSettings,
  });

  return {
    ...line,
    ...buildAmounts(
      requirement.totalCost,
      line.recommendedSell,
      organisationSettings
    ),
    costRate: requirement.unitCost,
  };
}
