/**
 * RETAINING-WALL-MATURITY-2B — Concrete masonry / Besser commercial maturity.
 *
 * Adapt Timber 1D / Sleeper 2A architecture. Do not invent a second estimating model.
 * Footing 400×250 and sub-base 100 mm remain estimating geometry, not engineering.
 * Reinforcement without a design schedule is an explicit design-dependent allowance.
 */

import type { OrganisationSettings } from "@/components/setup/types";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  RW_CORE_FILL_KEY,
  RW_DRAINAGE_AGGREGATE_KEY,
  RW_FOOTING_CONCRETE_KEY,
  RW_MASONRY_150_KEY,
  RW_MASONRY_200_KEY,
  RW_NOVACOIL_KEY,
  RW_SUBBASE_KEY,
  RW_WATERPROOFING_LIQUID_KEY,
  RW_WATERPROOFING_SHEET_KEY,
} from "@/lib/estimate/retaining-wall-identities";
import { RW_PRODUCTIVITY_KEYS } from "@/lib/estimate/retaining-wall-productivity";
import {
  RW_TIMBER_PILING_METHOD_MACHINE,
  RW_TIMBER_PILING_METHOD_MANUAL,
} from "@/lib/estimate/retaining-wall-construction-method";
import { retainingWallExcavationHoursStarter } from "@/lib/estimate/retaining-wall-family-coverage";

export const RW_MASONRY_PACKAGE_LIFECYCLE = "LEGACY_FALLBACK_ONLY" as const;
export const RW_MASONRY_AUTHORITY_WITH_ALLOWANCE =
  "DETAILED_COMPONENT_AUTHORITY_WITH_ALLOWANCE" as const;

export const RW_MASONRY_FOOTING_DISCLOSURE =
  "Footing dimensions assumed for estimating (400 mm wide × 250 mm deep, or stated override). Confirm engineered design.";
export const RW_MASONRY_SUBBASE_DISCLOSURE =
  "Sub-base assumed 100 mm compacted under the footing. Estimating assumption only.";
export const RW_MASONRY_CORE_FILL_DISCLOSURE =
  "Full core fill assumed for estimating. Confirm engineered masonry design. Volume from block count ÷ series blocks-per-m³.";
export const RW_MASONRY_BLOCK_DENSITY_DISCLOSURE =
  "Standard masonry face density 12.5 blocks/m² (390 × 190 nominal face). Discrete EA from face area.";
/**
 * Block procurement allowance for cuts, breakage, and minor site loss.
 * Applied once: purchase EA = ceil(net × (1 + factor)). Not org default wastage (10%).
 * LOW-CONFIDENCE Quotr starter metadata — company editable later via Rates if productised.
 */
export const RW_MASONRY_BLOCK_PROCUREMENT_FACTOR = 0.05;
export const RW_MASONRY_BLOCK_PROCUREMENT_KIND =
  "LOW_CONFIDENCE_QUOTR_STARTER_PROCUREMENT_ALLOWANCE" as const;
export const RW_MASONRY_BLOCK_PROCUREMENT_DISCLOSURE =
  "Block purchase includes a 5% procurement allowance for cuts, breakage, and minor site loss (applied once, then rounded up to whole blocks). Net physical requirement is unchanged. Low-confidence Quotr starter — Company/Project may override when productised.";
export const RW_MASONRY_DESIGN_CONFIRM =
  "Confirm footing / reinforcement design.";
export const RW_MASONRY_REINFORCEMENT_ACTION =
  "Add a reinforcement allowance or confirm the engineered design.";
export const RW_MASONRY_ENGINEERING_BOUNDARY =
  "Quotr estimates the physical wall. Footing size and reinforcement are estimating assumptions or design inputs — not structural certification.";

/**
 * Mortar / laying consumables — no bag-yield model in MVP.
 * Explicit residual allowance: company item OR % of purchased block material cost.
 * Not included in block rate, labour, core fill, or labour-only subcontract.
 */
