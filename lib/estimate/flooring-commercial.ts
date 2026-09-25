/**
 * FLOORING-05 — cost-first nested Flooring commercialisation.
 *
 * Consumes calculateFlooringPhysical. Does not recompute quantities.
 * Hosted path: calculateFlooring → physical → this module → line items.
 * Legacy flat Flooring stays on the existing FITOUT path.
 */
import { getCombinedLabourAccessFactor } from "@/lib/estimate/adjustments";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY } from "@/lib/estimate/bathroom-identities";
import { hasTrustedPhysicalQuantity } from "@/lib/estimate/component-commercial-authority";
import {
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_CARPET_REMOVE_HOURS_LABEL,
  FLOORING_CARPET_REMOVE_LABOUR,
  FLOORING_CARPET_SUPPLY_INSTALL_LABEL,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_LABEL,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_CUSTOM_REMOVAL_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_LABEL,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_LABEL,
  FLOORING_HARDWOOD_REMOVE_LABOUR,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_LABEL,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBCONTRACT_RATE_KEYS,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_HOURS_LABEL,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_SUBSTRATE_REMOVE_HOURS_LABEL,
  FLOORING_SUBSTRATE_REMOVE_LABOUR,
  FLOORING_TILE_REMOVE_HOURS_LABEL,
  FLOORING_TILE_REMOVE_LABOUR,
  FLOORING_TILE_SUPPLY_INSTALL_LABEL,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_LABEL,
  FLOORING_VINYL_PLANK_REMOVE_LABOUR,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_LABEL,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  isOrdinaryFlooringFinishPackageKey,
} from "@/lib/estimate/flooring-identities";
import {
  flooringFramingAuthorityCost,
  isFlooringFramingAllowanceKey,
  resolveFlooringFramingAllowance,
} from "@/lib/estimate/flooring-framing-authority";
import { FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY } from "@/lib/estimate/flooring-question-copy";
import {
  FLOORING_NESTED_NOT_YET_PRICED_STATEMENT,
  FLOORING_PHYSICAL_COMPLETENESS,
  type FlooringPhysicalResult,
  type FlooringPortionPhysical,
  presentFlooringAreaM2,
} from "@/lib/estimate/flooring-physical";
import {
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE,
} from "@/lib/estimate/flooring-portions";
import {
  isFlooringProductivityKey,
  resolveFlooringProductivityHours,
} from "@/lib/estimate/flooring-productivity-authority";
import {
  resolveFlooringSubcontractRate,
  isFlooringSubcontractRateKey,
} from "@/lib/estimate/flooring-subcontract-authority";
import { round2 } from "@/lib/estimate/facts";
import {
  labourRequirementTotalCost,
  mapLabourRateSourceToRequirement,
} from "@/lib/estimate/labour-requirement";
import {
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { resolveLabourRate } from "@/lib/estimate/rates";
import { resolveMaterialRate } from "@/lib/estimate/resolve-material-rate";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  RequirementRateSource,
  SubcontractRequirement,
} from "@/lib/estimate/requirements";
import type {
  EstimateConstraint,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import { getCatalogueEntry } from "@/lib/rates/catalogue";

export const FLOORING_COMMERCIAL_COMPLETENESS = {
  COMPLETE_COMMERCIAL: "COMPLETE_COMMERCIAL",
  PRICING_REQUIRED: "PRICING_REQUIRED",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type FlooringCommercialCompleteness =
  (typeof FLOORING_COMMERCIAL_COMPLETENESS)[keyof typeof FLOORING_COMMERCIAL_COMPLETENESS];

export type FlooringCommercialResult = {
  readonly completeness: FlooringCommercialCompleteness | "empty";
  readonly requirements: readonly EstimateRequirement[];
  readonly lineItems: readonly EstimateLineItemInput[];
  readonly assumptions: readonly string[];
  readonly missingInfo: readonly string[];
};

const SUBCONTRACT_LABELS: Record<string, string> = {
  [FLOORING_CARPET_SUPPLY_INSTALL_M2]: FLOORING_CARPET_SUPPLY_INSTALL_LABEL,
  [FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2]:
    FLOORING_VINYL_PLANK_SUPPLY_INSTALL_LABEL,
  [FLOORING_TILE_SUPPLY_INSTALL_M2]: FLOORING_TILE_SUPPLY_INSTALL_LABEL,
  [FLOORING_HARDWOOD_SUPPLY_INSTALL_M2]: FLOORING_HARDWOOD_SUPPLY_INSTALL_LABEL,
  [FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2]:
    FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_LABEL,
  [FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2]:
    FLOORING_FLOOR_PREPARATION_ALLOWANCE_LABEL,
};

const FRAMING_LABELS: Record<string, string> = {
  [FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_LABEL,
  [FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_LABEL,
  [FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_LABEL,
};

const LABOUR_LABELS: Record<string, string> = {
  [FLOORING_SUBSTRATE_INSTALL_LABOUR]: FLOORING_SUBSTRATE_INSTALL_HOURS_LABEL,
  [FLOORING_SUBSTRATE_REMOVE_LABOUR]: FLOORING_SUBSTRATE_REMOVE_HOURS_LABEL,
  [FLOORING_CARPET_REMOVE_LABOUR]: FLOORING_CARPET_REMOVE_HOURS_LABEL,
  [FLOORING_VINYL_PLANK_REMOVE_LABOUR]: FLOORING_VINYL_PLANK_REMOVE_HOURS_LABEL,
  [FLOORING_TILE_REMOVE_LABOUR]: FLOORING_TILE_REMOVE_HOURS_LABEL,
  [FLOORING_HARDWOOD_REMOVE_LABOUR]: FLOORING_HARDWOOD_REMOVE_HOURS_LABEL,
};

function applicableGrossMarginPercent(
  organisationSettings: OrganisationSettings | null
): number {
  return organisationSettings?.default_margin_percent ?? 20;
}

export function flooringRequirementNestedItemId(
  requirement: Pick<EstimateRequirement, "variantKey">
): string {
  return requirement.variantKey ?? "";
}

export function flooringLineScopeKey(params: {
  workAreaId: string;
  nestedItemId: string;
  componentKey: string;
}): string {
  return `flooring:${params.workAreaId}:${params.nestedItemId}:${params.componentKey}`;
}

export function formatFlooringReviewTitle(
  portion: FlooringPortionPhysical
): string {
  const label = portion.label?.trim() || "Flooring Area";
  const area =
    portion.physicalNetAreaM2 != null
      ? presentFlooringAreaM2(portion.physicalNetAreaM2).replace(/\.0 m²$/, " m²")
      : "area unanswered";
  if (portion.specialist_kind != null) {
    const kind =
      portion.specialist_kind === "laminate"
        ? "laminate flooring"
        : portion.specialist_kind === "engineered_timber"
          ? "engineered timber flooring"
          : portion.specialist_kind === "sheet_vinyl"
            ? "sheet vinyl flooring"
            : "specialist flooring";
    return `${label} — ${area} ${kind}`;
  }
  if (portion.finish_type === "other") {
    const desc = portion.other_description?.trim() || "custom flooring";
    return `${label} — ${area} ${desc}`;
  }
  if (portion.finish_type === "carpet") {
    return `${label} — ${area} carpet`;
  }
  if (portion.finish_type === "vinyl_plank") {
    return `${label} — ${area} vinyl plank/LVT`;
  }
  if (portion.finish_type === "tile") {
    const dims =
      portion.tile?.tileWidthMm != null && portion.tile.tileLengthMm != null
        ? `, ${portion.tile.tileWidthMm} × ${portion.tile.tileLengthMm} mm`
        : "";
    return `${label} — ${area} tile${dims}`;
  }
  if (portion.finish_type === "hardwood") {
    const width =
      portion.hardwood?.boardWidthMm != null
        ? `, ${portion.hardwood.boardWidthMm} mm boards`
        : "";
    return `${label} — ${area} hardwood${width}`;
  }
  return `${label} — ${area} flooring`;
}

function portionAllowsOrdinaryPricing(
  portion: FlooringPortionPhysical | undefined
): boolean {
  if (!portion) return false;
  return portion.completeness === FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

function isFinishPackageMirror(requirement: MaterialRequirement): boolean {
  return (
    requirement.category === "FLOORING_PACKAGE" &&
    isFlooringSubcontractRateKey(requirement.componentKey)
  );
}

function mapMoneySource(source: "company" | "quotr" | "missing" | RequirementRateSource): {
  rateSource: string;
  rateSourceType: "user_rate" | "benchmark" | "missing";
} {
  if (source === "company") {
    return {
      rateSource: getRateSourceLabel("user_rate"),
      rateSourceType: "user_rate",
    };
  }
  if (source === "missing") {
    return {
      rateSource: getRateSourceLabel("missing"),
      rateSourceType: "missing",
    };
  }
  return {
    rateSource: getRateSourceLabel("benchmark"),
    rateSourceType: "benchmark",
  };
}

function packageQuantity(
  requirement: SubcontractRequirement,
  physical: readonly EstimateRequirement[]
): number | null {
  const mirror = physical.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" &&
      row.componentKey === requirement.componentKey &&
      row.variantKey === requirement.variantKey
  );
  if (!mirror) return null;
  return hasTrustedPhysicalQuantity(mirror.purchaseQuantity)
    ? mirror.purchaseQuantity
    : null;
}

function finishTakeoffNotes(portion: FlooringPortionPhysical | undefined): string | undefined {
  if (!portion) return undefined;
  if (portion.tile) {
    return `Package basis ${presentFlooringAreaM2(portion.physicalNetAreaM2 ?? 0)}. Informational ${portion.tile.wholeTileCount} whole tiles (${portion.tile.tileWidthMm} × ${portion.tile.tileLengthMm} mm). Tile count does not multiply the subcontract COST.`;
  }
  if (portion.hardwood) {
    return `Package basis ${presentFlooringAreaM2(portion.physicalNetAreaM2 ?? 0)}. Informational ${round2(portion.hardwood.linealM)} lm at ${portion.hardwood.boardWidthMm} mm board width. The lineal-metre takeoff does not multiply the subcontract COST.`;
  }
  return undefined;
}

export function priceFlooringSubcontract(params: {
  requirement: SubcontractRequirement;
  quantity: number | null;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  allowPricing: boolean;
}): SubcontractRequirement {
  const { requirement } = params;
  if (
    !params.allowPricing ||
    !isFlooringSubcontractRateKey(requirement.componentKey) ||
    !hasTrustedPhysicalQuantity(params.quantity)
  ) {
    return {
      ...requirement,
      priced: false,
      allowanceCost: null,
      quotedCost: null,
      totalCost: null,
    };
  }
  const resolved = resolveFlooringSubcontractRate({
    itemKey: requirement.componentKey,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  if (resolved.costRate == null || resolved.costRate <= 0) {
    return {
      ...requirement,
      priced: false,
      allowanceCost: null,
      quotedCost: null,
      totalCost: null,
    };
  }
  return {
    ...requirement,
    priced: true,
    allowanceCost: resolved.costRate,
    quotedCost: null,
    totalCost: round2(params.quantity! * resolved.costRate),
  };
}

export function priceFlooringMaterial(params: {
  requirement: MaterialRequirement;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  allowPricing: boolean;
}): MaterialRequirement {
  const { requirement } = params;
  if (isFinishPackageMirror(requirement)) {
    return requirement;
  }
  if (
    !params.allowPricing ||
    !hasTrustedPhysicalQuantity(requirement.purchaseQuantity)
  ) {
    return {
      ...requirement,
      priced: false,
      unitCost: null,
      totalCost: null,
      rateSource: "missing",
    };
  }
  if (isFlooringFramingAllowanceKey(requirement.componentKey)) {
    const resolved = resolveFlooringFramingAllowance({
      itemKey: requirement.componentKey,
      rates: params.rates,
      organisationSettings: params.organisationSettings,
    });
    if (resolved.costRate == null || resolved.costRate <= 0) {
      return {
        ...requirement,
        priced: false,
        unitCost: null,
        totalCost: null,
        rateSource: "missing",
      };
    }
    return {
      ...requirement,
      priced: true,
      unitCost: resolved.costRate,
      totalCost: round2(requirement.purchaseQuantity * resolved.costRate),
      rateSource: resolved.source === "company" ? "company" : "benchmark",
    };
  }
  const key = requirement.materialKey;
  if (key !== BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) {
    return {
      ...requirement,
      priced: false,
      unitCost: null,
      totalCost: null,
      rateSource: "missing",
    };
  }
  const catalogue = getCatalogueEntry(key);
  const unit = catalogue?.unit ?? requirement.purchaseUnit;
  const benchmark = catalogue?.defaultCostRate ?? 0;
  const resolved = resolveMaterialRate({
    orgRates: [...params.rates],
    materialKey: key,
    workAreaType: "flooring",
    unit,
    benchmarkCostRate: benchmark,
    organisationSettings: params.organisationSettings,
  });
  if (
    resolved.materialRateSource === "missing" ||
    !Number.isFinite(resolved.costRate) ||
    resolved.costRate <= 0
  ) {
    return {
      ...requirement,
      priced: false,
      unitCost: null,
      totalCost: null,
      rateSource: "missing",
    };
  }
  return {
    ...requirement,
    priced: true,
    unitCost: resolved.costRate,
    totalCost: round2(requirement.purchaseQuantity * resolved.costRate),
    rateSource:
      resolved.materialRateSource === "company_specific" ||
      resolved.materialRateSource === "company_scope"
        ? "company"
        : "benchmark",
  };
}

export function priceFlooringLabour(params: {
  requirement: LabourRequirement;
  rates: readonly OrganisationRate[];
  allowPricing: boolean;
  accessFactor: number;
  hourlyCost: number;
  labourSource: RequirementRateSource;
}): LabourRequirement {
  const { requirement } = params;
  const quantity = requirement.productivityBasis.quantity;
  const unit = requirement.productivityBasis.unit;
  const resolved = resolveFlooringProductivityHours({
    productivityKey: requirement.productivityBasis.key ?? "",
    quantity,
    unit,
    rates: params.rates,
  });
  const hoursTrusted =
    resolved.hoursPerUnit != null &&
    resolved.hours != null &&
    resolved.hoursPerUnit > 0;
  const priced =
    params.allowPricing &&
    hoursTrusted &&
    params.hourlyCost > 0 &&
    hasTrustedPhysicalQuantity(quantity) &&
    isFlooringProductivityKey(requirement.productivityBasis.key);
  const baseHours = priced ? round2(quantity * (resolved.hoursPerUnit ?? 0)) : 0;
  const adjustedHours = priced ? round2(baseHours * params.accessFactor) : 0;
  const totalCost = priced
    ? labourRequirementTotalCost({
        adjustedHours,
        hourlyCost: params.hourlyCost,
        hourlySell: params.hourlyCost,
      })
    : null;
  return {
    ...requirement,
    priced,
    baseHours,
    adjustedHours,
    hourlyCost: priced ? params.hourlyCost : null,
    totalCost,
    rateKey: FLOORING_CARPENTER_LABOUR_RATE_KEY,
    trade: "carpenter",
    rateProvenance: priced ? params.labourSource : "missing",
    productivityBasis: {
      ...requirement.productivityBasis,
      hoursPerUnit: resolved.hoursPerUnit ?? 0,
    },
  };
}

function missingMoneyLine(params: {
  requirement: EstimateRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  label: string;
  quantity: number;
  unit: string;
  category: EstimateLineItemInput["category"];
  itemKey?: string;
  pricingOwner: "subcontractor_allowance" | "contractor_material" | "in_house_labour";
  notes: string;
  identitySummary?: string;
}): EstimateLineItemInput {
  const nestedItemId = flooringRequirementNestedItemId(params.requirement);
  const scopeKey = flooringLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const line = createRateLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label: params.label,
    category: params.category,
    quantity: params.quantity,
    unit: params.unit,
    costRate: 0,
    sellRate: 0,
    rateSource: getRateSourceLabel("missing"),
    rateSourceType: "missing",
    itemKey: params.itemKey,
    componentKey: params.requirement.componentKey,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: params.notes,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      identitySummary: params.identitySummary,
      sellDerivedFromMargin: false,
      sellAuthority: undefined,
      costRate: undefined,
      sellRate: undefined,
    },
    {
      pricingOwner: params.pricingOwner,
      scopeKey,
      overlapGroup: `flooring.area:${nestedItemId}`,
      includedInTotal: false,
    }
  );
}

function subcontractLine(params: {
  requirement: SubcontractRequirement;
  quantity: number;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  rates: readonly OrganisationRate[];
  portion: FlooringPortionPhysical | undefined;
}): EstimateLineItemInput {
  const nestedItemId = flooringRequirementNestedItemId(params.requirement);
  const scopeKey = flooringLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const label =
    SUBCONTRACT_LABELS[params.requirement.componentKey] ??
    params.requirement.description;
  const resolved = resolveFlooringSubcontractRate({
    itemKey: params.requirement.componentKey,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  const notes = finishTakeoffNotes(params.portion);
  if (
    !params.requirement.priced ||
    params.requirement.allowanceCost == null ||
    params.requirement.totalCost == null
  ) {
    return missingMoneyLine({
      requirement: params.requirement,
      workAreaName: params.workAreaName,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      label,
      quantity: params.quantity,
      unit: "m2",
      category: "subcontractor",
      itemKey: params.requirement.componentKey,
      pricingOwner: "subcontractor_allowance",
      notes: `Pricing Required. Quantity ${params.quantity} m² remains visible.`,
      identitySummary: notes,
    });
  }
  const named = params.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key === params.requirement.componentKey &&
      rate.rate_type === "subcontractor" &&
      rate.cost_rate != null
  );
  const classified = classifyResolvedSell({
    costRate: params.requirement.allowanceCost,
    sellRate: named?.sell_rate,
    applicableGrossMarginPercent: applicableGrossMarginPercent(
      params.organisationSettings
    ),
  });
  const source = mapMoneySource(resolved.source);
  const line = createRateLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label,
    category: "subcontractor",
    quantity: params.quantity,
    unit: "m2",
    costRate: params.requirement.allowanceCost,
    sellRate: classified.sellRate,
    rateSource: source.rateSource,
    rateSourceType: source.rateSourceType,
    itemKey: params.requirement.componentKey,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: classified.sellDerivedFromMargin,
    sellAuthority: classified.sellAuthority,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes:
      notes ??
      `${params.quantity} m² × $${params.requirement.allowanceCost}/m²`,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      identitySummary: notes,
    },
    {
      pricingOwner: "subcontractor_allowance",
      scopeKey,
      overlapGroup: `flooring.area:${nestedItemId}`,
    }
  );
}

function materialOrAllowanceLine(params: {
  requirement: MaterialRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  rates: readonly OrganisationRate[];
}): EstimateLineItemInput {
  const nestedItemId = flooringRequirementNestedItemId(params.requirement);
  const scopeKey = flooringLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const framing = isFlooringFramingAllowanceKey(params.requirement.componentKey);
  const label = framing
    ? FRAMING_LABELS[params.requirement.componentKey] ??
      params.requirement.description
    : params.requirement.materialKey
      ? FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[params.requirement.materialKey] ??
        params.requirement.description
      : params.requirement.componentKey === FLOORING_CUSTOM_FINISH_COMPONENT
        ? "Custom ordinary flooring"
        : params.requirement.componentKey === FLOORING_SPECIALIST_COMPONENT
          ? "Specialist flooring supply and installation"
          : params.requirement.componentKey === FLOORING_CUSTOM_REMOVAL_COMPONENT
            ? "Custom existing-finish removal"
            : params.requirement.description;
  const category = framing ? "allowance" : "materials";
  const pricingOwner = framing
    ? "subcontractor_allowance"
    : "contractor_material";
  const source = mapMoneySource(
    params.requirement.rateSource === "company"
      ? "company"
      : params.requirement.rateSource === "missing"
        ? "missing"
        : "quotr"
  );
  const unit = framing
    ? "m2"
    : params.requirement.purchaseUnit;
  if (
    !params.requirement.priced ||
    params.requirement.unitCost == null ||
    params.requirement.totalCost == null
  ) {
    return missingMoneyLine({
      requirement: params.requirement,
      workAreaName: params.workAreaName,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      label,
      quantity: params.requirement.purchaseQuantity,
      unit,
      category,
      itemKey: framing
        ? params.requirement.componentKey
        : params.requirement.materialKey ?? undefined,
      pricingOwner,
      notes: `Pricing Required. Quantity ${params.requirement.purchaseQuantity} ${unit} remains visible.`,
      identitySummary: params.requirement.specification,
    });
  }
  const named = params.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key ===
        (framing
          ? params.requirement.componentKey
          : params.requirement.materialKey) &&
      rate.cost_rate != null &&
      (framing ? rate.rate_type === "allowance" : rate.rate_type === "material")
  );
  const classified = classifyResolvedSell({
    costRate: params.requirement.unitCost,
    sellRate: named?.sell_rate,
    applicableGrossMarginPercent: applicableGrossMarginPercent(
      params.organisationSettings
    ),
  });
  const line = createRateLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label,
    category,
    quantity: params.requirement.purchaseQuantity,
    unit,
    costRate: params.requirement.unitCost,
    sellRate: classified.sellRate,
    rateSource: source.rateSource,
    rateSourceType: source.rateSourceType,
    itemKey: framing
      ? params.requirement.componentKey
      : params.requirement.materialKey ?? undefined,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: classified.sellDerivedFromMargin,
    sellAuthority: classified.sellAuthority,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: framing
      ? `Combined allowance ${params.requirement.purchaseQuantity} m². Not timber materials and not labour hours.`
      : `Purchase ${params.requirement.purchaseQuantity} ${unit}`,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      identitySummary: params.requirement.specification,
    },
    {
      pricingOwner,
      scopeKey,
      overlapGroup: `flooring.area:${nestedItemId}`,
    }
  );
}

function labourLine(params: {
  requirement: LabourRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  labourSellRate: number;
  labourSellAuthority: ReturnType<typeof classifyResolvedSell>["sellAuthority"];
  labourSellDerived: boolean;
  accessFactor: number;
}): EstimateLineItemInput {
  const nestedItemId = flooringRequirementNestedItemId(params.requirement);
  const scopeKey = flooringLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const label =
    LABOUR_LABELS[params.requirement.componentKey] ??
    params.requirement.description;
  const qty = params.requirement.productivityBasis.quantity;
  const unit = params.requirement.productivityBasis.unit;
  if (
    !params.requirement.priced ||
    params.requirement.hourlyCost == null ||
    params.requirement.totalCost == null ||
    params.requirement.productivityBasis.hoursPerUnit <= 0
  ) {
    return missingMoneyLine({
      requirement: params.requirement,
      workAreaName: params.workAreaName,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      label,
      quantity: qty,
      unit,
      category: "labour",
      itemKey: params.requirement.productivityBasis.key ?? undefined,
      pricingOwner: "in_house_labour",
      notes: `Pricing Required productivity. Installed ${qty} ${unit}.`,
    });
  }
  const productivitySourceType =
    params.requirement.rateProvenance === "company" ? "user_rate" : "productivity";
  const line = createLabourLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label,
    quantity: qty,
    unit,
    productivityHoursPerUnit: params.requirement.productivityBasis.hoursPerUnit,
    labourCostRate: params.requirement.hourlyCost,
    labourSellRate: params.labourSellRate,
    adjustmentFactor: params.accessFactor,
    rateSource:
      params.requirement.rateProvenance === "company"
        ? getRateSourceLabel("user_rate")
        : getRateSourceLabel("productivity"),
    rateSourceType:
      params.requirement.rateProvenance === "company" ? "user_rate" : "productivity",
    itemKey: params.requirement.rateKey || FLOORING_CARPENTER_LABOUR_RATE_KEY,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: params.labourSellDerived,
    sellAuthority: params.labourSellAuthority,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    productivitySourceType,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
    },
    {
      pricingOwner: "in_house_labour",
      scopeKey,
      overlapGroup: `flooring.area:${nestedItemId}`,
    }
  );
}

