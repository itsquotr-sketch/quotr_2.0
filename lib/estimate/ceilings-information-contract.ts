/**
 * CEILINGS WA-03A — declarative information contract.
 *
 * Ask class vs contextual relevance. Canonical source for Details,
 * Ready, and Refine ownership. Do not hand-copy Ceiling relevance into
 * compose / question-ownership / Refine.
 */

import type { ClarifyAskClass } from "@/lib/assistant/clarify/types";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  CEILINGS_ACTIVE_BULKHEAD_ID_FACT_KEY,
  CEILINGS_ACTIVE_PORTION_ID_FACT_KEY,
  CEILINGS_ADD_BULKHEAD_KEY,
  CEILINGS_ADD_PORTION_KEY,
  CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
  CEILINGS_DELETE_BULKHEAD_KEY,
  CEILINGS_DELETE_PORTION_KEY,
  CEILINGS_DUPLICATE_PORTION_KEY,
  CEILINGS_PORTIONS_FACT_KEY,
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
  readonly briefText?: string | null;
  readonly omitStopping?: boolean;
  readonly omitPainting?: boolean;
};

export const CEILINGS_TIMBER_SPACING_ASSUMPTION_MM = 450;
export const CEILINGS_SUSPENSION_SPACING_ASSUMPTION_M = 1.2;
export const CEILINGS_EDGE_OFFSET_ASSUMPTION_M = 0.2;
export const CEILINGS_TIMBER_SPACING_ASSUMPTION_STATEMENT =
  "Assuming 450 mm timber framing centres.";
export const CEILINGS_SUSPENSION_SPACING_ASSUMPTION_STATEMENT =
  "Assuming 1.2 m maximum support spacing for the suspended ceiling.";
export const CEILINGS_EDGE_OFFSET_ASSUMPTION_STATEMENT =
  "Assuming a 0.2 m edge offset for the suspended ceiling.";
export const CEILINGS_TILE_SIZE_ASSUMPTION = "600x600";
export const CEILINGS_LINING_LAYERS_ASSUMPTION = 1;
export const CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT =
  "Assumes one layer of ceiling lining.";

