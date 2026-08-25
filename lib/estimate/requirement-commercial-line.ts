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
import {
  getRateSourceLabel,
  type RateSourceType,
} from "@/lib/estimate/rate-source-labels";
import type { OrganisationSettings } from "@/components/setup/types";
import type {
  LabourRequirement,
  MaterialRequirement,
  RequirementRateSource,
} from "@/lib/estimate/requirements";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

function mapRequirementRateSource(source: RequirementRateSource): {
  rateSource: string;
  rateSourceType: RateSourceType;
} {
  switch (source) {
    case "company":
      return {
        rateSource: getRateSourceLabel("user_rate"),
        rateSourceType: "user_rate",
      };
    case "project_override":
      return {
        rateSource: getRateSourceLabel("work_area_rate"),
        rateSourceType: "work_area_rate",
      };
    case "missing":
      return {
        rateSource: getRateSourceLabel("missing"),
        rateSourceType: "missing",
      };
    case "hardcoded_legacy":
      return {
        rateSource: getRateSourceLabel("fallback"),
        rateSourceType: "fallback",
      };
    default:
      return {
        rateSource: getRateSourceLabel("benchmark"),
        rateSourceType: "benchmark",
      };
  }
}

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
    sellAuthority: legacyLine.sellAuthority,
    ...buildAmounts(recommendedCost, recommendedSell, organisationSettings),
  };
}

export function adaptPricedMaterialRequirementWithoutLegacy(params: {
  requirement: MaterialRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  label?: string;
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
  const source = mapRequirementRateSource(requirement.rateSource);
  const line = createRateLineItem({
    workAreaId: requirement.workAreaId,
    workAreaName: params.workAreaName,
    label: params.label ?? "Decking",
    category: "materials",
    quantity: requirement.purchaseQuantity,
    unit: requirement.purchaseUnit,
    costRate: requirement.unitCost,
    sellRate: unitSell,
    rateSource: source.rateSource,
    rateSourceType: source.rateSourceType,
    itemKey: requirement.materialKey ?? undefined,
    componentKey: requirement.componentKey,
    sellDerivedFromMargin: true,
    sellAuthority: "derived_from_gross_margin" as const,
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

/**
 * Trusted physical quantity with no trusted rate.
 * Keeps the requirement visible as Pricing Required. Never silent $0 money.
 */
export function adaptUnpricedMaterialRequirementToEstimateLine(params: {
  requirement: MaterialRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  label?: string;
}): EstimateLineItemInput {
  const { requirement } = params;
  return createRateLineItem({
    workAreaId: requirement.workAreaId,
    workAreaName: params.workAreaName,
    label: params.label ?? requirement.description,
    category: "materials",
    quantity: requirement.purchaseQuantity,
    unit: requirement.purchaseUnit,
    costRate: 0,
    sellRate: 0,
    rateSource: getRateSourceLabel("missing"),
    rateSourceType: "missing",
    componentKey: requirement.componentKey,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: "Needs a trusted price.",
  });
}

/**
 * Known labour scope + physical driver with no trusted productivity.
 * Visible Pricing Required. Never silent 0 hours as complete labour.
 */
export function adaptUnpricedLabourRequirementToEstimateLine(params: {
  requirement: LabourRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  label?: string;
}): EstimateLineItemInput {
  const { requirement } = params;
  const qty = requirement.productivityBasis.quantity;
  const unit = requirement.productivityBasis.unit;
  return createRateLineItem({
    workAreaId: requirement.workAreaId,
    workAreaName: params.workAreaName,
    label: params.label ?? requirement.description,
    category: "labour",
    quantity: qty,
    unit,
    costRate: 0,
    sellRate: 0,
    rateSource: getRateSourceLabel("missing"),
    rateSourceType: "missing",
    componentKey: requirement.componentKey,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: `Needs productivity. ${qty} ${unit}. ${requirement.description}`,
  });
}
