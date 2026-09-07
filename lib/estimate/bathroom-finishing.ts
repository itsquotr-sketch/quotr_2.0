/**
 * WA-BATHROOM-06 — nested stopping and painting.
 *
 * Stopping uses selected new plasterboard lining area (tiles not deducted).
 * Painting uses paintable wall (gross minus tiled) plus ceiling when selected.
 * Finish level does not multiply these allowances.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import {
  BATHROOM_PAINTING_BENCHMARK,
  BATHROOM_PAINTING_COMPONENT,
  BATHROOM_PAINTING_KEY,
  BATHROOM_PAINT_TILE_XOR_STATEMENT,
  BATHROOM_QUOTR_ALLOWANCE_LABEL,
  BATHROOM_STOPPING_BENCHMARK,
  BATHROOM_STOPPING_COMPONENT,
  BATHROOM_STOPPING_KEY,
  BATHROOM_STOPPING_UNDER_TILE_STATEMENT,
} from "@/lib/estimate/bathroom-identities";
import type { BathroomGeometryResolution } from "@/lib/estimate/bathroom-geometry";
import {
  bathroomHalfHeightWallAreaM2,
  resolveBathroomFinishSelection,
  resolveBathroomShowerWallArea,
} from "@/lib/estimate/bathroom-finishes";
import { resolveBathroomPhysicalSelection } from "@/lib/estimate/bathroom-physical";
import { presentBathroomAreaM2 } from "@/lib/estimate/bathroom-linings";
import {
  getBooleanFact,
  getNumberFact,
  getStringFact,
  round2,
} from "@/lib/estimate/facts";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { resolveRate } from "@/lib/estimate/rates";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { createRateLineItem, buildAmounts } from "@/lib/estimate/line-items";
import { buildSubcontractRequirement } from "@/lib/estimate/subcontract-requirement";
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

function catalogueBenchmarkCost(itemKey: string): number | null {
  const entry = getCatalogueEntry(itemKey);
  return entry?.defaultCostRate != null && Number.isFinite(entry.defaultCostRate)
    ? entry.defaultCostRate
    : null;
}

function siblingType(context: EstimateContext, type: string): boolean {
  return context.confirmedWorkAreas.some((row) => row.type === type);
}

function resolveM2Rate(params: {
  itemKey: string;
  fallback: number;
  context: EstimateContext;
}): {
  priced: boolean;
  costRate: number | null;
  sellRate: number | null;
  company: boolean;
  sourceLabel: string;
} {
  const company = params.context.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key === params.itemKey &&
      rate.cost_rate != null
  );
  const fallback = catalogueBenchmarkCost(params.itemKey) ?? params.fallback;
  if (
    fallback == null &&
    company?.cost_rate == null
  ) {
    return {
      priced: false,
      costRate: null,
      sellRate: null,
      company: false,
      sourceLabel: getRateSourceLabel("missing"),
    };
  }
  const resolved = resolveRate({
    rates: params.context.rates,
    rateType: "subcontractor",
    itemKey: params.itemKey,
    unit: "m2",
    fallbackCostRate: company?.cost_rate ?? fallback,
    fallbackSellRate: company?.sell_rate ?? undefined,
    organisationSettings: params.context.organisationSettings,
  });
  return {
    priced: true,
    costRate: resolved.costRate,
    sellRate: resolved.sellRate,
    company: Boolean(company),
    sourceLabel: company
      ? resolved.sourceLabel
      : BATHROOM_QUOTR_ALLOWANCE_LABEL,
  };
}

export function bathroomTiledWallAreaM2(params: {
  context: EstimateContext;
  workAreaId: string;
  geometry: BathroomGeometryResolution;
}): number {
  const selection = resolveBathroomFinishSelection({
    facts: params.context.facts,
    workAreaId: params.workAreaId,
  });
  if (selection.wallTileExtent === "full_height") {
    return params.geometry.grossWallAreaM2 ?? 0;
  }
  if (selection.wallTileExtent === "half_height") {
    return params.geometry.perimeterM != null
      ? bathroomHalfHeightWallAreaM2(params.geometry.perimeterM)
      : 0;
  }
  if (selection.wallTileExtent === "custom") {
    return getNumberFact(
      params.context.facts as never,
      params.workAreaId,
      "bathroom.wall_tiling_area_m2"
    ) ?? 0;
  }
  if (selection.wallTileExtent === "shower_only") {
    return (
      resolveBathroomShowerWallArea({
        facts: params.context.facts as EstimateFact[],
        workAreaId: params.workAreaId,
        needed: true,
      }).areaM2 ?? 0
    );
  }
  return 0;
}

export function bathroomPaintableWallAreaM2(params: {
  context: EstimateContext;
  workAreaId: string;
  geometry: BathroomGeometryResolution;
}): number | null {
  if (params.geometry.grossWallAreaM2 == null) return null;
  return round2(
    Math.max(
      0,
      params.geometry.grossWallAreaM2 -
        bathroomTiledWallAreaM2(params)
    )
  );
}

export function buildBathroomFinishingEnvelope(params: {
  context: EstimateContext;
  workArea: EstimateWorkArea;
  geometry: BathroomGeometryResolution;
  sortOrderStart: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  nextSortOrder: number;
} {
  const { context, workArea, geometry } = params;
  const facts = context.facts;
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;

  const stoppingOn = getBooleanFact(
    facts as never,
    workArea.id,
    "bathroom.stopping_included"
  );
  const paintingOn = getBooleanFact(
    facts as never,
    workArea.id,
    "bathroom.painting_included"
  );
  if (stoppingOn !== true && paintingOn !== true) {
    return { requirements, lineItems, assumptions, missingInfo, nextSortOrder: sortOrder };
  }

  const provenance: RequirementProvenance = {
    calculatorSource: "bathroom-finishing",
    factKeys: [
      "bathroom.stopping_included",
      "bathroom.painting_included",
      "bathroom.wall_lining_included",
      "bathroom.ceiling_lining_included",
      "bathroom.tile_extent",
      "bathroom.length_m",
      "bathroom.width_m",
      "bathroom.wall_height_m",
    ],
    constraintKeys: [],
  };

  const emitSubcontract = (opts: {
    componentKey: string;
    itemKey: string;
    label: string;
    areaM2: number;
    identity: string;
    extraAssumptions: RequirementAssumption[];
    fallback: number;
    overlapGroup: string;
  }) => {
    const rate = resolveM2Rate({
      itemKey: opts.itemKey,
      fallback: opts.fallback,
      context,
    });
    const total =
      rate.priced && rate.costRate != null
        ? round2(opts.areaM2 * rate.costRate)
        : null;
    requirements.push(
      buildSubcontractRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: opts.componentKey,
        description: opts.label,
        confidence: "medium",
        assumptions: opts.extraAssumptions,
        provenance,
        priced: Boolean(rate.priced && total != null),
        trade: opts.componentKey === BATHROOM_STOPPING_COMPONENT ? "plastering" : "painting",
        allowanceCost: total,
        quotedCost: null,
        totalCost: total,
      })
    );
    if (rate.priced && rate.costRate != null && rate.sellRate != null && total != null) {
      lineItems.push(
        withPricingOwnership(
          {
            ...createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: opts.label,
              category: "subcontractor",
              quantity: opts.areaM2,
              unit: "m2",
              costRate: rate.costRate,
              sellRate: rate.sellRate,
              rateSource: rate.sourceLabel,
              rateSourceType: rate.company ? "user_rate" : "benchmark",
              itemKey: opts.itemKey,
              componentKey: opts.componentKey,
              notes: opts.identity,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor: 1,
            }),
            identitySummary: opts.identity,
          },
          {
            pricingOwner: "subcontractor_allowance",
            scopeKey: opts.componentKey,
            overlapGroup: opts.overlapGroup,
          }
        )
      );
    } else {
      lineItems.push(
        withPricingOwnership(
          {
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: opts.label,
            category: "subcontractor",
            quantity: opts.areaM2,
            unit: "m2",
            itemKey: opts.itemKey,
            componentKey: opts.componentKey,
            identitySummary: opts.identity,
            notes: "Pricing required.",
            rateSource: getRateSourceLabel("missing"),
            rateSourceType: "missing",
            sortOrder: sortOrder++,
            ...buildAmounts(0, 0, null),
          },
          {
            pricingOwner: "subcontractor_allowance",
            scopeKey: opts.componentKey,
            overlapGroup: opts.overlapGroup,
          }
        )
      );
    }
  };

  if (stoppingOn === true) {
    if (siblingType(context, "plastering")) {
      assumptions.push(
        "A Plastering Work Area is present. Nested bathroom stopping is not priced."
      );
    } else {
      const physical = resolveBathroomPhysicalSelection({
        facts,
        workAreaId: workArea.id,
      });
      const wallOn =
        getBooleanFact(facts as never, workArea.id, "bathroom.wall_lining_included") ===
          true ||
        (physical.wallLining != null && physical.wallLining !== "none");
      const ceilingOn =
        getBooleanFact(
          facts as never,
          workArea.id,
          "bathroom.ceiling_lining_included"
        ) === true ||
        (physical.ceilingLining != null && physical.ceilingLining !== "none");
      let area = 0;
      if (wallOn === true) {
        if (geometry.grossWallAreaM2 == null) {
          missingInfo.push("Bathroom wall area is required for stopping.");
        } else {
          area += geometry.grossWallAreaM2;
        }
      }
      if (ceilingOn === true) {
        if (geometry.ceilingAreaM2 == null) {
          missingInfo.push("Bathroom ceiling area is required for stopping.");
        } else {
          area += geometry.ceilingAreaM2;
        }
      }
      if (wallOn !== true && ceilingOn !== true) {
        assumptions.push("No new plasterboard lining selected — stopping is not priced.");
      } else if (area > 0) {
        assumptions.push(BATHROOM_STOPPING_UNDER_TILE_STATEMENT);
        emitSubcontract({
          componentKey: BATHROOM_STOPPING_COMPONENT,
          itemKey: BATHROOM_STOPPING_KEY,
          label: "Stopping / plastering",
          areaM2: round2(area),
          identity: `${presentBathroomAreaM2(round2(area))} lining · ${BATHROOM_STOPPING_UNDER_TILE_STATEMENT}`,
          extraAssumptions: [
            {
              key: "bathroom.stopping.tiles",
              text: BATHROOM_STOPPING_UNDER_TILE_STATEMENT,
              source: "calculator_default",
            },
          ],
          fallback: BATHROOM_STOPPING_BENCHMARK,
          overlapGroup: "bathroom_stopping",
        });
      }
    }
  }

  if (paintingOn === true) {
    if (siblingType(context, "painting")) {
      assumptions.push(
        "A Painting Work Area is present. Nested bathroom painting is not priced."
      );
    } else {
      const wallPaint = bathroomPaintableWallAreaM2({
        context,
        workAreaId: workArea.id,
        geometry,
      });
      if (geometry.grossWallAreaM2 == null) {
        missingInfo.push("Bathroom wall area is required for painting.");
      }
      const ceilingPaint = geometry.ceilingAreaM2 ?? 0;
      const total =
        (wallPaint ?? 0) + (geometry.ceilingAreaM2 != null ? ceilingPaint : 0);
      if (geometry.grossWallAreaM2 != null) {
        assumptions.push(BATHROOM_PAINT_TILE_XOR_STATEMENT);
        if (getStringFact(facts as never, workArea.id, "bathroom.tile_extent")) {
          assumptions.push(
            `Paintable walls ${presentBathroomAreaM2(wallPaint ?? 0)} after deducting tiled wall area.`
          );
        }
        if (total > 0) {
          emitSubcontract({
            componentKey: BATHROOM_PAINTING_COMPONENT,
            itemKey: BATHROOM_PAINTING_KEY,
            label: "Painting allowance",
            areaM2: round2(total),
            identity: `${presentBathroomAreaM2(round2(total))} paintable · walls ${presentBathroomAreaM2(wallPaint ?? 0)} · ceiling ${presentBathroomAreaM2(ceilingPaint)}`,
            extraAssumptions: [
              {
                key: "bathroom.painting.xor",
                text: BATHROOM_PAINT_TILE_XOR_STATEMENT,
                source: "calculator_default",
              },
            ],
            fallback: BATHROOM_PAINTING_BENCHMARK,
            overlapGroup: "bathroom_painting",
          });
        }
      }
    }
  }

  return { requirements, lineItems, assumptions, missingInfo, nextSortOrder: sortOrder };
}