export const RW_MASONRY_MORTAR_PERCENT_OF_BLOCKS = 0.1;
export const RW_MASONRY_MORTAR_KIND =
  "LOW_CONFIDENCE_QUOTR_STARTER_LAYING_CONSUMABLES_ALLOWANCE" as const;
export const RW_MASONRY_MORTAR_METHOD =
  "PERCENT_OF_PURCHASED_BLOCK_MATERIAL_OR_COMPANY_ITEM_ALLOWANCE" as const;
export const RW_MASONRY_MORTAR_KEY =
  "retaining_wall.masonry.mortar.allowance" as const;
export const RW_MASONRY_MORTAR_COMPONENT =
  "retaining_wall.masonry.mortar.allowance" as const;
export const RW_MASONRY_MORTAR_DISCLOSURE =
  "Masonry mortar / laying consumables estimated as 10% of purchased block material cost (or a company item allowance). Not bagged joint-volume precision. Not core fill. Not included in block unit rate or self-perform labour.";

/** Block-lay subcontract is labour-only; builder still owns blocks + mortar. */
export const RW_MASONRY_BLOCK_SUBCONTRACT_BASIS =
  "LABOUR_ONLY_BUILDER_SUPPLIES_BLOCKS_AND_MORTAR" as const;

/** Masonry-only fact — does not leak to Timber/Sleeper. */
export const RW_MASONRY_SUBCONTRACT_SCOPE_FACT =
  "retaining_wall.masonry.subcontract_scope" as const;

export const RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_ONLY = "LABOUR_ONLY" as const;
export const RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_AND_MATERIALS =
  "LABOUR_AND_BLOCK_MATERIALS" as const;

export type MasonrySubcontractScope =
  | typeof RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_ONLY
  | typeof RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_AND_MATERIALS;

export function parseMasonrySubcontractScope(
  raw: string | null | undefined
): MasonrySubcontractScope {
  const t = (raw ?? "").toLowerCase().replace(/[\s-+&]+/g, "_");
  if (
    t.includes("labour_and") ||
    t.includes("blocks") ||
    t.includes("laying_materials") ||
    t.includes("materials")
  ) {
    return RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_AND_MATERIALS;
  }
  return RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_ONLY;
}

export function isMasonryBlockLayingSubcontract(raw: string | null | undefined): boolean {
  const t = (raw ?? "").toLowerCase();
  return t.includes("subcontract") || t.includes("subbie") || t === "subcontract";
}

export const RW_MASONRY_SUBCONTRACT_SUPPLY_PLACEHOLDER_DISCLOSURE =
  "Placeholder based on your current block rate — confirm subcontractor supply price.";

export const RW_MASONRY_MORTAR_SUBCONTRACT_SUPPLY_PLACEHOLDER_DISCLOSURE =
  "Placeholder based on your current estimating allowance — confirm subcontractor supply price.";

/** Alias documenting preferred rate identity; canonical key remains block_lay.subcontract. */
export const RW_MASONRY_BLOCK_LAYING_SUBCONTRACT_LABOUR_ONLY_KEY =
  "retaining_wall.masonry.block_laying.subcontract.labour_only" as const;

export function masonryBlockPurchaseEa(
  netBlocks: number,
  procurementFactor: number = RW_MASONRY_BLOCK_PROCUREMENT_FACTOR
): number {
  if (!(netBlocks > 0) || !Number.isFinite(netBlocks)) return 0;
  const factor =
    procurementFactor >= 0 && Number.isFinite(procurementFactor)
      ? procurementFactor
      : RW_MASONRY_BLOCK_PROCUREMENT_FACTOR;
  return Math.ceil(netBlocks * (1 + factor) - 1e-9);
}

/**
 * Design-dependent reinforcement without a schedule.
 * Resolves as EXPLICIT_ALLOWANCE only when a company/project monetary
 * allowance exists. Otherwise PRICING_REQUIRED — never a silent $0 line.
 */
