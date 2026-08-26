/**
 * RETAINING-WALL-MATURITY-1A — wall system/type selection.
 * Evolves the previous timber/concrete commercial family into three systems.
 * Vague words must not invent a system.
 */

export const RETAINING_WALL_SYSTEMS = [
  "TIMBER_RETAINING_WALL",
  "CONCRETE_SLEEPER_WALL",
  "CONCRETE_MASONRY_WALL",
] as const;

export type RetainingWallSystem = (typeof RETAINING_WALL_SYSTEMS)[number];

export type RetainingWallSystemClass =
  | RetainingWallSystem
  | "CONCRETE_UNSPECIFIED"
  | "missing"
  | "unsupported";

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function classifyRetainingWallSystem(
  material: string | null | undefined
): RetainingWallSystemClass {
  if (!material || !material.trim()) return "missing";
  const raw = material.trim();
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if ((RETAINING_WALL_SYSTEMS as readonly string[]).includes(upper)) {
    return upper as RetainingWallSystem;
  }

  const t = tokens(raw);
  if (t.includes("gabion") || t.includes("stone") || t.includes("rock")) {
    return "unsupported";
  }

  const sleeper = t.includes("sleeper") || t.includes("sleepers");
  if (sleeper) return "CONCRETE_SLEEPER_WALL";

  const masonry =
    t.includes("masonry") ||
    t.includes("block") ||
    t.includes("blocks") ||
    t.includes("cmu") ||
    t.includes("besser");
  if (masonry) return "CONCRETE_MASONRY_WALL";

  if (t.includes("timber")) {
    return "TIMBER_RETAINING_WALL";
  }

  if (t.includes("concrete")) {
    return "CONCRETE_UNSPECIFIED";
  }

  return "unsupported";
}

export function retainingWallSystemLabel(system: RetainingWallSystem): string {
  switch (system) {
    case "TIMBER_RETAINING_WALL":
      return "Timber retaining wall";
    case "CONCRETE_SLEEPER_WALL":
      return "Concrete sleeper wall";
    case "CONCRETE_MASONRY_WALL":
      return "Concrete masonry / Besser block";
  }
}

/** Legacy commercial package family used by 1A money. Not the physical system. */
export function retainingWallLegacyCommercialFamily(
  system: RetainingWallSystemClass
): "timber" | "concrete" | null {
  if (system === "TIMBER_RETAINING_WALL") return "timber";
  if (
    system === "CONCRETE_SLEEPER_WALL" ||
    system === "CONCRETE_MASONRY_WALL" ||
    system === "CONCRETE_UNSPECIFIED"
  ) {
    return "concrete";
  }
  return null;
}
