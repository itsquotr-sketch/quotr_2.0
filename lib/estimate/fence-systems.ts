/**
 * FENCE-MATURITY-1A — fence system classification.
 * Builder-facing labels are canonical. Internal enums are never shown.
 * Vague words must not invent a system.
 */

export const FENCE_SYSTEMS = [
  "TIMBER_VERTICAL_PALING",
  "TIMBER_HORIZONTAL_SLAT",
  "METAL_SLAT_MODULAR",
  "PLASTIC_MODULAR",
] as const;

export type FenceSystem = (typeof FENCE_SYSTEMS)[number];

export type FenceSystemClass = FenceSystem | "missing" | "unsupported";

export const FENCE_SYSTEM_LABELS: Record<FenceSystem, string> = {
  TIMBER_VERTICAL_PALING: "Timber paling — vertical board",
  TIMBER_HORIZONTAL_SLAT: "Horizontal timber slats",
  METAL_SLAT_MODULAR: "Aluminium / steel slat fence",
  PLASTIC_MODULAR: "Plastic / composite fence",
};

export const FENCE_SYSTEM_OPTIONS = [
  FENCE_SYSTEM_LABELS.TIMBER_VERTICAL_PALING,
  FENCE_SYSTEM_LABELS.TIMBER_HORIZONTAL_SLAT,
  FENCE_SYSTEM_LABELS.METAL_SLAT_MODULAR,
  FENCE_SYSTEM_LABELS.PLASTIC_MODULAR,
] as const;

export type FenceMetalMaterial = "aluminium" | "steel";

export type FenceTimberSpecies =
  | "radiata_pine"
  | "macrocarpa"
  | "cedar"
  | "hardwood";

export const FENCE_TIMBER_SPECIES_LABELS: Record<FenceTimberSpecies, string> = {
  radiata_pine: "Radiata Pine",
  macrocarpa: "Macrocarpa",
  cedar: "Cedar",
  hardwood: "Hardwood",
};

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function labelToSystem(raw: string): FenceSystem | null {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
  if ((FENCE_SYSTEMS as readonly string[]).includes(upper)) {
    return upper as FenceSystem;
  }
  for (const system of FENCE_SYSTEMS) {
    if (trimmed.toLowerCase() === FENCE_SYSTEM_LABELS[system].toLowerCase()) {
      return system;
    }
  }
  return null;
}

/**
 * Classify fence system from fence.system, fence.material, and/or
 * paling/panel type. Timber without orientation → vertical paling
 * (disclosed assumption at the physical layer).
 */
export function classifyFenceSystem(
  systemOrMaterial: string | null | undefined,
  palingOrPanelType?: string | null
): FenceSystemClass {
  const primary = systemOrMaterial?.trim() ?? "";
  const secondary = palingOrPanelType?.trim() ?? "";
  if (!primary && !secondary) return "missing";

  const fromLabel = labelToSystem(primary) ?? (secondary ? labelToSystem(secondary) : null);
  if (fromLabel) return fromLabel;

  const t = [...tokens(primary), ...tokens(secondary)];
  if (t.length === 0) return "missing";
  if (t.includes("not") && t.includes("sure")) return "missing";

  const horizontal =
    t.includes("horizontal") ||
    (t.includes("slat") && !t.includes("metal") && !t.includes("aluminium") && !t.includes("aluminum") && !t.includes("steel") && !t.includes("plastic") && !t.includes("composite"));
  const plastic =
    t.includes("plastic") || t.includes("composite") || t.includes("pvc");
  const metal =
    t.includes("metal") ||
    t.includes("aluminium") ||
    t.includes("aluminum") ||
    t.includes("steel") ||
    t.includes("colorbond") ||
    t.includes("colorsteel");
  const timber =
    t.includes("timber") ||
    t.includes("paling") ||
    t.includes("palings") ||
    t.includes("wood");
  const panel = t.includes("panel") || t.includes("panels") || t.includes("modular");

  if (plastic) return "PLASTIC_MODULAR";
  if (metal || (panel && !timber)) return "METAL_SLAT_MODULAR";
  if (horizontal && (timber || t.includes("slat") || t.includes("board"))) {
    return "TIMBER_HORIZONTAL_SLAT";
  }
  if (timber || t.includes("paling") || t.includes("palings")) {
    return "TIMBER_VERTICAL_PALING";
  }
  return "unsupported";
}

export function fenceSystemLabel(system: FenceSystem): string {
  return FENCE_SYSTEM_LABELS[system];
}

export function isTimberFenceSystem(
  system: FenceSystemClass
): system is "TIMBER_VERTICAL_PALING" | "TIMBER_HORIZONTAL_SLAT" {
  return (
    system === "TIMBER_VERTICAL_PALING" || system === "TIMBER_HORIZONTAL_SLAT"
  );
}

export function isModularFenceSystem(
  system: FenceSystemClass
): system is "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR" {
  return system === "METAL_SLAT_MODULAR" || system === "PLASTIC_MODULAR";
}

/**
 * Fence 1A does not model modular gate products.
 * Flip this when a later pass deliberately enables them — do not treat
 * "modular can never have gates" as a permanent physical law.
 */
export const FENCE_1A_MODULAR_GATES_MODELLED = false;

export const FENCE_TIMBER_GATE_FACT_KEYS = [
  "fence.gate_included",
  "fence.gate_count",
  "fence.gate_width_m",
  "fence.gate_position",
  "fence.gate_capping",
] as const;

export function isFenceTimberGateFactKey(key: string): boolean {
  return (FENCE_TIMBER_GATE_FACT_KEYS as readonly string[]).includes(key);
}

/**
 * Active-scope rule: stored Timber gate facts may remain for return-switch,
 * but they are consumed/rendered only when this returns true.
 */
export function fenceGateScopeApplies(system: FenceSystemClass): boolean {
  if (isTimberFenceSystem(system)) return true;
  if (isModularFenceSystem(system)) return FENCE_1A_MODULAR_GATES_MODELLED;
  return false;
}

export function classifyFenceTimberSpecies(
  raw: string | null | undefined
): FenceTimberSpecies | null {
  if (!raw || !raw.trim()) return null;
  const t = tokens(raw);
  if (t.includes("macrocarpa") || t.includes("cypress")) return "macrocarpa";
  if (t.includes("cedar") || t.includes("redwood")) return "cedar";
  if (t.includes("hardwood") || t.includes("kwila") || t.includes("vitex")) {
    return "hardwood";
  }
  if (t.includes("radiata") || t.includes("pine") || t.includes("treated")) {
    return "radiata_pine";
  }
  return null;
}

export function classifyFenceMetalMaterial(
  raw: string | null | undefined
): FenceMetalMaterial | null {
  if (!raw || !raw.trim()) return null;
  const t = tokens(raw);
  if (t.includes("steel") || t.includes("colorbond") || t.includes("colorsteel")) {
    return "steel";
  }
  if (t.includes("aluminium") || t.includes("aluminum") || t.includes("alloy")) {
    return "aluminium";
  }
  return null;
}

/** Legacy package family — not the physical system. */
export function fenceLegacyCommercialFamily(
  system: FenceSystemClass
): "timber" | "metal" | null {
  if (isTimberFenceSystem(system)) return "timber";
  if (isModularFenceSystem(system)) return "metal";
  return null;
}
