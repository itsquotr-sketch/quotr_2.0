/**
 * WA-INTERNAL-WALLS-03 — timber framing requirement envelope + commercial lines.
 *
 * Per Wall Type takeoff, then commercial totals may aggregate the same
 * shared timber key. Missing rate → Pricing Required with quantity visible.
 * Existing frame emits no framing material, labour, or fixings.
 * Steel / other: no timber fallback.
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
import { buildLabourRequirement, labourRequirementTotalCost } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { resolveProductivity } from "@/lib/estimate/productivity";
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
  INTERNAL_WALLS_FRAMING_140_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
  INTERNAL_WALLS_FRAMING_OTHER_COMPONENT,
  INTERNAL_WALLS_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT,
  INTERNAL_WALLS_FRAMING_WASTE_CATEGORY,
  INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE,
  INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE,
  INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS,
  INTERNAL_WALLS_PRODUCTIVITY_KEYS,
  INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE,
  INTERNAL_WALLS_STEEL_STUD_KEY,
  INTERNAL_WALLS_STEEL_TRACK_KEY,
  INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE,
  INTERNAL_WALLS_TIMBER_140_KEY,
  INTERNAL_WALLS_TIMBER_140_LABEL,
  INTERNAL_WALLS_TIMBER_90_KEY,
  INTERNAL_WALLS_TIMBER_90_LABEL,
  internalWallsFramingOverlapGroup,
} from "@/lib/estimate/internal-walls-identities";
import {
  formatInternalWallsFramingTakeoff,
  formatInternalWallsSteelTakeoff,
  internalWallsSteelTakeoff,
  internalWallsTimberTakeoff,
  presentInternalWallsHours,
  presentInternalWallsLm,
  resolveInternalWallsStudCentres,
  type InternalWallsSteelTakeoff,
  type InternalWallsTimberTakeoff,
} from "@/lib/estimate/internal-walls-framing";
import {
  INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE,
  isInternalWallsSteelTrackAndStud,
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

function wallTypeDisplayName(type: InternalWallsWallType, index: number): string {
  if (type.label && type.label.trim()) return type.label.trim();
  return `Wall Type ${index + 1}`;
}

function timberMaterialComponent(frameSize: "90x45" | "140x45" | "other") {
  if (frameSize === "90x45") return INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT;
  if (frameSize === "140x45") return INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT;
  return INTERNAL_WALLS_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT;
}

function timberLabourComponent(frameSize: "90x45" | "140x45") {
  return frameSize === "90x45"
    ? INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT
    : INTERNAL_WALLS_FRAMING_140_LABOUR_COMPONENT;
}

function timberLabel(frameSize: "90x45" | "140x45" | "other") {
  if (frameSize === "90x45") return INTERNAL_WALLS_TIMBER_90_LABEL;
  if (frameSize === "140x45") return INTERNAL_WALLS_TIMBER_140_LABEL;
  return "Other timber size";
}

function skipFramingForScope(jobScope: InternalWallsJobScope | null): boolean {
  return jobScope === "remove_partition" || jobScope === "form_opening";
}

export function aggregateInternalWallsTimberPurchaseLm(
  requirements: readonly EstimateRequirement[],
  materialKey: string
): number {
  return round2(
    requirements
      .filter(
        (row): row is Extract<EstimateRequirement, { kind: "material" }> =>
          row.kind === "material" && row.materialKey === materialKey
      )
      .reduce((sum, row) => sum + row.purchaseQuantity, 0)
  );
}

export function buildInternalWallsFramingEnvelope(params: {
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
  emittedFraming: boolean;
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

  if (skipFramingForScope(jobScope)) {
    return {
      requirements,
      lineItems,
      assumptions,
      missingInfo,
      nextSortOrder: sortOrder,
      emittedFraming: false,
    };
  }

  const wastePercent = resolveMaterialWastage(
    context.materialWastageSettings,
    INTERNAL_WALLS_FRAMING_WASTE_CATEGORY
  );
  const wasteFactor = wastePercent / 100;
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const provenanceBase = {
    calculatorSource: "internal-walls-framing",
    factKeys: [
      "internal_walls.wall_types",
      "internal_walls.wall_type.frame_system",
      "internal_walls.wall_type.frame_size",
      "internal_walls.wall_type.length_lm",
      "internal_walls.wall_type.height_m",
      "internal_walls.wall_type.stud_centres_mm",
    ],
    constraintKeys: [] as string[],
  };

  types.forEach((type, index) => {
    const displayName = wallTypeDisplayName(type, index);
    const overlapGroup = internalWallsFramingOverlapGroup(type.id);

    if (type.frame_system === "existing_frame") {
      return;
    }

    if (type.frame_system === "steel") {
      if (!isInternalWallsSteelTrackAndStud(type)) {
        missingInfo.push(INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE);
        const area =
          type.length_lm != null && type.height_m != null
            ? round2(type.length_lm * type.height_m)
            : null;
        requirements.push(
          buildMaterialRequirement({
            workAreaId: workArea.id,
            workAreaType: "internal_walls",
            componentKey: INTERNAL_WALLS_FRAMING_STEEL_COMPONENT,
            variantKey: type.id,
            description: `${displayName} — steel framing`,
            confidence: "low",
            assumptions: [],
            provenance: provenanceBase,
            priced: false,
            materialKey: null,
            category: "FRAMING",
            specification: "Steel framing — system not supported in V1",
            baseQuantity: area ?? 0,
            baseUnit: "m2",
            wasteFactor: 0,
            purchaseQuantity: area ?? 0,
            purchaseUnit: "m2",
            rateSource: "missing",
            unitCost: null,
            totalCost: null,
          })
        );
        lineItems.push(
          unpricedMaterialLine({
            workArea,
            label: `${displayName} — steel framing`,
            quantity: area ?? 0,
            unit: "m2",
            componentKey: INTERNAL_WALLS_FRAMING_STEEL_COMPONENT,
            identitySummary: "Standard track and stud only",
            notes: INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE,
            sortOrder: sortOrder++,
            overlapGroup,
          })
        );
        return;
      }

      if (wallTypeNeedsLength(type, jobScope) && type.length_lm == null) {
        if (!missingInfo.includes(INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE)) {
          missingInfo.push(INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE);
        }
        return;
      }
      if (type.length_lm == null || type.height_m == null) return;

      const centres = resolveInternalWallsStudCentres(type);
      if (!centres.ok) {
        missingInfo.push(INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE);
        return;
      }

      const productivity = resolveProductivity({
        productivityKey: INTERNAL_WALLS_PRODUCTIVITY_KEYS.steelTrackAndStudM2,
        unit: "m2",
        fallbackHoursPerUnit: INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.steelTrackAndStudM2,
        rates: context.rates,
      });
      const takeoff = internalWallsSteelTakeoff({
        type,
        centresMm: centres.mm,
        spacingM: centres.spacingM,
        hoursPerM2: productivity.hoursPerUnit,
      });
      if (!takeoff) return;

      emitSteelFraming({
        workArea,
        context,
        type,
        displayName,
        overlapGroup,
        takeoff,
        labourRate,
        productivity,
        accessFactor,
        provenanceBase,
        requirements,
        lineItems,
        bumpSortOrder: () => sortOrder++,
      });
      return;
    }

    if (type.frame_system === "other" || type.frame_system == null) {
      if (type.frame_system === "other") {
        missingInfo.push(INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE);
        requirements.push(
          buildMaterialRequirement({
            workAreaId: workArea.id,
            workAreaType: "internal_walls",
            componentKey: INTERNAL_WALLS_FRAMING_OTHER_COMPONENT,
            variantKey: type.id,
            description: `${displayName} — other framing`,
            confidence: "low",
            assumptions: [],
            provenance: provenanceBase,
            priced: false,
            materialKey: null,
            category: "FRAMING",
            specification: "Other framing — no timber fallback",
            baseQuantity: 0,
            baseUnit: "lm",
            wasteFactor: 0,
            purchaseQuantity: 0,
            purchaseUnit: "lm",
            rateSource: "missing",
            unitCost: null,
            totalCost: null,
          })
        );
        lineItems.push(
          unpricedMaterialLine({
            workArea,
            label: `${displayName} — other framing`,
            quantity: 0,
            unit: "lm",
            componentKey: INTERNAL_WALLS_FRAMING_OTHER_COMPONENT,
            identitySummary: "No timber fallback",
            notes: INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE,
            sortOrder: sortOrder++,
            overlapGroup,
          })
        );
      }
      return;
    }

    if (type.frame_system !== "timber") return;

    if (wallTypeNeedsLength(type, jobScope) && type.length_lm == null) {
      if (!missingInfo.includes(INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE)) {
        missingInfo.push(INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE);
      }
      return;
    }
    if (type.length_lm == null || type.height_m == null) return;
    if (type.frame_size == null) {
      missingInfo.push(INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE);
      return;
    }

    const centres = resolveInternalWallsStudCentres(type);
    if (!centres.ok) {
      missingInfo.push(INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE);
      return;
    }

    const isSized = type.frame_size === "90x45" || type.frame_size === "140x45";
    const productivity = isSized
      ? resolveProductivity({
          productivityKey:
            type.frame_size === "90x45"
              ? INTERNAL_WALLS_PRODUCTIVITY_KEYS.timber90M2
              : INTERNAL_WALLS_PRODUCTIVITY_KEYS.timber140M2,
          unit: "m2",
          fallbackHoursPerUnit:
            type.frame_size === "90x45"
              ? INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.timber90M2
              : INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.timber140M2,
          rates: context.rates,
        })
      : null;

    const takeoff = internalWallsTimberTakeoff({
      type,
      centresMm: centres.mm,
      spacingM: centres.spacingM,
      wasteFactor,
      hoursPerM2: productivity?.hoursPerUnit ?? null,
    });
    if (!takeoff) return;

    emitTimberFraming({
      workArea,
      context,
      type,
      displayName,
      overlapGroup,
      takeoff,
      labourRate,
      productivity,
      accessFactor,
      provenanceBase,
      requirements,
      lineItems,
      missingInfo,
      bumpSortOrder: () => sortOrder++,
    });
  });

  return {
    requirements,
    lineItems,
    assumptions,
    missingInfo,
    nextSortOrder: sortOrder,
    emittedFraming: requirements.length > 0 || lineItems.length > 0,
  };
}

function emitFramingLmMaterial(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  type: InternalWallsWallType;
  overlapGroup: string;
  componentKey: string;
  materialKey: string;
  label: string;
  specification: string;
  identitySummary: string;
  baseQuantity: number;
  purchaseQuantity: number;
  wasteFactor: number;
  unpricedNotes: string;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  bumpSortOrder: () => number;
}): void {
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
      variantKey: params.type.id,
      description: params.label,
      confidence: "high",
      assumptions: [],
      provenance: {
        calculatorSource: "internal-walls-framing",
        factKeys: [
          "internal_walls.wall_types",
          "internal_walls.wall_type.frame_system",
          "internal_walls.wall_type.length_lm",
          "internal_walls.wall_type.height_m",
          "internal_walls.wall_type.stud_centres_mm",
        ],
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
            notes: params.specification,
            sortOrder: params.bumpSortOrder(),
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
        sortOrder: params.bumpSortOrder(),
        overlapGroup: params.overlapGroup,
      })
    );
  }
}

function emitSteelFraming(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  type: InternalWallsWallType;
  displayName: string;
  overlapGroup: string;
  takeoff: InternalWallsSteelTakeoff;
  labourRate: ReturnType<typeof resolveLabourRate>;
  productivity: ReturnType<typeof resolveProductivity>;
  accessFactor: number;
  provenanceBase: {
    calculatorSource: string;
    factKeys: string[];
    constraintKeys: string[];
  };
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  bumpSortOrder: () => number;
}): void {
  const {
    workArea,
    context,
    type,
    displayName,
    overlapGroup,
    takeoff,
    labourRate,
    productivity,
    accessFactor,
    provenanceBase,
  } = params;
  const supporting = formatInternalWallsSteelTakeoff(takeoff);
  const trackSummary = `Track ${presentInternalWallsLm(takeoff.totalTrackLm)} (${presentInternalWallsLm(takeoff.topTrackLm)} top + ${presentInternalWallsLm(takeoff.bottomTrackLm)} bottom)`;
  const studSummary = `${takeoff.studCount} studs · ${takeoff.studCount} × ${takeoff.heightM} m · ${presentInternalWallsLm(takeoff.studLm)}`;

  emitFramingLmMaterial({
    workArea,
    context,
    type,
    overlapGroup,
    componentKey: INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT,
    materialKey: INTERNAL_WALLS_STEEL_TRACK_KEY,
    label: `${displayName} — steel track`,
    specification: supporting,
    identitySummary: `${takeoff.lengthLm} m × ${takeoff.heightM} m · ${takeoff.centresMm} mm centres · ${trackSummary}`,
    baseQuantity: takeoff.totalTrackLm,
    purchaseQuantity: takeoff.totalTrackLm,
    wasteFactor: takeoff.wasteFactor,
    unpricedNotes: `${trackSummary}. Pricing required — no approved steel track $/lm.`,
    requirements: params.requirements,
    lineItems: params.lineItems,
    bumpSortOrder: params.bumpSortOrder,
  });
  emitFramingLmMaterial({
    workArea,
    context,
    type,
    overlapGroup,
    componentKey: INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT,
    materialKey: INTERNAL_WALLS_STEEL_STUD_KEY,
    label: `${displayName} — steel studs`,
    specification: supporting,
    identitySummary: studSummary,
    baseQuantity: takeoff.studLm,
    purchaseQuantity: takeoff.studLm,
    wasteFactor: takeoff.wasteFactor,
    unpricedNotes: `${studSummary}. Pricing required — no approved steel stud $/lm.`,
    requirements: params.requirements,
    lineItems: params.lineItems,
    bumpSortOrder: params.bumpSortOrder,
  });

  const labourLabel = `${displayName} — steel framing labour`;
  const adjustedHours = round2(takeoff.labourHours * accessFactor);
  params.requirements.push(
    buildLabourRequirement({
      workAreaId: workArea.id,
      workAreaType: "internal_walls",
      componentKey: INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT,
      variantKey: type.id,
      description: labourLabel,
      confidence: "high",
      assumptions: [],
      provenance: provenanceBase,
      priced: true,
      trade: "carpenter",
      baseHours: takeoff.labourHours,
      productivityBasis: {
        key: productivity.key,
        hoursPerUnit: productivity.hoursPerUnit,
        unit: "m2",
        quantity: takeoff.wallAreaM2,
      },
      adjustmentRef: { factors: [] },
      adjustedHours,
      rateKey: labourRate.itemKey ?? INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
      hourlyCost: labourRate.costRate,
      totalCost: labourRequirementTotalCost({
        adjustedHours,
        hourlyCost: labourRate.costRate,
        hourlySell: labourRate.sellRate,
      }),
      rateProvenance:
        labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
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
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          rateSource: labourRate.sourceLabel,
          rateSourceType: labourRate.sourceType,
          itemKey: productivity.key,
          notes: presentInternalWallsHours(takeoff.labourHours),
          sortOrder: params.bumpSortOrder(),
          organisationSettings: context.organisationSettings,
        }),
        componentKey: INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT,
        identitySummary: presentInternalWallsHours(takeoff.labourHours),
        productivityRate: productivity.hoursPerUnit,
        productivityUnit: "m2",
        productivitySourceType: productivity.sourceType,
      },
      {
        pricingOwner: "in_house_labour",
        scopeKey: INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT,
        overlapGroup,
      }
    )
  );

  emitFixings({
    workArea,
    type,
    displayName,
    overlapGroup,
    takeoff,
    provenanceBase,
    supporting,
    requirements: params.requirements,
    lineItems: params.lineItems,
    bumpSortOrder: params.bumpSortOrder,
  });
}

function emitTimberFraming(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  type: InternalWallsWallType;
  displayName: string;
  overlapGroup: string;
  takeoff: InternalWallsTimberTakeoff;
  labourRate: ReturnType<typeof resolveLabourRate>;
  productivity: ReturnType<typeof resolveProductivity> | null;
  accessFactor: number;
  provenanceBase: {
    calculatorSource: string;
    factKeys: string[];
    constraintKeys: string[];
  };
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  missingInfo: string[];
  bumpSortOrder: () => number;
}): void {
  const {
    workArea,
    context,
    type,
    displayName,
    overlapGroup,
    takeoff,
    labourRate,
    productivity,
    accessFactor,
    provenanceBase,
  } = params;
  const frameSize = type.frame_size!;
  const supporting = formatInternalWallsFramingTakeoff(takeoff);
  const materialComponent = timberMaterialComponent(frameSize);
  const materialLabel = `${displayName} — ${timberLabel(frameSize)}`;

  if (frameSize === "other") {
    if (!params.missingInfo.includes(INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE)) {
      params.missingInfo.push(INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE);
    }
    params.requirements.push(
      buildMaterialRequirement({
        workAreaId: workArea.id,
        workAreaType: "internal_walls",
        componentKey: materialComponent,
        variantKey: type.id,
        description: materialLabel,
        confidence: "medium",
        assumptions: [],
        provenance: provenanceBase,
        priced: false,
        materialKey: null,
        category: "timber",
        specification: supporting,
        baseQuantity: takeoff.rawTimberLm,
        baseUnit: "lm",
        wasteFactor: takeoff.wasteFactor,
        purchaseQuantity: takeoff.purchaseTimberLm,
        purchaseUnit: "lm",
        rateSource: "missing",
        unitCost: null,
        totalCost: null,
      })
    );
    params.lineItems.push(
      unpricedMaterialLine({
        workArea,
        label: materialLabel,
        quantity: takeoff.purchaseTimberLm,
        unit: "lm",
        componentKey: materialComponent,
        identitySummary: supporting,
        notes: INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE,
        sortOrder: params.bumpSortOrder(),
        overlapGroup,
      })
    );
    emitFixings({
      ...params,
      supporting,
    });
    return;
  }

  const materialKey =
    frameSize === "90x45" ? INTERNAL_WALLS_TIMBER_90_KEY : INTERNAL_WALLS_TIMBER_140_KEY;
  const rate = resolveExactMaterialRate({
    itemKey: materialKey,
    unit: "lm",
    context,
  });
  params.requirements.push(
    buildMaterialRequirement({
      workAreaId: workArea.id,
      workAreaType: "internal_walls",
      componentKey: materialComponent,
      variantKey: type.id,
      description: materialLabel,
      confidence: "high",
      assumptions: [],
      provenance: provenanceBase,
      priced: rate.priced,
      materialKey,
      category: "timber",
      specification: supporting,
      baseQuantity: takeoff.rawTimberLm,
      baseUnit: "lm",
      wasteFactor: takeoff.wasteFactor,
      purchaseQuantity: takeoff.purchaseTimberLm,
      purchaseUnit: "lm",
      rateSource: rate.priced
        ? rate.sourceType === "user_rate"
          ? "company"
          : "benchmark"
        : "missing",
      unitCost: rate.costRate,
      totalCost:
        rate.priced && rate.costRate != null
          ? round2(takeoff.purchaseTimberLm * rate.costRate)
          : null,
    })
  );

  if (rate.priced && rate.costRate != null && rate.sellRate != null) {
    params.lineItems.push(
      withPricingOwnership(
        {
          ...createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: materialLabel,
            category: "materials",
            quantity: takeoff.purchaseTimberLm,
            unit: "lm",
            costRate: rate.costRate,
            sellRate: rate.sellRate,
            rateSource: rate.sourceLabel,
            rateSourceType: rate.sourceType,
            itemKey: materialKey,
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
        quantity: takeoff.purchaseTimberLm,
        unit: "lm",
        itemKey: materialKey,
        componentKey: materialComponent,
        identitySummary: supporting,
        notes: `${supporting}. Pricing required — no approved ${timberLabel(frameSize)} $/lm.`,
        sortOrder: params.bumpSortOrder(),
        overlapGroup,
      })
    );
  }

  if (productivity) {
    const labourComponent = timberLabourComponent(frameSize);
    const labourLabel = `${displayName} — timber framing labour`;
    const adjustedHours = round2(takeoff.labourHours * accessFactor);
    params.requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "internal_walls",
        componentKey: labourComponent,
        variantKey: type.id,
        description: labourLabel,
        confidence: "high",
        assumptions: [],
        provenance: provenanceBase,
        priced: true,
        trade: "carpenter",
        baseHours: takeoff.labourHours,
        productivityBasis: {
          key: productivity.key,
          hoursPerUnit: productivity.hoursPerUnit,
          unit: "m2",
          quantity: takeoff.wallAreaM2,
        },
        adjustmentRef: { factors: [] },
        adjustedHours,
        rateKey: labourRate.itemKey ?? INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
        hourlyCost: labourRate.costRate,
        totalCost: labourRequirementTotalCost({
          adjustedHours,
          hourlyCost: labourRate.costRate,
          hourlySell: labourRate.sellRate,
        }),
        rateProvenance:
          labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
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
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: labourRate.sourceLabel,
            rateSourceType: labourRate.sourceType,
            itemKey: productivity.key,
            notes: presentInternalWallsHours(takeoff.labourHours),
            sortOrder: params.bumpSortOrder(),
            organisationSettings: context.organisationSettings,
          }),
          componentKey: labourComponent,
          identitySummary: presentInternalWallsHours(takeoff.labourHours),
          productivityRate: productivity.hoursPerUnit,
          productivityUnit: "m2",
          productivitySourceType: productivity.sourceType,
        },
        {
          pricingOwner: "in_house_labour",
          scopeKey: labourComponent,
          overlapGroup,
        }
      )
    );
  }

  emitFixings({
    ...params,
    supporting,
  });
}

function emitFixings(params: {
  workArea: EstimateWorkArea;
  type: InternalWallsWallType;
  displayName: string;
  overlapGroup: string;
  takeoff: { wallAreaM2: number };
  provenanceBase: {
    calculatorSource: string;
    factKeys: string[];
    constraintKeys: string[];
  };
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  supporting: string;
  bumpSortOrder: () => number;
}): void {
  const {
    workArea,
    type,
    displayName,
    overlapGroup,
    takeoff,
    provenanceBase,
    supporting,
  } = params;
  const label = `${displayName} — framing fixings allowance`;
  params.requirements.push(
    buildMaterialRequirement({
      workAreaId: workArea.id,
      workAreaType: "internal_walls",
      componentKey: INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
      variantKey: type.id,
      description: label,
      confidence: "medium",
      assumptions: [
        {
          key: "internal_walls.framing.fixings",
          text: "General framing-fixings allowance on wall framing area. Anchors, nails/screws, small brackets, standard consumables. Not a screw-count takeoff.",
          source: "calculator_default",
        },
      ],
      provenance: provenanceBase,
      priced: false,
      materialKey: INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
      category: "FIXINGS",
      specification: `${takeoff.wallAreaM2} m² wall framing area · allowance`,
      baseQuantity: takeoff.wallAreaM2,
      baseUnit: "m2",
      wasteFactor: 0,
      purchaseQuantity: takeoff.wallAreaM2,
      purchaseUnit: "m2",
      rateSource: "missing",
      unitCost: null,
      totalCost: null,
    })
  );
  params.lineItems.push(
    unpricedMaterialLine({
      workArea,
      label,
      quantity: takeoff.wallAreaM2,
      unit: "m2",
      itemKey: INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
      componentKey: INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
      identitySummary: `${takeoff.wallAreaM2} m² wall area · framing fixings allowance`,
      notes: `${supporting}. Pricing required — no approved framing-fixings $/m².`,
      sortOrder: params.bumpSortOrder(),
      overlapGroup,
    })
  );
}
