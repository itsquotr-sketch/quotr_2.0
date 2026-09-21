/**
 * DOORS-05 — cost-first nested Doors commercialisation.
 *
 * Consumes calculateDoorsPhysical. Does not recompute quantities.
 * Hosted path: calculateDoors → physical → this module → line items.
 * Legacy flat Doors stay on the existing fitout allowance path.
 */
import { getCombinedLabourAccessFactor } from "@/lib/estimate/adjustments";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { hasTrustedPhysicalQuantity } from "@/lib/estimate/component-commercial-authority";
import {
  DOORS_CARPENTER_LABOUR_RATE_KEY,
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_HARDWARE_INSTALL_LABEL,
  DOORS_HARDWARE_INSTALL_LABOUR,
  DOORS_HARDWARE_STANDARD_KEY,
  DOORS_HARDWARE_STANDARD_LABEL,
  DOORS_LEAF_HOLLOW_CORE_KEY,
  DOORS_LEAF_HOLLOW_CORE_LABEL,
  DOORS_LEAF_SOLID_CORE_KEY,
  DOORS_LEAF_SOLID_CORE_LABEL,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_HOLLOW_CORE_SET_LABEL,
  DOORS_PREHUNG_INSTALL_LABEL,
  DOORS_PREHUNG_INSTALL_LABOUR,
  DOORS_PREHUNG_SOLID_CORE_SET_KEY,
  DOORS_PREHUNG_SOLID_CORE_SET_LABEL,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABEL,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR,
  DOORS_SPECIALIST_COMPONENT,
  isOrdinaryDoorsMaterialKey,
} from "@/lib/estimate/doors-identities";
import {
  resolveDoorsProductivityHours,
} from "@/lib/estimate/doors-productivity";
import {
  DOOR_PHYSICAL_COMPLETENESS,
  type DoorPhysicalResult,
  type DoorPortionPhysical,
  summariseDoorPhysicalPortion,
} from "@/lib/estimate/doors-physical";
import { DOORS_NESTED_NOT_CALCULATED_MESSAGE } from "@/lib/estimate/doors-portions";
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
} from "@/lib/estimate/requirements";
import type {
  EstimateConstraint,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import { getCatalogueEntry } from "@/lib/rates/catalogue";

export const DOOR_COMMERCIAL_COMPLETENESS = {
  COMPLETE_COMMERCIAL: "COMPLETE_COMMERCIAL",
  PRICING_REQUIRED: "PRICING_REQUIRED",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type DoorCommercialCompleteness =
  (typeof DOOR_COMMERCIAL_COMPLETENESS)[keyof typeof DOOR_COMMERCIAL_COMPLETENESS];

export type DoorCommercialResult = {
  readonly completeness: DoorCommercialCompleteness | "empty";
  readonly requirements: readonly EstimateRequirement[];
  readonly lineItems: readonly EstimateLineItemInput[];
  readonly assumptions: readonly string[];
  readonly missingInfo: readonly string[];
};

const MATERIAL_LABELS: Record<string, string> = {
  [DOORS_LEAF_HOLLOW_CORE_KEY]: DOORS_LEAF_HOLLOW_CORE_LABEL,
  [DOORS_LEAF_SOLID_CORE_KEY]: DOORS_LEAF_SOLID_CORE_LABEL,
  [DOORS_PREHUNG_HOLLOW_CORE_SET_KEY]: DOORS_PREHUNG_HOLLOW_CORE_SET_LABEL,
  [DOORS_PREHUNG_SOLID_CORE_SET_KEY]: DOORS_PREHUNG_SOLID_CORE_SET_LABEL,
  [DOORS_HARDWARE_STANDARD_KEY]: DOORS_HARDWARE_STANDARD_LABEL,
};

const LABOUR_LABELS: Record<string, string> = {
  [DOORS_PREHUNG_INSTALL_LABOUR]: DOORS_PREHUNG_INSTALL_LABEL,
  [DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR]: DOORS_REPLACEMENT_LEAF_INSTALL_LABEL,
  [DOORS_HARDWARE_INSTALL_LABOUR]: DOORS_HARDWARE_INSTALL_LABEL,
};

function applicableGrossMarginPercent(
  organisationSettings: OrganisationSettings | null
): number {
  return organisationSettings?.default_margin_percent ?? 20;
}

export function doorsRequirementNestedItemId(
  requirement: Pick<EstimateRequirement, "variantKey">
): string {
  return requirement.variantKey ?? "";
}

export function doorsLineScopeKey(params: {
  workAreaId: string;
  nestedItemId: string;
  componentKey: string;
}): string {
  return `doors:${params.workAreaId}:${params.nestedItemId}:${params.componentKey}`;
}

export function formatDoorsReviewTitle(portion: DoorPortionPhysical): string {
  return summariseDoorPhysicalPortion({
    id: portion.nestedItemId,
    label: portion.label,
    installation_type: portion.installation_type,
    leaf_construction: portion.leaf_construction,
    height_mm: portion.height_mm,
    width_mm: portion.width_mm,
    quantity: portion.quantity,
    hardware_included: portion.hardware_included,
    other_description: portion.other_description,
    specialist_kind: portion.specialist_kind,
  }).replace(" · ", " — ");
}

function portionAllowsOrdinaryPricing(portion: DoorPortionPhysical | undefined): boolean {
  if (!portion) return false;
  return portion.completeness === DOOR_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

function mapMaterialSource(source: RequirementRateSource): {
  rateSource: string;
  rateSourceType: ReturnType<typeof getRateSourceLabel> extends string
    ? "user_rate" | "benchmark" | "missing" | "work_area_rate" | "fallback"
    : never;
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

export function priceDoorsMaterial(params: {
  requirement: MaterialRequirement;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  allowPricing: boolean;
}): MaterialRequirement {
  const { requirement } = params;
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
  const key = requirement.materialKey;
  if (!key || !isOrdinaryDoorsMaterialKey(key)) {
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
    workAreaType: "doors",
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

export function priceDoorsLabour(params: {
  requirement: LabourRequirement;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  allowPricing: boolean;
  accessFactor: number;
  hourlyCost: number;
  labourSource: RequirementRateSource;
}): LabourRequirement {
  const { requirement } = params;
  const quantity = requirement.productivityBasis.quantity;
  const unit = requirement.productivityBasis.unit;
  const resolved = resolveDoorsProductivityHours({
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
    hasTrustedPhysicalQuantity(quantity);
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
    rateProvenance: priced ? params.labourSource : "missing",
    productivityBasis: {
      ...requirement.productivityBasis,
      hoursPerUnit: resolved.hoursPerUnit ?? 0,
    },
  };
}

function materialLine(params: {
  requirement: MaterialRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  rates: readonly OrganisationRate[];
}): EstimateLineItemInput {
  const nestedItemId = doorsRequirementNestedItemId(params.requirement);
  const scopeKey = doorsLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const label =
    (params.requirement.materialKey &&
      MATERIAL_LABELS[params.requirement.materialKey]) ||
    (params.requirement.componentKey === DOORS_CUSTOM_LEAF_COMPONENT
      ? "Custom internal door leaf"
      : params.requirement.componentKey === DOORS_SPECIALIST_COMPONENT
        ? "Unsupported specialist door"
        : params.requirement.description);
  const source = mapMaterialSource(params.requirement.rateSource);
  const catalogueUnit = params.requirement.materialKey
    ? getCatalogueEntry(params.requirement.materialKey)?.unit
    : undefined;
  const unit = catalogueUnit ?? params.requirement.purchaseUnit;
  if (
    !params.requirement.priced ||
    params.requirement.unitCost == null ||
    params.requirement.totalCost == null
  ) {
    const line = createRateLineItem({
      workAreaId: params.requirement.workAreaId,
      workAreaName: params.workAreaName,
      label,
      category: "materials",
      quantity: params.requirement.purchaseQuantity,
      unit,
      costRate: 0,
      sellRate: 0,
      rateSource: source.rateSource,
      rateSourceType: "missing",
      itemKey: params.requirement.materialKey ?? undefined,
      componentKey: params.requirement.componentKey,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      notes: `Pricing Required. Quantity ${params.requirement.purchaseQuantity} ${unit} remains visible.`,
    });
    return withPricingOwnership(
      {
        ...line,
        nestedItemId,
        identitySummary: params.requirement.specification,
        sellDerivedFromMargin: false,
        sellAuthority: undefined,
        costRate: undefined,
        sellRate: undefined,
      },
      {
        pricingOwner: "contractor_material",
        scopeKey,
        overlapGroup: `doors.set:${nestedItemId}`,
      }
    );
  }
  const named = params.requirement.materialKey
    ? params.rates.find(
        (rate) =>
          rate.active &&
          rate.item_key === params.requirement.materialKey &&
          rate.rate_type === "material" &&
          rate.cost_rate != null
      )
    : undefined;
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
    category: "materials",
    quantity: params.requirement.purchaseQuantity,
    unit,
    costRate: params.requirement.unitCost,
    sellRate: classified.sellRate,
    rateSource: source.rateSource,
    rateSourceType: source.rateSourceType,
    itemKey: params.requirement.materialKey ?? undefined,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: classified.sellDerivedFromMargin,
    sellAuthority: classified.sellAuthority,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: `Purchase ${params.requirement.purchaseQuantity} ${unit} · installed ${params.requirement.baseQuantity} ${params.requirement.baseUnit}`,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      identitySummary: params.requirement.specification,
    },
    {
      pricingOwner: "contractor_material",
      scopeKey,
      overlapGroup: `doors.set:${nestedItemId}`,
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
  const nestedItemId = doorsRequirementNestedItemId(params.requirement);
  const scopeKey = doorsLineScopeKey({
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
    const line = createRateLineItem({
      workAreaId: params.requirement.workAreaId,
      workAreaName: params.workAreaName,
      label,
      category: "labour",
      quantity: qty,
      unit,
      costRate: 0,
      sellRate: 0,
      rateSource: getRateSourceLabel("missing"),
      rateSourceType: "missing",
      itemKey: params.requirement.productivityBasis.key ?? undefined,
      componentKey: params.requirement.componentKey,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      notes: `Pricing Required productivity. Installed ${qty} ${unit}.`,
    });
    return withPricingOwnership(
      {
        ...line,
        nestedItemId,
        labourHours: undefined,
        productivityRate: params.requirement.productivityBasis.hoursPerUnit,
        productivityUnit: unit,
        productivitySourceType: "missing",
        sellDerivedFromMargin: false,
        sellAuthority: undefined,
        costRate: undefined,
        sellRate: undefined,
      },
      {
        pricingOwner: "in_house_labour",
        scopeKey,
        overlapGroup: `doors.set:${nestedItemId}`,
      }
    );
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
    itemKey: params.requirement.rateKey || DOORS_CARPENTER_LABOUR_RATE_KEY,
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
      overlapGroup: `doors.set:${nestedItemId}`,
    }
  );
}

function rollupCompleteness(
  physical: DoorPhysicalResult,
  requirements: readonly EstimateRequirement[]
): DoorCommercialCompleteness | "empty" {
  if (physical.completeness === "empty" || physical.portions.length === 0) {
    return "empty";
  }
  if (
    physical.portions.some(
      (row) =>
        row.completeness === DOOR_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
    )
  ) {
    return DOOR_COMMERCIAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  if (
    physical.portions.every(
      (row) =>
        row.completeness === DOOR_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
    )
  ) {
    return DOOR_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  if (requirements.some((row) => !row.priced)) {
    return DOOR_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED;
  }
  return DOOR_COMMERCIAL_COMPLETENESS.COMPLETE_COMMERCIAL;
}

export function commercializeDoors(params: {
  physical: DoorPhysicalResult;
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  constraints?: readonly EstimateConstraint[];
}): DoorCommercialResult {
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
  const labourSource = mapLabourRateSourceToRequirement(
    labourRate.sourceType
  );

  const materials: MaterialRequirement[] = [];
  const labour: LabourRequirement[] = [];

  for (const requirement of params.physical.requirements) {
    const nestedId = doorsRequirementNestedItemId(requirement);
    const portion = params.physical.portions.find(
      (row) => row.nestedItemId === nestedId
    );
    if (requirement.kind === "material") {
      materials.push(
        priceDoorsMaterial({
          requirement,
          rates: params.rates,
          organisationSettings: params.organisationSettings,
          allowPricing: portionAllowsOrdinaryPricing(portion),
        })
      );
      continue;
    }
    if (requirement.kind !== "labour") continue;
    const allowLabour = portionAllowsOrdinaryPricing(portion);
    labour.push(
      priceDoorsLabour({
        requirement,
        rates: params.rates,
        organisationSettings: params.organisationSettings,
        allowPricing: allowLabour,
        accessFactor,
        hourlyCost: labourRate.costRate,
        labourSource,
      })
    );
  }

  const requirements: EstimateRequirement[] = [...materials, ...labour];
  const lineItems: EstimateLineItemInput[] = [];
  let sort = 1;
  for (const requirement of materials) {
    lineItems.push(
      materialLine({
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
  const missingInfo = [...params.physical.missingInfo];
  const pricedAny = lineItems.some(
    (item) =>
      item.rateSourceType !== "missing" && (item.recommendedCost ?? 0) > 0
  );
  if (!pricedAny) {
    missingInfo.push(DOORS_NESTED_NOT_CALCULATED_MESSAGE);
  }
  if (
    completeness === DOOR_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED ||
    completeness === DOOR_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
  ) {
    for (const requirement of requirements) {
      if (requirement.priced) continue;
      missingInfo.push(`Pricing required: ${requirement.description}`);
    }
  }

  const assumptions = [...params.physical.assumptions].filter(
    (row) => !/not yet commercially priced/i.test(row)
  );

  return {
    completeness,
    requirements,
    lineItems,
    assumptions,
    missingInfo: [...new Set(missingInfo)],
  };
}
