/**
 * Canonical catalogue scope identifiers and aliases to stored work-area types.
 *
 * Stored Work Area `type` values are NOT renamed in this batch.
 * Catalogue IDs may be abstract (e.g. waterproofing) when no dedicated WA type exists.
 */

export const CANONICAL_SCOPE_IDS = [
  "deck",
  "bathroom",
  "commercial_fitout",
  "demolition",
  "excavation",
  "substructure",
  "piles_posts",
  "bearers",
  "joists",
  "bracing",
  "framing",
  "decking",
  "fascia",
  "stairs",
  "balustrade",
  "handrail",
  "coatings",
  "trims",
  "drainage",
  "waste_removal",
  "access_logistics",
  "scaffold_access",
  "plumbing",
  "electrical",
  "waterproofing",
  "tiling",
  "linings",
  "fixtures",
  "fit_off",
  "painting",
  "ventilation",
  "partitions",
  "ceilings",
  "doors",
  "flooring",
  "joinery",
  "fire_stopping",
  "seismic",
  "services_coordination",
  "protection",
  "make_good",
  "strip_out",
] as const;

export type CanonicalScopeId = (typeof CANONICAL_SCOPE_IDS)[number];

/**
 * Alias map: incoming / stored type → canonical catalogue id.
 * Documented aliases only — one domain meaning → one canonical id.
 */
export const SCOPE_ALIASES: Readonly<Record<string, CanonicalScopeId>> =
  Object.freeze({
    // Existing SCOPE_CATALOGUE types
    deck: "deck",
    bathroom: "bathroom",
    demolition: "demolition",
    ceilings: "ceilings",
    doors: "doors",
    flooring: "flooring",
    painting: "painting",
    plastering: "linings",
    internal_walls: "partitions",
    external_stairs: "stairs",
    // Common synonyms
    balustrades: "balustrade",
    handrails: "handrail",
    coating: "coatings",
    oiling: "coatings",
    fascia_boards: "fascia",
    face_boards: "fascia",
    vertical_face_boards: "fascia",
    waste: "waste_removal",
    disposal: "waste_removal",
    piles: "piles_posts",
    posts: "piles_posts",
    pile_or_post: "piles_posts",
    soft_strip: "strip_out",
    stripout: "strip_out",
    fitout: "commercial_fitout",
    commercial_fit_out: "commercial_fitout",
    partitions_walls: "partitions",
    wall_linings: "linings",
    firestopping: "fire_stopping",
    fire_stop: "fire_stopping",
    seismic_restraint: "seismic",
    services: "services_coordination",
    access: "access_logistics",
    logistics: "access_logistics",
    make_good_works: "make_good",
    makegood: "make_good",
    ventilation_extract: "ventilation",
    waterproof: "waterproofing",
    tiles: "tiling",
    tile: "tiling",
    fixture: "fixtures",
    fitoff: "fit_off",
    fit_off_install: "fit_off",
  });

export function isCanonicalScopeId(value: string): value is CanonicalScopeId {
  return (CANONICAL_SCOPE_IDS as readonly string[]).includes(value);
}

/**
 * Resolve a stored or free-form type to a canonical catalogue id.
 * Returns null if unknown (do not invent).
 */
export function resolveCanonicalScopeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isCanonicalScopeId(normalized)) return normalized;
  const aliased = SCOPE_ALIASES[normalized];
  return aliased ?? null;
}

export function normalizeScopeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Alias documentation for completion reports / verification. */
export const DOCUMENTED_ALIASES: readonly {
  readonly alias: string;
  readonly canonical: CanonicalScopeId;
  readonly note: string;
}[] = Object.freeze(
  Object.entries(SCOPE_ALIASES).map(([alias, canonical]) =>
    Object.freeze({
      alias,
      canonical,
      note:
        alias === canonical
          ? "Identity alias for stored work-area type"
          : `Maps stored/synonym "${alias}" → "${canonical}"`,
    })
  )
);
