/**
 * CEILINGS WA-03A — declarative information contract.
 *
 * Ask class vs contextual relevance. Not a second takeoff model.
 * Not wired into clarify/compose.ts in this slice (WA-03B).
 *
 * Lookup/relevance is ready for Details / Ready / Refine ownership.
 */

import type { ClarifyAskClass } from "@/lib/assistant/clarify/types";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
  findCeilingBulkhead,
  findCeilingPortion,
  recommendedCeilingGeometryMode,
  resolveCeilingsPortions,
  type CeilingBulkhead,
  type CeilingPortion,
} from "@/lib/estimate/ceilings-portions";

export type CeilingsContractScope = "portion" | "suspended" | "bulkhead";

export type CeilingsInformationContractRow = {
  readonly factKey: string;
  readonly askClass: ClarifyAskClass;
  readonly scope: CeilingsContractScope;
  readonly calculatorConsumed: boolean;
  readonly physical: boolean;
  readonly commercial: boolean;
  readonly reason: string;
};

export type CeilingsInformationContext = {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly nestedItemId?: string | null;
  readonly componentId?: string | null;
  readonly portion?: CeilingPortion | null;
  readonly bulkhead?: CeilingBulkhead | null;
};

export const CEILINGS_INFORMATION_CONTRACT: readonly CeilingsInformationContractRow[] =
  [
    {
      factKey: "ceilings.portion.geometry_mode",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Length×width vs area-only. Family gates which mode is valid.",
    },
    {
      factKey: "ceilings.portion.length_m",
      askClass: "HARD_MINIMUM",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Plan length. Required for timber/steel/suspended and timber-lined.",
    },
    {
      factKey: "ceilings.portion.width_m",
      askClass: "HARD_MINIMUM",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Plan width. Required for timber/steel/suspended and timber-lined.",
    },
    {
      factKey: "ceilings.portion.area_m2",
      askClass: "HARD_MINIMUM",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Plan area. Sufficient for existing framing + simple lining and tile_and_grid.",
    },
    {
      factKey: "ceilings.portion.job_scope",
      askClass: "HARD_MINIMUM",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "New ceiling vs lining-only vs complete replacement vs reline existing.",
    },
    {
      factKey: "ceilings.portion.structure_family",
      askClass: "HARD_MINIMUM",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Existing / timber / steel / suspended / tile-and-grid XOR family.",
    },
    {
      factKey: "ceilings.portion.structure_requirements",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "New framing / structure requirements when the job is not lining-only.",
    },
    {
      factKey: "ceilings.portion.timber_size",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Timber member size. Relevant only for timber_direct_fix.",
    },
    {
      factKey: "ceilings.portion.spacing_mm",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Framing spacing. Timber or steel direct-fix only.",
    },
    {
      factKey: "ceilings.portion.direction",
      askClass: "ASSUME_IF_SKIPPED",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Run direction along length or width. Framing or timber-lined.",
    },
    {
      factKey: "ceilings.portion.lining_family",
      askClass: "HARD_MINIMUM",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Plasterboard / plywood / timber-lined / tile-and-grid.",
    },
    {
      factKey: "ceilings.portion.plasterboard_product",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Standard / Aqualine / Fyreline / other. Plasterboard lining only.",
    },
    {
      factKey: "ceilings.portion.sheet_length_mm",
      askClass: "ASSUME_IF_SKIPPED",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Sheet length default. Plasterboard / plywood.",
    },
    {
      factKey: "ceilings.portion.sheet_width_mm",
      askClass: "ASSUME_IF_SKIPPED",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Sheet width default. Plasterboard / plywood.",
    },
    {
      factKey: "ceilings.portion.layers",
      askClass: "ASSUME_IF_SKIPPED",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Lining layers where applicable (plasterboard).",
    },
    {
      factKey: "ceilings.portion.height_m",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Ceiling / working height for this portion.",
    },
    {
      factKey: "ceilings.portion.insulation_included",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: false,
      commercial: true,
      reason: "Insulation include for this portion.",
    },
    {
      factKey: "ceilings.portion.bulkheads_present",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Whether this portion has bulkheads. Child facts only when yes.",
    },
    {
      factKey: "ceilings.portion.demolition_included",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: false,
      commercial: true,
      reason: "Existing ceiling removal for this portion.",
    },
    {
      factKey: "ceilings.portion.stopping_included",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: false,
      commercial: true,
      reason: "Stopping / plastering include.",
    },
    {
      factKey: "ceilings.portion.painting_included",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: false,
      commercial: true,
      reason: "Painting include.",
    },
    {
      factKey: "ceilings.portion.penetrations",
      askClass: "REFINEMENT",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Known penetrations. Not a takeoff in 03A.",
    },
    {
      factKey: "ceilings.portion.fire_acoustic_system",
      askClass: "ADVANCED",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Fire / acoustic system. Not a V1 takeoff.",
    },
    {
      factKey: "ceilings.portion.drop_height_m",
      askClass: "HARD_MINIMUM",
      scope: "suspended",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Suspended drop height. Relevant only for suspended_steel.",
    },
    {
      factKey: "ceilings.portion.suspension_spacing_m",
      askClass: "ASK_NOW",
      scope: "suspended",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Suspension spacing. Relevant only for suspended_steel.",
    },
    {
      factKey: "ceilings.portion.edge_offset_m",
      askClass: "ASSUME_IF_SKIPPED",
      scope: "suspended",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Edge offset. Relevant only for suspended_steel.",
    },
    {
      factKey: "ceilings.bulkhead.length_m",
      askClass: "HARD_MINIMUM",
      scope: "bulkhead",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Bulkhead run length. Required when a bulkhead exists.",
    },
    {
      factKey: "ceilings.bulkhead.depth_m",
      askClass: "HARD_MINIMUM",
      scope: "bulkhead",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Bulkhead plan depth. Required when a bulkhead exists.",
    },
    {
      factKey: "ceilings.bulkhead.height_m",
      askClass: "HARD_MINIMUM",
      scope: "bulkhead",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Bulkhead downstand height. Required when a bulkhead exists.",
    },
    {
      factKey: "ceilings.bulkhead.framing_type",
      askClass: "HARD_MINIMUM",
      scope: "bulkhead",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Timber or steel bulkhead framing. Required when a bulkhead exists.",
    },
    {
      factKey: "ceilings.bulkhead.lining_type",
      askClass: "HARD_MINIMUM",
      scope: "bulkhead",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Bulkhead lining type. Required when a bulkhead exists.",
    },
    {
      factKey: "ceilings.bulkhead.topology",
      askClass: "DERIVED_NEVER_ASK",
      scope: "bulkhead",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
    },
  ];