export const RW_REBAR_ALLOWANCE = "REINFORCEMENT_ALLOWANCE_DESIGN_DEPENDENT" as const;
export const RW_MASONRY_REBAR_ALLOWANCE_KEY =
  "retaining_wall.masonry.rebar.allowance" as const;
export const RW_MASONRY_REBAR_ALLOWANCE_COMPONENT =
  "retaining_wall.masonry.rebar.allowance" as const;
export const RW_MASONRY_REBAR_TREATMENT =
  "DESIGN_DEPENDENT_ALLOWANCE_OR_EXPLICIT_QUANTITY_OR_PRICING_REQUIRED" as const;

export const RW_MASONRY_FOOTING_EXCAVATION_OWNERSHIP =
  "MEASURED_BULK_OWNS_EXCAVATION_ELSE_DERIVED_FOOTING_TRENCH" as const;
export const RW_MASONRY_DERIVED_FOOTING_EXCAVATION_NOTE =
  "Derived footing trench excavation (length × footing width × footing depth). Used only when measured bulk excavation is absent. Estimating driver — not a second trench when measured volume already includes footing dig.";

export const RW_MASONRY_PLANT_TREATMENT =
  "MINI_EXCAVATOR_FOR_MEASURED_OR_DERIVED_EXCAVATION_WHEN_ACCESS_ALLOWS_NO_COMPACTOR_INVENTED" as const;
export const RW_MASONRY_PLANT_COMPONENT =
  "retaining_wall.masonry.plant" as const;

export const RW_MASONRY_BLOCK_SUBCONTRACT_KEY =
  "retaining_wall.masonry.block_lay.subcontract" as const;
export const RW_MASONRY_WATERPROOF_SUBCONTRACT_KEY =
  "retaining_wall.masonry.waterproofing.subcontract" as const;

export const RW_MASONRY_EXCAVATION_HOURS_MACHINE_M3 = 0.45;
export const RW_MASONRY_EXCAVATION_HOURS_MANUAL_M3 = 1.6;

export const RW_MASONRY_2B_ACCESS_RULE = {
  appliesTo: [
    "excavation",
    "subbase",
    "footing_concrete",
    "block_laying",
    "core_fill",
    "waterproofing",
    "drainage",
    "backfill",
  ] as const,
  method: "PER_INTENT_PROJECT_CONDITION_MODIFIERS" as const,
  excavationIncludesMaterialCarry: false,
  inwardMaterialIncludesCarry: true,
  note:
    "Site access may adjust excavation, sub-base, footing, block laying, core fill, waterproofing, drainage, and backfill. Material carry adjusts inward-material intents only. Bulk excavation does not inherit material carry. Spoil/export uses waste facts, not material_carry_distance.",
};

export type RwMasonryStarterConfidence = "low" | "medium";

export const RW_MASONRY_2B_MATERIAL_STARTERS: Record<
  string,
  {
    costPerUnit: number;
    unit: string;
    identity: string;
    rationale: string;
    confidence: RwMasonryStarterConfidence;
  }
