/**
 * WA-INTERNAL-WALLS-07/08 — insulation / skirting / cornice / electrical /
 * stopping / painting requirement envelope. Quantities are physical. Rates
 * and hours are Pricing Required unless a company exact rate already exists.
 *
 * Does not change timber, steel, lining sheet-run, or opening formulas.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import { round2 } from "@/lib/estimate/facts";
import { buildAmounts, createRateLineItem } from "@/lib/estimate/line-items";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { buildSubcontractRequirement } from "@/lib/estimate/subcontract-requirement";
import { resolveRate } from "@/lib/estimate/rates";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type {
  EstimateContext,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import type { InternalWallsJobScope } from "@/lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
  INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY,
  INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT,
  INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT,
  INTERNAL_WALLS_CORNICE_MATERIAL_KEY,
  INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_COMPONENT,
  INTERNAL_WALLS_INSULATION_INSTALL_HOURS_PER_M2_KEY,
  INTERNAL_WALLS_INSULATION_LABOUR_COMPONENT,
  INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT,
  INTERNAL_WALLS_INSULATION_WASTE_FACTOR,
  INTERNAL_WALLS_PAINTING_COMPONENT,
  INTERNAL_WALLS_PAINTING_MATERIAL_KEY,
  INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
  INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_KEY,
  INTERNAL_WALLS_STOPPING_COMPONENT,
  internalWallsCorniceOverlapGroup,
  internalWallsElectricalAllowanceItemKey,
  internalWallsElectricalOverlapGroup,
  internalWallsInsulationMaterialKey,
  internalWallsInsulationOverlapGroup,
  internalWallsPaintingOverlapGroup,
  internalWallsSkirtingOverlapGroup,
  internalWallsStoppingItemKey,
  internalWallsStoppingOverlapGroup,
} from "@/lib/estimate/internal-walls-identities";
import {
  INTERNAL_WALLS_CORNICE_LABOUR_OWNER_REQUIRED_MESSAGE,
  INTERNAL_WALLS_CORNICE_PRODUCT_REQUIRED_MESSAGE,
  INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_REQUIRED_MESSAGE,
  INTERNAL_WALLS_INSULATION_LABOUR_OWNER_REQUIRED_MESSAGE,
  INTERNAL_WALLS_INSULATION_TYPE_REQUIRED_MESSAGE,
  INTERNAL_WALLS_INSULATION_WASTE_DECISION,
  INTERNAL_WALLS_PAINTING_AREA_RULE,
  INTERNAL_WALLS_PAINTING_RATE_REQUIRED_MESSAGE,
  INTERNAL_WALLS_CORNICE_OPENING_RULE,
  INTERNAL_WALLS_SKIRTING_LABOUR_OWNER_REQUIRED_MESSAGE,
  INTERNAL_WALLS_SKIRTING_OPENING_RULE,
  INTERNAL_WALLS_SKIRTING_PROFILE_REQUIRED_MESSAGE,
  INTERNAL_WALLS_STOPPING_AREA_RULE,
  INTERNAL_WALLS_STOPPING_RATE_REQUIRED_MESSAGE,
  corniceTakeoff,
  electricalTierDisplay,
  insulationAreaForWallType,
  insulationAsksForScope,
  insulationTypeDisplay,
  internalWallsNestedFinishOmit,
  paintingTakeoff,
  presentFinishQty,
  skirtingTakeoff,
  stoppingLevelDisplay,
  stoppingTakeoff,
  type InternalWallsElectricalTier,
} from "@/lib/estimate/internal-walls-finish";
import type { InternalWallsWallType } from "@/lib/estimate/internal-walls-wall-types";

function wallTypeDisplayName(type: InternalWallsWallType, index: number): string {
  if (type.label && type.label.trim()) return type.label.trim();
  return `Wall Type ${index + 1}`;
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

function resolveAllowanceRate(params: {
  itemKey: string;
  context: EstimateContext;
}): {
  priced: boolean;
  costRate: number | null;
  sellRate: number | null;
  sourceLabel: string;
} {
  const company = params.context.rates.find(
    (rate) =>
      rate.active &&
      (rate.rate_type === "allowance" || rate.rate_type === "material") &&
      rate.item_key === params.itemKey &&
      rate.cost_rate != null
  );
  if (company?.cost_rate == null) {
    return {
      priced: false,
      costRate: null,
      sellRate: null,
      sourceLabel: getRateSourceLabel("missing"),
    };
  }
  const resolved = resolveRate({
    rates: params.context.rates,
    rateType: "allowance",
    itemKey: params.itemKey,
    unit: "allowance",
    fallbackCostRate: company.cost_rate,
    fallbackSellRate: company.sell_rate ?? undefined,
    organisationSettings: params.context.organisationSettings,
  });
  return {
    priced: true,
    costRate: resolved.costRate,
    sellRate: resolved.sellRate,
    sourceLabel: resolved.sourceLabel,
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
  overlapGroup: string;
}): EstimateLineItemInput {
  return withPricingOwnership(
    {
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
    },
    {
      pricingOwner: "contractor_material",
      scopeKey: params.componentKey,
      overlapGroup: params.overlapGroup,
    }
  );
}

function unpricedLabourLine(params: {
  workArea: EstimateWorkArea;
  label: string;
  quantity: number;
  unit: string;
  itemKey: string;
  componentKey: string;
  identitySummary: string;
  notes: string;
  sortOrder: number;
  overlapGroup: string;
}): EstimateLineItemInput {
  return withPricingOwnership(
    {
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
    },
    {
      pricingOwner: "in_house_labour",
      scopeKey: params.componentKey,
      overlapGroup: params.overlapGroup,
    }
  );
}

function emitQtyMaterial(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  wallTypeId: string;
  variantKey?: string;
  overlapGroup: string;
  componentKey: string;
  materialKey: string;
  category: "INSULATION" | "TRIM";
  label: string;
  specification: string;
  identitySummary: string;
  quantity: number;
  unit: "m2" | "lm";
  wasteFactor: number;
  unpricedNotes: string;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  sortOrder: number;
}): number {
  const rate = resolveExactMaterialRate({
    itemKey: params.materialKey,
    unit: params.unit,
    context: params.context,
  });
  params.requirements.push(
    buildMaterialRequirement({
      workAreaId: params.workArea.id,
      workAreaType: "internal_walls",
      componentKey: params.componentKey,
      variantKey: params.variantKey ?? params.wallTypeId,
      description: params.label,
      confidence: "high",
      assumptions: [],
      provenance: {
        calculatorSource: "internal-walls-finish",
        factKeys: ["internal_walls.wall_types"],
        constraintKeys: [],
      },
      priced: rate.priced,
      materialKey: params.materialKey,
      category: params.category,
      specification: params.specification,
      baseQuantity: params.quantity,
      baseUnit: params.unit,
      wasteFactor: params.wasteFactor,
      purchaseQuantity: params.quantity,
      purchaseUnit: params.unit,
      rateSource: rate.priced
        ? rate.sourceType === "user_rate"
          ? "company"
          : "benchmark"
        : "missing",
      unitCost: rate.costRate,
      totalCost:
        rate.priced && rate.costRate != null
          ? round2(params.quantity * rate.costRate)
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
            quantity: params.quantity,
            unit: params.unit,
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
        quantity: params.quantity,
        unit: params.unit,
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

function emitQtyLabour(params: {
  workArea: EstimateWorkArea;
  wallTypeId: string;
  variantKey?: string;
  overlapGroup: string;
  componentKey: string;
  hoursKey: string;
  label: string;
  identitySummary: string;
  notes: string;
  quantity: number;
  unit: "m2" | "lm";
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  sortOrder: number;
}): number {
  params.requirements.push(
    buildLabourRequirement({
      workAreaId: params.workArea.id,
      workAreaType: "internal_walls",
      componentKey: params.componentKey,
      variantKey: params.variantKey ?? params.wallTypeId,
      description: params.label,
      confidence: "low",
      assumptions: [],
      provenance: {
        calculatorSource: "internal-walls-finish",
        factKeys: ["internal_walls.wall_types"],
        constraintKeys: [],
      },
      priced: false,
      trade: "carpenter",
      baseHours: 0,
      productivityBasis: {
        key: params.hoursKey,
        hoursPerUnit: 0,
        unit: params.unit,
        quantity: params.quantity,
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
      workArea: params.workArea,
      label: params.label,
      quantity: params.quantity,
      unit: params.unit,
      itemKey: params.hoursKey,
      componentKey: params.componentKey,
      identitySummary: params.identitySummary,
      notes: params.notes,
      sortOrder: params.sortOrder,
      overlapGroup: params.overlapGroup,
    })
  );
  return params.sortOrder + 1;
}

export function buildInternalWallsFinishEnvelope(params: {
  context: EstimateContext;
  workArea: EstimateWorkArea;
  types: readonly InternalWallsWallType[];
  jobScope: InternalWallsJobScope | null;
  sortOrderStart: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  nextSortOrder: number;
} {
  const { context, workArea, types, jobScope } = params;
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;

  if (jobScope === "remove_partition") {
    return {
      requirements,
      lineItems,
      assumptions,
      missingInfo,
      nextSortOrder: sortOrder,
    };
  }

  const omit = internalWallsNestedFinishOmit({
    confirmedTypes: context.confirmedWorkAreas.map((row) => row.type),
  });

  types.forEach((type, index) => {
    const displayName = wallTypeDisplayName(type, index);

    if (
      insulationAsksForScope(jobScope) &&
      type.insulation_included === true
    ) {
      if (type.insulation_type == null) {
        if (!missingInfo.includes(INTERNAL_WALLS_INSULATION_TYPE_REQUIRED_MESSAGE)) {
          missingInfo.push(INTERNAL_WALLS_INSULATION_TYPE_REQUIRED_MESSAGE);
        }
      } else {
        const area = insulationAreaForWallType({ type, jobScope });
        if (!area.ok) {
          if (!missingInfo.includes(area.message)) missingInfo.push(area.message);
        } else {
          const materialKey = internalWallsInsulationMaterialKey(
            type.insulation_type
          );
          const overlap = internalWallsInsulationOverlapGroup(type.id);
          const typeLabel =
            insulationTypeDisplay(type.insulation_type) ?? "Wall insulation";
          const specification = `${typeLabel} · ${presentFinishQty(area.areaM2)} m² net cavity`;
          assumptions.push(INTERNAL_WALLS_INSULATION_WASTE_DECISION);
          sortOrder = emitQtyMaterial({
            workArea,
            context,
            wallTypeId: type.id,
            overlapGroup: overlap,
            componentKey: INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT,
            materialKey,
            category: "INSULATION",
            label: `${displayName} — insulation`,
            specification,
            identitySummary: specification,
            quantity: area.areaM2,
            unit: "m2",
            wasteFactor: INTERNAL_WALLS_INSULATION_WASTE_FACTOR,
            unpricedNotes: `${specification}. Material — Pricing Required.`,
            requirements,
            lineItems,
            sortOrder,
          });
          sortOrder = emitQtyLabour({
            workArea,
            wallTypeId: type.id,
            overlapGroup: overlap,
            componentKey: INTERNAL_WALLS_INSULATION_LABOUR_COMPONENT,
            hoursKey: INTERNAL_WALLS_INSULATION_INSTALL_HOURS_PER_M2_KEY,
            label: `${displayName} — insulation labour`,
            identitySummary: `${specification} · ${INTERNAL_WALLS_INSULATION_LABOUR_OWNER_REQUIRED_MESSAGE}`,
            notes: INTERNAL_WALLS_INSULATION_LABOUR_OWNER_REQUIRED_MESSAGE,
            quantity: area.areaM2,
            unit: "m2",
            requirements,
            lineItems,
            sortOrder,
          });
        }
      }
    }

    const skirting = skirtingTakeoff({ type, jobScope });
    if (skirting && skirting.totalLm > 0) {
      const overlap = internalWallsSkirtingOverlapGroup(type.id);
      assumptions.push(INTERNAL_WALLS_SKIRTING_OPENING_RULE);
      const faces: Array<{ side: "side_a" | "side_b"; lm: number }> = [];
      if (skirting.sideALm != null && skirting.sideALm > 0) {
        faces.push({ side: "side_a", lm: skirting.sideALm });
      }
      if (skirting.sideBLm != null && skirting.sideBLm > 0) {
        faces.push({ side: "side_b", lm: skirting.sideBLm });
      }
      for (const face of faces) {
        const sideLabel = face.side === "side_a" ? "Side A" : "Side B";
        const specification = `${sideLabel} · ${presentFinishQty(face.lm)} lm`;
        sortOrder = emitQtyMaterial({
          workArea,
          context,
          wallTypeId: type.id,
          variantKey: `${type.id}:${face.side}`,
          overlapGroup: overlap,
          componentKey: INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT,
          materialKey: INTERNAL_WALLS_SKIRTING_MATERIAL_KEY,
          category: "TRIM",
          label: `${displayName} — skirting`,
          specification,
          identitySummary: specification,
          quantity: round2(face.lm),
          unit: "lm",
          wasteFactor: 0,
          unpricedNotes: `${specification}. ${INTERNAL_WALLS_SKIRTING_PROFILE_REQUIRED_MESSAGE}`,
          requirements,
          lineItems,
          sortOrder,
        });
        sortOrder = emitQtyLabour({
          workArea,
          wallTypeId: type.id,
          variantKey: `${type.id}:${face.side}`,
          overlapGroup: overlap,
          componentKey: INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT,
          hoursKey: INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
          label: `${displayName} — skirting labour`,
          identitySummary: `${specification} · ${INTERNAL_WALLS_SKIRTING_LABOUR_OWNER_REQUIRED_MESSAGE}`,
          notes: INTERNAL_WALLS_SKIRTING_LABOUR_OWNER_REQUIRED_MESSAGE,
          quantity: round2(face.lm),
          unit: "lm",
          requirements,
          lineItems,
          sortOrder,
        });
      }
    }

    const cornice = corniceTakeoff({ type, jobScope });
    if (cornice && cornice.totalLm > 0) {
      const overlap = internalWallsCorniceOverlapGroup(type.id);
      assumptions.push(INTERNAL_WALLS_CORNICE_OPENING_RULE);
      const faces: Array<{ side: "side_a" | "side_b"; lm: number }> = [];
      if (cornice.sideALm != null && cornice.sideALm > 0) {
        faces.push({ side: "side_a", lm: cornice.sideALm });
      }
      if (cornice.sideBLm != null && cornice.sideBLm > 0) {
        faces.push({ side: "side_b", lm: cornice.sideBLm });
      }
      for (const face of faces) {
        const sideLabel = face.side === "side_a" ? "Side A" : "Side B";
        const specification = `${sideLabel} · ${presentFinishQty(face.lm)} lm`;
        sortOrder = emitQtyMaterial({
          workArea,
          context,
          wallTypeId: type.id,
          variantKey: `${type.id}:${face.side}`,
          overlapGroup: overlap,
          componentKey: INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT,
          materialKey: INTERNAL_WALLS_CORNICE_MATERIAL_KEY,
          category: "TRIM",
          label: `${displayName} — cornice`,
          specification,
          identitySummary: specification,
          quantity: round2(face.lm),
          unit: "lm",
          wasteFactor: 0,
          unpricedNotes: `${specification}. ${INTERNAL_WALLS_CORNICE_PRODUCT_REQUIRED_MESSAGE}`,
          requirements,
          lineItems,
          sortOrder,
        });
        sortOrder = emitQtyLabour({
          workArea,
          wallTypeId: type.id,
          variantKey: `${type.id}:${face.side}`,
          overlapGroup: overlap,
          componentKey: INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT,
          hoursKey: INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY,
          label: `${displayName} — cornice labour`,
          identitySummary: `${specification} · ${INTERNAL_WALLS_CORNICE_LABOUR_OWNER_REQUIRED_MESSAGE}`,
          notes: INTERNAL_WALLS_CORNICE_LABOUR_OWNER_REQUIRED_MESSAGE,
          quantity: round2(face.lm),
          unit: "lm",
          requirements,
          lineItems,
          sortOrder,
        });
      }
    }

    const electrical = type.electrical;
    if (
      electrical &&
      electrical !== "none"
    ) {
      sortOrder = emitElectrical({
        workArea,
        context,
        type,
        displayName,
        tier: electrical,
        requirements,
        lineItems,
        sortOrder,
      });
    }

    if (!omit.omitStopping) {
      const stopping = stoppingTakeoff({ type, jobScope });
      if (
        (type.stopping_side_a && type.stopping_side_a !== "none") ||
        (type.stopping_side_b && type.stopping_side_b !== "none")
      ) {
        if (!stopping) {
          const area = insulationAreaForWallType({ type, jobScope });
          if (!area.ok && !missingInfo.includes(area.message)) {
            missingInfo.push(area.message);
          }
        } else {
          assumptions.push(INTERNAL_WALLS_STOPPING_AREA_RULE);
          const overlap = internalWallsStoppingOverlapGroup(type.id);
          const faces: Array<{
            side: "side_a" | "side_b";
            level: "level_4" | "level_5" | "custom";
            areaM2: number;
          }> = [];
          if (stopping.sideA) {
            faces.push({
              side: "side_a",
              level: stopping.sideA.level,
              areaM2: stopping.sideA.areaM2,
            });
          }
          if (stopping.sideB) {
            faces.push({
              side: "side_b",
              level: stopping.sideB.level,
              areaM2: stopping.sideB.areaM2,
            });
          }
          for (const face of faces) {
            const sideLabel = face.side === "side_a" ? "Side A" : "Side B";
            const levelLabel = stoppingLevelDisplay(face.level) ?? "Stopping";
            const specification = `${sideLabel} · ${levelLabel} · ${face.areaM2} m² visible face`;
            sortOrder = emitServiceM2({
              workArea,
              context,
              wallTypeId: type.id,
              variantKey: `${type.id}:${face.side}:${face.level}`,
              overlapGroup: overlap,
              componentKey: INTERNAL_WALLS_STOPPING_COMPONENT,
              itemKey: internalWallsStoppingItemKey(face.level),
              label: `${displayName} — stopping`,
              specification,
              quantity: face.areaM2,
              unpricedNotes: `${specification}. ${INTERNAL_WALLS_STOPPING_RATE_REQUIRED_MESSAGE}`,
              trade: "plastering",
              requirements,
              lineItems,
              sortOrder,
            });
          }
        }
      }
    }

    if (!omit.omitPainting) {
      const painting = paintingTakeoff({ type, jobScope });
      if (type.painting && type.painting !== "none") {
        if (!painting) {
          const area = insulationAreaForWallType({ type, jobScope });
          if (!area.ok && !missingInfo.includes(area.message)) {
            missingInfo.push(area.message);
          }
        } else {
          assumptions.push(INTERNAL_WALLS_PAINTING_AREA_RULE);
          const overlap = internalWallsPaintingOverlapGroup(type.id);
          const faces: Array<{ side: "side_a" | "side_b"; areaM2: number }> = [];
          if (painting.sideAM2 != null && painting.sideAM2 > 0) {
            faces.push({ side: "side_a", areaM2: painting.sideAM2 });
          }
          if (painting.sideBM2 != null && painting.sideBM2 > 0) {
            faces.push({ side: "side_b", areaM2: painting.sideBM2 });
          }
          for (const face of faces) {
            const sideLabel = face.side === "side_a" ? "Side A" : "Side B";
            const specification = `${sideLabel} · ${face.areaM2} m² wall face`;
            sortOrder = emitServiceM2({
              workArea,
              context,
              wallTypeId: type.id,
              variantKey: `${type.id}:${face.side}`,
              overlapGroup: overlap,
              componentKey: INTERNAL_WALLS_PAINTING_COMPONENT,
              itemKey: INTERNAL_WALLS_PAINTING_MATERIAL_KEY,
              label: `${displayName} — painting`,
              specification,
              quantity: face.areaM2,
              unpricedNotes: `${specification}. ${INTERNAL_WALLS_PAINTING_RATE_REQUIRED_MESSAGE}`,
              trade: "painting",
              requirements,
              lineItems,
              sortOrder,
            });
          }
        }
      }
    }
  });

  return {
    requirements,
    lineItems,
    assumptions: [...new Set(assumptions)],
    missingInfo,
    nextSortOrder: sortOrder,
  };
}

function emitElectrical(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  type: InternalWallsWallType;
  displayName: string;
  tier: Exclude<InternalWallsElectricalTier, "none">;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  sortOrder: number;
}): number {
  const itemKey = internalWallsElectricalAllowanceItemKey(params.tier);
  const overlap = internalWallsElectricalOverlapGroup(params.type.id);
  const tierLabel = electricalTierDisplay(params.tier) ?? "Electrical";
  const note =
    params.tier === "custom" && params.type.electrical_note
      ? params.type.electrical_note
      : null;
  const specification = note
    ? `${tierLabel} allowance · ${note}`
    : `${tierLabel} allowance`;
  const rate = resolveAllowanceRate({
    itemKey,
    context: params.context,
  });
  params.requirements.push(
    buildSubcontractRequirement({
      workAreaId: params.workArea.id,
      workAreaType: "internal_walls",
      componentKey: INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_COMPONENT,
      variantKey: params.type.id,
      description: `${params.displayName} — electrical`,
      confidence: "low",
      assumptions: [
        {
          key: "internal_walls.electrical.allowance_only",
          text: "Electrical is an allowance only. No sockets, cable, or switchboard takeoff.",
          source: "user_confirmed",
        },
      ],
      provenance: {
        calculatorSource: "internal-walls-finish",
        factKeys: ["internal_walls.wall_types"],
        constraintKeys: [],
      },
      priced: Boolean(rate.priced && rate.costRate != null),
      trade: "electrical",
      allowanceCost: rate.costRate,
      quotedCost: null,
      totalCost: rate.priced && rate.costRate != null ? rate.costRate : null,
    })
  );
  if (rate.priced && rate.costRate != null && rate.sellRate != null) {
    params.lineItems.push(
      withPricingOwnership(
        {
          ...createRateLineItem({
            workAreaId: params.workArea.id,
            workAreaName: params.workArea.name,
            label: `${params.displayName} — electrical`,
            category: "subcontractor",
            quantity: 1,
            unit: "allowance",
            costRate: rate.costRate,
            sellRate: rate.sellRate,
            rateSource: rate.sourceLabel,
            rateSourceType: "user_rate",
            itemKey,
            componentKey: INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_COMPONENT,
            notes: specification,
            sortOrder: params.sortOrder,
            organisationSettings: params.context.organisationSettings,
            qualityFactor: 1,
          }),
          identitySummary: specification,
        },
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_COMPONENT,
          overlapGroup: overlap,
        }
      )
    );
  } else {
    params.lineItems.push(
      withPricingOwnership(
        {
          workAreaId: params.workArea.id,
          workAreaName: params.workArea.name,
          label: `${params.displayName} — electrical`,
          category: "subcontractor",
          quantity: 1,
          unit: "allowance",
          itemKey,
          componentKey: INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_COMPONENT,
          identitySummary: specification,
          notes: `${specification}. ${INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_REQUIRED_MESSAGE}`,
          rateSource: getRateSourceLabel("missing"),
          rateSourceType: "missing",
          sortOrder: params.sortOrder,
          ...buildAmounts(0, 0, null),
        },
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_COMPONENT,
          overlapGroup: overlap,
        }
      )
    );
  }
  return params.sortOrder + 1;
}

function resolveExactServiceM2Rate(params: {
  itemKey: string;
  context: EstimateContext;
}): {
  priced: boolean;
  costRate: number | null;
  sellRate: number | null;
  sourceLabel: string;
} {
  const company = params.context.rates.find(
    (rate) =>
      rate.active &&
      (rate.rate_type === "subcontractor" ||
        rate.rate_type === "allowance" ||
        rate.rate_type === "material") &&
      rate.item_key === params.itemKey &&
      rate.cost_rate != null
  );
  if (company?.cost_rate == null) {
    return {
      priced: false,
      costRate: null,
      sellRate: null,
      sourceLabel: getRateSourceLabel("missing"),
    };
  }
  const resolved = resolveRate({
    rates: params.context.rates,
    rateType: "subcontractor",
    itemKey: params.itemKey,
    unit: "m2",
    fallbackCostRate: company.cost_rate,
    fallbackSellRate: company.sell_rate ?? undefined,
    organisationSettings: params.context.organisationSettings,
  });
  return {
    priced: true,
    costRate: resolved.costRate,
    sellRate: resolved.sellRate,
    sourceLabel: resolved.sourceLabel,
  };
}

function emitServiceM2(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  wallTypeId: string;
  variantKey: string;
  overlapGroup: string;
  componentKey: string;
  itemKey: string;
  label: string;
  specification: string;
  quantity: number;
  unpricedNotes: string;
  trade: string;
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  sortOrder: number;
}): number {
  void params.wallTypeId;
  const rate = resolveExactServiceM2Rate({
    itemKey: params.itemKey,
    context: params.context,
  });
  const priced = Boolean(rate.priced && rate.costRate != null);
  params.requirements.push(
    buildSubcontractRequirement({
      workAreaId: params.workArea.id,
      workAreaType: "internal_walls",
      componentKey: params.componentKey,
      variantKey: params.variantKey,
      description: params.label,
      confidence: "high",
      assumptions: [],
      provenance: {
        calculatorSource: "internal-walls-finish",
        factKeys: ["internal_walls.wall_types"],
        constraintKeys: [],
      },
      priced,
      trade: params.trade,
      allowanceCost:
        priced && rate.costRate != null
          ? round2(params.quantity * rate.costRate)
          : null,
      quotedCost: null,
      totalCost:
        priced && rate.costRate != null
          ? round2(params.quantity * rate.costRate)
          : null,
    })
  );
  if (priced && rate.costRate != null && rate.sellRate != null) {
    params.lineItems.push(
      withPricingOwnership(
        {
          ...createRateLineItem({
            workAreaId: params.workArea.id,
            workAreaName: params.workArea.name,
            label: params.label,
            category: "subcontractor",
            quantity: params.quantity,
            unit: "m2",
            costRate: rate.costRate,
            sellRate: rate.sellRate,
            rateSource: rate.sourceLabel,
            rateSourceType: "user_rate",
            itemKey: params.itemKey,
            componentKey: params.componentKey,
            notes: params.specification,
            sortOrder: params.sortOrder,
            organisationSettings: params.context.organisationSettings,
            qualityFactor: 1,
          }),
          identitySummary: params.specification,
        },
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: params.componentKey,
          overlapGroup: params.overlapGroup,
        }
      )
    );
  } else {
    params.lineItems.push(
      withPricingOwnership(
        {
          workAreaId: params.workArea.id,
          workAreaName: params.workArea.name,
          label: params.label,
          category: "subcontractor",
          quantity: params.quantity,
          unit: "m2",
          itemKey: params.itemKey,
          componentKey: params.componentKey,
          identitySummary: params.specification,
          notes: params.unpricedNotes,
          rateSource: getRateSourceLabel("missing"),
          rateSourceType: "missing",
          sortOrder: params.sortOrder,
          ...buildAmounts(0, 0, null),
        },
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: params.componentKey,
          overlapGroup: params.overlapGroup,
        }
      )
    );
  }
  return params.sortOrder + 1;
}
