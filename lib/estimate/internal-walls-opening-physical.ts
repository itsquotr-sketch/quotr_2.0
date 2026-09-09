/**
 * WA-INTERNAL-WALLS-06 — opening framing / labour / form-opening lining
 * make-good envelope.
 *
 * Additive to IW-03/04 base framing. Opening timber feeds its own raw lm,
 * then waste once on that raw qty (not wasted again on a combined total).
 * Opening labour has no owner hours → Pricing Required; does not block
 * known base framing/lining money.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import { round2 } from "@/lib/estimate/facts";
import { buildAmounts, createRateLineItem } from "@/lib/estimate/line-items";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { resolveRate } from "@/lib/estimate/rates";
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
  INTERNAL_WALLS_FRAMING_WASTE_CATEGORY,
  INTERNAL_WALLS_OPENING_FORM_LABOUR_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_140_MATERIAL_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_STEEL_STUD_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_STEEL_TRACK_COMPONENT,
  INTERNAL_WALLS_OPENING_LINING_MAKE_GOOD_COMPONENT,
  INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE,
  INTERNAL_WALLS_STEEL_STUD_KEY,
  INTERNAL_WALLS_STEEL_TRACK_KEY,
  INTERNAL_WALLS_STEEL_WASTE_FACTOR,
  INTERNAL_WALLS_TIMBER_140_KEY,
  INTERNAL_WALLS_TIMBER_90_KEY,
  internalWallsOpeningFramingOverlapGroup,
} from "@/lib/estimate/internal-walls-identities";
import {
  INTERNAL_WALLS_DOOR_LEAF_NOT_INCLUDED_STATEMENT,
  INTERNAL_WALLS_OPENING_CRIPPLES_DEFERRED_STATEMENT,
  INTERNAL_WALLS_OPENING_DIMENSIONS_REQUIRED_MESSAGE,
  INTERNAL_WALLS_OPENING_FORM_HOURS_EACH_KEY,
  INTERNAL_WALLS_OPENING_LABOUR_OWNER_REQUIRED_MESSAGE,
  INTERNAL_WALLS_OPENING_MAKE_GOOD_MESSAGE,
  INTERNAL_WALLS_OPENING_REQUIRED_MESSAGE,
  formatInternalWallsOpeningFramingTakeoff,
  formatOpeningDimensionsMm,
  internalWallsSteelOpeningTakeoff,
  internalWallsTimberOpeningTakeoff,
  openingTypeDisplay,
  openingsEligibleForTakeoff,
  trimmerHeightM,
  validateOpeningCollection,
  type InternalWallsOpening,
} from "@/lib/estimate/internal-walls-openings";
import {
  isInternalWallsSteelTrackAndStud,
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
  identitySummary: string;
  notes: string;
  sortOrder: number;
  overlapGroup: string;
  componentKey: string;
}): EstimateLineItemInput {
  const item: EstimateLineItemInput = {
    workAreaId: params.workArea.id,
    workAreaName: params.workArea.name,
    label: params.label,
    category: "labour",
    quantity: 1,
    unit: "opening",
    itemKey: INTERNAL_WALLS_OPENING_FORM_HOURS_EACH_KEY,
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

function emitLmMaterial(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  wallTypeId: string;
  openingId: string;
  overlapGroup: string;
  componentKey: string;
  materialKey: string | null;
  label: string;
  specification: string;
  identitySummary: string;
  baseQuantity: number;
  purchaseQuantity: number;
  wasteFactor: number;
  unpricedNotes: string;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  sortOrder: number;
}): number {
  const variantKey = `${params.wallTypeId}:${params.openingId}`;
  if (!params.materialKey) {
    params.requirements.push(
      buildMaterialRequirement({
        workAreaId: params.workArea.id,
        workAreaType: "internal_walls",
        componentKey: params.componentKey,
        variantKey,
        description: params.label,
        confidence: "medium",
        assumptions: [],
        provenance: {
          calculatorSource: "internal-walls-openings",
          factKeys: ["internal_walls.wall_types"],
          constraintKeys: [],
        },
        priced: false,
        materialKey: null,
        category: "FRAMING",
        specification: params.specification,
        baseQuantity: params.baseQuantity,
        baseUnit: "lm",
        wasteFactor: params.wasteFactor,
        purchaseQuantity: params.purchaseQuantity,
        purchaseUnit: "lm",
        rateSource: "missing",
        unitCost: null,
        totalCost: null,
      })
    );
    params.lineItems.push(
      unpricedMaterialLine({
        workArea: params.workArea,
        label: params.label,
        quantity: params.purchaseQuantity,
        unit: "lm",
        componentKey: params.componentKey,
        identitySummary: params.identitySummary,
        notes: params.unpricedNotes,
        sortOrder: params.sortOrder,
        overlapGroup: params.overlapGroup,
      })
    );
    return params.sortOrder + 1;
  }

  const rate = resolveExactMaterialRate({
    itemKey: params.materialKey,
    unit: "lm",
    context: params.context,
  });
  params.requirements.push(
    buildMaterialRequirement({
      workAreaId: params.workArea.id,
      workAreaType: "internal_walls",
      componentKey: params.componentKey,
      variantKey,
      description: params.label,
      confidence: "high",
      assumptions: [],
      provenance: {
        calculatorSource: "internal-walls-openings",
        factKeys: ["internal_walls.wall_types"],
        constraintKeys: [],
      },
      priced: rate.priced,
      materialKey: params.materialKey,
      category: "FRAMING",
      specification: params.specification,
      baseQuantity: params.baseQuantity,
      baseUnit: "lm",
      wasteFactor: params.wasteFactor,
      purchaseQuantity: params.purchaseQuantity,
      purchaseUnit: "lm",
      rateSource: rate.priced
        ? rate.sourceType === "user_rate"
          ? "company"
          : "benchmark"
        : "missing",
      unitCost: rate.costRate,
      totalCost:
        rate.priced && rate.costRate != null
          ? round2(params.purchaseQuantity * rate.costRate)
          : null,
    })
  );
  if (rate.priced && rate.costRate != null && rate.sellRate != null) {
    params.lineItems.push(
      withPricingOwnership(
        {
          ...createRateLineItem({
            workAreaId: params.workArea.id,
            workAreaName: params.workArea.name,
            label: params.label,
            category: "materials",
            quantity: params.purchaseQuantity,
            unit: "lm",
            costRate: rate.costRate,
            sellRate: rate.sellRate,
            rateSource: rate.sourceLabel,
            rateSourceType: rate.sourceType,
            itemKey: params.materialKey,
            componentKey: params.componentKey,
            notes: params.identitySummary,
            sortOrder: params.sortOrder,
            organisationSettings: params.context.organisationSettings,
            qualityFactor: 1,
          }),
          identitySummary: params.identitySummary,
        },
        {
          pricingOwner: "contractor_material",
          scopeKey: params.componentKey,
          overlapGroup: params.overlapGroup,
        }
      )
    );
  } else {
    params.lineItems.push(
      unpricedMaterialLine({
        workArea: params.workArea,
        label: params.label,
        quantity: params.purchaseQuantity,
        unit: "lm",
        itemKey: params.materialKey,
        componentKey: params.componentKey,
        identitySummary: params.identitySummary,
        notes: params.unpricedNotes,
        sortOrder: params.sortOrder,
        overlapGroup: params.overlapGroup,
      })
    );
  }
  return params.sortOrder + 1;
}

function emitOpeningLabour(params: {
  workArea: EstimateWorkArea;
  wallTypeId: string;
  opening: InternalWallsOpening;
  displayName: string;
  overlapGroup: string;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  sortOrder: number;
}): number {
  const label = `${params.displayName} — opening labour`;
  const identity = `${formatInternalWallsOpeningFramingTakeoff({
    typeLabel: openingTypeDisplay(params.opening.type) ?? "Opening",
    dimensions: formatOpeningDimensionsMm(
      params.opening.width_m,
      params.opening.height_m
    ),
    trimmerStudCount: 2,
    headerLm: params.opening.width_m ?? 0,
  })} · ${INTERNAL_WALLS_OPENING_LABOUR_OWNER_REQUIRED_MESSAGE}`;
  params.requirements.push(
    buildLabourRequirement({
      workAreaId: params.workArea.id,
      workAreaType: "internal_walls",
      componentKey: INTERNAL_WALLS_OPENING_FORM_LABOUR_COMPONENT,
      variantKey: `${params.wallTypeId}:${params.opening.id}`,
      description: label,
      confidence: "low",
      assumptions: [],
      provenance: {
        calculatorSource: "internal-walls-openings",
        factKeys: ["internal_walls.wall_types"],
        constraintKeys: [],
      },
      priced: false,
      trade: "carpenter",
      baseHours: 0,
      productivityBasis: {
        key: INTERNAL_WALLS_OPENING_FORM_HOURS_EACH_KEY,
        hoursPerUnit: 0,
        unit: "opening",
        quantity: 1,
      },
      adjustmentRef: { factors: [] },
      adjustedHours: 0,
      rateKey: INTERNAL_WALLS_OPENING_FORM_HOURS_EACH_KEY,
      hourlyCost: null,
      totalCost: null,
      rateProvenance: "missing",
    })
  );
  params.lineItems.push(
    unpricedLabourLine({
      workArea: params.workArea,
      label,
      identitySummary: identity,
      notes: INTERNAL_WALLS_OPENING_LABOUR_OWNER_REQUIRED_MESSAGE,
      sortOrder: params.sortOrder,
      overlapGroup: params.overlapGroup,
      componentKey: INTERNAL_WALLS_OPENING_FORM_LABOUR_COMPONENT,
    })
  );
  return params.sortOrder + 1;
}

function emitFormOpeningMakeGood(params: {
  workArea: EstimateWorkArea;
  type: InternalWallsWallType;
  opening: InternalWallsOpening;
  displayName: string;
  overlapGroup: string;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  sortOrder: number;
}): number {
  const lined = params.type.side_a.lined || params.type.side_b.lined;
  if (!lined) return params.sortOrder;
  const label = `${params.displayName} — lining make-good`;
  params.requirements.push(
    buildMaterialRequirement({
      workAreaId: params.workArea.id,
      workAreaType: "internal_walls",
      componentKey: INTERNAL_WALLS_OPENING_LINING_MAKE_GOOD_COMPONENT,
      variantKey: `${params.type.id}:${params.opening.id}`,
      description: label,
      confidence: "low",
      assumptions: [],
      provenance: {
        calculatorSource: "internal-walls-openings",
        factKeys: ["internal_walls.wall_types"],
        constraintKeys: [],
      },
      priced: false,
      materialKey: null,
      category: "LINING",
      specification: INTERNAL_WALLS_OPENING_MAKE_GOOD_MESSAGE,
      baseQuantity: 0,
      baseUnit: "m2",
      wasteFactor: 0,
      purchaseQuantity: 0,
      purchaseUnit: "m2",
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
      unit: "m2",
      componentKey: INTERNAL_WALLS_OPENING_LINING_MAKE_GOOD_COMPONENT,
      identitySummary: INTERNAL_WALLS_OPENING_MAKE_GOOD_MESSAGE,
      notes: INTERNAL_WALLS_OPENING_MAKE_GOOD_MESSAGE,
      sortOrder: params.sortOrder,
      overlapGroup: params.overlapGroup,
    })
  );
  return params.sortOrder + 1;
}

function emitTimberOpening(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  type: InternalWallsWallType;
  opening: InternalWallsOpening;
  displayName: string;
  wasteFactor: number;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  missingInfo: string[];
  sortOrder: number;
}): number {
  const height = trimmerHeightM({
    wallHeightM: params.type.height_m,
    openingHeightM: params.opening.height_m,
  });
  if (height == null) {
    if (!params.missingInfo.includes(INTERNAL_WALLS_OPENING_DIMENSIONS_REQUIRED_MESSAGE)) {
      params.missingInfo.push(INTERNAL_WALLS_OPENING_DIMENSIONS_REQUIRED_MESSAGE);
    }
    return params.sortOrder;
  }
  const takeoff = internalWallsTimberOpeningTakeoff({
    opening: params.opening,
    trimmerHeightM: height,
    wasteFactor: params.wasteFactor,
  });
  if (!takeoff) return params.sortOrder;
  const overlapGroup = internalWallsOpeningFramingOverlapGroup(
    params.type.id,
    params.opening.id
  );
  const typeLabel = openingTypeDisplay(params.opening.type) ?? "Opening";
  const specification = formatInternalWallsOpeningFramingTakeoff({
    typeLabel,
    dimensions: formatOpeningDimensionsMm(
      params.opening.width_m,
      params.opening.height_m
    ),
    trimmerStudCount: takeoff.trimmerStudCount,
    headerLm: takeoff.headerLm,
  });
  const frameSize = params.type.frame_size;
  if (frameSize === "other" || frameSize == null) {
    if (frameSize === "other" && !params.missingInfo.includes(INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE)) {
      params.missingInfo.push(INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE);
    }
    return emitLmMaterial({
      workArea: params.workArea,
      context: params.context,
      wallTypeId: params.type.id,
      openingId: params.opening.id,
      overlapGroup,
      componentKey: INTERNAL_WALLS_OPENING_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT,
      materialKey: null,
      label: `${params.displayName} — opening framing`,
      specification,
      identitySummary: specification,
      baseQuantity: takeoff.rawTimberLm,
      purchaseQuantity: takeoff.purchaseTimberLm,
      wasteFactor: takeoff.wasteFactor,
      unpricedNotes: INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE,
      requirements: params.requirements,
      lineItems: params.lineItems,
      sortOrder: params.sortOrder,
    });
  }
  const materialKey =
    frameSize === "90x45" ? INTERNAL_WALLS_TIMBER_90_KEY : INTERNAL_WALLS_TIMBER_140_KEY;
  const componentKey =
    frameSize === "90x45"
      ? INTERNAL_WALLS_OPENING_FRAMING_90_MATERIAL_COMPONENT
      : INTERNAL_WALLS_OPENING_FRAMING_140_MATERIAL_COMPONENT;
  return emitLmMaterial({
    workArea: params.workArea,
    context: params.context,
    wallTypeId: params.type.id,
    openingId: params.opening.id,
    overlapGroup,
    componentKey,
    materialKey,
    label: `${params.displayName} — opening framing`,
    specification,
    identitySummary: specification,
    baseQuantity: takeoff.rawTimberLm,
    purchaseQuantity: takeoff.purchaseTimberLm,
    wasteFactor: takeoff.wasteFactor,
    unpricedNotes: `${specification}. Pricing required — no approved timber $/lm.`,
    requirements: params.requirements,
    lineItems: params.lineItems,
    sortOrder: params.sortOrder,
  });
}

function emitSteelOpening(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  type: InternalWallsWallType;
  opening: InternalWallsOpening;
  displayName: string;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  missingInfo: string[];
  sortOrder: number;
}): number {
  const height = trimmerHeightM({
    wallHeightM: params.type.height_m,
    openingHeightM: params.opening.height_m,
  });
  if (height == null) return params.sortOrder;
  const takeoff = internalWallsSteelOpeningTakeoff({
    opening: params.opening,
    trimmerHeightM: height,
    wasteFactor: INTERNAL_WALLS_STEEL_WASTE_FACTOR,
  });
  if (!takeoff) return params.sortOrder;
  const overlapGroup = internalWallsOpeningFramingOverlapGroup(
    params.type.id,
    params.opening.id
  );
  const typeLabel = openingTypeDisplay(params.opening.type) ?? "Opening";
  const specification = [
    typeLabel,
    formatOpeningDimensionsMm(params.opening.width_m, params.opening.height_m),
    `${takeoff.jambStudCount} jamb studs`,
    `${takeoff.headerTrackLm} lm head track`,
  ]
    .filter(Boolean)
    .join(" · ");
  let sortOrder = emitLmMaterial({
    workArea: params.workArea,
    context: params.context,
    wallTypeId: params.type.id,
    openingId: params.opening.id,
    overlapGroup,
    componentKey: INTERNAL_WALLS_OPENING_FRAMING_STEEL_STUD_COMPONENT,
    materialKey: INTERNAL_WALLS_STEEL_STUD_KEY,
    label: `${params.displayName} — opening steel studs`,
    specification,
    identitySummary: `${takeoff.jambStudCount} jamb studs · ${takeoff.jambStudLm} lm`,
    baseQuantity: takeoff.jambStudLm,
    purchaseQuantity: takeoff.jambStudLm,
    wasteFactor: takeoff.wasteFactor,
    unpricedNotes: `${specification}. Pricing required — no approved steel stud $/lm.`,
    requirements: params.requirements,
    lineItems: params.lineItems,
    sortOrder: params.sortOrder,
  });
  sortOrder = emitLmMaterial({
    workArea: params.workArea,
    context: params.context,
    wallTypeId: params.type.id,
    openingId: params.opening.id,
    overlapGroup,
    componentKey: INTERNAL_WALLS_OPENING_FRAMING_STEEL_TRACK_COMPONENT,
    materialKey: INTERNAL_WALLS_STEEL_TRACK_KEY,
    label: `${params.displayName} — opening head track`,
    specification,
    identitySummary: `${takeoff.headerTrackLm} lm head track`,
    baseQuantity: takeoff.headerTrackLm,
    purchaseQuantity: takeoff.headerTrackLm,
    wasteFactor: takeoff.wasteFactor,
    unpricedNotes: `${specification}. Pricing required — no approved steel track $/lm.`,
    requirements: params.requirements,
    lineItems: params.lineItems,
    sortOrder,
  });
  return sortOrder;
}

export function buildInternalWallsOpeningEnvelope(params: {
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
  emittedOpeningWork: boolean;
} {
  const { context, workArea, types, jobScope } = params;
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;

  if (jobScope === "remove_partition" || jobScope === "infill_opening") {
    if (jobScope === "infill_opening") {
      for (const type of types) {
        if (type.openings.length === 0) {
          if (!missingInfo.includes(INTERNAL_WALLS_OPENING_REQUIRED_MESSAGE)) {
            missingInfo.push(INTERNAL_WALLS_OPENING_REQUIRED_MESSAGE);
          }
        }
      }
    }
    return {
      requirements,
      lineItems,
      assumptions,
      missingInfo,
      nextSortOrder: sortOrder,
      emittedOpeningWork: false,
    };
  }

  const timberWaste =
    resolveMaterialWastage(
      context.materialWastageSettings,
      INTERNAL_WALLS_FRAMING_WASTE_CATEGORY
    ) / 100;

  types.forEach((type, index) => {
    const displayName = wallTypeDisplayName(type, index);
    const compareToWall =
      jobScope !== "form_opening" && type.length_lm != null;
    const validation = validateOpeningCollection({
      openings: type.openings,
      wallLengthLm: type.length_lm,
      wallHeightM: type.height_m,
      compareToWall,
    });
    if (!validation.ok) {
      if (
        type.has_openings === true ||
        type.openings.length > 0 ||
        jobScope === "form_opening"
      ) {
        if (!missingInfo.includes(validation.message)) {
          missingInfo.push(validation.message);
        }
      }
    }
    if (jobScope === "form_opening" && type.openings.length === 0) {
      if (!missingInfo.includes(INTERNAL_WALLS_OPENING_REQUIRED_MESSAGE)) {
        missingInfo.push(INTERNAL_WALLS_OPENING_REQUIRED_MESSAGE);
      }
      return;
    }

    const eligible = openingsEligibleForTakeoff(type.openings, {
      wallLengthLm: type.length_lm,
      wallHeightM: type.height_m,
      compareToWall,
    });

    for (const opening of eligible) {
      const overlapGroup = internalWallsOpeningFramingOverlapGroup(
        type.id,
        opening.id
      );
      if (type.frame_system === "timber" || (type.frame_system === "existing_frame" && type.frame_size)) {
        sortOrder = emitTimberOpening({
          workArea,
          context,
          type,
          opening,
          displayName,
          wasteFactor: timberWaste,
          requirements,
          lineItems,
          missingInfo,
          sortOrder,
        });
      } else if (type.frame_system === "steel" && isInternalWallsSteelTrackAndStud(type)) {
        sortOrder = emitSteelOpening({
          workArea,
          context,
          type,
          opening,
          displayName,
          requirements,
          lineItems,
          missingInfo,
          sortOrder,
        });
      } else if (type.frame_system === "steel") {
        sortOrder = emitLmMaterial({
          workArea,
          context,
          wallTypeId: type.id,
          openingId: opening.id,
          overlapGroup,
          componentKey: INTERNAL_WALLS_OPENING_FRAMING_STEEL_TRACK_COMPONENT,
          materialKey: null,
          label: `${displayName} — opening steel framing`,
          specification: "Steel opening framing needs a specialist price.",
          identitySummary: "Steel opening framing — Pricing Required",
          baseQuantity: 0,
          purchaseQuantity: 0,
          wasteFactor: 0,
          unpricedNotes: "Steel opening framing is Pricing Required.",
          requirements,
          lineItems,
          sortOrder,
        });
      }

      sortOrder = emitOpeningLabour({
        workArea,
        wallTypeId: type.id,
        opening,
        displayName,
        overlapGroup,
        requirements,
        lineItems,
        sortOrder,
      });

      if (jobScope === "form_opening") {
        sortOrder = emitFormOpeningMakeGood({
          workArea,
          type,
          opening,
          displayName,
          overlapGroup,
          requirements,
          lineItems,
          sortOrder,
        });
      }

      if (opening.type === "door") {
        assumptions.push(INTERNAL_WALLS_DOOR_LEAF_NOT_INCLUDED_STATEMENT);
      }
    }
  });

  if (requirements.some((row) => row.componentKey.includes("opening.framing"))) {
    assumptions.push(INTERNAL_WALLS_OPENING_CRIPPLES_DEFERRED_STATEMENT);
  }

  return {
    requirements,
    lineItems,
    assumptions,
    missingInfo,
    nextSortOrder: sortOrder,
    emittedOpeningWork: requirements.length > 0 || lineItems.length > 0,
  };
}

export function typesForInfillFraming(
  types: readonly InternalWallsWallType[]
): InternalWallsWallType[] {
  const out: InternalWallsWallType[] = [];
  for (const type of types) {
    const eligible = openingsEligibleForTakeoff(type.openings, {
      wallLengthLm: null,
      wallHeightM: null,
      compareToWall: false,
    });
    for (const opening of eligible) {
      out.push({
        ...type,
        id: type.openings.length <= 1 ? type.id : `${type.id}:${opening.id}`,
        length_lm: opening.width_m,
        height_m: opening.height_m,
        openings: [],
        has_openings: false,
        active_opening_id: null,
      });
    }
  }
  return out;
}
