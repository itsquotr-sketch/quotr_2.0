/**
 * CLADDING-05 — hosted commercialisation of nested Cladding sections.
 *
 * Consumes calculateCladdingPhysical. Does not recompute wall area, cover,
 * lineal metres, sheet equivalents, batten layout, or accessory quantities.
 * Sell, margin and GST stay on the shared estimate path.
 */

import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { deriveSellFromCost } from "@/lib/commercial-engine/core/sell-from-margin";
import { getCombinedLabourAccessFactor } from "@/lib/estimate/adjustments";
import {
  CLADDING_MATERIAL_BENCHMARKS,
  CLADDING_PRODUCTIVITY_BENCHMARKS,
  resolveCladdingMaterialAuthority,
  resolveCladdingProductivityAuthority,
} from "@/lib/estimate/cladding-authority";
import {
  CLADDING_BOARD_AND_BATTEN_SHEET_M2,
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
  CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM,
  CLADDING_SHEET_EQUIVALENT_INFORMATIONAL,
  CLADDING_SHEET_EQUIVALENT_LABEL,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_SPECIALIST_CUSTOM,
  CLADDING_SPECIALIST_MASONRY,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
} from "@/lib/estimate/cladding-identities";
import {
  CLADDING_PHYSICAL_COMPLETENESS,
  CLADDING_PHYSICAL_UNPRICED_MESSAGE,
  presentCladdingMeasure,
  type CladdingPhysicalComponent,
  type CladdingPhysicalResult,
  type CladdingPortionPhysical,
} from "@/lib/estimate/cladding-physical";
import { CLADDING_STAGED_NOT_CALCULATED_MESSAGE } from "@/lib/estimate/cladding-portions";
import { resolveCladdingCarpenterHourlyCost } from "@/lib/estimate/cladding-rate-resolution";
import { formatProductivity, formatQuantity } from "@/lib/estimate/builder-presentation-format";
import { round2 } from "@/lib/estimate/facts";
import { createAllowanceLineItem } from "@/lib/estimate/line-items";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
} from "@/lib/estimate/requirements";
import type {
  EstimateConstraint,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";

export const CLADDING_REMOVAL_EXCLUSIONS =
  "Excludes disposal, cartage, scaffold, hazardous materials, substrate repairs and structural remediation." as const;

export const CLADDING_COMMERCIAL_COMPLETENESS = {
  COMPLETE_COMMERCIAL: "COMPLETE_COMMERCIAL",
  PRICING_REQUIRED: "PRICING_REQUIRED",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type CladdingCommercialCompleteness =
  (typeof CLADDING_COMMERCIAL_COMPLETENESS)[keyof typeof CLADDING_COMMERCIAL_COMPLETENESS];

export type CladdingCommercialResult = {
  readonly completeness: CladdingCommercialCompleteness | "empty";
  readonly requirements: readonly EstimateRequirement[];
  readonly lineItems: readonly EstimateLineItemInput[];
  readonly assumptions: readonly string[];
  readonly missingInfo: readonly string[];
  readonly exclusions: readonly string[];
};

const MATERIAL_LABELS = new Map(
  CLADDING_MATERIAL_BENCHMARKS.map((row) => [row.key, row.label])
);
const PRODUCTIVITY_LABELS = new Map(
  CLADDING_PRODUCTIVITY_BENCHMARKS.map((row) => [row.key, row.label])
);

const ACCESSORY_LABELS: Record<string, string> = {
  [CLADDING_CAVITY_UNRESOLVED_M2]: "Drained cavity",
  [CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2]: "Wall underlay or rigid air barrier",
  [CLADDING_TRIMS_UNRESOLVED]: "Trims, corners and flashings",
  [CLADDING_SPECIALIST_BRICK_VENEER]: "Brick veneer cladding supply and installation",
  [CLADDING_SPECIALIST_MASONRY]: "Masonry veneer cladding supply and installation",
  [CLADDING_SPECIALIST_CUSTOM]: "Proprietary cladding",
  [CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM]: "Custom weatherboard",
  [CLADDING_CUSTOM_INSTALL_HOURS_PER_LM]: "Custom cladding installation",
  [CLADDING_CUSTOM_REMOVE_HOURS_PER_M2]: "Custom cladding removal",
};

export function claddingLineScopeKey(params: {
  workAreaId: string;
  nestedItemId: string;
  componentKey: string;
}): string {
  return `cladding:${params.workAreaId}:${params.nestedItemId}:${params.componentKey}`;
}

export function claddingCommercialCalculatorFields(result: {
  requirements: readonly EstimateRequirement[];
}): { requirements?: readonly EstimateRequirement[] } {
  if (result.requirements.length === 0) return {};
  return { requirements: result.requirements };
}

export function formatCladdingReviewTitle(portion: CladdingPortionPhysical): string {
  const name = portion.label?.trim() || "Cladding section";
  const area =
    portion.netAreaM2 != null
      ? `${presentCladdingMeasure(portion.netAreaM2)} m²`
      : "area not confirmed";
  if (portion.scopeIntent === "removal_only") {
    return `${name} — ${area} cladding removal`;
  }
  const keys = portion.components.map((row) => row.componentKey);
  if (keys.includes(CLADDING_SPECIALIST_BRICK_VENEER)) {
    return `${name} — ${area} brick veneer`;
  }
  if (keys.includes(CLADDING_SPECIALIST_MASONRY)) {
    return `${name} — ${area} masonry veneer`;
  }
  if (
    keys.includes(CLADDING_SPECIALIST_CUSTOM) ||
    keys.includes(CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM)
  ) {
    return `${name} — ${area} custom cladding`;
  }
  if (keys.includes(CLADDING_BOARD_AND_BATTEN_SHEET_M2)) {
    return `${name} — ${area} timber board-and-batten`;
  }
  const linear = portion.components.find((row) => row.materialKey?.endsWith(".lm"));
  const phrase = linear?.materialKey ? humanLinearPhrase(linear.materialKey) : null;
  return phrase ? `${name} — ${area} ${phrase}` : `${name} — ${area}`;
}

export function claddingReviewDisclosures(
  portion: CladdingPortionPhysical
): readonly string[] {
  const notes: string[] = [];
  if (portion.grossAreaM2 != null && portion.netAreaM2 != null) {
    notes.push(
      portion.grossAreaM2 === portion.netAreaM2
        ? `Gross and net wall area are both ${presentCladdingMeasure(portion.netAreaM2)} m².`
        : `Gross wall area ${presentCladdingMeasure(portion.grossAreaM2)} m². Net wall area ${presentCladdingMeasure(portion.netAreaM2)} m² after the opening deduction.`
    );
  }
  const sheet = portion.components.find(
    (row) => row.componentKey === CLADDING_SHEET_EQUIVALENT_INFORMATIONAL
  );
  if (sheet?.quantity != null) {
    notes.push(
      `Minimum whole-sheet equivalent ${sheet.quantity}. ${CLADDING_SHEET_EQUIVALENT_LABEL} This is not an order quantity and does not multiply material COST.`
    );
  }
  if (portion.components.some((row) => row.componentKey.includes(".remove."))) {
    notes.push(CLADDING_REMOVAL_EXCLUSIONS);
  }
  return notes;
}

export function commercializeCladding(params: {
  physical: CladdingPhysicalResult;
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  constraints?: readonly EstimateConstraint[];
}): CladdingCommercialResult {
  if (params.physical.source === "empty" || params.physical.portions.length === 0) {
    return {
      completeness: "empty",
      requirements: [],
      lineItems: [],
      assumptions: [],
      missingInfo: [CLADDING_STAGED_NOT_CALCULATED_MESSAGE],
      exclusions: [],
    };
  }

  const accessFactor = getCombinedLabourAccessFactor({
    constraints: [...(params.constraints ?? [])],
  });
  const carpenter = resolveCladdingCarpenterHourlyCost({
    rates: params.rates,
    allowBenchmarkRates: params.organisationSettings?.allow_benchmark_rates !== false,
  });
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  let sort = 1;

  for (const requirement of params.physical.requirements) {
    const portion = params.physical.portions.find(
      (row) => row.nestedItemId === (requirement.variantKey ?? "")
    );
    if (requirement.kind === "material") {
      const priced = priceMaterial({
        requirement,
        rates: params.rates,
        allowBenchmarkRates: params.organisationSettings?.allow_benchmark_rates !== false,
        portion,
      });
      requirements.push(priced.requirement);
      if (priced.line) {
        lineItems.push(
          ownedLine({
            line: materialLine({
              requirement: priced.requirement,
              priced: priced.line,
              workAreaName: params.workArea.name,
              sortOrder: sort++,
              organisationSettings: params.organisationSettings,
            }),
            requirement: priced.requirement,
            owner: "contractor_material",
            included: priced.line.included,
          })
        );
      }
      continue;
    }
    if (requirement.kind !== "labour") continue;
    const priced = priceLabour({
      requirement,
      rates: params.rates,
      allowBenchmarkRates: params.organisationSettings?.allow_benchmark_rates !== false,
      portion,
      accessFactor,
      hourlyCost: carpenter.value,
      hourlySource: carpenter.source,
    });
    requirements.push(priced.requirement);
    if (priced.line) {
      lineItems.push(
        ownedLine({
          line: labourLine({
            requirement: priced.requirement,
            priced: priced.line,
            workAreaName: params.workArea.name,
            sortOrder: sort++,
            organisationSettings: params.organisationSettings,
            accessFactor,
          }),
          requirement: priced.requirement,
          owner: "in_house_labour",
          included: priced.line.included,
        })
      );
    }
  }

  const completeness = rollup(params.physical, requirements);
  const missingInfo = params.physical.missingInfo.filter(
    (row) => !row.includes(CLADDING_PHYSICAL_UNPRICED_MESSAGE)
  );
  for (const requirement of requirements) {
    if (requirement.priced) continue;
    if (requirement.componentKey === CLADDING_SHEET_EQUIVALENT_INFORMATIONAL) continue;
    if (!missingInfo.some((row) => row.includes(requirement.description))) {
      missingInfo.push(`Pricing required: ${humanLabel(requirement)}`);
    }
  }

  return {
    completeness,
    requirements,
    lineItems,
    assumptions: [],
    missingInfo: [...new Set(missingInfo)],
    exclusions: lineItems.some((row) => (row.componentKey ?? "").includes(".remove."))
      ? [CLADDING_REMOVAL_EXCLUSIONS]
      : [],
  };
}

function humanLinearPhrase(key: string): string | null {
  const bevel = key.match(/bevelback\.(\d+)x(\d+)/);
  if (bevel) return `timber bevelback, ${bevel[1]} × ${bevel[2]} mm`;
  const rustic = key.match(/rusticated\.(\d+)x(\d+)/);
  if (rustic) return `timber rusticated, ${rustic[1]} × ${rustic[2]} mm`;
  const ship = key.match(/vertical_shiplap\.(\d+)x(\d+)/);
  if (ship) return `vertical shiplap, ${ship[1]} × ${ship[2]} mm`;
  const fibre = key.match(/weatherboard\.(\d+)\.lm/);
  if (fibre) return `fibre-cement weatherboard, ${fibre[1]} mm`;
  return null;
}

function humanLabel(requirement: EstimateRequirement): string {
  if (requirement.kind === "material" && requirement.materialKey) {
    return MATERIAL_LABELS.get(requirement.materialKey) ?? requirement.description;
  }
  return (
    ACCESSORY_LABELS[requirement.componentKey] ??
    PRODUCTIVITY_LABELS.get(requirement.componentKey) ??
    requirement.description
  );
}

function portionCanPriceOrdinary(portion: CladdingPortionPhysical | undefined): boolean {
  return portion?.completeness === CLADDING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

function priceMaterial(params: {
  requirement: MaterialRequirement;
  rates: readonly OrganisationRate[];
  allowBenchmarkRates: boolean;
  portion: CladdingPortionPhysical | undefined;
}): {
  requirement: MaterialRequirement;
  line: { included: boolean; unitCost: number; totalCost: number; source: "company" | "quotr" } | null;
} {
  const requirement = params.requirement;
  if (requirement.componentKey === CLADDING_SHEET_EQUIVALENT_INFORMATIONAL) {
    return {
      requirement: unpricedMaterial(requirement),
      line: null,
    };
  }
  const key = requirement.materialKey;
  const ordinary = key != null && MATERIAL_LABELS.has(key);
  if (!ordinary || !portionCanPriceOrdinary(params.portion)) {
    return {
      requirement: unpricedMaterial(requirement),
      line: unresolvedMaterialLine(requirement),
    };
  }
  const resolved = resolveCladdingMaterialAuthority({
    identity: key,
    rates: params.rates,
    allowBenchmarkRates: params.allowBenchmarkRates,
  });
  if (resolved.value == null || resolved.source === "pricing_required") {
    return {
      requirement: unpricedMaterial(requirement),
      line: unresolvedMaterialLine(requirement),
    };
  }
  const totalCost = round2(requirement.purchaseQuantity * resolved.value);
  return {
    requirement: {
      ...requirement,
      priced: true,
      unitCost: resolved.value,
      totalCost,
      rateSource: resolved.source === "company" ? "company" : "benchmark",
    },
    line: {
      included: true,
      unitCost: resolved.value,
      totalCost,
      source: resolved.source === "company" ? "company" : "quotr",
    },
  };
}

function priceLabour(params: {
  requirement: LabourRequirement;
  rates: readonly OrganisationRate[];
  allowBenchmarkRates: boolean;
  portion: CladdingPortionPhysical | undefined;
  accessFactor: number;
  hourlyCost: number | null;
  hourlySource: "company" | "quotr" | "pricing_required";
}): {
  requirement: LabourRequirement;
  line: {
    included: boolean;
    hourlyCost: number;
    totalCost: number;
    hoursPerUnit: number;
    baseHours: number;
    adjustedHours: number;
    source: "company" | "quotr";
    hourlySource: "company" | "quotr";
  } | null;
} {
  const requirement = params.requirement;
  const key = requirement.productivityBasis.key ?? requirement.componentKey;
  const ordinary = PRODUCTIVITY_LABELS.has(key);
  const quantity = requirement.productivityBasis.quantity;
  if (
    !ordinary ||
    !portionCanPriceOrdinary(params.portion) ||
    params.hourlyCost == null ||
    params.hourlySource === "pricing_required" ||
    !(quantity > 0)
  ) {
    return { requirement: unpricedLabour(requirement), line: visibleUnresolvedLabour(requirement) };
  }
  const productivity = resolveCladdingProductivityAuthority({
    identity: key,
    rates: params.rates,
    allowBenchmarkRates: params.allowBenchmarkRates,
  });
  if (productivity.value == null) {
    return { requirement: unpricedLabour(requirement), line: visibleUnresolvedLabour(requirement) };
  }
  const baseHours = quantity * productivity.value;
  const adjustedHours = baseHours * params.accessFactor;
  const totalCost = round2(adjustedHours * params.hourlyCost);
  const source = productivity.source === "company" ? "company" : "quotr";
  return {
    requirement: {
      ...requirement,
      priced: true,
      baseHours,
      adjustedHours,
      hourlyCost: params.hourlyCost,
      totalCost,
      rateProvenance: params.hourlySource === "company" ? "company" : "benchmark",
      productivityBasis: {
        ...requirement.productivityBasis,
        hoursPerUnit: productivity.value,
      },
    },
    line: {
      included: true,
      hourlyCost: params.hourlyCost,
      totalCost,
      hoursPerUnit: productivity.value,
      baseHours,
      adjustedHours,
      source,
      hourlySource: params.hourlySource === "company" ? "company" : "quotr",
    },
  };
}

function unpricedMaterial(requirement: MaterialRequirement): MaterialRequirement {
  return {
    ...requirement,
    priced: false,
    unitCost: null,
    totalCost: null,
    rateSource: "missing",
  };
}

function unpricedLabour(requirement: LabourRequirement): LabourRequirement {
  return {
    ...requirement,
    priced: false,
    hourlyCost: null,
    totalCost: null,
    rateProvenance: "missing",
  };
}

function unresolvedMaterialLine(
  requirement: MaterialRequirement
): { included: boolean; unitCost: number; totalCost: number; source: "company" | "quotr" } | null {
  if (
    ACCESSORY_LABELS[requirement.componentKey] == null &&
    !(requirement.purchaseQuantity > 0)
  ) {
    return null;
  }
  return { included: false, unitCost: 0, totalCost: 0, source: "quotr" };
}

function visibleUnresolvedLabour(
  requirement: LabourRequirement
): null | {
  included: boolean;
  hourlyCost: number;
  totalCost: number;
  hoursPerUnit: number;
  baseHours: number;
  adjustedHours: number;
  source: "company" | "quotr";
  hourlySource: "company" | "quotr";
} {
  if (!(requirement.productivityBasis.quantity > 0)) return null;
  return {
    included: false,
    hourlyCost: 0,
    totalCost: 0,
    hoursPerUnit: 0,
    baseHours: 0,
    adjustedHours: 0,
    source: "quotr",
    hourlySource: "quotr",
  };
}

function materialLine(params: {
  requirement: MaterialRequirement;
  priced: { included: boolean; unitCost: number; totalCost: number; source: "company" | "quotr" };
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
}): EstimateLineItemInput {
  const included = params.priced.included;
  const label = humanLabel(params.requirement);
  const sourceType = included
    ? params.priced.source === "company"
      ? "user_rate"
      : "benchmark"
    : "missing";
  const line = createAllowanceLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label,
    category: "materials",
    quantity: params.requirement.purchaseQuantity,
    unit: params.requirement.purchaseUnit,
    recommendedCost: included ? params.priced.totalCost : 0,
    recommendedSell: included
      ? sharedSell(params.priced.totalCost, params.organisationSettings)
      : 0,
    unitCost: included ? params.priced.unitCost : undefined,
    unitSell: included
      ? sharedSell(params.priced.unitCost, params.organisationSettings)
      : undefined,
    rateSource: getRateSourceLabel(sourceType),
    rateSourceType: sourceType,
    itemKey: params.requirement.materialKey ?? undefined,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: included,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: included
      ? `${presentCladdingMeasure(params.requirement.purchaseQuantity)} ${params.requirement.purchaseUnit} × ${money(params.priced.unitCost)}`
      : params.requirement.componentKey.includes(".specialist.")
        ? "Continue to Pricing and add a price."
        : `Pricing Required. Quantity ${presentCladdingMeasure(params.requirement.purchaseQuantity)} ${params.requirement.purchaseUnit} remains visible.`,
  });
  if (included) return line;
  return {
    ...line,
    costRate: undefined,
    sellRate: undefined,
    recommendedCost: 0,
    recommendedSell: 0,
  };
}

function labourLine(params: {
  requirement: LabourRequirement;
  priced: {
    included: boolean;
    hourlyCost: number;
    totalCost: number;
    hoursPerUnit: number;
    baseHours: number;
    adjustedHours: number;
    source: "company" | "quotr";
    hourlySource: "company" | "quotr";
  };
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  accessFactor: number;
}): EstimateLineItemInput {
  const included = params.priced.included;
  const label = humanLabel(params.requirement);
  const qty = params.requirement.productivityBasis.quantity;
  const unit = params.requirement.productivityBasis.unit;
  const sourceType = included
    ? params.priced.source === "company"
      ? "user_rate"
      : "productivity"
    : "missing";
  const removal = params.requirement.componentKey.includes(".remove.");
  const calculation = `${formatQuantity(qty)} ${unit} × ${formatProductivity(params.priced.hoursPerUnit)} h/${unit} = ${formatQuantity(params.priced.baseHours)} h base. Access × ${formatQuantity(params.accessFactor)} = ${formatQuantity(params.priced.adjustedHours)} h.`;
  const note = included
    ? `${calculation} Carpenter hourly COST is ${params.priced.hourlySource === "company" ? "the company rate" : "the Quotr benchmark"}.${removal ? ` ${CLADDING_REMOVAL_EXCLUSIONS}` : ""}`
    : `Pricing Required. Quantity ${formatQuantity(qty)} ${unit} remains visible.`;
  const line = createAllowanceLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label,
    category: "labour",
    quantity: qty,
    unit,
    recommendedCost: included ? params.priced.totalCost : 0,
    recommendedSell: included
      ? sharedSell(params.priced.totalCost, params.organisationSettings)
      : 0,
    unitCost: included ? params.priced.hourlyCost : undefined,
    unitSell: included
      ? sharedSell(params.priced.hourlyCost, params.organisationSettings)
      : undefined,
    rateSource: getRateSourceLabel(sourceType),
    rateSourceType: sourceType,
    itemKey: params.requirement.componentKey,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: included,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: note,
  });
  return {
    ...line,
    labourHours: included ? params.priced.adjustedHours : undefined,
    productivityRate: included ? params.priced.hoursPerUnit : undefined,
    productivityUnit: unit,
    productivitySourceType: included
      ? params.priced.source === "company"
        ? "user_rate"
        : "productivity"
      : "missing",
    costRate: included ? params.priced.hourlyCost : undefined,
    sellRate: included
      ? sharedSell(params.priced.hourlyCost, params.organisationSettings)
      : undefined,
    recommendedCost: included ? params.priced.totalCost : 0,
    recommendedSell: included
      ? sharedSell(params.priced.totalCost, params.organisationSettings)
      : 0,
  };
}