function rollupCompleteness(
  physical: FlooringPhysicalResult,
  requirements: readonly EstimateRequirement[]
): FlooringCommercialCompleteness | "empty" {
  if (physical.completeness === "empty" || physical.portions.length === 0) {
    return "empty";
  }
  if (
    physical.portions.some(
      (row) =>
        row.completeness === FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
    )
  ) {
    return FLOORING_COMMERCIAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  if (
    physical.portions.every(
      (row) =>
        row.completeness === FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
    )
  ) {
    return FLOORING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  if (requirements.some((row) => !row.priced)) {
    return FLOORING_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED;
  }
  return FLOORING_COMMERCIAL_COMPLETENESS.COMPLETE_COMMERCIAL;
}

export function commercializeFlooring(params: {
  physical: FlooringPhysicalResult;
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  constraints?: readonly EstimateConstraint[];
}): FlooringCommercialResult {
  const accessFactor = getCombinedLabourAccessFactor({
    constraints: [...(params.constraints ?? [])],
  });
  const labourRate = resolveLabourRate({
    rates: [...params.rates],
    organisationSettings: params.organisationSettings,
    trade: "carpenter",
  });
  const labourSell = classifyResolvedSell({
    costRate: labourRate.costRate,
    sellRate:
      labourRate.sellAuthority === "derived_from_gross_margin"
        ? null
        : labourRate.sellRate,
    applicableGrossMarginPercent: applicableGrossMarginPercent(
      params.organisationSettings
    ),
  });
  const labourSource = mapLabourRateSourceToRequirement(labourRate.sourceType);

  const subcontract: Array<{
    requirement: SubcontractRequirement;
    quantity: number;
  }> = [];
  const materials: MaterialRequirement[] = [];
  const labour: LabourRequirement[] = [];

  for (const requirement of params.physical.requirements) {
    const nestedId = flooringRequirementNestedItemId(requirement);
    const portion = params.physical.portions.find(
      (row) => row.nestedItemId === nestedId
    );
    const allowPricing = portionAllowsOrdinaryPricing(portion);
    if (requirement.kind === "subcontract") {
      const quantity = packageQuantity(requirement, params.physical.requirements);
      subcontract.push({
        requirement: priceFlooringSubcontract({
          requirement,
          quantity,
          rates: params.rates,
          organisationSettings: params.organisationSettings,
          allowPricing,
        }),
        quantity: quantity ?? 0,
      });
      continue;
    }
    if (requirement.kind === "material") {
      if (isFinishPackageMirror(requirement)) continue;
      materials.push(
        priceFlooringMaterial({
          requirement,
          rates: params.rates,
          organisationSettings: params.organisationSettings,
          allowPricing,
        })
      );
      continue;
    }
    if (requirement.kind !== "labour") continue;
    labour.push(
      priceFlooringLabour({
        requirement,
        rates: params.rates,
        allowPricing,
        accessFactor,
        hourlyCost: labourRate.costRate,
        labourSource,
      })
    );
  }

  const requirements: EstimateRequirement[] = [
    ...subcontract.map((row) => row.requirement),
    ...materials,
    ...labour,
  ];
  const lineItems: EstimateLineItemInput[] = [];
  let sort = 1;
  for (const row of subcontract) {
    const nestedId = flooringRequirementNestedItemId(row.requirement);
    lineItems.push(
      subcontractLine({
        requirement: row.requirement,
        quantity: row.quantity,
        workAreaName: params.workArea.name,
        sortOrder: sort++,
        organisationSettings: params.organisationSettings,
        rates: params.rates,
        portion: params.physical.portions.find((item) => item.nestedItemId === nestedId),
      })
    );
  }
  for (const requirement of materials) {
    lineItems.push(
      materialOrAllowanceLine({
        requirement,
        workAreaName: params.workArea.name,
        sortOrder: sort++,
        organisationSettings: params.organisationSettings,
        rates: params.rates,
      })
    );
  }
  for (const requirement of labour) {
    lineItems.push(
      labourLine({
        requirement,
        workAreaName: params.workArea.name,
        sortOrder: sort++,
        organisationSettings: params.organisationSettings,
        labourSellRate: labourSell.sellRate,
        labourSellAuthority: labourSell.sellAuthority,
        labourSellDerived: labourSell.sellDerivedFromMargin,
        accessFactor,
      })
    );
  }

  const completeness = rollupCompleteness(params.physical, requirements);
  const missingInfo = [...params.physical.missingInfo].filter(
    (row) =>
      row !== FLOORING_NESTED_NOT_CALCULATED_MESSAGE &&
      !/canonical nested|legacy Flooring allowance path|UNSUPPORTED_SPECIALIST/i.test(
        row
      )
  );
  const pricedAny = lineItems.some(
    (item) =>
      item.rateSourceType !== "missing" && (item.recommendedCost ?? 0) > 0
  );
  if (
    !pricedAny &&
    completeness === FLOORING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
  ) {
    missingInfo.push(FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE);
  }
  if (
    completeness === FLOORING_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED ||
    completeness === FLOORING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
  ) {
    for (const requirement of requirements) {
      if (requirement.priced) continue;
      const human =
        requirement.componentKey === FLOORING_SPECIALIST_COMPONENT
          ? FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE
          : `Pricing required: ${requirement.description}`;
      if (
        /canonical nested|legacy Flooring allowance path|UNSUPPORTED_SPECIALIST|unsupported specialist/i.test(
          human
        )
      ) {
        continue;
      }
      missingInfo.push(human);
    }
  }

  const assumptions = [...params.physical.assumptions].filter(
    (row) => row !== FLOORING_NESTED_NOT_YET_PRICED_STATEMENT
  );

  return {
    completeness,
    requirements,
    lineItems,
    assumptions,
    missingInfo: [...new Set(missingInfo)],
  };
}

export function flooringFramingCommercialCost(
  itemKey: string,
  areaM2: number,
  rates: readonly OrganisationRate[] = []
): number | null {
  return flooringFramingAuthorityCost(itemKey, areaM2, rates);
}

export function isFlooringFinishPackageComponent(key: string): boolean {
  return isOrdinaryFlooringFinishPackageKey(key);
}

/**
 * Shared Pricing Required eligibility for Flooring components.
 * Incomplete Details (missing area/finish) never emit a quantity-bearing
 * requirement, so they cannot become a manual Pricing row.
 * Other Work Areas inherit cost_known persistence on updatePricingItem
 * but keep their own Quote/eligibility proofs.
 */
export function flooringComponentIsManualPricingEligible(
  componentKey: string | null | undefined
): boolean {
  const key = componentKey ?? "";
  return (
    key === FLOORING_SPECIALIST_COMPONENT ||
    key === FLOORING_CUSTOM_FINISH_COMPONENT ||
    key === FLOORING_CUSTOM_REMOVAL_COMPONENT ||
    key === FLOORING_SUBSTRATE_MATERIAL_COMPONENT ||
    isFlooringFramingAllowanceKey(key)
  );
}

export function flooringLineIsManualPricingEligible(item: {
  componentKey?: string | null;
  rateSourceType?: string | null;
  quantity?: number | null;
  recommendedCost?: number | null;
}): boolean {
  if (item.rateSourceType !== "missing") return false;
  if (item.quantity == null || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    return false;
  }
  if (item.recommendedCost != null && item.recommendedCost > 0) return false;
  return flooringComponentIsManualPricingEligible(item.componentKey);
}

export const FLOORING_ADDON_COMPONENT_KEYS = [
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
] as const;

void FLOORING_SUBCONTRACT_RATE_KEYS;
