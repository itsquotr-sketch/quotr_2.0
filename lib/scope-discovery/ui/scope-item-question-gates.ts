/**
 * Map excluded/included scope items to question suppression (3.1B.6R1).
 * Inclusion does not invent Facts — only exclusion suppresses related questions.
 */

/** When a scope item type is rejected/not required, suppress these fact keys. */
export const SCOPE_ITEM_EXCLUSION_SUPPRESSIONS: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  demolition: ["deck.existing_deck_removal"],
  balustrade: ["deck.balustrade_required"],
  handrail: ["deck.handrail_required"],
  stairs: ["deck.has_stairs", "deck.access_type"],
  coatings: [],
  waste_removal: [],
  waterproofing: [],
  fire_stopping: [],
});

export type ScopeItemDecisionSets = {
  readonly includedTypes: ReadonlySet<string>;
  readonly excludedTypes: ReadonlySet<string>;
};

/**
 * Build included/excluded scope-item type sets from composed suggestion views.
 */
export function buildScopeItemDecisionSets(
  suggestions: readonly {
    readonly proposalClass?: string;
    readonly proposedWorkAreaType: string | null;
    readonly decisionState: string;
  }[]
): ScopeItemDecisionSets {
  const includedTypes = new Set<string>();
  const excludedTypes = new Set<string>();
  for (const s of suggestions) {
    const type = s.proposedWorkAreaType;
    if (!type) continue;
    const cls = String(s.proposalClass ?? "");
    if (cls !== "SCOPE_ITEM" && cls !== "EXCLUSION") continue;
    const state = String(s.decisionState).toUpperCase();
    if (state === "ACCEPTED" || state === "MODIFIED") {
      includedTypes.add(type);
    } else if (state === "REJECTED") {
      excludedTypes.add(type);
    }
  }
  return { includedTypes, excludedTypes };
}

/**
 * True when a template question should be hidden because the related scope item
 * was explicitly marked not required.
 */
export function isQuestionSuppressedByScopeItemExclusion(params: {
  readonly factKey: string;
  readonly excludedTypes: ReadonlySet<string>;
}): boolean {
  for (const [scopeType, factKeys] of Object.entries(
    SCOPE_ITEM_EXCLUSION_SUPPRESSIONS
  )) {
    if (!params.excludedTypes.has(scopeType)) continue;
    if (factKeys.includes(params.factKey)) return true;
  }
  return false;
}
