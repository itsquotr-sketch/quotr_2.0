/**
 * Demolition handling: demolition is usually a component fact on a parent scope
 * (bathroom.demolition_required, kitchen.demolition_required, etc.), not a
 * separate work area — unless the brief describes a standalone strip-out package.
 */

/** Scopes where demolition/strip-out is normally a component, not its own work area. */
export const PARENT_SCOPES_WITH_EMBEDDED_DEMOLITION = [
  "bathroom",
  "kitchen",
  "fence",
] as const;

export type EmbeddedDemolitionParentScope =
  (typeof PARENT_SCOPES_WITH_EMBEDDED_DEMOLITION)[number];

export function shouldDropStandaloneDemolitionWorkArea(
  confirmedWorkAreaTypes: string[]
): boolean {
  const types = new Set(confirmedWorkAreaTypes);

  if (!types.has("demolition")) {
    return false;
  }

  return PARENT_SCOPES_WITH_EMBEDDED_DEMOLITION.some((parentType) =>
    types.has(parentType)
  );
}

function keepsExplicitConcretePath(
  facts: readonly { key?: string; value?: unknown }[]
): boolean {
  return facts.some((fact) => {
    if (fact.key !== "demolition.scope_items" || !Array.isArray(fact.value)) return false;
    return fact.value.some(
      (item) => typeof item === "string" && /concrete path/i.test(item)
    );
  });
}

export function filterEmbeddedDemolitionWorkAreas<
  T extends { type: string }
>(
  workAreas: T[],
  facts: readonly { key?: string; value?: unknown }[] = []
): T[] {
  const types = workAreas.map((wa) => wa.type);

  if (
    keepsExplicitConcretePath(facts) ||
    !shouldDropStandaloneDemolitionWorkArea(types)
  ) {
    return workAreas;
  }

  return workAreas.filter((wa) => wa.type !== "demolition");
}
