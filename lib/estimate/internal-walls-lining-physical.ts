/**
 * WA-INTERNAL-WALLS-05 — lining requirement envelope + commercial lines.
 *
 * Per face / product. Commercial totals may aggregate only identical
 * physical sheet identities. Labour uses installed sheets, never waste sheets.
 * Timber/steel framing formulas live in internal-walls-physical.ts and are
 * not changed here.
 */

import { getCombinedLabourAccessFactor } from "@/lib/estimate/adjustments";
import { getCatalogueEntry } from "@/lib/rates/catalogue";
import { round2 } from "@/lib/estimate/facts";
import {
  buildAmounts,
  createFixedLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import {
  buildLabourRequirement,
  labourRequirementTotalCost,
} from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { findCompanyProductivityRate } from "@/lib/estimate/productivity";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { resolveMaterialWastage } from "@/lib/settings/material-wastage";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type {
  EstimateContext,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import type { InternalWallsJobScope } from "@/lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
  INTERNAL_WALLS_LINING_GROSS_SHEET_ASSUMPTION,
  INTERNAL_WALLS_LINING_LABOUR_OWNER_REQUIRED_MESSAGE,
  INTERNAL_WALLS_LINING_WASTE_CATEGORY,
  internalWallsLiningLabourComponent,
  internalWallsLiningMaterialComponent,
  internalWallsLiningOverlapGroup,
} from "@/lib/estimate/internal-walls-identities";
import {
  formatInternalWallsLiningTakeoff,
  internalWallsLiningFaceTakeoff,
  liningProductivityKeyForProduct,
  type InternalWallsLiningFaceSide,
  type InternalWallsLiningTakeoff,
} from "@/lib/estimate/internal-walls-lining";
import { presentInternalWallsHours } from "@/lib/estimate/internal-walls-framing";
import {
  INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE,
  wallTypeNeedsLength,
  type InternalWallsWallType,
} from "@/lib/estimate/internal-walls-wall-types";

function catalogueBenchmarkCost(itemKey: string): number | null {
  const entry = getCatalogueEntry(itemKey);
  return entry?.defaultCostRate != null && entry.defaultCostRate > 0
    ? entry.defaultCostRate
    : null;
}

function resolveExactMaterialRate(params: {
  itemKey: string;
  unit: string;
  context: EstimateContext;
}): {
  priced: boolean;
  costRate: number | null;
  sellRate: number | null;
  sourceType: "user_rate" | "benchmark" | "missing";
  sourceLabel: string;
} {
  const company = params.context.rates.find(
    (rate) =>
      rate.active &&
      rate.rate_type === "material" &&
      rate.item_key === params.itemKey &&
      rate.cost_rate != null
  );
  if (company?.cost_rate != null) {
    const resolved = resolveRate({
      rates: params.context.rates,
      rateType: "material",
      itemKey: params.itemKey,
      unit: params.unit,
      fallbackCostRate: company.cost_rate,
      fallbackSellRate: company.sell_rate ?? undefined,
      organisationSettings: params.context.organisationSettings,
    });
    return {
      priced: true,
      costRate: resolved.costRate,
      sellRate: resolved.sellRate,
      sourceType: "user_rate",
      sourceLabel: resolved.sourceLabel,
    };
  }
  const benchmark = catalogueBenchmarkCost(params.itemKey);
  if (
    benchmark != null &&
    params.context.organisationSettings?.allow_benchmark_rates !== false
  ) {
    const resolved = resolveRate({
      rates: params.context.rates,
      rateType: "material",
      itemKey: params.itemKey,
      unit: params.unit,
      fallbackCostRate: benchmark,
      organisationSettings: params.context.organisationSettings,
    });
    return {
      priced: true,
      costRate: resolved.costRate,
      sellRate: resolved.sellRate,
      sourceType: "benchmark",
      sourceLabel: resolved.sourceLabel,
    };
  }
  return {
    priced: false,
    costRate: null,
    sellRate: null,
    sourceType: "missing",
    sourceLabel: getRateSourceLabel("missing"),
  };
}

function unpricedMaterialLine(params: {
  workArea: EstimateWorkArea;
  label: string;
  quantity: number;
  unit: string;
  itemKey?: string;
  componentKey: string;
  identitySummary: string;
  notes: string;
  sortOrder: number;
  overlapGroup: string;
}): EstimateLineItemInput {
  const item: EstimateLineItemInput = {
    workAreaId: params.workArea.id,
    workAreaName: params.workArea.name,
    label: params.label,
    category: "materials",
    quantity: params.quantity,
    unit: params.unit,
    itemKey: params.itemKey,
    componentKey: params.componentKey,
    identitySummary: params.identitySummary,
    notes: params.notes,
    rateSource: getRateSourceLabel("missing"),
    rateSourceType: "missing",
    sortOrder: params.sortOrder,
    ...buildAmounts(0, 0, null),
  };
  return withPricingOwnership(item, {
    pricingOwner: "contractor_material",
    scopeKey: params.componentKey,
    overlapGroup: params.overlapGroup,
  });
}

function unpricedLabourLine(params: {
  workArea: EstimateWorkArea;
  label: string;
  quantity: number;
  unit: string;
  itemKey?: string;
  componentKey: string;
  identitySummary: string;
  notes: string;
  sortOrder: number;
  overlapGroup: string;
}): EstimateLineItemInput {
  const item: EstimateLineItemInput = {
    workAreaId: params.workArea.id,
    workAreaName: params.workArea.name,
    label: params.label,
    category: "labour",
    quantity: params.quantity,
    unit: params.unit,
    itemKey: params.itemKey,
    componentKey: params.componentKey,
    identitySummary: params.identitySummary,
    notes: params.notes,
    rateSource: getRateSourceLabel("missing"),
    rateSourceType: "missing",
    sortOrder: params.sortOrder,
    ...buildAmounts(0, 0, null),
  };
  return withPricingOwnership(item, {
    pricingOwner: "in_house_labour",
    scopeKey: params.componentKey,
    overlapGroup: params.overlapGroup,
  });
}

function wallTypeDisplayName(type: InternalWallsWallType, index: number): string {
  if (type.label && type.label.trim()) return type.label.trim();
  return `Wall Type ${index + 1}`;
}

function sideLabel(side: InternalWallsLiningFaceSide): string {
  return side === "side_a" ? "Side A" : "Side B";
}

function skipLiningForScope(jobScope: InternalWallsJobScope | null): boolean {
  return jobScope === "remove_partition";
}

export function buildInternalWallsLiningEnvelope(params: {
  context: EstimateContext;
  workArea: EstimateWorkArea;
  types: readonly InternalWallsWallType[];
  jobScope: InternalWallsJobScope | null;
  accessFactor?: number;
  sortOrderStart: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  nextSortOrder: number;
  emittedLining: boolean;
} {
  const { context, workArea, types, jobScope } = params;
  const accessFactor =
    params.accessFactor ??
    getCombinedLabourAccessFactor({ constraints: context.constraints });
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;

  if (skipLiningForScope(jobScope)) {
    return {
      requirements,
      lineItems,
      assumptions,
      missingInfo,
      nextSortOrder: sortOrder,
      emittedLining: false,
    };
  }

  const wastePercent = resolveMaterialWastage(
    context.materialWastageSettings,
    INTERNAL_WALLS_LINING_WASTE_CATEGORY
  );
  const wasteFactor = wastePercent / 100;
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const provenanceBase = {
    calculatorSource: "internal-walls-lining",
    factKeys: [
      "internal_walls.wall_types",
      "internal_walls.wall_type.side_a_product",
      "internal_walls.wall_type.side_b_product",
      "internal_walls.wall_type.length_lm",
      "internal_walls.wall_type.height_m",
    ],
    constraintKeys: [] as string[],
  };

  types.forEach((type, index) => {
    const displayName = wallTypeDisplayName(type, index);
    const overlapGroup = internalWallsLiningOverlapGroup(type.id);

    if (wallTypeNeedsLength(type, jobScope) && type.length_lm == null) {
      if (!missingInfo.includes(INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE)) {
        missingInfo.push(INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE);
      }
      return;
    }

    const sides: InternalWallsLiningFaceSide[] = ["side_a", "side_b"];
    for (const side of sides) {
      const face = side === "side_a" ? type.side_a : type.side_b;
      const productivityKey = face.product
        ? liningProductivityKeyForProduct(face.product)
        : null;
      const companyProductivity =
        productivityKey != null
          ? findCompanyProductivityRate(context.rates, productivityKey, "sheet")
          : undefined;
      const hoursPerSheet =
        companyProductivity?.cost_rate != null &&
        Number(companyProductivity.cost_rate) > 0
          ? Number(companyProductivity.cost_rate)
          : null;

      const takeoff = internalWallsLiningFaceTakeoff({
        type,
        face,
        side,
        wasteFactor,
        hoursPerSheet,
      });

      if (!takeoff.ok) {
        if (takeoff.kind === "not_lined") continue;
        if (takeoff.kind === "incomplete" && takeoff.message == null) continue;
        if (takeoff.kind === "too_short" && takeoff.message) {
          missingInfo.push(takeoff.message);
          continue;
        }
        if (
          (takeoff.kind === "catalogue_gap" || takeoff.kind === "custom") &&
          takeoff.message
        ) {
          emitCatalogueGap({
            workArea,
            type,
            displayName,
            side,
            overlapGroup,
            message: takeoff.message,
            product: takeoff.product,
            requirements,
            lineItems,
            bumpSortOrder: () => sortOrder++,
          });
          continue;
        }
        if (takeoff.message) missingInfo.push(takeoff.message);
        continue;
      }

      emitLiningFace({
        workArea,
        context,
        type,
        displayName,
        overlapGroup,
        takeoff,
        labourRate,
        accessFactor,
        provenanceBase,
        productivityKey: productivityKey ?? liningProductivityKeyForProduct(takeoff.product),
        requirements,
        lineItems,
        bumpSortOrder: () => sortOrder++,
      });
    }
  });

  if (requirements.length > 0 || lineItems.length > 0) {
    assumptions.push(INTERNAL_WALLS_LINING_GROSS_SHEET_ASSUMPTION);
  }

  return {
    requirements,
    lineItems,
    assumptions,
    missingInfo,
    nextSortOrder: sortOrder,
    emittedLining: requirements.length > 0 || lineItems.length > 0,
  };
}

function emitCatalogueGap(params: {
  workArea: EstimateWorkArea;
  type: InternalWallsWallType;
  displayName: string;
  side: InternalWallsLiningFaceSide;
  overlapGroup: string;
  message: string;
  product: string | null;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  bumpSortOrder: () => number;
}): void {
  const product = params.product ?? "other";
  const componentKey = internalWallsLiningMaterialComponent(product);
  const label = `${params.displayName} — ${sideLabel(params.side)} lining`;
  params.requirements.push(
    buildMaterialRequirement({
      workAreaId: params.workArea.id,
      workAreaType: "internal_walls",
      componentKey,
      variantKey: `${params.type.id}:${params.side}`,
      description: label,
      confidence: "low",
      assumptions: [],
      provenance: {
        calculatorSource: "internal-walls-lining",
        factKeys: ["internal_walls.wall_types"],
        constraintKeys: [],
      },
      priced: false,
      materialKey: null,
      category: "LINING",
      specification: params.message,
      baseQuantity: 0,
      baseUnit: "each",
      wasteFactor: 0,
      purchaseQuantity: 0,
      purchaseUnit: "each",
      rateSource: "missing",
      unitCost: null,
      totalCost: null,
    })
  );
  params.lineItems.push(
    unpricedMaterialLine({
      workArea: params.workArea,
      label,
      quantity: 0,
      unit: "each",
      componentKey,
      identitySummary: params.message,
      notes: params.message,
      sortOrder: params.bumpSortOrder(),
      overlapGroup: params.overlapGroup,
    })
  );
}

function emitLiningFace(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  type: InternalWallsWallType;
  displayName: string;
  overlapGroup: string;
  takeoff: Extract<InternalWallsLiningTakeoff, { ok: true }>;
  labourRate: ReturnType<typeof resolveLabourRate>;
  accessFactor: number;
  provenanceBase: {
    calculatorSource: string;
    factKeys: string[];
    constraintKeys: string[];
  };
  productivityKey: string;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  bumpSortOrder: () => number;
}): void {
  const { workArea, context, type, displayName, overlapGroup, takeoff } = params;
  const faceHeading = sideLabel(takeoff.side);
  const supporting = formatInternalWallsLiningTakeoff(takeoff);
  const materialComponent = internalWallsLiningMaterialComponent(takeoff.product);
  const labourComponent = internalWallsLiningLabourComponent(takeoff.product);
  const variantKey = `${type.id}:${takeoff.side}`;
  const materialLabel = `${displayName} — ${faceHeading} lining`;
  const labourLabel = `${displayName} — ${faceHeading} lining labour`;
  const rate = takeoff.materialKey
    ? resolveExactMaterialRate({
        itemKey: takeoff.materialKey,
        unit: "each",
        context,
      })
    : {
        priced: false as const,
        costRate: null,
        sellRate: null,
        sourceType: "missing" as const,
        sourceLabel: getRateSourceLabel("missing"),
      };

  params.requirements.push(
    buildMaterialRequirement({
      workAreaId: workArea.id,
      workAreaType: "internal_walls",
      componentKey: materialComponent,
      variantKey,
      description: materialLabel,
      confidence: "high",
      assumptions: [],
      provenance: params.provenanceBase,
      priced: rate.priced,
      materialKey: takeoff.materialKey,
      category: "LINING",
      specification: supporting,
      baseQuantity: takeoff.installedSheets,
      baseUnit: "each",
      wasteFactor: takeoff.wasteFactor,
      purchaseQuantity: takeoff.purchaseSheets,
      purchaseUnit: "each",
      rateSource: rate.priced
        ? rate.sourceType === "user_rate"
          ? "company"
          : "benchmark"
        : "missing",
      unitCost: rate.costRate,
      totalCost:
        rate.priced && rate.costRate != null
          ? round2(takeoff.purchaseSheets * rate.costRate)
          : null,
    })
  );

  if (rate.priced && rate.costRate != null && rate.sellRate != null && takeoff.materialKey) {
    params.lineItems.push(
      withPricingOwnership(
        {
          ...createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: materialLabel,
            category: "materials",
            quantity: takeoff.purchaseSheets,
            unit: "each",
            costRate: rate.costRate,
            sellRate: rate.sellRate,
            rateSource: rate.sourceLabel,
            rateSourceType: rate.sourceType,
            itemKey: takeoff.materialKey,
            componentKey: materialComponent,
            notes: supporting,
            sortOrder: params.bumpSortOrder(),
            organisationSettings: context.organisationSettings,
            qualityFactor: 1,
          }),
          identitySummary: supporting,
        },
        {
          pricingOwner: "contractor_material",
          scopeKey: materialComponent,
          overlapGroup,
        }
      )
    );
  } else {
    params.lineItems.push(
      unpricedMaterialLine({
        workArea,
        label: materialLabel,
        quantity: takeoff.purchaseSheets,
        unit: "each",
        itemKey: takeoff.materialKey ?? undefined,
        componentKey: materialComponent,
        identitySummary: supporting,
        notes: `${supporting}. Pricing required — no approved sheet rate for this size.`,
        sortOrder: params.bumpSortOrder(),
        overlapGroup,
      })
    );
  }

  const hasProductivity =
    takeoff.hoursPerSheet != null &&
    takeoff.hoursPerSheet > 0 &&
    takeoff.labourHours != null;
  if (hasProductivity && takeoff.labourHours != null && takeoff.hoursPerSheet != null) {
    const adjustedHours = round2(takeoff.labourHours * params.accessFactor);
    params.requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "internal_walls",
        componentKey: labourComponent,
        variantKey,
        description: labourLabel,
        confidence: "high",
        assumptions: [],
        provenance: params.provenanceBase,
        priced: true,
        trade: "carpenter",
        baseHours: takeoff.labourHours,
        productivityBasis: {
          key: params.productivityKey,
          hoursPerUnit: takeoff.hoursPerSheet,
          unit: "sheet",
          quantity: takeoff.installedSheets,
        },
        adjustmentRef: { factors: [] },
        adjustedHours,
        rateKey: params.labourRate.itemKey ?? INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
        hourlyCost: params.labourRate.costRate,
        totalCost: labourRequirementTotalCost({
          adjustedHours,
          hourlyCost: params.labourRate.costRate,
          hourlySell: params.labourRate.sellRate,
        }),
        rateProvenance:
          params.labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
      })
    );
    params.lineItems.push(
      withPricingOwnership(
        {
          ...createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: labourLabel,
            labourHours: adjustedHours,
            labourCostRate: params.labourRate.costRate,
            labourSellRate: params.labourRate.sellRate,
            rateSource: params.labourRate.sourceLabel,
            rateSourceType: params.labourRate.sourceType,
            itemKey: INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
            notes: `${takeoff.installedSheets} sheets installed · ${presentInternalWallsHours(adjustedHours)}`,
            sortOrder: params.bumpSortOrder(),
            organisationSettings: context.organisationSettings,
          }),
          componentKey: labourComponent,
          identitySummary: `${takeoff.installedSheets} sheets installed · ${presentInternalWallsHours(adjustedHours)}`,
        },
        {
          pricingOwner: "in_house_labour",
          scopeKey: labourComponent,
          overlapGroup,
        }
      )
    );
  } else {
    params.requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "internal_walls",
        componentKey: labourComponent,
        variantKey,
        description: labourLabel,
        confidence: "low",
        assumptions: [],
        provenance: params.provenanceBase,
        priced: false,
        trade: "carpenter",
        baseHours: 0,
        productivityBasis: {
          key: params.productivityKey,
          hoursPerUnit: 0,
          unit: "sheet",
          quantity: takeoff.installedSheets,
        },
        adjustmentRef: { factors: [] },
        adjustedHours: 0,
        rateKey: INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
        hourlyCost: null,
        totalCost: null,
        rateProvenance: "missing",
      })
    );
    params.lineItems.push(
      unpricedLabourLine({
        workArea,
        label: labourLabel,
        quantity: takeoff.installedSheets,
        unit: "sheet",
        itemKey: params.productivityKey,
        componentKey: labourComponent,
        identitySummary: `${takeoff.installedSheets} sheets installed · lining labour Pricing Required`,
        notes: INTERNAL_WALLS_LINING_LABOUR_OWNER_REQUIRED_MESSAGE,
        sortOrder: params.bumpSortOrder(),
        overlapGroup,
      })
    );
  }
}