> = {
  [RW_MASONRY_200_KEY]: {
    costPerUnit: 5.5,
    unit: "ea",
    identity: "200-series concrete masonry block 390×190×190",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER BENCHMARK. Indicative NZ merchant band for standard 200-series CMU/Besser, ex GST — not a brand quote. Company/Project exact overrides.",
  },
  [RW_MASONRY_150_KEY]: {
    costPerUnit: 4.8,
    unit: "ea",
    identity: "150-series concrete masonry block 390×190×140",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER BENCHMARK. Indicative NZ merchant band for standard 150-series CMU, ex GST — not a brand quote. Company/Project exact overrides.",
  },
  [RW_SUBBASE_KEY]: {
    costPerUnit: 68,
    unit: "m3",
    identity: "Compacted sub-base aggregate under masonry footing (purchased m³)",
    confidence: "medium",
    rationale:
      "MEDIUM-CONFIDENCE QUOTR STARTER. GAP/AP40-class builder-buy band applied to in-place sub-base m³. Distinct from drainage aggregate identity. Company/Project exact overrides.",
  },
  [RW_FOOTING_CONCRETE_KEY]: {
    costPerUnit: 245,
    unit: "m3",
    identity: "Ready-mix / concrete supply for masonry strip footing",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER. Indicative NZ ready-mix supply $/m³ ex GST for normal footing volumes — not bagged concrete and not pump/delivery add-ons. Company/Project exact overrides.",
  },
  [RW_CORE_FILL_KEY]: {
    costPerUnit: 260,
    unit: "m3",
    identity: "Masonry core fill / grout (m³)",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER. Core-fill/grout band distinct from drainage aggregate and from footing concrete unless company intentionally unifies. Company/Project exact overrides.",
  },
  [RW_WATERPROOFING_LIQUID_KEY]: {
    costPerUnit: 12,
    unit: "L",
    identity: "Liquid retaining-side waterproofing membrane",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER. Indicative liquid membrane $/L at ~1 L/m² coverage. Product confirmation required. Company/Project exact overrides.",
  },
  [RW_WATERPROOFING_SHEET_KEY]: {
    costPerUnit: 22,
    unit: "m2",
    identity: "Sheet retaining-side waterproofing membrane",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER. Indicative sheet membrane $/m². Product confirmation required. Company/Project exact overrides.",
  },
  [RW_NOVACOIL_KEY]: {
    costPerUnit: 8.5,
    unit: "lm",
    identity: "100 mm slotted drainage coil (novacoil)",
    confidence: "medium",
    rationale: "Shared Timber 1D / Sleeper 2A starter — same product on masonry walls.",
  },
  [RW_DRAINAGE_AGGREGATE_KEY]: {
    costPerUnit: 72,
    unit: "m3",
    identity: "Drainage aggregate / drainage metal (purchased m³)",
    confidence: "medium",
    rationale: "Shared Timber 1D / Sleeper 2A starter — drainage metal only, not core fill or sub-base.",
  },
  [RW_MASONRY_BLOCK_SUBCONTRACT_KEY]: {
    costPerUnit: 85,
    unit: "m2",
    identity: "Masonry block laying — subcontract labour only ($/face m²)",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER. Indicative NZ subcontract block-laying labour band $/face m² — labour only, builder supplies blocks and mortar unless scope says otherwise. Company/Project exact overrides.",
  },
};

export const RW_MASONRY_2B_PRODUCTIVITY_STARTERS: Record<
  string,
  {
    hoursPerUnit: number;
    unit: string;
    included: string;
    excluded: string;
    confidence: "starter";
    confidenceBand: "low" | "medium";
    rationale: string;
    crewMethod: string;
    plantAssumption: string;
  }