export function ceilingsContractRow(
  factKey: string
): CeilingsInformationContractRow | null {
  return (
    CEILINGS_INFORMATION_CONTRACT.find((row) => row.factKey === factKey) ?? null
  );
}

export function resolveCeilingsInformationContext(
  ctx: CeilingsInformationContext
): {
  portion: CeilingPortion | null;
  bulkhead: CeilingBulkhead | null;
} {
  if (ctx.portion) {
    return {
      portion: ctx.portion,
      bulkhead:
        ctx.bulkhead ?? findCeilingBulkhead(ctx.portion, ctx.componentId),
    };
  }
  const resolved = resolveCeilingsPortions({
    facts: ctx.facts,
    workAreaId: ctx.workAreaId,
  });
  const portion =
    findCeilingPortion(resolved.portions, ctx.nestedItemId) ??
    findCeilingPortion(resolved.portions, resolved.activeId);
  return {
    portion,
    bulkhead: ctx.bulkhead ?? findCeilingBulkhead(portion, ctx.componentId),
  };
}

function lengthWidthRequired(portion: CeilingPortion | null): boolean {
  if (!portion) return false;
  return recommendedCeilingGeometryMode(portion) === "length_width";
}

function areaOnlyValid(portion: CeilingPortion | null): boolean {
  if (!portion) return true;
  return recommendedCeilingGeometryMode(portion) === "area_only";
}

function bulkheadExists(portion: CeilingPortion | null): boolean {
  if (!portion) return false;
  return portion.has_bulkheads === true || portion.bulkheads.length > 0;
}

export function ceilingsFactIsRelevant(
  factKey: string,
  ctx: CeilingsInformationContext
): boolean {
  const row = ceilingsContractRow(factKey);
  if (!row) return false;
  const { portion, bulkhead } = resolveCeilingsInformationContext(ctx);
  const family = portion?.structure.family ?? null;
  const lining = portion?.lining.family ?? null;

  if (row.scope === "bulkhead") {
    if (!bulkheadExists(portion)) return false;
    if (row.factKey === "ceilings.bulkhead.topology") return bulkheadExists(portion);
    return bulkhead != null || bulkheadExists(portion);
  }

  if (row.scope === "suspended") {
    return family === "suspended_steel";
  }

  switch (factKey) {
    case "ceilings.portion.length_m":
    case "ceilings.portion.width_m":
      return lengthWidthRequired(portion);
    case "ceilings.portion.area_m2":
      return areaOnlyValid(portion) || lengthWidthRequired(portion);
    case "ceilings.portion.geometry_mode":
      return family != null || lining != null;
    case "ceilings.portion.timber_size":
      return family === "timber_direct_fix";
    case "ceilings.portion.spacing_mm":
      return family === "timber_direct_fix" || family === "steel_direct_fix";
    case "ceilings.portion.direction":
      return (
        family === "timber_direct_fix" ||
        family === "steel_direct_fix" ||
        lining === "timber_lined"
      );
    case "ceilings.portion.plasterboard_product":
    case "ceilings.portion.layers":
      return lining === "plasterboard";
    case "ceilings.portion.sheet_length_mm":
    case "ceilings.portion.sheet_width_mm":
      return lining === "plasterboard" || lining === "plywood";
    case "ceilings.portion.structure_requirements":
      return (
        portion?.structure.job_scope === "new_ceiling" ||
        portion?.structure.job_scope === "complete_replacement"
      );
    default:
      return true;
  }
}

export type CeilingsContractLookup = {
  readonly factKey: string;
  readonly row: CeilingsInformationContractRow | null;
  readonly relevant: boolean;
  readonly askClass: ClarifyAskClass | null;
  readonly scope: CeilingsContractScope | null;
  readonly reason: string;
  readonly workAreaId: string;
  readonly nestedItemId?: string | null;
  readonly componentId?: string | null;
};

export function lookupCeilingsInformationContract(
  factKey: string,
  ctx: CeilingsInformationContext
): CeilingsContractLookup {
  const row = ceilingsContractRow(factKey);
  const relevant = ceilingsFactIsRelevant(factKey, ctx);
  return {
    factKey,
    row,
    relevant,
    askClass: row?.askClass ?? null,
    scope: row?.scope ?? null,
    reason: relevant
      ? (row?.reason ?? "Relevant for this portion.")
      : "Not relevant for this portion or bulkhead.",
    workAreaId: ctx.workAreaId,
    nestedItemId: ctx.nestedItemId,
    componentId: ctx.componentId,
  };
}
