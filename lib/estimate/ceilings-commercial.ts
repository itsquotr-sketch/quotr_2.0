/**
 * CEILINGS WA-05B — commercial requirement layer.
 *
 * Consumes calculateCeilingsPhysical. Does not recalculate geometry.
 * Nested hosted estimate: calculateCeilings → physical → this module.
 * Legacy flat Ceilings stay on calculateAreaBasedFitout.
 */

import { getCombinedLabourAccessFactor } from "@/lib/estimate/adjustments";
import { PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY } from "@/lib/estimate/requirements";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  hasTrustedPhysicalQuantity,
} from "@/lib/estimate/component-commercial-authority";
import {
  aggregateSameIdentityCommercialLines,
  commercialLinesAggregationCompatible,
  defaultMergeSameIdentityCommercialLines,
} from "@/lib/estimate/commercial-aggregation";
import {
  CEILING_PHYSICAL_COMPLETENESS,
  ceilingRequirementComponentId,
  ceilingRequirementNestedItemId,
  type CeilingPhysicalResult,
  type CeilingPortionPhysical,
} from "@/lib/estimate/ceilings-physical";
import {
  CEILINGS_BULKHEAD_FRAMING_STEEL_COMPONENT,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
} from "@/lib/estimate/ceilings-bulkheads";
import {
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_STEEL_KEY,
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_TIMBER_KEY,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
  CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_FIXINGS_PLYWOOD_COMPONENT,
  CEILINGS_FIXINGS_STEEL_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_LINING_COMPONENT,
} from "@/lib/estimate/ceilings-fixings";
import { CEILINGS_TIMBER_FRAMING_COMPONENT } from "@/lib/estimate/ceilings-framing";
import {
  CEILINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_PLYWOOD_COMPONENT,
  CEILING_PLYWOOD_SHEET_KEY,
  CEILINGS_TILE_GRID_GRID_COMPONENT,
  CEILINGS_TILE_GRID_TILE_COMPONENT,
  CEILINGS_TIMBER_LINING_COMPONENT,
} from "@/lib/estimate/ceilings-lining";
import { CEILINGS_INSULATION_COMPONENT } from "@/lib/estimate/ceilings-insulation";
import { CEILING_INSULATION_THERMAL_KEY } from "@/lib/estimate/insulation-fallback";
import {
  CEILINGS_STEEL_CLIP_COMPONENT,
  CEILINGS_STEEL_FURRING_COMPONENT,
  CEILINGS_STEEL_PERIMETER_COMPONENT,
  CEILINGS_STEEL_PRIMARY_COMPONENT,
  CEILINGS_SUSPENSION_DROPPER_COMPONENT,
  CEILINGS_SUSPENSION_WIRE_COMPONENT,
} from "@/lib/estimate/ceilings-steel";
import {
  CEILINGS_BULKHEAD_FRAMING_STEEL_LABOUR,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR,
  CEILINGS_BULKHEAD_LINING_LABOUR,
  CEILINGS_DNA_COVERAGE,
  CEILINGS_GRID_LABOUR,
  CEILINGS_INSULATION_LABOUR,
  CEILINGS_PARTIAL_ESTIMATE_MESSAGE,
  CEILINGS_PLASTERBOARD_LABOUR,
  CEILINGS_PLYWOOD_LABOUR,
  CEILINGS_PRODUCTIVITY_KEYS,
  CEILINGS_SPECIALIST_COMPONENT,
  CEILINGS_STEEL_CLIP_LABOUR,
  CEILINGS_STEEL_DROPPER_LABOUR,
  CEILINGS_STEEL_FURRING_LABOUR,
  CEILINGS_STEEL_PERIMETER_LABOUR,
  CEILINGS_STEEL_PRIMARY_LABOUR,
  CEILINGS_TILE_LABOUR,
  CEILINGS_TIMBER_FRAMING_LABOUR,
  CEILINGS_TIMBER_LINING_LABOUR,
  CEILINGS_WIRE_LABOUR_DECISION,
  type CeilingLabourOperationSpec,
} from "@/lib/estimate/ceilings-identities";
import { derivedDimensionedPlasterboardCost } from "@/lib/estimate/ceilings-plasterboard-derived-cost";
import { round2 } from "@/lib/estimate/facts";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import {
  buildAmounts,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import {
  getQuotrProductivityBenchmark,
  resolveProductivity,
} from "@/lib/estimate/productivity";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { resolveLabourRate } from "@/lib/estimate/rates";
import { materialRateUnitsMatch } from "@/lib/estimate/resolve-material-rate";
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
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";

export const CEILING_COMMERCIAL_COMPLETENESS = {
  COMPLETE_COMMERCIAL: "COMPLETE_COMMERCIAL",
  PRICING_REQUIRED: "PRICING_REQUIRED",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type CeilingCommercialCompleteness =
  (typeof CEILING_COMMERCIAL_COMPLETENESS)[keyof typeof CEILING_COMMERCIAL_COMPLETENESS];

export type CeilingRateCoverageRow = {
  readonly component: string;
  readonly physicalUnit: string;
  readonly materialKey: string;
  readonly companyRateSupport: boolean;
  readonly quotrCostBenchmark: boolean;
  readonly productivityKey: string | null;
  readonly companyProductivitySupport: boolean;
  readonly quotrProductivity: boolean;
  readonly resultIfNoCompany: string;
};

export type CeilingCommercialResult = {
  readonly completeness: CeilingCommercialCompleteness | "empty";
  readonly requirements: readonly EstimateRequirement[];
  readonly lineItems: readonly EstimateLineItemInput[];
  readonly coverage: readonly CeilingRateCoverageRow[];
  readonly assumptions: readonly string[];
  readonly missingInfo: readonly string[];
  readonly wireLabourDecision: typeof CEILINGS_WIRE_LABOUR_DECISION;
  readonly dnaCoverage: typeof CEILINGS_DNA_COVERAGE;
};

const NO_LABOUR = new Set<string>([
  CEILINGS_SUSPENSION_WIRE_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_STEEL_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_FIXINGS_PLYWOOD_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_LINING_COMPONENT,
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
  CEILINGS_SPECIALIST_COMPONENT,
]);

const LABOUR_FOR_MATERIAL: Record<string, CeilingLabourOperationSpec> = {
  [CEILINGS_TIMBER_FRAMING_COMPONENT]: {
    labourComponentKey: CEILINGS_TIMBER_FRAMING_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.timberFramingLm,
    unit: "lm",
    description: "Timber ceiling framing install",
  },
  [CEILINGS_STEEL_PERIMETER_COMPONENT]: {
    labourComponentKey: CEILINGS_STEEL_PERIMETER_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.perimeterLm,
    unit: "lm",
    description: "Ceiling perimeter track install",
  },
  [CEILINGS_STEEL_PRIMARY_COMPONENT]: {
    labourComponentKey: CEILINGS_STEEL_PRIMARY_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.primaryLm,
    unit: "lm",
    description: "Ceiling primary channel install",
  },
  [CEILINGS_STEEL_FURRING_COMPONENT]: {
    labourComponentKey: CEILINGS_STEEL_FURRING_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.furringLm,
    unit: "lm",
    description: "Ceiling furring channel install",
  },
  [CEILINGS_STEEL_CLIP_COMPONENT]: {
    labourComponentKey: CEILINGS_STEEL_CLIP_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.clipEach,
    unit: "each",
    description: "Ceiling crossover clip install",
  },
  [CEILINGS_SUSPENSION_DROPPER_COMPONENT]: {
    labourComponentKey: CEILINGS_STEEL_DROPPER_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.dropperEach,
    unit: "each",
    description: "Ceiling dropper install (includes ordinary wire)",
  },
  [CEILINGS_PLASTERBOARD_COMPONENT]: {
    labourComponentKey: CEILINGS_PLASTERBOARD_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet,
    unit: "sheet",
    description: "Ceiling plasterboard install",
  },
  [CEILINGS_PLYWOOD_COMPONENT]: {
    labourComponentKey: CEILINGS_PLYWOOD_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.plywoodSheet,
    unit: "sheet",
    description: "Ceiling plywood install",
  },
  [CEILINGS_TIMBER_LINING_COMPONENT]: {
    labourComponentKey: CEILINGS_TIMBER_LINING_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.timberLiningLm,
    unit: "lm",
    description: "Ceiling timber lining install",
  },
  [CEILINGS_TILE_GRID_GRID_COMPONENT]: {
    labourComponentKey: CEILINGS_GRID_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.gridM2,
    unit: "m2",
    description: "Ceiling T-grid install",
  },
  [CEILINGS_TILE_GRID_TILE_COMPONENT]: {
    labourComponentKey: CEILINGS_TILE_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.tileEach,
    unit: "each",
    description: "Ceiling tile install",
  },
  [CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT]: {
    labourComponentKey: CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.bulkheadFramingTimberLm,
    unit: "lm",
    description: "Bulkhead timber framing install",
  },
  [CEILINGS_BULKHEAD_FRAMING_STEEL_COMPONENT]: {
    labourComponentKey: CEILINGS_BULKHEAD_FRAMING_STEEL_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.bulkheadFramingSteelLm,
    unit: "lm",
    description: "Bulkhead steel framing install",
  },
  [CEILINGS_BULKHEAD_LINING_COMPONENT]: {
    labourComponentKey: CEILINGS_BULKHEAD_LINING_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.bulkheadLiningSheet,
    unit: "sheet",
    description: "Bulkhead lining install",
  },
  [CEILINGS_INSULATION_COMPONENT]: {
    labourComponentKey: CEILINGS_INSULATION_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.insulationM2,
    unit: "m2",
    description: "Ceiling insulation install",
  },
};

const LEGACY_PACKAGE_KEYS = new Set([
  "ceiling.tile.m2",
  "scope.ceilings.m2",
]);

function quotrStartersAllowed(
  organisationSettings: OrganisationSettings | null
): boolean {
  return organisationSettings?.allow_benchmark_rates !== false;
}

/**
 * Trusted physical quantities may still resolve Quotr fallbacks when a
 * sibling nested item is INFORMATION_REQUIRED. Physical already omitted
 * untrusted quantities. Do not treat portion-level IR as a commercial
 * kill-switch for complete lining / insulation / fixings / labour.
 */
function ceilingAllowsQuotrResolution(
  portion: CeilingPortionPhysical | undefined,
  componentKey: string
): boolean {
  if (
    portion?.completeness ===
      CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    componentKey === CEILINGS_SPECIALIST_COMPONENT
  ) {
    return false;
  }
  return true;
}

function applicableGrossMarginPercent(
  organisationSettings: OrganisationSettings | null
): number {
  return organisationSettings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT;
}

export function quotrCatalogueCost(itemKey: string | null): number | null {
  if (!itemKey || LEGACY_PACKAGE_KEYS.has(itemKey)) return null;
  const entry = getCatalogueEntry(itemKey);
  if (entry?.defaultCostRate != null && entry.defaultCostRate > 0) {
    return entry.defaultCostRate;
  }
  return null;
}

export function isGenericPlywoodSpecification(
  specification: string | null | undefined
): boolean {
  const spec = (specification ?? "").trim().toLowerCase();
  if (!spec) return true;
  return (
    spec === "generic" ||
    spec === "plywood" ||
    spec === "plywood sheet" ||
    spec === "standard"
  );
}

export function quotrCeilingMaterialCost(itemKey: string | null): {
  readonly unitCost: number;
  readonly derived: ReturnType<typeof derivedDimensionedPlasterboardCost>;
} | null {
  const catalogue = quotrCatalogueCost(itemKey);
  if (catalogue != null) return { unitCost: catalogue, derived: null };
  const derived = derivedDimensionedPlasterboardCost(itemKey);
  if (derived != null) return { unitCost: derived.derivedCost, derived };
  return null;
}

function findExactMaterialRate(
  rates: readonly OrganisationRate[],
  itemKey: string,
  unit: string
): OrganisationRate | undefined {
  const matches = rates.filter(
    (rate) =>
      rate.active &&
      (rate.rate_type === "material" || rate.rate_type === "project_material") &&
      rate.item_key === itemKey &&
      rate.cost_rate != null &&
      materialRateUnitsMatch(rate.unit, unit)
  );
  return (
    matches.find((rate) => rate.rate_type === "project_material") ?? matches[0]
  );
}

function mapMaterialSourceToLine(
  source: RequirementRateSource
): { rateSource: string; rateSourceType: RateSourceType } {
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

export function priceCeilingMaterial(params: {
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
  if (!key) {
    return {
      ...requirement,
      priced: false,
      unitCost: null,
      totalCost: null,
      rateSource: "missing",
    };
  }
  const named = findExactMaterialRate(
    params.rates,
    key,
    requirement.purchaseUnit
  );
  if (named?.cost_rate != null) {
    const unitCost = Number(named.cost_rate);
    return {
      ...requirement,
      priced: true,
      unitCost,
      totalCost: round2(requirement.purchaseQuantity * unitCost),
      rateSource:
        named.rate_type === "project_material" ? "project_override" : "company",
    };
  }
  if (quotrStartersAllowed(params.organisationSettings)) {
    const skipGenericPlywood =
      key === CEILING_PLYWOOD_SHEET_KEY &&
      !isGenericPlywoodSpecification(requirement.specification);
    if (!skipGenericPlywood) {
      const catalogue = quotrCatalogueCost(key);
      if (catalogue != null) {
        return {
          ...requirement,
          priced: true,
          unitCost: catalogue,
          totalCost: round2(requirement.purchaseQuantity * catalogue),
          rateSource: "benchmark",
        };
      }
      const derived = derivedDimensionedPlasterboardCost(key);
      if (derived != null) {
        return {
          ...requirement,
          priced: true,
          unitCost: derived.derivedCost,
          totalCost: round2(requirement.purchaseQuantity * derived.derivedCost),
          rateSource: "benchmark",
          conversion: {
            from: derived.baseKey,
            to: key,
            factor: derived.ratio,
            sourceUnitCost: derived.baseCost,
            basis: derived.basis,
          },
          assumptions: [
            ...requirement.assumptions,
            {
              key: "derived_plasterboard_cost",
              text: `Quotr derived COST from ${derived.baseKey} $${derived.baseCost} × ${derived.ratio} (sheet area ${derived.targetAreaM2} / 2.88 m²). Same family and thickness only.`,
              source: "benchmark",
            },
          ],
        };
      }
    }
  }
  return {
    ...requirement,
    priced: false,
    unitCost: null,
    totalCost: null,
    rateSource: "missing",
  };
}

export function resolveCeilingProductivity(params: {
  productivityKey: string;
  unit: string;
  rates: readonly OrganisationRate[];
}): {
  hoursPerUnit: number | null;
  source: RequirementRateSource;
  sourceType: RateSourceType;
} {
  const resolved = resolveProductivity({
    productivityKey: params.productivityKey,
    unit: params.unit,
    fallbackHoursPerUnit: 0,
    rates: params.rates,
  });
  if (
    resolved.sourceType === "user_rate" ||
    resolved.sourceType === "calibrated_productivity"
  ) {
    return {
      hoursPerUnit: resolved.hoursPerUnit,
      source: "company",
      sourceType: resolved.sourceType,
    };
  }
  const quotr = getQuotrProductivityBenchmark(params.productivityKey);
  if (quotr && quotr.hoursPerUnit > 0) {
    return {
      hoursPerUnit: resolved.hoursPerUnit > 0 ? resolved.hoursPerUnit : quotr.hoursPerUnit,
      source: "benchmark",
      sourceType: "productivity",
    };
  }
  return {
    hoursPerUnit: null,
    source: "missing",
    sourceType: "missing",
  };
}

function labourForMaterial(
  requirement: MaterialRequirement,
  rates: readonly OrganisationRate[],
  hourlyCost: number,
  allowPricing: boolean,
  accessFactor: number
): LabourRequirement | null {
  if (NO_LABOUR.has(requirement.componentKey)) return null;
  const spec = LABOUR_FOR_MATERIAL[requirement.componentKey];
  if (!spec) return null;
  const quantity = requirement.baseQuantity;
  const productivity = resolveCeilingProductivity({
    productivityKey: spec.productivityKey,
    unit: spec.unit,
    rates,
  });
  const priced =
    allowPricing &&
    productivity.hoursPerUnit != null &&
    productivity.hoursPerUnit > 0 &&
    hourlyCost > 0 &&
    hasTrustedPhysicalQuantity(quantity);
  const baseHours =
    priced && productivity.hoursPerUnit != null
      ? round2(quantity * productivity.hoursPerUnit)
      : 0;
  const adjustedHours = priced ? round2(baseHours * accessFactor) : 0;
  return buildLabourRequirement({
    workAreaId: requirement.workAreaId,
    workAreaType: requirement.workAreaType,
    componentKey: spec.labourComponentKey,
    variantKey: requirement.variantKey,
    description: `${requirement.description.replace(/ — .+$/, "")} — ${spec.description}`,
    confidence: priced ? "medium" : "low",
    assumptions: priced
      ? [
          {
            key: "quantity_basis",
            text: `Labour uses installed ${spec.unit}, not purchase/waste quantity.`,
            source: "calculator_default",
          },
        ]
      : [
          {
            key: "productivity_required",
            text: `Needs productivity for ${spec.description} (${quantity} ${spec.unit}). Not zero hours.`,
            source: "calculator_default",
          },
        ],
    provenance: {
      calculatorSource: "ceilings-commercial",
      factKeys: requirement.provenance.factKeys,
      constraintKeys: [],
    },
    priced,
    trade: "carpenter",
    baseHours,
    productivityBasis: {
      key: spec.productivityKey,
      hoursPerUnit: productivity.hoursPerUnit ?? 0,
      unit: spec.unit,
      quantity,
    },
    adjustmentRef: {
      factors:
        priced && accessFactor !== 1
          ? [{ key: PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY, value: accessFactor }]
          : [],
    },
    adjustedHours,
    rateKey: spec.productivityKey,
    hourlyCost: priced ? hourlyCost : null,
    totalCost: priced ? round2(adjustedHours * hourlyCost) : null,
    rateProvenance: priced ? productivity.source : "missing",
  });
}

function specialistRequirement(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  nestedItemId: string;
  componentId?: string;
  description: string;
  reason: string;
}): MaterialRequirement {
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "ceilings",
    componentKey: CEILINGS_SPECIALIST_COMPONENT,
    variantKey: params.componentId
      ? `${params.nestedItemId}::${params.componentId}`
      : params.nestedItemId,
    description: params.description,
    confidence: "low",
    assumptions: [
      {
        key: "unsupported_specialist",
        text: params.reason,
        source: "calculator_default",
      },
    ],
    provenance: {
      calculatorSource: "ceilings-commercial",
      factKeys: ["ceilings.portions"],
      constraintKeys: [],
    },
    priced: false,
    materialKey: null,
    category: "SPECIALIST",
    specification: params.reason,
    baseQuantity: 1,
    baseUnit: "item",
    wasteFactor: 0,
    purchaseQuantity: 1,
    purchaseUnit: "item",
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

function sellForPricedCost(params: {
  unitCost: number;
  companySell: number | null | undefined;
  organisationSettings: OrganisationSettings | null;
  explicitSellOverride?: boolean;
}) {
  return classifyResolvedSell({
    costRate: params.unitCost,
    sellRate: params.companySell,
    applicableGrossMarginPercent: applicableGrossMarginPercent(
      params.organisationSettings
    ),
    explicitSellOverride: params.explicitSellOverride,
  });
}

function materialLine(params: {
  requirement: MaterialRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  rates: readonly OrganisationRate[];
}): EstimateLineItemInput {
  const nestedItemId = ceilingRequirementNestedItemId(params.requirement);
  const componentId = ceilingRequirementComponentId(params.requirement);
  const source = mapMaterialSourceToLine(params.requirement.rateSource);
  if (
    !params.requirement.priced ||
    params.requirement.unitCost == null ||
    params.requirement.totalCost == null
  ) {
    const line = createRateLineItem({
      workAreaId: params.requirement.workAreaId,
      workAreaName: params.workAreaName,
      label: params.requirement.description,
      category: "materials",
      quantity: params.requirement.purchaseQuantity,
      unit: params.requirement.purchaseUnit,
      costRate: 0,
      sellRate: 0,
      rateSource: source.rateSource,
      rateSourceType: "missing",
      itemKey: params.requirement.materialKey ?? undefined,
      componentKey: params.requirement.componentKey,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      notes: `Pricing Required. Purchase ${params.requirement.purchaseQuantity} ${params.requirement.purchaseUnit}. Waste is not reapplied. ${params.requirement.specification ?? params.requirement.description}`,
    });
    return withPricingOwnership(
      {
        ...line,
        nestedItemId,
        componentId,
        identitySummary: params.requirement.specification,
        sellDerivedFromMargin: false,
        sellAuthority: undefined,
      },
      { pricingOwner: "contractor_material" }
    );
  }
  const named = params.requirement.materialKey
    ? findExactMaterialRate(
        params.rates,
        params.requirement.materialKey,
        params.requirement.purchaseUnit
      )
    : undefined;
  const classified = sellForPricedCost({
    unitCost: params.requirement.unitCost,
    companySell: named?.sell_rate,
    organisationSettings: params.organisationSettings,
  });
  const line = createRateLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label: params.requirement.description,
    category: "materials",
    quantity: params.requirement.purchaseQuantity,
    unit: params.requirement.purchaseUnit,
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
    notes: `Purchase ${params.requirement.purchaseQuantity} ${params.requirement.purchaseUnit} · installed ${params.requirement.baseQuantity} ${params.requirement.baseUnit} · waste not reapplied`,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      componentId,
      identitySummary: params.requirement.specification,
    },
    { pricingOwner: "contractor_material" }
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
}): EstimateLineItemInput {
  const nestedItemId = ceilingRequirementNestedItemId(params.requirement);
  const componentId = ceilingRequirementComponentId(params.requirement);
  const qty = params.requirement.productivityBasis.quantity;
  const unit = params.requirement.productivityBasis.unit;
  if (
    !params.requirement.priced ||
    params.requirement.hourlyCost == null ||
    params.requirement.totalCost == null
  ) {
    const line = createRateLineItem({
      workAreaId: params.requirement.workAreaId,
      workAreaName: params.workAreaName,
      label: params.requirement.description,
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
      notes: `Pricing Required productivity. Installed ${qty} ${unit}. ${params.requirement.description}`,
    });
    return withPricingOwnership(
      {
        ...line,
        nestedItemId,
        componentId,
        labourHours: 0,
        productivityRate: params.requirement.productivityBasis.hoursPerUnit,
        productivityUnit: unit,
        productivitySourceType: "missing",
        sellDerivedFromMargin: false,
        sellAuthority: undefined,
      },
      { pricingOwner: "in_house_labour" }
    );
  }
  const hours = params.requirement.adjustedHours;
  const sellHour = params.labourSellRate;
  const recommendedSell = round2(hours * sellHour);
  const amounts = buildAmounts(
    params.requirement.totalCost,
    recommendedSell,
    params.organisationSettings
  );
  return withPricingOwnership(
    {
      workAreaId: params.requirement.workAreaId,
      workAreaName: params.workAreaName,
      label: params.requirement.description,
      category: "labour",
      quantity: qty,
      unit,
      labourHours: hours,
      productivityRate: params.requirement.productivityBasis.hoursPerUnit,
      productivityUnit: unit,
      costRate: params.requirement.hourlyCost,
      sellRate: sellHour,
      rateSource:
        params.requirement.rateProvenance === "company"
          ? getRateSourceLabel("user_rate")
          : getRateSourceLabel("productivity"),
      rateSourceType:
        params.requirement.rateProvenance === "company"
          ? "user_rate"
          : "productivity",
      itemKey: params.requirement.productivityBasis.key ?? undefined,
      componentKey: params.requirement.componentKey,
      nestedItemId,
      componentId,
      sellDerivedFromMargin: params.labourSellDerived,
      sellAuthority: params.labourSellAuthority,
      productivitySourceType:
        params.requirement.rateProvenance === "company"
          ? "user_rate"
          : "productivity",
      sortOrder: params.sortOrder,
      notes: `${hours} person-hours × $${params.requirement.hourlyCost}/h cost. Installed ${qty} ${unit}.`,
      ...amounts,
    },
    { pricingOwner: "in_house_labour" }
  );
}

function ceilingMaterialGroupingKey(item: EstimateLineItemInput): string | null {
  if (item.category !== "materials") return null;
  if (!item.itemKey) return null;
  return [
    item.workAreaId,
    item.itemKey,
    item.componentKey ?? "",
    item.componentId ?? "",
    item.unit ?? "",
    item.rateSource,
    item.rateSourceType ?? "",
    item.sellAuthority ?? "",
    item.pricingOwner ?? "",
    item.scopeKey ?? "",
    item.rateSourceType === "missing" ? "pr" : "priced",
  ].join("::");
}

function mergeCeilingMaterialLines(
  members: readonly EstimateLineItemInput[]
): EstimateLineItemInput {
  const merged = defaultMergeSameIdentityCommercialLines(members);
  const portions = [
    ...new Set(
      members.flatMap((item) => [
        ...(item.contributingNestedItemIds ?? []),
        item.nestedItemId,
      ]).filter((id): id is string => Boolean(id))
    ),
  ];
  return {
    ...merged,
    nestedItemId: members[0]?.nestedItemId,
    contributingNestedItemIds: portions,
    notes: [
      members[0]?.notes,
      portions.length > 1 ? `Portions: ${portions.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function aggregateCeilingCommercialLines(
  items: readonly EstimateLineItemInput[]
): EstimateLineItemInput[] {
  return aggregateSameIdentityCommercialLines(items, {
    isEligible: (item) =>
      item.category === "materials" &&
      Boolean(item.itemKey) &&
      item.includedInTotal !== false,
    groupingKey: ceilingMaterialGroupingKey,
    areCompatible: (a, b) => commercialLinesAggregationCompatible(a, b),
    merge: mergeCeilingMaterialLines,
  });
}

function paintingPlasteringDemoLabels(): RegExp[] {
  return [
    /^ceiling stopping\/plastering allowance$/i,
    /^ceiling stopping/i,
    /^ceiling painting$/i,
    /^existing ceiling removal$/i,
    /stopping_included/i,
    /painting_included/i,
    /demolition_included/i,
  ];
}

export function ceilingCommercialOwnsFinishMoney(
  line: Pick<EstimateLineItemInput, "label" | "componentKey">
): boolean {
  const key = line.componentKey ?? "";
  if (
    /\.(paint|painting|stopping|demolition|removal)(\.|$)/.test(key) ||
    key.includes("ceilings.painting") ||
    key.includes("ceilings.stopping") ||
    key.includes("ceilings.demolition")
  ) {
    return true;
  }
  return paintingPlasteringDemoLabels().some((pattern) =>
    pattern.test(line.label)
  );
}

function rollupCompleteness(
  physical: CeilingPhysicalResult,
  requirements: readonly EstimateRequirement[]
): CeilingCommercialCompleteness | "empty" {
  if (physical.completeness === "empty") return "empty";
  if (
    physical.completeness ===
    CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
  ) {
    return CEILING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  if (
    physical.completeness ===
    CEILING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
  ) {
    return CEILING_COMMERCIAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  const included = requirements.filter(
    (row) =>
      (row.kind === "material" && hasTrustedPhysicalQuantity(row.purchaseQuantity)) ||
      (row.kind === "labour" &&
        hasTrustedPhysicalQuantity(row.productivityBasis.quantity))
  );
  if (included.length === 0) {
    return CEILING_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED;
  }
  if (included.every((row) => row.priced)) {
    return CEILING_COMMERCIAL_COMPLETENESS.COMPLETE_COMMERCIAL;
  }
  return CEILING_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED;
}

export function ceilingCommercialCoverageTable(): CeilingRateCoverageRow[] {
  const row = (
    component: string,
    physicalUnit: string,
    materialKey: string,
    productivityKey: string | null,
    extras?: { companyMaterial?: boolean }
  ): CeilingRateCoverageRow => {
    const quotrCost =
      quotrCatalogueCost(materialKey) != null ||
      derivedDimensionedPlasterboardCost(materialKey) != null;
    const quotrProd = productivityKey
      ? getQuotrProductivityBenchmark(productivityKey) != null
      : false;
    const materialResult = quotrCost ? "resolved" : "PR";
    const labourResult =
      productivityKey == null
        ? "n/a"
        : quotrProd
          ? "resolved"
          : "PR";
    return {
      component,
      physicalUnit,
      materialKey,
      companyRateSupport: extras?.companyMaterial !== false,
      quotrCostBenchmark: quotrCost,
      productivityKey,
      companyProductivitySupport: productivityKey != null,
      quotrProductivity: quotrProd,
      resultIfNoCompany: `${materialResult} / ${labourResult}`,
    };
  };
  return [
    row(
      "140×45 H1.2 timber framing",
      "lm",
      "timber.framing.140x45.h1.2.lm",
      CEILINGS_PRODUCTIVITY_KEYS.timberFramingLm
    ),
    row(
      "90×45 H1.2 bulkhead timber",
      "lm",
      "timber.framing.90x45.h1.2.lm",
      CEILINGS_PRODUCTIVITY_KEYS.bulkheadFramingTimberLm
    ),
    row(
      "13mm Standard GIB 2400×1200",
      "sheet",
      "sheet.plasterboard.standard.each",
      CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet
    ),
    row(
      "13mm Standard GIB 3000×1200",
      "sheet",
      "sheet.plasterboard.standard.13mm.3000x1200.each",
      CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet
    ),
    row(
      "13mm Aqualine 2400×1200",
      "sheet",
      "sheet.plasterboard.aqualine.each",
      CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet
    ),
    row(
      "13mm Fyreline 2400×1200",
      "sheet",
      "sheet.plasterboard.fyreline.each",
      CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet
    ),
    row(
      "13mm Braceline 2400×1200",
      "sheet",
      "sheet.plasterboard.braceline.each",
      CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet
    ),
    row(
      "Dimensioned plasterboard (other sizes)",
      "sheet",
      "sheet.plasterboard.standard.10mm.2700x1200.each",
      CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet
    ),
    row(
      "Plywood sheet (generic)",
      "sheet",
      "sheet.plywood.each",
      CEILINGS_PRODUCTIVITY_KEYS.plywoodSheet
    ),
    row(
      "Perimeter track / angle",
      "lm",
      "steel.ceiling.perimeter_track.lm",
      CEILINGS_PRODUCTIVITY_KEYS.perimeterLm
    ),
    row(
      "Primary channel",
      "lm",
      "steel.ceiling.primary_channel.lm",
      CEILINGS_PRODUCTIVITY_KEYS.primaryLm
    ),
    row(
      "Furring channel",
      "lm",
      "steel.ceiling.furring_channel.lm",
      CEILINGS_PRODUCTIVITY_KEYS.furringLm
    ),
    row(
      "Crossover / suspension clip",
      "each",
      "steel.ceiling.crossover_clip.each",
      CEILINGS_PRODUCTIVITY_KEYS.clipEach
    ),
    row(
      "Dropper (wire labour embedded)",
      "each",
      "steel.ceiling.dropper.each",
      CEILINGS_PRODUCTIVITY_KEYS.dropperEach
    ),
    row(
      "Suspension wire (material only)",
      "lm",
      "steel.ceiling.suspension_wire.lm",
      null
    ),
    row(
      "Timber lining / profile",
      "lm",
      "timber.lining.profile.lm",
      CEILINGS_PRODUCTIVITY_KEYS.timberLiningLm
    ),
    row(
      "T-grid",
      "m2",
      "ceiling.grid.m2",
      CEILINGS_PRODUCTIVITY_KEYS.gridM2
    ),
    row(
      "Tile 300×300",
      "each",
      "ceiling.tile.300x300.each",
      CEILINGS_PRODUCTIVITY_KEYS.tileEach
    ),
    row(
      "Tile 600×600",
      "each",
      "ceiling.tile.600x600.each",
      CEILINGS_PRODUCTIVITY_KEYS.tileEach
    ),
    row(
      "Tile 1200×600",
      "each",
      "ceiling.tile.1200x600.each",
      CEILINGS_PRODUCTIVITY_KEYS.tileEach
    ),
    row(
      "Bulkhead steel framing",
      "lm",
      "steel.ceiling.bulkhead.framing.lm",
      CEILINGS_PRODUCTIVITY_KEYS.bulkheadFramingSteelLm
    ),
    row(
      "Thermal / standard ceiling insulation",
      "m2",
      CEILING_INSULATION_THERMAL_KEY,
      CEILINGS_PRODUCTIVITY_KEYS.insulationM2
    ),
    row(
      "Insulation (unspecified / acoustic / other)",
      "m2",
      "(unresolved)",
      CEILINGS_PRODUCTIVITY_KEYS.insulationM2,
      { companyMaterial: false }
    ),
    row(
      "Timber framing fixings",
      "lm",
      "ceilings.fixings.timber_framing",
      null
    ),
    row(
      "Steel framing residual fixings",
      "lm",
      "ceilings.fixings.steel_framing",
      null
    ),
    row(
      "Plasterboard fixings",
      "m2",
      "ceilings.fixings.plasterboard",
      null
    ),
    row(
      "Plywood fixings",
      "m2",
      "ceilings.fixings.plywood",
      null
    ),
    row(
      "Timber lining fixings",
      "lm",
      "ceilings.fixings.timber_lining",
      null
    ),
    row(
      "Bulkhead timber framing fixings",
      "lm",
      CEILINGS_FIXINGS_BULKHEAD_FRAMING_TIMBER_KEY,
      null
    ),
    row(
      "Bulkhead steel framing fixings",
      "lm",
      CEILINGS_FIXINGS_BULKHEAD_FRAMING_STEEL_KEY,
      null
    ),
    row(
      "Bulkhead lining fixings",
      "m2",
      "ceilings.fixings.bulkhead_lining",
      null
    ),
    {
      component: "Tile/Grid minor fixings",
      physicalUnit: "included",
      materialKey: "ceiling.grid.m2 (included)",
      companyRateSupport: true,
      quotrCostBenchmark: false,
      productivityKey: null,
      companyProductivitySupport: false,
      quotrProductivity: false,
      resultIfNoCompany: "included in grid m² / no second line",
    },
  ];
}

function specialistLinesForPortion(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortionPhysical;
}): MaterialRequirement[] {
  const out: MaterialRequirement[] = [];
  if (params.portion.specialistKind) {
    out.push(
      specialistRequirement({
        workArea: params.workArea,
        nestedItemId: params.portion.nestedItemId,
        description: `Unsupported specialist ceiling (${params.portion.specialistKind})`,
        reason:
          "Unsupported specialist system. Pricing Required. Do not price as ordinary plasterboard.",
      })
    );
  }
  for (const bulkhead of params.portion.bulkheads) {
    if (bulkhead.status === "unsupported_specialist") {
      out.push(
        specialistRequirement({
          workArea: params.workArea,
          nestedItemId: params.portion.nestedItemId,
          componentId: bulkhead.componentId,
          description: "Unsupported specialist bulkhead",
          reason:
            bulkhead.reason ??
            "Unsupported bulkhead form is not a conventional wall-adjacent downstand.",
        })
      );
    }
  }
  return out;
}

export function commercializeCeilings(params: {
  physical: CeilingPhysicalResult;
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  constraints?: readonly EstimateConstraint[];
}): CeilingCommercialResult {
  const assumptions: string[] = [CEILINGS_WIRE_LABOUR_DECISION, CEILINGS_DNA_COVERAGE];
  const accessFactor = getCombinedLabourAccessFactor({
    constraints: [...(params.constraints ?? [])],
  });
  const labourRate = resolveLabourRate({
    rates: [...params.rates],
    organisationSettings: params.organisationSettings,
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

  const materials: MaterialRequirement[] = [];
  const labour: LabourRequirement[] = [];

  for (const portion of params.physical.portions) {
    materials.push(...specialistLinesForPortion({ workArea: params.workArea, portion }));
  }

  for (const requirement of params.physical.requirements) {
    const nestedId = ceilingRequirementNestedItemId(requirement);
    const portion = params.physical.portions.find(
      (row) => row.nestedItemId === nestedId
    );
    const allowPricing = ceilingAllowsQuotrResolution(
      portion,
      requirement.componentKey
    );
    const priced = priceCeilingMaterial({
      requirement,
      rates: params.rates,
      organisationSettings: params.organisationSettings,
      allowPricing,
    });
    materials.push(priced);
    const labourRow = labourForMaterial(
      priced,
      params.rates,
      labourRate.costRate,
      allowPricing,
      accessFactor
    );
    if (labourRow) labour.push(labourRow);
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
      })
    );
  }

  const aggregated = aggregateCeilingCommercialLines(lineItems);
  const finishOwned = aggregated.filter((item) =>
    ceilingCommercialOwnsFinishMoney(item)
  );
  if (finishOwned.length > 0) {
    assumptions.push(
      "Nested Ceilings commercial layer emitted finish/demo money — unexpected."
    );
  }

  const completeness = rollupCompleteness(params.physical, requirements);
  const missingInfo = [...params.physical.missingInfo];
  if (
    completeness === CEILING_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED ||
    completeness === CEILING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
  ) {
    missingInfo.push(CEILINGS_PARTIAL_ESTIMATE_MESSAGE);
    for (const requirement of requirements) {
      if (requirement.priced) continue;
      missingInfo.push(`Pricing required: ${requirement.description}`);
    }
  }

  return {
    completeness,
    requirements,
    lineItems: aggregated.filter(
      (item) => !ceilingCommercialOwnsFinishMoney(item)
    ),
    coverage: ceilingCommercialCoverageTable(),
    assumptions,
    missingInfo,
    wireLabourDecision: CEILINGS_WIRE_LABOUR_DECISION,
    dnaCoverage: CEILINGS_DNA_COVERAGE,
  };
}

export function ceilingLabourUsesInstalledQuantity(
  requirement: LabourRequirement
): boolean {
  return requirement.productivityBasis.quantity > 0;
}

export {
  CEILINGS_DNA_COVERAGE,
  CEILINGS_PARTIAL_ESTIMATE_MESSAGE,
  CEILINGS_WIRE_LABOUR_DECISION,
};