> = {
  [RW_PRODUCTIVITY_KEYS.masonrySubbaseM2]: {
    hoursPerUnit: 0.15,
    unit: "m2",
    included: "Place, level, and hand-compact sub-base under footing plan area",
    excluded: "Bulk excavation, footing pour, block laying, plant hire, spoil export",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "1 person hand place/compact on prepared trench base",
    plantAssumption: "No plate-compactor day invented — labour covers MVP compaction",
    rationale:
      "~9 min/m² footing-base area for place and hand compact. Driver is plan m², not sub-base m³.",
  },
  [RW_PRODUCTIVITY_KEYS.masonryFootingM3]: {
    hoursPerUnit: 1.2,
    unit: "m3",
    included: "Receive/place ready-mix, level, basic consolidate footing",
    excluded: "Excavation, rebar fabrication/design, sub-base, block laying, pump hire",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "2-person attendance on ready-mix footing pour",
    plantAssumption: "Pump/delivery charges not invented",
    rationale:
      "1.2 h/m³ place-and-finish starter for strip footing volumes. Not bagged-concrete mixing.",
  },
  [RW_PRODUCTIVITY_KEYS.masonryBlockM2]: {
    hoursPerUnit: 1.8,
    unit: "m2",
    included: "Set out, lay standard hollow blocks, level courses, normal workface handling",
    excluded: "Core fill, waterproofing, excavation, footing, plant, subcontract block laying",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "1 bricklayer + attendant on accessible suburban site",
    plantAssumption: "None — hand/small-tool. Awkward carry is Project Conditions.",
    rationale:
      "1.8 h/face-m² self-perform starter for standard CMU. XOR with subcontract — never both.",
  },
  [RW_PRODUCTIVITY_KEYS.masonryCoreFillM3]: {
    hoursPerUnit: 0.85,
    unit: "m3",
    included: "Place core fill/grout into filled cores, basic consolidation",
    excluded: "Block laying, waterproofing, footing pour, rebar design",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "1–2 person pour into cores after laying",
    plantAssumption: "None invented for MVP",
    rationale:
      "0.85 h/m³ separate from block-laying hours. Full core-fill estimating assumption.",
  },
  [RW_PRODUCTIVITY_KEYS.masonryWaterproofM2]: {
    hoursPerUnit: 0.28,
    unit: "m2",
    included: "Prepare retaining face, apply liquid or sheet membrane on retaining side",
    excluded: "Drainage aggregate, novacoil, block laying, subcontract waterproofing",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "1 person self-perform retaining-side waterproofing",
    plantAssumption: "None",
    rationale:
      "~17 min/m² retaining-side only. XOR with waterproofing subcontract.",
  },
  [RW_PRODUCTIVITY_KEYS.masonryRebarLm]: {
    hoursPerUnit: 0.08,
    unit: "lm",
    included: "Place stated horizontal reinforcement runs (when design quantity exists)",
    excluded: "Fabrication of an invented bar schedule, footing dig, block laying",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "1 person placing stated runs only",
    plantAssumption: "None",
    rationale:
      "Used only when horizontal run count is stated. No fabricated engineering schedule.",
  },
};

export function masonry2BMaterialStarter(
  itemKey: string | null | undefined,
  unit?: string | null
): {
  costPerUnit: number;
  unit: string;
  confidence: RwMasonryStarterConfidence;
} | null {
  if (!itemKey) return null;
  const row = RW_MASONRY_2B_MATERIAL_STARTERS[itemKey];
  if (!row || row.costPerUnit <= 0) return null;
  if (unit && row.unit !== unit) return null;
  return {
    costPerUnit: row.costPerUnit,
    unit: row.unit,
    confidence: row.confidence,
  };
}

export function masonry2BProductivityStarter(
  productivityKey: string
): { hoursPerUnit: number; unit: string } | null {
  const row = RW_MASONRY_2B_PRODUCTIVITY_STARTERS[productivityKey];
  return row ? { hoursPerUnit: row.hoursPerUnit, unit: row.unit } : null;
}

export function masonry2BExcavationHoursM3(machineAssisted: boolean): number {
  return retainingWallExcavationHoursStarter(
    machineAssisted
      ? RW_TIMBER_PILING_METHOD_MACHINE
      : RW_TIMBER_PILING_METHOD_MANUAL
  );
}

export function detailedMasonryLabourFromCost(
  costPerHour: number,
  organisationSettings: OrganisationSettings | null
): {
  costPerHour: number;
  sellPerHour: number;
  sellAuthority: "derived_from_gross_margin";
  sellDerivedFromMargin: true;
  grossMarginPercent: number;
} {
  const gm =
    organisationSettings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT;
  const classified = classifyResolvedSell({
    costRate: costPerHour,
    sellRate: null,
    applicableGrossMarginPercent: gm,
  });
  return {
    costPerHour,
    sellPerHour: classified.sellRate,
    sellAuthority: "derived_from_gross_margin",
    sellDerivedFromMargin: true,
    grossMarginPercent: gm,
  };
}
