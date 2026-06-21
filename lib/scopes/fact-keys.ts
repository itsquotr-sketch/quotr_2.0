/**
 * Canonical fact keys for scope templates, note proposals, and Scope Review.
 * Keeps AI/note proposal keys aligned with estimate engine expectations.
 */

export const DERIVED_FACT_KEYS = new Set([
  "deck.area_m2",
  "retaining_wall.height_m",
]);

const CANONICAL_SUFFIX_BY_SCOPE: Record<string, Record<string, string>> = {
  deck: {
    length: "deck.length_m",
    length_m: "deck.length_m",
    deck_length: "deck.length_m",
    deck_length_m: "deck.length_m",
    "deck.length": "deck.length_m",
    width: "deck.width_m",
    width_m: "deck.width_m",
    deck_width: "deck.width_m",
    deck_width_m: "deck.width_m",
    "deck.width": "deck.width_m",
    area: "deck.area_m2",
    area_m2: "deck.area_m2",
  },
  fence: {
    length: "fence.length_m",
    length_m: "fence.length_m",
    fence_length: "fence.length_m",
    "fence.length": "fence.length_m",
    height: "fence.height_m",
    height_m: "fence.height_m",
    fence_height: "fence.height_m",
    "fence.height": "fence.height_m",
  },
  retaining_wall: {
    length: "retaining_wall.length_m",
    length_m: "retaining_wall.length_m",
    retaining_wall_length: "retaining_wall.length_m",
    "retaining_wall.length": "retaining_wall.length_m",
    height: "retaining_wall.height_m",
    height_m: "retaining_wall.height_m",
    height_high_m: "retaining_wall.height_high_m",
    height_low_m: "retaining_wall.height_low_m",
  },
};

export function normalizeCanonicalFactKey(
  key: string,
  workAreaType: string | null
): string {
  const trimmed = key.trim();
  if (DERIVED_FACT_KEYS.has(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes(".")) {
    return trimmed;
  }

  const underscored = trimmed.replace(/-/g, "_");

  if (workAreaType) {
    const byScope =
      CANONICAL_SUFFIX_BY_SCOPE[workAreaType]?.[trimmed] ??
      CANONICAL_SUFFIX_BY_SCOPE[workAreaType]?.[underscored];
    if (byScope) return byScope;
  }

  if (workAreaType && !trimmed.includes(".")) {
    return `${workAreaType}.${underscored}`;
  }

  return trimmed;
}

export function inferUnitFromFactKey(key: string): string | undefined {
  if (key.endsWith("_m2") || key.includes("area_m2")) return "m²";
  if (key.endsWith("_lm")) return "lm";
  if (
    key.endsWith("_m") ||
    key.includes("length_m") ||
    key.includes("width_m") ||
    key.includes("height_m")
  ) {
    return "m";
  }
  return undefined;
}
