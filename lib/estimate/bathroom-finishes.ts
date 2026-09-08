/**
 * WA-BATHROOM-04 — mature floor finish XOR, tiling, and waterproofing.
 *
 * Material waste applies once to purchase quantity.
 * Tiler / vinyl install / waterproofing use net physical area.
 * Finish level must not change m². Mixed legacy tiling is not used here.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import {
  BATHROOM_BATH_SURROUND_REQUIRED_MESSAGE,
  BATHROOM_CUSTOM_WALL_TILE_REQUIRED_MESSAGE,
  BATHROOM_CUSTOM_WP_AREA_REQUIRED_MESSAGE,
  BATHROOM_FLOOR_FINISH_OTHER_COMPONENT,
  BATHROOM_FLOOR_FINISH_REQUIRED_MESSAGE,
  BATHROOM_FLOOR_FINISH_XOR_STATEMENT,
  BATHROOM_FLOOR_TILE_INSTALL_COMPONENT,
  BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT,
  BATHROOM_FLOORING_WA_OVERLAP_STATEMENT,
  BATHROOM_HALF_HEIGHT_M,
  BATHROOM_HALF_HEIGHT_STATEMENT,
  BATHROOM_OTHER_FLOOR_FINISH_REQUIRED_MESSAGE,
  BATHROOM_SHEET_VINYL_INSTALL_COMPONENT,
  BATHROOM_SHEET_VINYL_INSTALL_KEY,
  BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT,
  BATHROOM_SHEET_VINYL_MATERIAL_KEY,
  BATHROOM_SHOWER_ASSUMED_DEPTH_M,
  BATHROOM_SHOWER_ASSUMED_WALL_HEIGHT_M,
  BATHROOM_SHOWER_ASSUMED_WIDTH_M,
  BATHROOM_SHOWER_ASSUMPTION_STATEMENT,
  BATHROOM_SHOWER_GEOMETRY_REQUIRED_MESSAGE,
  BATHROOM_TILE_INSTALL_KEY,
  BATHROOM_TILE_MATERIAL_KEY,
  BATHROOM_TILE_WASTE_FACTOR,
  BATHROOM_TILE_WASTE_STATEMENT,
  BATHROOM_VINYL_PLANK_INSTALL_COMPONENT,
  BATHROOM_VINYL_PLANK_INSTALL_KEY,
  BATHROOM_VINYL_PLANK_LENGTH_M,
  BATHROOM_VINYL_PLANK_MATERIAL_COMPONENT,
  BATHROOM_VINYL_PLANK_MATERIAL_KEY,
  BATHROOM_VINYL_PLANK_WIDTH_M,
  BATHROOM_WALL_TILE_EXTENT_REQUIRED_MESSAGE,
  BATHROOM_WALL_TILE_INSTALL_COMPONENT,
  BATHROOM_WALL_TILE_MATERIAL_COMPONENT,
  BATHROOM_WATERPROOFING_COMPONENT,
  BATHROOM_WATERPROOFING_EXTENT_REQUIRED_MESSAGE,
  BATHROOM_WATERPROOFING_INSTALL_KEY,
  BATHROOM_WP_FLOOR_AND_SHOWER_LEGACY_STATEMENT,
} from "@/lib/estimate/bathroom-identities";
import { BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT } from "@/lib/estimate/bathroom-geometry";
import type { BathroomGeometryResolution } from "@/lib/estimate/bathroom-geometry";
import {
  isMatureBathroomPath,
  parseBathroomFloorFinish,
  parseBathroomTileFormat,
  parseBathroomWaterproofingExtent,
  resolveBathroomWallTileExtent,
  BATHROOM_TILE_FORMAT_FACT_KEY,
  type BathroomFloorFinishSystem,
  type BathroomTileFormat,
  type BathroomWallTileExtent,
  type BathroomWaterproofingExtent,
} from "@/lib/estimate/bathroom-scope";
import { getBooleanFact, getFact, getNumberFact, getStringFact, isNotSureValue, round2 } from "@/lib/estimate/facts";
import { presentBathroomAreaM2 } from "@/lib/estimate/bathroom-linings";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { buildSubcontractRequirement } from "@/lib/estimate/subcontract-requirement";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { resolveRate } from "@/lib/estimate/rates";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { createRateLineItem, buildAmounts } from "@/lib/estimate/line-items";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import type {
  EstimateRequirement,
  RequirementAssumption,
  RequirementProvenance,
} from "@/lib/estimate/requirements";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";

export const BATHROOM_SHOWER_DISCLOSED_AREA_M2 = round2(
  (BATHROOM_SHOWER_ASSUMED_WIDTH_M + BATHROOM_SHOWER_ASSUMED_DEPTH_M) *
    BATHROOM_SHOWER_ASSUMED_WALL_HEIGHT_M
);

export function bathroomPurchaseAreaM2(netAreaM2: number): number {
  return netAreaM2 * (1 + BATHROOM_TILE_WASTE_FACTOR);
}

export function bathroomHalfHeightWallAreaM2(perimeterM: number): number {
  return round2(perimeterM * BATHROOM_HALF_HEIGHT_M);
}

export function bathroomShowerWallAreaM2(params: {
  widthM: number;
  depthM: number;
  wallHeightM: number;
}): number {
  return round2((params.widthM + params.depthM) * params.wallHeightM);
}

export function bathroomTileFaceAreaM2(
  format: BathroomTileFormat | null
): number | null {
  if (format === "600x600") return 0.36;
  if (format === "600x300") return 0.18;
  if (format === "300x300") return 0.09;
  return null;
}

export function bathroomTileFormatDisplay(
  format: BathroomTileFormat | null
): string | null {
  if (format === "600x600") return "600 × 600";
  if (format === "600x300") return "600 × 300";
  if (format === "300x300") return "300 × 300";
  return null;
}

export function bathroomApproxCount(
  purchaseAreaM2: number,
  faceAreaM2: number | null
): number | null {
  if (faceAreaM2 == null || faceAreaM2 <= 0) return null;
  return Math.ceil(purchaseAreaM2 / faceAreaM2 - 1e-12);
}

type FinishRate = {
  priced: boolean;
  costRate: number | null;
  sellRate: number | null;
  sourceType: RateSourceType;
  sourceLabel: string;
};

function catalogueBenchmarkCost(itemKey: string): number | null {
  const entry = getCatalogueEntry(itemKey);
  return entry?.defaultCostRate != null && Number.isFinite(entry.defaultCostRate)
    ? entry.defaultCostRate
    : null;
}

function resolveFinishRate(params: {
  itemKey: string;
  unit: string;
  rateType: "material" | "subcontractor";
  context: EstimateContext;
  pcAllowance?: boolean;
}): FinishRate {
  const company = params.context.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key === params.itemKey &&
      rate.cost_rate != null
  );
  if (company?.cost_rate != null) {
    const resolved = resolveRate({
      rates: params.context.rates,
      rateType: params.rateType,
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
      rateType: params.rateType,
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
      sourceLabel: params.pcAllowance ? "PC allowance" : resolved.sourceLabel,
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

function factValue(
  facts: EstimateContext["facts"],
  workAreaId: string,
  key: string
): unknown {
  return getFact(facts as never, workAreaId, key)?.value;
}

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

export type BathroomShowerResolution = {
  areaM2: number | null;
  assumed: boolean;
  required: boolean;
};

export function resolveBathroomShowerWallArea(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  needed: boolean;
}): BathroomShowerResolution {
  if (!params.needed) {
    return { areaM2: null, assumed: false, required: false };
  }
  const facts = params.facts as EstimateFact[];
  const widthRaw = factValue(facts, params.workAreaId, "bathroom.shower.width_m");
  const depthRaw = factValue(facts, params.workAreaId, "bathroom.shower.depth_m");
  const heightRaw = factValue(
    facts,
    params.workAreaId,
    "bathroom.shower.wall_height_m"
  );
  const widthM = positive(getNumberFact(facts, params.workAreaId, "bathroom.shower.width_m"));
  const depthM = positive(getNumberFact(facts, params.workAreaId, "bathroom.shower.depth_m"));
  const heightM = positive(
    getNumberFact(facts, params.workAreaId, "bathroom.shower.wall_height_m")
  );
  const notSure =
    isNotSureValue(widthRaw) ||
    isNotSureValue(depthRaw) ||
    isNotSureValue(heightRaw);
  if (widthM != null && depthM != null && heightM != null) {
    return {
      areaM2: bathroomShowerWallAreaM2({
        widthM,
        depthM,
        wallHeightM: heightM,
      }),
      assumed: false,
      required: false,
    };
  }
  if (notSure) {
    return {
      areaM2: BATHROOM_SHOWER_DISCLOSED_AREA_M2,
      assumed: true,
      required: false,
    };
  }
  return { areaM2: null, assumed: false, required: true };
}

function floorFinishQuestionExpected(
  facts: EstimateContext["facts"],
  workAreaId: string
): boolean {
  const scope = getStringFact(facts as never, workAreaId, "bathroom.job_scope");
  return (
    scope === "retile_floor" ||
    scope === "new_fitout" ||
    scope === "full_renovation" ||
    scope === "custom"
  );
}

export type BathroomFinishSelection = {
  floorFinish: BathroomFloorFinishSystem | null;
  floorFinishUnknown: boolean;
  wallTileExtent: BathroomWallTileExtent | null;
  wallTileUnknown: boolean;
  tileFormat: BathroomTileFormat | null;
  waterproofingIncluded: boolean | null;
  waterproofingUnknown: boolean;
  waterproofingExtent: BathroomWaterproofingExtent | null;
  waterproofingExtentUnknown: boolean;
};

export function resolveBathroomFinishSelection(params: {
  facts: EstimateContext["facts"];
  workAreaId: string;
}): BathroomFinishSelection {
  const { facts, workAreaId } = params;
  const floorRaw = factValue(facts, workAreaId, "bathroom.floor_finish_system");
  const floorFinishUnknown = isNotSureValue(floorRaw);
  const floorFinish = parseBathroomFloorFinish(floorRaw);

  const tileExtentRaw = factValue(facts, workAreaId, "bathroom.tile_extent");
  const heightRaw = factValue(facts, workAreaId, "bathroom.wall_tile_height");
  const wallTileUnknown =
    isNotSureValue(tileExtentRaw) || isNotSureValue(heightRaw);
  const wallTileExtent = resolveBathroomWallTileExtent({
    tileExtent: tileExtentRaw,
    wallTileHeight: heightRaw,
  });

  const tileFormat = parseBathroomTileFormat(
    factValue(facts, workAreaId, BATHROOM_TILE_FORMAT_FACT_KEY)
  );

  const wpRaw = factValue(facts, workAreaId, "bathroom.waterproofing_included");
  const waterproofingUnknown = isNotSureValue(wpRaw);
  const waterproofingIncluded = getBooleanFact(
    facts as never,
    workAreaId,
    "bathroom.waterproofing_included"
  );
  const wpExtentRaw = factValue(facts, workAreaId, "bathroom.waterproofing_extent");
  const waterproofingExtentUnknown = isNotSureValue(wpExtentRaw);
  const waterproofingExtent = parseBathroomWaterproofingExtent(wpExtentRaw);

  return {
    floorFinish,
    floorFinishUnknown,
    wallTileExtent,
    wallTileUnknown,
    tileFormat,
    waterproofingIncluded,
    waterproofingUnknown,
    waterproofingExtent,
    waterproofingExtentUnknown,
  };
}

function unpricedLine(params: {
  workArea: EstimateWorkArea;
  label: string;
  category: "materials" | "subcontractor" | "allowance";
  quantity: number;
  unit: string;
  itemKey: string;
  componentKey: string;
  identitySummary: string;
  notes: string;
  sortOrder: number;
}): EstimateLineItemInput {
  const item: EstimateLineItemInput = {
    workAreaId: params.workArea.id,
    workAreaName: params.workArea.name,
    label: params.label,
    category: params.category,
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
    pricingOwner:
      params.category === "subcontractor"
        ? "subcontractor_allowance"
        : "contractor_material",
    scopeKey: params.componentKey,
    overlapGroup: params.componentKey,
  });
}

export function buildBathroomFinishEnvelope(params: {
  context: EstimateContext;
  workArea: EstimateWorkArea;
  geometry: BathroomGeometryResolution;
  selection: BathroomFinishSelection;
  sortOrderStart: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  nextSortOrder: number;
} {
  const { context, workArea, geometry, selection } = params;
  const facts = context.facts;
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;

  const provenance: RequirementProvenance = {
    calculatorSource: "bathroom-finishes",
    factKeys: [
      "bathroom.floor_finish_system",
      "bathroom.tile_extent",
      "bathroom.wall_tile_height",
      "bathroom.tile_format",
      "bathroom.floor_tiling_area_m2",
      "bathroom.wall_tiling_area_m2",
      "bathroom.waterproofing_included",
      "bathroom.waterproofing_extent",
      "bathroom.waterproofing_area_m2",
      "bathroom.shower.width_m",
      "bathroom.shower.depth_m",
      "bathroom.shower.wall_height_m",
      "bathroom.length_m",
      "bathroom.width_m",
      "bathroom.wall_height_m",
    ],
    constraintKeys: [],
  };

  const showerNeeded =
    selection.wallTileExtent === "shower_only" ||
    selection.waterproofingExtent === "shower_only" ||
    selection.waterproofingExtent === "floor_and_shower";
  const shower = resolveBathroomShowerWallArea({
    facts: facts as EstimateFact[],
    workAreaId: workArea.id,
    needed: showerNeeded,
  });
  if (shower.assumed) {
    assumptions.push(BATHROOM_SHOWER_ASSUMPTION_STATEMENT);
  }
  if (shower.required) {
    missingInfo.push(BATHROOM_SHOWER_GEOMETRY_REQUIRED_MESSAGE);
  }

  if (selection.floorFinishUnknown && floorFinishQuestionExpected(facts, workArea.id)) {
    missingInfo.push(BATHROOM_FLOOR_FINISH_REQUIRED_MESSAGE);
  } else if (
    selection.floorFinish == null &&
    getStringFact(facts as never, workArea.id, "bathroom.job_scope") ===
      "retile_floor" &&
    factValue(facts, workArea.id, "bathroom.floor_finish_system") == null
  ) {
    missingInfo.push(BATHROOM_FLOOR_FINISH_REQUIRED_MESSAGE);
  }

  if (selection.wallTileUnknown) {
    missingInfo.push(BATHROOM_WALL_TILE_EXTENT_REQUIRED_MESSAGE);
  }

  if (selection.waterproofingUnknown) {
    missingInfo.push(BATHROOM_WATERPROOFING_EXTENT_REQUIRED_MESSAGE);
  } else if (
    selection.waterproofingIncluded === true &&
    selection.waterproofingExtentUnknown
  ) {
    missingInfo.push(BATHROOM_WATERPROOFING_EXTENT_REQUIRED_MESSAGE);
  } else if (
    selection.waterproofingIncluded === true &&
    selection.waterproofingExtent == null &&
    factValue(facts, workArea.id, "bathroom.waterproofing_extent") == null
  ) {
    missingInfo.push(BATHROOM_WATERPROOFING_EXTENT_REQUIRED_MESSAGE);
  }

  const explicitFloorTile = positive(
    getNumberFact(facts as never, workArea.id, "bathroom.floor_tiling_area_m2")
  );
  const explicitWallTile = positive(
    getNumberFact(facts as never, workArea.id, "bathroom.wall_tiling_area_m2")
  );
  const explicitWp = positive(
    getNumberFact(facts as never, workArea.id, "bathroom.waterproofing_area_m2")
  );
  const bathSurround = positive(
    getNumberFact(facts as never, workArea.id, "bathroom.bath_surround_area_m2")
  );

  const emitMaterialInstall = (args: {
    netAreaM2: number;
    materialKey: string;
    installKey: string;
    materialComponent: string;
    installComponent: string;
    materialLabel: string;
    installLabel: string;
    materialCategory: string;
    installTrade: string;
    overlapGroup: string;
    pcAllowance: boolean;
    extraAssumptions: RequirementAssumption[];
    identityExtra?: string;
    sizeLabel?: string | null;
    approxCount?: number | null;
    countNoun?: string;
  }) => {
    const purchase = bathroomPurchaseAreaM2(args.netAreaM2);
    const materialRate = resolveFinishRate({
      itemKey: args.materialKey,
      unit: "m2",
      rateType: "material",
      context,
      pcAllowance: args.pcAllowance,
    });
    const installRate = resolveFinishRate({
      itemKey: args.installKey,
      unit: "m2",
      rateType: "subcontractor",
      context,
    });
    const formatLabel = args.sizeLabel ?? null;
    const countBit =
      args.approxCount != null
        ? `Approx. ${args.approxCount} ${args.countNoun ?? "tiles"}`
        : "";
    const wasteAssumption: RequirementAssumption[] = [
      {
        key: "bathroom.tile_waste",
        text: BATHROOM_TILE_WASTE_STATEMENT,
        source: "calculator_default",
      },
      ...args.extraAssumptions,
    ];
    const identity = [
      `${presentBathroomAreaM2(args.netAreaM2)} net`,
      `${presentBathroomAreaM2(purchase)} incl. waste`,
      formatLabel,
      countBit,
      args.identityExtra,
    ]
      .filter(Boolean)
      .join(" · ");

    requirements.push(
      buildMaterialRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: args.materialComponent,
        description: args.materialLabel,
        confidence: args.extraAssumptions.some((a) => a.source === "assumed_default")
          ? "medium"
          : "high",
        assumptions: wasteAssumption,
        provenance,
        priced: materialRate.priced,
        materialKey: args.materialKey,
        category: args.materialCategory,
        specification: identity,
        baseQuantity: args.netAreaM2,
        baseUnit: "m2",
        wasteFactor: BATHROOM_TILE_WASTE_FACTOR,
        purchaseQuantity: purchase,
        purchaseUnit: "m2",
        rateSource:
          materialRate.sourceType === "user_rate"
            ? "company"
            : materialRate.sourceType === "missing"
              ? "missing"
              : "benchmark",
        unitCost: materialRate.costRate,
        totalCost:
          materialRate.priced && materialRate.costRate != null
            ? round2(purchase * materialRate.costRate)
            : null,
      })
    );
    requirements.push(
      buildSubcontractRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: args.installComponent,
        description: args.installLabel,
        confidence: "high",
        assumptions: args.extraAssumptions,
        provenance,
        priced: installRate.priced,
        trade: args.installTrade,
        allowanceCost:
          installRate.priced && installRate.costRate != null
            ? round2(args.netAreaM2 * installRate.costRate)
            : null,
        totalCost:
          installRate.priced && installRate.costRate != null
            ? round2(args.netAreaM2 * installRate.costRate)
            : null,
      })
    );

    const materialNotes = `${identity}. ${BATHROOM_FLOOR_FINISH_XOR_STATEMENT}`;
    if (materialRate.priced && materialRate.costRate != null && materialRate.sellRate != null) {
      lineItems.push(
        withPricingOwnership(
          {
            ...createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: args.materialLabel,
              category: "materials",
              quantity: purchase,
              unit: "m²",
              costRate: materialRate.costRate,
              sellRate: materialRate.sellRate,
              rateSource: materialRate.sourceLabel,
              rateSourceType: materialRate.sourceType,
              itemKey: args.materialKey,
              componentKey: args.materialComponent,
              notes: materialNotes,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor: 1,
            }),
            identitySummary: identity,
          },
          {
            pricingOwner: "contractor_material",
            scopeKey: args.materialComponent,
            overlapGroup: args.overlapGroup,
          }
        )
      );
    } else {
      lineItems.push(
        unpricedLine({
          workArea,
          label: args.materialLabel,
          category: "materials",
          quantity: purchase,
          unit: "m²",
          itemKey: args.materialKey,
          componentKey: args.materialComponent,
          identitySummary: identity,
          notes: `${identity}. Pricing required.`,
          sortOrder: sortOrder++,
        })
      );
    }

    const installIdentity = `Install ${presentBathroomAreaM2(args.netAreaM2)} net (no waste)`;
    if (installRate.priced && installRate.costRate != null && installRate.sellRate != null) {
      lineItems.push(
        withPricingOwnership(
          {
            ...createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: args.installLabel,
              category: "subcontractor",
              quantity: args.netAreaM2,
              unit: "m²",
              costRate: installRate.costRate,
              sellRate: installRate.sellRate,
              rateSource: installRate.sourceLabel,
              rateSourceType: installRate.sourceType,
              itemKey: args.installKey,
              componentKey: args.installComponent,
              notes: installIdentity,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor: 1,
            }),
            identitySummary: installIdentity,
          },
          {
            pricingOwner: "subcontractor_allowance",
            scopeKey: args.installComponent,
            overlapGroup: args.overlapGroup,
          }
        )
      );
    } else {
      lineItems.push(
        unpricedLine({
          workArea,
          label: args.installLabel,
          category: "subcontractor",
          quantity: args.netAreaM2,
          unit: "m²",
          itemKey: args.installKey,
          componentKey: args.installComponent,
          identitySummary: installIdentity,
          notes: `${installIdentity}. Pricing required.`,
          sortOrder: sortOrder++,
        })
      );
    }
  };

  const tileFace = bathroomTileFaceAreaM2(selection.tileFormat);

  if (selection.floorFinish === "tile") {
    const net = explicitFloorTile ?? geometry.floorAreaM2;
    if (net == null) {
      missingInfo.push("Bathroom floor area is required for floor tiling.");
    } else {
      assumptions.push(BATHROOM_FLOORING_WA_OVERLAP_STATEMENT);
      emitMaterialInstall({
        netAreaM2: net,
        materialKey: BATHROOM_TILE_MATERIAL_KEY,
        installKey: BATHROOM_TILE_INSTALL_KEY,
        materialComponent: BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT,
        installComponent: BATHROOM_FLOOR_TILE_INSTALL_COMPONENT,
        materialLabel: "Floor tile supply allowance",
        installLabel: "Floor tiler installation",
        materialCategory: "tile",
        installTrade: "tiler",
        overlapGroup: "bathroom_floor_finish",
        pcAllowance: true,
        extraAssumptions: [],
        identityExtra: "Tile supply PC allowance",
        sizeLabel: bathroomTileFormatDisplay(selection.tileFormat),
        approxCount: bathroomApproxCount(bathroomPurchaseAreaM2(net), tileFace),
        countNoun: "tiles",
      });
    }
  } else if (selection.floorFinish === "sheet_vinyl") {
    const net = geometry.floorAreaM2;
    if (net == null) {
      missingInfo.push("Bathroom floor area is required for sheet vinyl.");
    } else {
      assumptions.push(BATHROOM_FLOORING_WA_OVERLAP_STATEMENT);
      emitMaterialInstall({
        netAreaM2: net,
        materialKey: BATHROOM_SHEET_VINYL_MATERIAL_KEY,
        installKey: BATHROOM_SHEET_VINYL_INSTALL_KEY,
        materialComponent: BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT,
        installComponent: BATHROOM_SHEET_VINYL_INSTALL_COMPONENT,
        materialLabel: "Sheet vinyl supply",
        installLabel: "Sheet vinyl installation",
        materialCategory: "vinyl",
        installTrade: "flooring",
        overlapGroup: "bathroom_floor_finish",
        pcAllowance: false,
        extraAssumptions: [],
      });
    }
  } else if (selection.floorFinish === "vinyl_plank") {
    const net = geometry.floorAreaM2;
    if (net == null) {
      missingInfo.push("Bathroom floor area is required for vinyl plank.");
    } else {
      const plankFace = BATHROOM_VINYL_PLANK_LENGTH_M * BATHROOM_VINYL_PLANK_WIDTH_M;
      assumptions.push(BATHROOM_FLOORING_WA_OVERLAP_STATEMENT);
      emitMaterialInstall({
        netAreaM2: net,
        materialKey: BATHROOM_VINYL_PLANK_MATERIAL_KEY,
        installKey: BATHROOM_VINYL_PLANK_INSTALL_KEY,
        materialComponent: BATHROOM_VINYL_PLANK_MATERIAL_COMPONENT,
        installComponent: BATHROOM_VINYL_PLANK_INSTALL_COMPONENT,
        materialLabel: "Vinyl plank supply",
        installLabel: "Vinyl plank installation",
        materialCategory: "vinyl_plank",
        installTrade: "flooring",
        overlapGroup: "bathroom_floor_finish",
        pcAllowance: false,
        extraAssumptions: [
          {
            key: "bathroom.vinyl_plank_size",
            text: "Typical vinyl plank 915 × 152 mm used for approximate count only.",
            source: "calculator_default",
          },
        ],
        approxCount: bathroomApproxCount(bathroomPurchaseAreaM2(net), plankFace),
        countNoun: "planks",
      });
    }
  } else if (selection.floorFinish === "other") {
    missingInfo.push(BATHROOM_OTHER_FLOOR_FINISH_REQUIRED_MESSAGE);
    lineItems.push(
      unpricedLine({
        workArea,
        label: "Other floor finish",
        category: "allowance",
        quantity: 1,
        unit: "allow",
        itemKey: BATHROOM_FLOOR_FINISH_OTHER_COMPONENT,
        componentKey: BATHROOM_FLOOR_FINISH_OTHER_COMPONENT,
        identitySummary: "Pricing required — other floor finish",
        notes: BATHROOM_OTHER_FLOOR_FINISH_REQUIRED_MESSAGE,
        sortOrder: sortOrder++,
      })
    );
  }

  let wallNet: number | null = null;
  const wallAssumptions: RequirementAssumption[] = [];
  if (selection.wallTileExtent === "none" || selection.wallTileExtent == null) {
    wallNet = null;
  } else if (selection.wallTileExtent === "custom") {
    if (explicitWallTile == null) {
      missingInfo.push(BATHROOM_CUSTOM_WALL_TILE_REQUIRED_MESSAGE);
    } else {
      wallNet = explicitWallTile;
    }
  } else if (selection.wallTileExtent === "full_height") {
    if (geometry.grossWallAreaM2 == null) {
      missingInfo.push("Bathroom wall height and length × width are required for full-height tiling.");
    } else {
      wallNet = geometry.grossWallAreaM2;
      wallAssumptions.push({
        key: "bathroom.openings",
        text: BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT,
        source: "calculator_default",
      });
      assumptions.push(BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT);
    }
  } else if (selection.wallTileExtent === "half_height") {
    if (geometry.perimeterM == null) {
      missingInfo.push("Bathroom length and width are required for half-height wall tiling.");
    } else {
      wallNet = bathroomHalfHeightWallAreaM2(geometry.perimeterM);
      wallAssumptions.push({
        key: "bathroom.half_height",
        text: BATHROOM_HALF_HEIGHT_STATEMENT,
        source: "calculator_default",
      });
      wallAssumptions.push({
        key: "bathroom.openings",
        text: BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT,
        source: "calculator_default",
      });
      assumptions.push(BATHROOM_HALF_HEIGHT_STATEMENT);
      assumptions.push(BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT);
    }
  } else if (selection.wallTileExtent === "shower_only") {
    wallNet = shower.areaM2;
  }

  if (wallNet != null && wallNet > 0) {
    emitMaterialInstall({
      netAreaM2: wallNet,
      materialKey: BATHROOM_TILE_MATERIAL_KEY,
      installKey: BATHROOM_TILE_INSTALL_KEY,
      materialComponent: BATHROOM_WALL_TILE_MATERIAL_COMPONENT,
      installComponent: BATHROOM_WALL_TILE_INSTALL_COMPONENT,
      materialLabel: "Wall tile supply allowance",
      installLabel: "Wall tiler installation",
      materialCategory: "tile",
      installTrade: "tiler",
      overlapGroup: "bathroom_wall_tile",
      pcAllowance: true,
      extraAssumptions: wallAssumptions,
      identityExtra: `Extent: ${selection.wallTileExtent?.replace(/_/g, " ")}`,
      sizeLabel: bathroomTileFormatDisplay(selection.tileFormat),
      approxCount: bathroomApproxCount(bathroomPurchaseAreaM2(wallNet), tileFace),
      countNoun: "tiles",
    });
  }

  const wpOn =
    selection.waterproofingIncluded === true &&
    selection.waterproofingExtent != null &&
    selection.waterproofingExtent !== "none";
  if (wpOn) {
    const parts: number[] = [];
    const extent = selection.waterproofingExtent!;
    if (extent === "custom") {
      if (explicitWp == null) {
        missingInfo.push(BATHROOM_CUSTOM_WP_AREA_REQUIRED_MESSAGE);
      } else {
        parts.push(explicitWp);
      }
    } else {
      if (extent === "floor_only" || extent === "floor_and_shower") {
        if (geometry.floorAreaM2 == null) {
          missingInfo.push("Bathroom floor area is required for floor waterproofing.");
        } else {
          parts.push(geometry.floorAreaM2);
        }
      }
      if (extent === "shower_only" || extent === "floor_and_shower") {
        if (shower.areaM2 != null) {
          parts.push(shower.areaM2);
        }
      }
      if (extent === "bath_surround") {
        if (bathSurround == null) {
          missingInfo.push(BATHROOM_BATH_SURROUND_REQUIRED_MESSAGE);
        } else {
          parts.push(bathSurround);
        }
      }
      if (extent === "floor_and_shower") {
        const raw = String(
          factValue(facts, workArea.id, "bathroom.waterproofing_extent") ?? ""
        ).toLowerCase();
        if (raw.includes("wall")) {
          assumptions.push(BATHROOM_WP_FLOOR_AND_SHOWER_LEGACY_STATEMENT);
        }
      }
    }
    const wpArea = parts.length > 0 ? round2(parts.reduce((sum, n) => sum + n, 0)) : null;
    if (wpArea != null && wpArea > 0) {
      const wpRate = resolveFinishRate({
        itemKey: BATHROOM_WATERPROOFING_INSTALL_KEY,
        unit: "m2",
        rateType: "subcontractor",
        context,
      });
      const identity = `Waterproofing ${presentBathroomAreaM2(wpArea)} · ${extent.replace(/_/g, " ")}`;
      requirements.push(
        buildSubcontractRequirement({
          workAreaId: workArea.id,
          workAreaType: "bathroom",
          componentKey: BATHROOM_WATERPROOFING_COMPONENT,
          description: "Bathroom waterproofing",
          confidence: shower.assumed ? "medium" : "high",
          assumptions: shower.assumed
            ? [
                {
                  key: "bathroom.shower_assumption",
                  text: BATHROOM_SHOWER_ASSUMPTION_STATEMENT,
                  source: "assumed_default",
                },
              ]
            : [],
          provenance,
          priced: wpRate.priced,
          trade: "waterproofing",
          allowanceCost:
            wpRate.priced && wpRate.costRate != null
              ? round2(wpArea * wpRate.costRate)
              : null,
          totalCost:
            wpRate.priced && wpRate.costRate != null
              ? round2(wpArea * wpRate.costRate)
              : null,
        })
      );
      if (wpRate.priced && wpRate.costRate != null && wpRate.sellRate != null) {
        lineItems.push(
          withPricingOwnership(
            {
              ...createRateLineItem({
                workAreaId: workArea.id,
                workAreaName: workArea.name,
                label: "Waterproofing",
                category: "subcontractor",
                quantity: wpArea,
                unit: "m²",
                costRate: wpRate.costRate,
                sellRate: wpRate.sellRate,
                rateSource: wpRate.sourceLabel,
                rateSourceType: wpRate.sourceType,
                itemKey: BATHROOM_WATERPROOFING_INSTALL_KEY,
                componentKey: BATHROOM_WATERPROOFING_COMPONENT,
                notes: identity,
                sortOrder: sortOrder++,
                organisationSettings: context.organisationSettings,
                qualityFactor: 1,
              }),
              identitySummary: identity,
            },
            {
              pricingOwner: "subcontractor_allowance",
              scopeKey: BATHROOM_WATERPROOFING_COMPONENT,
              overlapGroup: "bathroom_waterproofing",
            }
          )
        );
      } else {
        lineItems.push(
          unpricedLine({
            workArea,
            label: "Waterproofing",
            category: "subcontractor",
            quantity: wpArea,
            unit: "m²",
            itemKey: BATHROOM_WATERPROOFING_INSTALL_KEY,
            componentKey: BATHROOM_WATERPROOFING_COMPONENT,
            identitySummary: identity,
            notes: `${identity}. Pricing required.`,
            sortOrder: sortOrder++,
          })
        );
      }
    }
  }

  return {
    requirements,
    lineItems,
    assumptions: [...new Set(assumptions)],
    missingInfo: [...new Set(missingInfo)],
    nextSortOrder: sortOrder,
  };
}

export function matureBathroomUsesFinishEnvelope(jobScopeRaw: unknown): boolean {
  return isMatureBathroomPath(jobScopeRaw);
}
