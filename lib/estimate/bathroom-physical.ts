/**
 * WA-BATHROOM-03 — mature-path substrate / lining / framing requirements.
 *
 * Emits MaterialRequirement + LabourRequirement plus commercial line items.
 * Missing material $ → Pricing Required (physical quantity still shown).
 * Does not invent dollar prices. Does not apply 10% sheet waste to timber lm.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import {
  BATHROOM_AQUALINE_CEILING_ASSUMPTION,
  BATHROOM_AQUALINE_LABEL,
  BATHROOM_AQUALINE_SHEET_KEY,
  BATHROOM_AQUALINE_WALL_ASSUMPTION,
  BATHROOM_CEILING_LINING_COMPONENT,
  BATHROOM_CEILING_LINING_LABOUR_COMPONENT,
  BATHROOM_CEILING_NESTED_STATEMENT,
  BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FRAMING_COMPONENT,
  BATHROOM_FRAMING_LABOUR_COMPONENT,
  BATHROOM_FRAMING_REQUIRED_MESSAGE,
  BATHROOM_FRAMING_TIMBER_KEY,
  BATHROOM_FRAMING_TIMBER_LABEL,
  BATHROOM_PLYWOOD_ASSUMPTION,
  BATHROOM_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_PRODUCTIVITY_KEYS,
  BATHROOM_SHEET_WASTE_STATEMENT,
  BATHROOM_WALL_LINING_COMPONENT,
  BATHROOM_WALL_LINING_LABOUR_COMPONENT,
} from "@/lib/estimate/bathroom-identities";
import { BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT } from "@/lib/estimate/bathroom-geometry";
import { bathroomFramingTakeoff, presentBathroomLm } from "@/lib/estimate/bathroom-framing";
import {
  bathroomLiningHours,
  bathroomSheetMaterialLabel,
  bathroomSheetTakeoff,
  presentBathroomAreaM2,
  presentBathroomHours,
} from "@/lib/estimate/bathroom-linings";
import {
  parseBathroomFloorSubstrate,
  parseBathroomFramingLevel,
  type BathroomFloorSubstrateSystem,
  type BathroomFramingLevel,
} from "@/lib/estimate/bathroom-scope";
import { round2 } from "@/lib/estimate/facts";
import { getBooleanFact, getFact, getStringFact, isNotSureValue } from "@/lib/estimate/facts";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { createSheetCountBuildUp } from "@/lib/estimate/material-buildup-meta";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import {
  createFixedLabourLineItem,
  createRateLineItem,
  buildAmounts,
} from "@/lib/estimate/line-items";
import type {
  EstimateContext,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type { BathroomGeometryResolution } from "@/lib/estimate/bathroom-geometry";

export type BathroomPhysicalSelection = {
  floorSubstrate: BathroomFloorSubstrateSystem | null;
  floorSubstrateAssumed: boolean;
  wallLining: "aqualine" | "other" | "none" | null;
  wallLiningAssumed: boolean;
  ceilingLining: "aqualine" | "other" | "none" | null;
  ceilingLiningAssumed: boolean;
  framingLevel: BathroomFramingLevel | null;
  framingUnknown: boolean;
};

function factValue(
  facts: EstimateContext["facts"],
  workAreaId: string,
  key: string
): unknown {
  return getFact(facts as never, workAreaId, key)?.value;
}

export function resolveBathroomPhysicalSelection(params: {
  facts: EstimateContext["facts"];
  workAreaId: string;
}): BathroomPhysicalSelection {
  const { facts, workAreaId } = params;
  const jobScope = getStringFact(facts as never, workAreaId, "bathroom.job_scope");
  const stripOutOnly = jobScope === "strip_out_only";
  const substrateRaw = factValue(facts, workAreaId, "bathroom.floor_substrate_system");
  const floorSubstrateAssumed = !stripOutOnly && isNotSureValue(substrateRaw);
  const floorSubstrate = floorSubstrateAssumed
    ? "treated_plywood"
    : parseBathroomFloorSubstrate(substrateRaw);

  const wallRaw = factValue(facts, workAreaId, "bathroom.wall_lining_included");
  const wallSystem = getStringFact(
    facts as never,
    workAreaId,
    "bathroom.wall_lining_system"
  );
  let wallLining: BathroomPhysicalSelection["wallLining"] = null;
  let wallLiningAssumed = false;
  if (!stripOutOnly && (isNotSureValue(wallRaw) || isNotSureValue(wallSystem))) {
    wallLining = "aqualine";
    wallLiningAssumed = true;
  } else if (wallSystem) {
    const lower = wallSystem.toLowerCase();
    if (lower === "none" || lower === "no") wallLining = "none";
    else if (lower.includes("other")) wallLining = "other";
    else if (lower.includes("aqualine") || lower.includes("gib")) {
      wallLining = "aqualine";
    }
  }
  if (wallLining == null) {
    const wallBool = getBooleanFact(facts as never, workAreaId, "bathroom.wall_lining_included");
    if (wallBool === true) wallLining = "aqualine";
    else if (wallBool === false) wallLining = "none";
  }

  const ceilingRaw = factValue(facts, workAreaId, "bathroom.ceiling_lining_included");
  let ceilingLining: BathroomPhysicalSelection["ceilingLining"] = null;
  let ceilingLiningAssumed = false;
  if (!stripOutOnly && isNotSureValue(ceilingRaw)) {
    ceilingLining = "aqualine";
    ceilingLiningAssumed = true;
  } else {
    const ceilingBool = getBooleanFact(
      facts as never,
      workAreaId,
      "bathroom.ceiling_lining_included"
    );
    if (ceilingBool === true) ceilingLining = "aqualine";
    else if (ceilingBool === false) ceilingLining = "none";
  }

  const framingRaw = factValue(facts, workAreaId, "bathroom.framing_level");
  const framingUnknown =
    hasUnknownFraming(framingRaw) && framingQuestionExpected(facts, workAreaId);
  const framingLevel = parseBathroomFramingLevel(framingRaw);

  return {
    floorSubstrate,
    floorSubstrateAssumed,
    wallLining,
    wallLiningAssumed,
    ceilingLining,
    ceilingLiningAssumed,
    framingLevel,
    framingUnknown,
  };
}

function hasUnknownFraming(value: unknown): boolean {
  if (value == null || value === "") return true;
  return isNotSureValue(value) || parseBathroomFramingLevel(value) == null;
}

function framingQuestionExpected(
  facts: EstimateContext["facts"],
  workAreaId: string
): boolean {
  const scope = getStringFact(facts as never, workAreaId, "bathroom.job_scope");
  return (
    scope === "reline" ||
    scope === "new_fitout" ||
    scope === "full_renovation" ||
    scope === "custom"
  );
}

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
  if (benchmark != null && params.context.organisationSettings?.allow_benchmark_rates !== false) {
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
  itemKey: string;
  componentKey: string;
  identitySummary: string;
  notes: string;
  sortOrder: number;
  buildUp: ReturnType<typeof createSheetCountBuildUp> | null;
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
  return withPricingOwnership(
    params.buildUp ? { ...item, materialBuildUp: params.buildUp, materialBuildUps: [params.buildUp] } : item,
    {
      pricingOwner: "contractor_material",
      scopeKey: params.componentKey,
      overlapGroup: params.componentKey,
    }
  );
}

export function buildBathroomPhysicalEnvelope(params: {
  context: EstimateContext;
  workArea: EstimateWorkArea;
  geometry: BathroomGeometryResolution;
  selection: BathroomPhysicalSelection;
  accessFactor: number;
  sortOrderStart: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  nextSortOrder: number;
  emittedPhysical: boolean;
} {
  const { context, workArea, geometry, selection } = params;
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const provenanceBase = {
    calculatorSource: "bathroom-physical",
    factKeys: [
      "bathroom.length_m",
      "bathroom.width_m",
      "bathroom.wall_height_m",
      "bathroom.floor_substrate_system",
      "bathroom.wall_lining_included",
      "bathroom.ceiling_lining_included",
      "bathroom.framing_level",
    ],
    constraintKeys: [] as string[],
  };

  if (selection.floorSubstrateAssumed) {
    assumptions.push(BATHROOM_PLYWOOD_ASSUMPTION);
  }
  if (selection.wallLiningAssumed) {
    assumptions.push(BATHROOM_AQUALINE_WALL_ASSUMPTION);
  }
  if (selection.ceilingLiningAssumed) {
    assumptions.push(BATHROOM_AQUALINE_CEILING_ASSUMPTION);
  }
  if (selection.floorSubstrate === "other") {
    missingInfo.push("Specify the floor substrate type so Quotr can price it.");
  }
  if (selection.wallLining === "other") {
    missingInfo.push("Specify the wall lining type so Quotr can price it.");
  }
  if (selection.ceilingLining === "other") {
    missingInfo.push("Specify the ceiling lining type so Quotr can price it.");
  }

  const floorArea = geometry.floorAreaM2;
  const ceilingArea = geometry.ceilingAreaM2 ?? geometry.floorAreaM2;
  const wallArea = geometry.grossWallAreaM2;

  if (
    (selection.floorSubstrate === "treated_plywood" ||
      selection.floorSubstrate === "fibre_cement") &&
    floorArea != null
  ) {
    const kind = selection.floorSubstrate === "fibre_cement" ? "fibre_cement" : "plywood";
    const itemKey =
      kind === "fibre_cement"
        ? BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY
        : BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY;
    const takeoff = bathroomSheetTakeoff(floorArea);
    const label = bathroomSheetMaterialLabel(kind);
    const productivity = resolveProductivity({
      productivityKey: BATHROOM_PRODUCTIVITY_KEYS.floorSubstrateM2,
      unit: "m2",
      fallbackHoursPerUnit: BATHROOM_PRODUCTIVITY_BENCHMARKS.floorSubstrateM2,
      rates: context.rates,
    });
    const hours = bathroomLiningHours(floorArea, productivity.hoursPerUnit);
    const adjustedHours = hours * params.accessFactor;
    const rate = resolveExactMaterialRate({
      itemKey,
      unit: "each",
      context,
    });
    const identity = `${presentBathroomAreaM2(floorArea)} net · ${presentBathroomAreaM2(takeoff.purchaseAreaM2)} purchase (10% waste) · ${takeoff.sheetCount} sheets · ${label}`;
    assumptions.push(BATHROOM_SHEET_WASTE_STATEMENT);
    const buildUp = createSheetCountBuildUp({
      result: {
        sheetAreaM2: takeoff.sheetAreaM2,
        baseSheetCount: takeoff.physicalAreaM2 / takeoff.sheetAreaM2,
        totalSheetCount: takeoff.sheetCount,
      },
      areaM2: takeoff.physicalAreaM2,
      wastagePercent: takeoff.wasteFactor * 100,
      materialLabel: label,
    });
    requirements.push(
      buildMaterialRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
        variantKey: kind,
        description: `Floor substrate — ${label}`,
        confidence: "high",
        assumptions: selection.floorSubstrateAssumed
          ? [{ key: "bathroom.floor_substrate_system", text: BATHROOM_PLYWOOD_ASSUMPTION, source: "assumed_default" }]
          : [],
        provenance: provenanceBase,
        priced: rate.priced,
        materialKey: itemKey,
        category: "sheet",
        specification: `${label} 2400 × 1200`,
        baseQuantity: takeoff.physicalAreaM2,
        baseUnit: "m2",
        wasteFactor: takeoff.wasteFactor,
        purchaseQuantity: takeoff.sheetCount,
        purchaseUnit: "each",
        rateSource: rate.priced ? (rate.sourceType === "user_rate" ? "company" : "benchmark") : "missing",
        unitCost: rate.costRate,
        totalCost:
          rate.priced && rate.costRate != null
            ? round2(takeoff.sheetCount * rate.costRate)
            : null,
      })
    );
    requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT,
        description: "Floor substrate installation",
        confidence: "high",
        assumptions: [],
        provenance: provenanceBase,
        priced: true,
        trade: "carpenter",
        baseHours: hours,
        productivityBasis: {
          key: productivity.key,
          hoursPerUnit: productivity.hoursPerUnit,
          unit: "m2",
          quantity: floorArea,
        },
        adjustmentRef: { factors: [] },
        adjustedHours,
        rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
        hourlyCost: labourRate.costRate,
        totalCost: round2(adjustedHours * labourRate.costRate),
        rateProvenance:
          labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
      })
    );
    if (rate.priced && rate.costRate != null && rate.sellRate != null) {
      lineItems.push(
        withPricingOwnership(
          {
            ...createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: `Floor substrate — ${label}`,
              category: "materials",
              quantity: takeoff.sheetCount,
              unit: "each",
              costRate: rate.costRate,
              sellRate: rate.sellRate,
              rateSource: rate.sourceLabel,
              rateSourceType: rate.sourceType,
              itemKey,
              componentKey: BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
              notes: identity,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor: 1,
            }),
            identitySummary: identity,
            materialBuildUp: buildUp,
            materialBuildUps: [buildUp],
          },
          {
            pricingOwner: "contractor_material",
            scopeKey: BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
            overlapGroup: "bathroom_floor_substrate",
          }
        )
      );
    } else {
      lineItems.push(
        unpricedMaterialLine({
          workArea,
          label: `Floor substrate — ${label}`,
          quantity: takeoff.sheetCount,
          unit: "each",
          itemKey,
          componentKey: BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
          identitySummary: identity,
          notes: `${identity}. Pricing required — no approved sheet rate.`,
          sortOrder: sortOrder++,
          buildUp,
        })
      );
    }
    lineItems.push(
      withPricingOwnership(
        {
          ...createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Floor substrate labour",
            labourHours: round2(adjustedHours),
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: labourRate.sourceLabel,
            rateSourceType: labourRate.sourceType,
            itemKey: BATHROOM_PRODUCTIVITY_KEYS.floorSubstrateM2,
            notes: presentBathroomHours(hours),
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          componentKey: BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT,
          identitySummary: presentBathroomHours(hours),
          productivityRate: productivity.hoursPerUnit,
          productivityUnit: "m2",
          productivitySourceType: productivity.sourceType,
        },
        {
          pricingOwner: "in_house_labour",
          scopeKey: BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT,
          overlapGroup: "bathroom_floor_substrate_install",
        }
      )
    );
  }

  if (selection.wallLining === "aqualine" && wallArea != null) {
    const takeoff = bathroomSheetTakeoff(wallArea);
    const productivity = resolveProductivity({
      productivityKey: BATHROOM_PRODUCTIVITY_KEYS.wallLiningM2,
      unit: "m2",
      fallbackHoursPerUnit: BATHROOM_PRODUCTIVITY_BENCHMARKS.wallLiningM2,
      rates: context.rates,
    });
    const hours = bathroomLiningHours(wallArea, productivity.hoursPerUnit);
    const adjustedHours = hours * params.accessFactor;
    const rate = resolveExactMaterialRate({
      itemKey: BATHROOM_AQUALINE_SHEET_KEY,
      unit: "each",
      context,
    });
    const identity = `${presentBathroomAreaM2(wallArea)} net · ${presentBathroomAreaM2(takeoff.purchaseAreaM2)} purchase (10% waste) · ${takeoff.sheetCount} sheets · ${BATHROOM_AQUALINE_LABEL}`;
    assumptions.push(BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT);
    assumptions.push(BATHROOM_SHEET_WASTE_STATEMENT);
    const buildUp = createSheetCountBuildUp({
      result: {
        sheetAreaM2: takeoff.sheetAreaM2,
        baseSheetCount: takeoff.physicalAreaM2 / takeoff.sheetAreaM2,
        totalSheetCount: takeoff.sheetCount,
      },
      areaM2: takeoff.physicalAreaM2,
      wastagePercent: takeoff.wasteFactor * 100,
      materialLabel: BATHROOM_AQUALINE_LABEL,
    });
    requirements.push(
      buildMaterialRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: BATHROOM_WALL_LINING_COMPONENT,
        variantKey: "aqualine",
        description: "Wall lining — 13 mm GIB Aqualine",
        confidence: "high",
        assumptions: [
          {
            key: "bathroom.wall_openings",
            text: BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT,
            source: "calculator_default",
          },
        ],
        provenance: provenanceBase,
        priced: rate.priced,
        materialKey: BATHROOM_AQUALINE_SHEET_KEY,
        category: "sheet",
        specification: `${BATHROOM_AQUALINE_LABEL} 2400 × 1200`,
        baseQuantity: takeoff.physicalAreaM2,
        baseUnit: "m2",
        wasteFactor: takeoff.wasteFactor,
        purchaseQuantity: takeoff.sheetCount,
        purchaseUnit: "each",
        rateSource: rate.priced ? (rate.sourceType === "user_rate" ? "company" : "benchmark") : "missing",
        unitCost: rate.costRate,
        totalCost:
          rate.priced && rate.costRate != null
            ? round2(takeoff.sheetCount * rate.costRate)
            : null,
      })
    );
    requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: BATHROOM_WALL_LINING_LABOUR_COMPONENT,
        description: "Wall lining installation",
        confidence: "high",
        assumptions: [],
        provenance: provenanceBase,
        priced: true,
        trade: "carpenter",
        baseHours: hours,
        productivityBasis: {
          key: productivity.key,
          hoursPerUnit: productivity.hoursPerUnit,
          unit: "m2",
          quantity: wallArea,
        },
        adjustmentRef: { factors: [] },
        adjustedHours,
        rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
        hourlyCost: labourRate.costRate,
        totalCost: round2(adjustedHours * labourRate.costRate),
        rateProvenance:
          labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
      })
    );
    if (rate.priced && rate.costRate != null && rate.sellRate != null) {
      lineItems.push(
        withPricingOwnership(
          {
            ...createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: "Wall lining — 13 mm GIB Aqualine",
              category: "materials",
              quantity: takeoff.sheetCount,
              unit: "each",
              costRate: rate.costRate,
              sellRate: rate.sellRate,
              rateSource: rate.sourceLabel,
              rateSourceType: rate.sourceType,
              itemKey: BATHROOM_AQUALINE_SHEET_KEY,
              componentKey: BATHROOM_WALL_LINING_COMPONENT,
              notes: identity,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor: 1,
            }),
            identitySummary: identity,
            materialBuildUp: buildUp,
            materialBuildUps: [buildUp],
          },
          {
            pricingOwner: "contractor_material",
            scopeKey: BATHROOM_WALL_LINING_COMPONENT,
            overlapGroup: "bathroom_wall_lining",
          }
        )
      );
    } else {
      lineItems.push(
        unpricedMaterialLine({
          workArea,
          label: "Wall lining — 13 mm GIB Aqualine",
          quantity: takeoff.sheetCount,
          unit: "each",
          itemKey: BATHROOM_AQUALINE_SHEET_KEY,
          componentKey: BATHROOM_WALL_LINING_COMPONENT,
          identitySummary: identity,
          notes: `${identity}. Pricing required — no approved sheet rate.`,
          sortOrder: sortOrder++,
          buildUp,
        })
      );
    }
    lineItems.push(
      withPricingOwnership(
        {
          ...createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Wall lining labour",
            labourHours: round2(adjustedHours),
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: labourRate.sourceLabel,
            rateSourceType: labourRate.sourceType,
            itemKey: BATHROOM_PRODUCTIVITY_KEYS.wallLiningM2,
            notes: presentBathroomHours(hours),
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          componentKey: BATHROOM_WALL_LINING_LABOUR_COMPONENT,
          identitySummary: presentBathroomHours(hours),
          productivityRate: productivity.hoursPerUnit,
          productivityUnit: "m2",
          productivitySourceType: productivity.sourceType,
        },
        {
          pricingOwner: "in_house_labour",
          scopeKey: BATHROOM_WALL_LINING_LABOUR_COMPONENT,
          overlapGroup: "bathroom_wall_lining_install",
        }
      )
    );
  }

  if (selection.ceilingLining === "aqualine" && ceilingArea != null) {
    const takeoff = bathroomSheetTakeoff(ceilingArea);
    const productivity = resolveProductivity({
      productivityKey: BATHROOM_PRODUCTIVITY_KEYS.ceilingLiningM2,
      unit: "m2",
      fallbackHoursPerUnit: BATHROOM_PRODUCTIVITY_BENCHMARKS.ceilingLiningM2,
      rates: context.rates,
    });
    const hours = bathroomLiningHours(ceilingArea, productivity.hoursPerUnit);
    const adjustedHours = hours * params.accessFactor;
    const rate = resolveExactMaterialRate({
      itemKey: BATHROOM_AQUALINE_SHEET_KEY,
      unit: "each",
      context,
    });
    const identity = `${presentBathroomAreaM2(ceilingArea)} net · ${presentBathroomAreaM2(takeoff.purchaseAreaM2)} purchase (10% waste) · ${takeoff.sheetCount} sheets · ${BATHROOM_AQUALINE_LABEL}`;
    assumptions.push(BATHROOM_CEILING_NESTED_STATEMENT);
    assumptions.push(BATHROOM_SHEET_WASTE_STATEMENT);
    const buildUp = createSheetCountBuildUp({
      result: {
        sheetAreaM2: takeoff.sheetAreaM2,
        baseSheetCount: takeoff.physicalAreaM2 / takeoff.sheetAreaM2,
        totalSheetCount: takeoff.sheetCount,
      },
      areaM2: takeoff.physicalAreaM2,
      wastagePercent: takeoff.wasteFactor * 100,
      materialLabel: BATHROOM_AQUALINE_LABEL,
    });
    requirements.push(
      buildMaterialRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: BATHROOM_CEILING_LINING_COMPONENT,
        variantKey: "aqualine",
        description: "Ceiling lining — 13 mm GIB Aqualine",
        confidence: "high",
        assumptions: [],
        provenance: provenanceBase,
        priced: rate.priced,
        materialKey: BATHROOM_AQUALINE_SHEET_KEY,
        category: "sheet",
        specification: `${BATHROOM_AQUALINE_LABEL} 2400 × 1200`,
        baseQuantity: takeoff.physicalAreaM2,
        baseUnit: "m2",
        wasteFactor: takeoff.wasteFactor,
        purchaseQuantity: takeoff.sheetCount,
        purchaseUnit: "each",
        rateSource: rate.priced ? (rate.sourceType === "user_rate" ? "company" : "benchmark") : "missing",
        unitCost: rate.costRate,
        totalCost:
          rate.priced && rate.costRate != null
            ? round2(takeoff.sheetCount * rate.costRate)
            : null,
      })
    );
    requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: BATHROOM_CEILING_LINING_LABOUR_COMPONENT,
        description: "Ceiling lining installation",
        confidence: "high",
        assumptions: [],
        provenance: provenanceBase,
        priced: true,
        trade: "carpenter",
        baseHours: hours,
        productivityBasis: {
          key: productivity.key,
          hoursPerUnit: productivity.hoursPerUnit,
          unit: "m2",
          quantity: ceilingArea,
        },
        adjustmentRef: { factors: [] },
        adjustedHours,
        rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
        hourlyCost: labourRate.costRate,
        totalCost: round2(adjustedHours * labourRate.costRate),
        rateProvenance:
          labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
      })
    );
    if (rate.priced && rate.costRate != null && rate.sellRate != null) {
      lineItems.push(
        withPricingOwnership(
          {
            ...createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: "Ceiling lining — 13 mm GIB Aqualine",
              category: "materials",
              quantity: takeoff.sheetCount,
              unit: "each",
              costRate: rate.costRate,
              sellRate: rate.sellRate,
              rateSource: rate.sourceLabel,
              rateSourceType: rate.sourceType,
              itemKey: BATHROOM_AQUALINE_SHEET_KEY,
              componentKey: BATHROOM_CEILING_LINING_COMPONENT,
              notes: identity,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor: 1,
            }),
            identitySummary: identity,
            materialBuildUp: buildUp,
            materialBuildUps: [buildUp],
          },
          {
            pricingOwner: "contractor_material",
            scopeKey: BATHROOM_CEILING_LINING_COMPONENT,
            overlapGroup: "bathroom_ceiling_lining",
          }
        )
      );
    } else {
      lineItems.push(
        unpricedMaterialLine({
          workArea,
          label: "Ceiling lining — 13 mm GIB Aqualine",
          quantity: takeoff.sheetCount,
          unit: "each",
          itemKey: BATHROOM_AQUALINE_SHEET_KEY,
          componentKey: BATHROOM_CEILING_LINING_COMPONENT,
          identitySummary: identity,
          notes: `${identity}. Pricing required — no approved sheet rate.`,
          sortOrder: sortOrder++,
          buildUp,
        })
      );
    }
    lineItems.push(
      withPricingOwnership(
        {
          ...createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Ceiling lining labour",
            labourHours: round2(adjustedHours),
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: labourRate.sourceLabel,
            rateSourceType: labourRate.sourceType,
            itemKey: BATHROOM_PRODUCTIVITY_KEYS.ceilingLiningM2,
            notes: presentBathroomHours(hours),
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          componentKey: BATHROOM_CEILING_LINING_LABOUR_COMPONENT,
          identitySummary: presentBathroomHours(hours),
          productivityRate: productivity.hoursPerUnit,
          productivityUnit: "m2",
          productivitySourceType: productivity.sourceType,
        },
        {
          pricingOwner: "in_house_labour",
          scopeKey: BATHROOM_CEILING_LINING_LABOUR_COMPONENT,
          overlapGroup: "bathroom_ceiling_lining_install",
        }
      )
    );
  }

  if (selection.framingUnknown) {
    missingInfo.push(BATHROOM_FRAMING_REQUIRED_MESSAGE);
  }

  if (selection.framingLevel && selection.framingLevel !== "none" && wallArea != null) {
    const productivity = resolveProductivity({
      productivityKey: BATHROOM_PRODUCTIVITY_KEYS.framingLm,
      unit: "lm",
      fallbackHoursPerUnit: BATHROOM_PRODUCTIVITY_BENCHMARKS.framingLm,
      rates: context.rates,
    });
    const takeoff = bathroomFramingTakeoff({
      level: selection.framingLevel,
      grossWallAreaM2: wallArea,
      hoursPerLm: productivity.hoursPerUnit,
    });
    if (takeoff) {
      const rate = resolveExactMaterialRate({
        itemKey: BATHROOM_FRAMING_TIMBER_KEY,
        unit: "lm",
        context,
      });
      const identity = `${selection.framingLevel.replace(/^./, (c) => c.toUpperCase())} · ${presentBathroomLm(takeoff.framingLm)} · ${BATHROOM_FRAMING_TIMBER_LABEL}`;
      const adjustedHours = takeoff.labourHours * params.accessFactor;
      requirements.push(
        buildMaterialRequirement({
          workAreaId: workArea.id,
          workAreaType: "bathroom",
          componentKey: BATHROOM_FRAMING_COMPONENT,
          variantKey: selection.framingLevel,
          description: `Local framing / nogging — ${BATHROOM_FRAMING_TIMBER_LABEL}`,
          confidence: "high",
          assumptions: [],
          provenance: provenanceBase,
          priced: rate.priced,
          materialKey: BATHROOM_FRAMING_TIMBER_KEY,
          category: "timber",
          specification: BATHROOM_FRAMING_TIMBER_LABEL,
          baseQuantity: takeoff.framingLm,
          baseUnit: "lm",
          wasteFactor: 0,
          purchaseQuantity: takeoff.framingLm,
          purchaseUnit: "lm",
          rateSource: rate.priced ? (rate.sourceType === "user_rate" ? "company" : "benchmark") : "missing",
          unitCost: rate.costRate,
          totalCost:
            rate.priced && rate.costRate != null
              ? round2(takeoff.framingLm * rate.costRate)
              : null,
        })
      );
      requirements.push(
        buildLabourRequirement({
          workAreaId: workArea.id,
          workAreaType: "bathroom",
          componentKey: BATHROOM_FRAMING_LABOUR_COMPONENT,
          description: "Local framing / nogging labour",
          confidence: "high",
          assumptions: [],
          provenance: provenanceBase,
          priced: true,
          trade: "carpenter",
          baseHours: takeoff.labourHours,
          productivityBasis: {
            key: productivity.key,
            hoursPerUnit: productivity.hoursPerUnit,
            unit: "lm",
            quantity: takeoff.framingLm,
          },
          adjustmentRef: { factors: [] },
          adjustedHours,
          rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
          hourlyCost: labourRate.costRate,
          totalCost: round2(adjustedHours * labourRate.costRate),
          rateProvenance:
            labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
        })
      );
      if (rate.priced && rate.costRate != null && rate.sellRate != null) {
        lineItems.push(
          withPricingOwnership(
            {
              ...createRateLineItem({
                workAreaId: workArea.id,
                workAreaName: workArea.name,
                label: "Local framing / nogging — 90 × 45 H1.2",
                category: "materials",
                quantity: round2(takeoff.framingLm),
                unit: "lm",
                costRate: rate.costRate,
                sellRate: rate.sellRate,
                rateSource: rate.sourceLabel,
                rateSourceType: rate.sourceType,
                itemKey: BATHROOM_FRAMING_TIMBER_KEY,
                componentKey: BATHROOM_FRAMING_COMPONENT,
                notes: identity,
                sortOrder: sortOrder++,
                organisationSettings: context.organisationSettings,
                qualityFactor: 1,
              }),
              identitySummary: identity,
            },
            {
              pricingOwner: "contractor_material",
              scopeKey: BATHROOM_FRAMING_COMPONENT,
              overlapGroup: "bathroom_framing",
            }
          )
        );
      } else {
        lineItems.push(
          unpricedMaterialLine({
            workArea,
            label: "Local framing / nogging — 90 × 45 H1.2",
            quantity: round2(takeoff.framingLm),
            unit: "lm",
            itemKey: BATHROOM_FRAMING_TIMBER_KEY,
            componentKey: BATHROOM_FRAMING_COMPONENT,
            identitySummary: identity,
            notes: `${identity}. Pricing required — no approved H1.2 $/lm.`,
            sortOrder: sortOrder++,
            buildUp: null,
          })
        );
      }
      lineItems.push(
        withPricingOwnership(
          {
            ...createFixedLabourLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: "Local framing / nogging labour",
              labourHours: round2(adjustedHours),
              labourCostRate: labourRate.costRate,
              labourSellRate: labourRate.sellRate,
              rateSource: labourRate.sourceLabel,
              rateSourceType: labourRate.sourceType,
              itemKey: BATHROOM_PRODUCTIVITY_KEYS.framingLm,
              notes: presentBathroomHours(takeoff.labourHours),
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
            }),
            componentKey: BATHROOM_FRAMING_LABOUR_COMPONENT,
            identitySummary: presentBathroomHours(takeoff.labourHours),
            productivityRate: productivity.hoursPerUnit,
            productivityUnit: "lm",
            productivitySourceType: productivity.sourceType,
          },
          {
            pricingOwner: "in_house_labour",
            scopeKey: BATHROOM_FRAMING_LABOUR_COMPONENT,
            overlapGroup: "bathroom_framing_install",
          }
        )
      );
    }
  }

  return {
    requirements,
    lineItems,
    assumptions: [...new Set(assumptions)],
    missingInfo,
    nextSortOrder: sortOrder,
    emittedPhysical: lineItems.length > 0 || requirements.length > 0,
  };
}