function ownedLine(params: {
  line: EstimateLineItemInput;
  requirement: EstimateRequirement;
  owner: "contractor_material" | "in_house_labour";
  included: boolean;
}): EstimateLineItemInput {
  return withPricingOwnership(
    {
      ...params.line,
      nestedItemId: params.requirement.variantKey ?? "",
    },
    {
      pricingOwner: params.owner,
      scopeKey: claddingLineScopeKey({
        workAreaId: params.requirement.workAreaId,
        nestedItemId: params.requirement.variantKey ?? "",
        componentKey: params.requirement.componentKey,
      }),
      overlapGroup: `cladding.section:${params.requirement.variantKey ?? ""}`,
      includedInTotal: params.included,
    }
  );
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function sharedSell(cost: number, settings: OrganisationSettings | null): number {
  if (!(cost > 0)) return 0;
  const margin = settings?.default_margin_percent;
  const percent = margin != null && Number.isFinite(margin) ? margin : 20;
  return deriveSellFromCost(cost, percent);
}

function rollup(
  physical: CladdingPhysicalResult,
  requirements: readonly EstimateRequirement[]
): CladdingCommercialCompleteness {
  if (
    physical.portions.some(
      (row) => row.completeness === CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
    )
  ) {
    return CLADDING_COMMERCIAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  if (
    physical.portions.every(
      (row) => row.completeness === CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
    )
  ) {
    return CLADDING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  const billable = requirements.filter(
    (row) => row.componentKey !== CLADDING_SHEET_EQUIVALENT_INFORMATIONAL
  );
  if (billable.some((row) => !row.priced)) {
    return CLADDING_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED;
  }
  return CLADDING_COMMERCIAL_COMPLETENESS.COMPLETE_COMMERCIAL;
}

export function claddingComponentIsInformational(component: CladdingPhysicalComponent): boolean {
  return component.componentKey === CLADDING_SHEET_EQUIVALENT_INFORMATIONAL;
}