export const CEILINGS_INFORMATION_CONTRACT: readonly CeilingsInformationContractRow[] =
  [
    {
      factKey: "ceilings.portion.geometry_mode",
      askClass: "DERIVED_NEVER_ASK",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Length×width vs area-only. Derived from family; not independently asked.",
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
      askClass: "ASSUME_IF_SKIPPED",
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
      askClass: "ASSUME_IF_SKIPPED",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Timber framing spacing. Disclosed 450 mm if skipped.",
    },
    {
      factKey: "ceilings.portion.primary_spacing_mm",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Steel primary channel spacing. Steel direct-fix and suspended steel.",
    },
    {
      factKey: "ceilings.portion.furring_spacing_mm",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Steel furring spacing. Steel direct-fix and suspended steel.",
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
      factKey: "ceilings.portion.thickness_mm",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason:
        "Plasterboard thickness. Not inferred from Standard / Aqualine / Fyreline.",
    },
    {
      factKey: "ceilings.portion.plywood_spec",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Plywood specification. Required when lining is plywood.",
    },
    {
      factKey: "ceilings.portion.board_width_mm",
      askClass: "HARD_MINIMUM",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Timber-lined cover width. Area-only is not sufficient.",
    },
    {
      factKey: "ceilings.portion.gap_mm",
      askClass: "HARD_MINIMUM",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Timber-lined gap. Required with board width and direction.",
    },
    {
      factKey: "ceilings.portion.tile_size",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Tile & Grid tile size. Area is sufficient for geometry.",
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
      reason:
        "Lining layers where applicable (plasterboard). Omitted consumes 1 as ASSUMED_DISCLOSED.",
    },
    {
      factKey: "ceilings.portion.height_m",
      askClass: "ASSUME_IF_SKIPPED",
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
      physical: true,
      commercial: true,
      reason: "Insulation include for this portion.",
    },
    {
      factKey: "ceilings.portion.insulation_type",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Insulation specification when insulation is included.",
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
      factKey: "ceilings.portion.significant_penetrations",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Significant openings / hatches. Asked only where relevant.",
    },
    {
      factKey: "ceilings.portion.penetrations",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: false,
      reason: "Approximate hatch / opening count when significant penetrations exist.",
    },
    {
      factKey: "ceilings.portion.fire_acoustic_requirement",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Fire / acoustic requirement class. Asked only when relevant.",
    },
    {
      factKey: "ceilings.portion.fire_acoustic_system",
      askClass: "ASK_NOW",
      scope: "portion",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Named fire / acoustic system when specified. Do not invent a system.",
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
      askClass: "ASSUME_IF_SKIPPED",
      scope: "suspended",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Suspension spacing. Disclosed 1.2 m if skipped.",
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
      factKey: "ceilings.bulkhead.thickness_mm",
      askClass: "ASK_NOW",
      scope: "bulkhead",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason:
        "Bulkhead plasterboard thickness. Not inferred as 13 mm. Required for Standard / Aqualine / Fyreline.",
    },
    {
      factKey: "ceilings.bulkhead.form",
      askClass: "ASK_NOW",
      scope: "bulkhead",
      calculatorConsumed: false,
      physical: true,
      commercial: true,
      reason: "Bulkhead form. Island/boxed/complex is unsupported specialist, not two-face.",
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

function briefMentionsFireAcoustic(briefText: string | null | undefined): boolean {
  const brief = (briefText ?? "").toLowerCase();
  return (
    /\bfire(\s|-)?(rated|rating|system|ceiling)\b/.test(brief) ||
    /\bacoustic\b/.test(brief) ||
    /\bstc\b/.test(brief) ||
    /\brw\b/.test(brief)
  );
}

function briefMentionsPenetrations(briefText: string | null | undefined): boolean {
  const brief = (briefText ?? "").toLowerCase();
  return (
    /\bpenetrat/.test(brief) ||
    /\bhatch/.test(brief) ||
    /\baccess panel/.test(brief) ||
    /\bceiling opening/.test(brief)
  );
}

function demolitionRelevant(portion: CeilingPortion | null): boolean {
  const scope = portion?.structure.job_scope;
  return (
    scope === "replacement_lining_only" ||
    scope === "complete_replacement"
  );
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
    if (row.factKey === "ceilings.bulkhead.thickness_mm") {
      const lining = bulkhead?.lining_type;
      return lining === "standard" || lining === "aqualine" || lining === "fyreline";
    }
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
      return family === "timber_direct_fix";
    case "ceilings.portion.primary_spacing_mm":
    case "ceilings.portion.furring_spacing_mm":
      return family === "steel_direct_fix" || family === "suspended_steel";
    case "ceilings.portion.direction":
      return (
        family === "timber_direct_fix" ||
        family === "steel_direct_fix" ||
        family === "suspended_steel" ||
        lining === "timber_lined"
      );
    case "ceilings.portion.plasterboard_product":
    case "ceilings.portion.thickness_mm":
    case "ceilings.portion.layers":
      return lining === "plasterboard";
    case "ceilings.portion.plywood_spec":
      return lining === "plywood";
    case "ceilings.portion.board_width_mm":
    case "ceilings.portion.gap_mm":
      return lining === "timber_lined";
    case "ceilings.portion.tile_size":
      return family === "tile_and_grid" || lining === "tile_and_grid";
    case "ceilings.portion.sheet_length_mm":
    case "ceilings.portion.sheet_width_mm":
      return lining === "plasterboard" || lining === "plywood";
    case "ceilings.portion.structure_requirements":
      return (
        portion?.structure.job_scope === "new_ceiling" ||
        portion?.structure.job_scope === "complete_replacement"
      );
    case "ceilings.portion.demolition_included":
      return demolitionRelevant(portion);
    case "ceilings.portion.stopping_included":
      return ctx.omitStopping !== true;
    case "ceilings.portion.painting_included":
      return ctx.omitPainting !== true;
    case "ceilings.portion.insulation_type":
      return portion?.finish.insulation_included === true;
    case "ceilings.portion.significant_penetrations":
      return (
        briefMentionsPenetrations(ctx.briefText) ||
        portion?.significant_penetrations != null
      );
    case "ceilings.portion.penetrations":
      return portion?.significant_penetrations === true;
    case "ceilings.portion.fire_acoustic_requirement":
      return (
        briefMentionsFireAcoustic(ctx.briefText) ||
        portion?.fire_acoustic_requirement != null ||
        Boolean(portion?.fire_acoustic_system)
      );
    case "ceilings.portion.fire_acoustic_system":
      return portion?.fire_acoustic_requirement === "specified";
    default:
      return true;
  }
}

export function ceilingsFactQuestionClass(
  factKey: string
): ClarifyAskClass | null {
  return ceilingsContractRow(factKey)?.askClass ?? null;
}

export function listCeilingsInformationContract(): readonly CeilingsInformationContractRow[] {
  return CEILINGS_INFORMATION_CONTRACT;
}

export function ceilingsDetailsSectionId(
  factKey: string
): "dimensions" | "materials" | "structure" | "scope" | "details" {
  if (
    factKey.includes("length_m") ||
    factKey.includes("width_m") ||
    factKey.includes("area_m2") ||
    factKey.includes("geometry")
  ) {
    return "dimensions";
  }
  if (
    factKey.includes("structure") ||
    factKey.includes("timber") ||
    factKey.includes("spacing") ||
    factKey.includes("direction") ||
    factKey.includes("drop") ||
    factKey.includes("suspension") ||
    factKey.includes("edge_offset") ||
    factKey.includes("primary") ||
    factKey.includes("furring") ||
    factKey.includes("job_scope")
  ) {
    return "structure";
  }
  if (
    factKey.includes("lining") ||
    factKey.includes("plasterboard") ||
    factKey.includes("thickness") ||
    factKey.includes("plywood") ||
    factKey.includes("tile") ||
    factKey.includes("sheet") ||
    factKey.includes("layers") ||
    factKey.includes("board_width") ||
    factKey.includes("gap_mm")
  ) {
    return "materials";
  }
  if (
    factKey.includes("insulation") ||
    factKey.includes("demolition") ||
    factKey.includes("stopping") ||
    factKey.includes("painting") ||
    factKey.includes("bulkhead") ||
    factKey.includes("penetrat") ||
    factKey.includes("fire") ||
    factKey.includes("height_m")
  ) {
    return "scope";
  }
  return "details";
}

export function ceilingsAssumptionStatement(factKey: string): string | null {
  if (factKey === "ceilings.portion.spacing_mm") {
    return CEILINGS_TIMBER_SPACING_ASSUMPTION_STATEMENT;
  }
  if (factKey === "ceilings.portion.suspension_spacing_m") {
    return CEILINGS_SUSPENSION_SPACING_ASSUMPTION_STATEMENT;
  }
  if (factKey === "ceilings.portion.edge_offset_m") {
    return CEILINGS_EDGE_OFFSET_ASSUMPTION_STATEMENT;
  }
  if (factKey === "ceilings.portion.layers") {
    return CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT;
  }
  if (factKey === "ceilings.bulkhead.topology" || factKey === "ceilings.bulkhead.form") {
    return CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION;
  }
  return null;
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

/** Calculator-owned Refine contract. Nested write keys patch `ceilings.portions`. */
export const CEILINGS_CALCULATOR_CONSUMED_FACTS = [
  CEILINGS_PORTIONS_FACT_KEY,
  CEILINGS_ACTIVE_PORTION_ID_FACT_KEY,
  CEILINGS_ACTIVE_BULKHEAD_ID_FACT_KEY,
  CEILINGS_ADD_PORTION_KEY,
  CEILINGS_DUPLICATE_PORTION_KEY,
  CEILINGS_DELETE_PORTION_KEY,
  CEILINGS_ADD_BULKHEAD_KEY,
  CEILINGS_DELETE_BULKHEAD_KEY,
  ...CEILINGS_INFORMATION_CONTRACT.map((row) => row.factKey),
  "ceilings.portion.label",
  "ceilings.bulkhead.label",
  "ceilings.area_m2",
  "ceilings.ceiling_type",
  "ceilings.edge_lining_length_lm",
  "ceilings.edge_lining_type",
  "ceilings.demolition_included",
  "ceilings.battens_included",
  "ceilings.insulation_included",
  "ceilings.stopping_included",
  "ceilings.painting_included",
] as const;
