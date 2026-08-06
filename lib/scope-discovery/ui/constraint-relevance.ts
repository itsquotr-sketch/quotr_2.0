/**
 * Light constraint relevance filtering for Stage 3.1B.6R1.
 * Distinguishes project-wide vs scope-linked constraints without new taxonomy.
 */

export const PROJECT_WIDE_CONSTRAINT_KEYS = Object.freeze([
  "site_access",
  "site_slope",
  "working_hours",
  "occupied_site",
  "floor_level",
] as const);

/** Constraints that become more relevant when certain scope items are included. */
export const SCOPE_LINKED_CONSTRAINT_KEYS: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  waste_removal: ["material_carry_distance", "waste_bin_access"],
  demolition: ["material_carry_distance", "waste_bin_access", "services_isolated"],
  excavation: ["material_carry_distance"],
  balustrade: [],
  access_logistics: ["site_access", "material_carry_distance"],
});

export function isProjectWideConstraint(key: string): boolean {
  return (PROJECT_WIDE_CONSTRAINT_KEYS as readonly string[]).includes(key);
}

/**
 * Keep project-wide constraints always.
 * Keep scope-linked constraints when the linked scope item is included
 * or when no inclusion decisions exist yet (show defaults).
 */
export function filterConstraintsForAcceptedScope(params: {
  readonly constraintKeys: readonly string[];
  readonly includedScopeTypes: ReadonlySet<string>;
  readonly confirmedWorkAreaTypes: ReadonlySet<string>;
}): string[] {
  const hasInclusionDecisions = params.includedScopeTypes.size > 0;
  return params.constraintKeys.filter((key) => {
    if (isProjectWideConstraint(key)) return true;
    if (!hasInclusionDecisions) return true;

    for (const [scopeType, keys] of Object.entries(SCOPE_LINKED_CONSTRAINT_KEYS)) {
      if (keys.includes(key) && params.includedScopeTypes.has(scopeType)) {
        return true;
      }
    }
    // Non-linked, non-project-wide: keep if any relevant WA confirmed (conservative)
    return params.confirmedWorkAreaTypes.size > 0;
  });
}
