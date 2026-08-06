/**
 * Canonical Work Area ↔ Fact ↔ Question linkage (3.1B.6R3).
 * Facts remain estimating SoT. Uses existing work_area_id scoping — no migration.
 */

export type WorkAreaFactContext = {
  readonly workAreaId: string;
  readonly workAreaType: string;
  readonly workAreaName: string | null;
  readonly factKey: string;
  readonly scopeItemIdentity: string | null;
  readonly source: string;
  readonly downstreamConsumers: readonly string[];
};

/** Map fact keys → typical scope-item identity (catalogue candidate types). */
export const FACT_KEY_SCOPE_ITEM: Readonly<Record<string, string>> = Object.freeze({
  "deck.existing_deck_removal": "demolition",
  "deck.balustrade_required": "balustrade",
  "deck.has_stairs": "stairs",
  "deck.substructure_condition": "substructure",
  "deck.handrail_required": "handrail",
  "bathroom.waterproofing_required": "waterproofing",
});

/** Map fact keys → estimate calculator consumers (presentation labels). */
export const FACT_KEY_CONSUMERS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    "deck.length_m": ["Deck area derivation", "Deck estimate"],
    "deck.width_m": ["Deck area derivation", "Deck estimate"],
    "deck.area_m2": ["Deck estimate"],
    "deck.existing_deck_removal": ["Deck demolition labour"],
    "deck.balustrade_required": ["Deck balustrade allowance"],
    "deck.has_stairs": ["Deck stairs"],
    "pergola.length_m": ["Pergola area derivation", "Pergola estimate"],
    "pergola.width_m": ["Pergola area derivation", "Pergola estimate"],
    "pergola.area_m2": ["Pergola estimate"],
    "bathroom.floor_tiling_area_m2": ["Bathroom tiling"],
    "bathroom.wall_tiling_area_m2": ["Bathroom tiling"],
  });

export function resolveWorkAreaFactContext(params: {
  readonly workAreaId: string;
  readonly workAreaType: string;
  readonly workAreaName?: string | null;
  readonly factKey: string;
  readonly source: string;
}): WorkAreaFactContext {
  return {
    workAreaId: params.workAreaId,
    workAreaType: params.workAreaType,
    workAreaName: params.workAreaName ?? null,
    factKey: params.factKey,
    scopeItemIdentity: FACT_KEY_SCOPE_ITEM[params.factKey] ?? null,
    source: params.source,
    downstreamConsumers: FACT_KEY_CONSUMERS[params.factKey] ?? [],
  };
}

/**
 * Human-facing work-area label for a fact — never expose raw UUIDs.
 */
export function workAreaDisplayLabel(ctx: WorkAreaFactContext): string {
  if (ctx.workAreaName?.trim()) return ctx.workAreaName.trim();
  const type = ctx.workAreaType.replace(/_/g, " ");
  return type.charAt(0).toUpperCase() + type.slice(1);
}
