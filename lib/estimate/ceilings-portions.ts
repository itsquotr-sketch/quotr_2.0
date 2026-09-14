/**
 * CEILINGS WA-03A — Ceiling Portion nested collection.
 *
 * Canonical store: `ceilings.portions` on project_facts (jsonb).
 * Persistence may wrap `{ v, portions }` so concurrent nested writes
 * compare-and-swap an integer revision.
 *
 * Stable UUID per Portion and Bulkhead. Do not flatten portion_1 keys.
 * Logical `ceilings.portion.*` / `ceilings.bulkhead.*` keys are write
 * addresses for Clarify / Refine. They patch the JSON collection and are
 * not persisted as sibling rows.
 *
 * No timber/steel/sheet/tile/bulkhead takeoff or money in this module.
 */

import { getFact, getNumberFact, getStringFact, round2 } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  createStableClientId,
  isStableClientId,
} from "@/lib/ids/stable-client-id";

export const CEILINGS_PORTIONS_FACT_KEY = "ceilings.portions" as const;
export const CEILINGS_ACTIVE_PORTION_ID_FACT_KEY =
  "ceilings.active_portion_id" as const;
export const CEILINGS_ACTIVE_BULKHEAD_ID_FACT_KEY =
  "ceilings.active_bulkhead_id" as const;

export const CEILINGS_PORTION_FIELD_PREFIX = "ceilings.portion." as const;
export const CEILINGS_BULKHEAD_FIELD_PREFIX = "ceilings.bulkhead." as const;

export const CEILINGS_ADD_PORTION_KEY = "ceilings.add_portion" as const;
export const CEILINGS_DUPLICATE_PORTION_KEY =
  "ceilings.duplicate_portion" as const;
export const CEILINGS_DELETE_PORTION_KEY = "ceilings.delete_portion" as const;
export const CEILINGS_ADD_BULKHEAD_KEY = "ceilings.add_bulkhead" as const;
export const CEILINGS_DELETE_BULKHEAD_KEY =
  "ceilings.delete_bulkhead" as const;

export const CEILINGS_GEOMETRY_MODE_VALUES = [
  "length_width",
  "area_only",
] as const;
export type CeilingGeometryMode = (typeof CEILINGS_GEOMETRY_MODE_VALUES)[number];

export const CEILINGS_JOB_SCOPE_VALUES = [
  "new_ceiling",
  "replacement_lining_only",
  "complete_replacement",
  "reline_existing_suitable_framing",
] as const;
export type CeilingJobScope = (typeof CEILINGS_JOB_SCOPE_VALUES)[number];

export const CEILINGS_STRUCTURE_FAMILY_VALUES = [
  "existing_framing",
  "timber_direct_fix",
  "steel_direct_fix",
  "suspended_steel",
  "tile_and_grid",
] as const;
export type CeilingStructureFamily =
  (typeof CEILINGS_STRUCTURE_FAMILY_VALUES)[number];

export const CEILINGS_LINING_FAMILY_VALUES = [
  "plasterboard",
  "plywood",
  "timber_lined",
  "tile_and_grid",
] as const;
export type CeilingLiningFamily = (typeof CEILINGS_LINING_FAMILY_VALUES)[number];

export const CEILINGS_PLASTERBOARD_PRODUCT_VALUES = [
  "standard",
  "aqualine",
  "fyreline",
  "other",
] as const;
export type CeilingPlasterboardProduct =
  (typeof CEILINGS_PLASTERBOARD_PRODUCT_VALUES)[number];

export const CEILINGS_PLASTERBOARD_THICKNESS_VALUES = [
  "10",
  "13",
  "other",
] as const;
export type CeilingPlasterboardThicknessMm = 10 | 13 | "other";

export const CEILINGS_PLASTERBOARD_THICKNESS_OPTIONS = [
  "10 mm",
  "13 mm",
  "Other / specified system",
] as const;

export function parseCeilingPlasterboardThickness(
  value: unknown
): CeilingPlasterboardThicknessMm | null {
  if (value === 10 || value === 13) return value;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    if (value === 10) return 10;
    if (value === 13) return 13;
    return "other";
  }
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (normalised === "10" || normalised === "10mm" || normalised === "10 mm") {
      return 10;
    }
    if (normalised === "13" || normalised === "13mm" || normalised === "13 mm") {
      return 13;
    }
    if (
      normalised === "other" ||
      normalised === "custom" ||
      normalised.includes("specified")
    ) {
      return "other";
    }
  }
  return null;
}

export function ceilingPlasterboardThicknessLabel(
  value: CeilingPlasterboardThicknessMm
): string {
  if (value === 10) return "10 mm";
  if (value === 13) return "13 mm";
  return "Other / specified system";
}

export const CEILINGS_TIMBER_SIZE_VALUES = ["140x45_h1.2", "other"] as const;
export type CeilingTimberSize = (typeof CEILINGS_TIMBER_SIZE_VALUES)[number];

export const CEILINGS_DIRECTION_VALUES = [
  "along_length",
  "along_width",
] as const;
export type CeilingDirection = (typeof CEILINGS_DIRECTION_VALUES)[number];

export const CEILINGS_TILE_SIZE_VALUES = [
  "300x300",
  "600x600",
  "1200x600",
] as const;
export type CeilingTileSize = (typeof CEILINGS_TILE_SIZE_VALUES)[number];

export const CEILINGS_BULKHEAD_FRAMING_VALUES = ["timber", "steel"] as const;
export type CeilingBulkheadFraming =
  (typeof CEILINGS_BULKHEAD_FRAMING_VALUES)[number];

export const CEILINGS_BULKHEAD_LINING_VALUES = [
  "standard",
  "aqualine",
  "fyreline",
  "other",
] as const;
export type CeilingBulkheadLining =
  (typeof CEILINGS_BULKHEAD_LINING_VALUES)[number];

export const CEILINGS_SPECIALIST_KIND_VALUES = [
  "curved",
  "complex_raking",
  "coffered",
  "proprietary_acoustic",
  "unknown_proprietary_fire",
  "feature_baffles",
  "engineered_structural",
] as const;
export type CeilingSpecialistKind =
  (typeof CEILINGS_SPECIALIST_KIND_VALUES)[number];

export const CEILINGS_BULKHEAD_FORM_VALUES = [
  "conventional_two_face_downstand",
  "island",
  "boxed",
  "complex",
] as const;
export type CeilingBulkheadForm = (typeof CEILINGS_BULKHEAD_FORM_VALUES)[number];

/** V1 topology only. Island/boxed/complex bulkheads are later Pricing Required. */
export const CEILINGS_BULKHEAD_TOPOLOGY_V1 =
  "conventional_two_face_downstand" as const;
export const CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED =
  "unsupported_specialist" as const;
export type CeilingBulkheadTopology =
  | typeof CEILINGS_BULKHEAD_TOPOLOGY_V1
  | typeof CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED;

export const CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION =
  "Assumes a standard wall-adjacent downstand bulkhead with an underside and one exposed vertical face.";

export type CeilingGeometry = {
  mode: CeilingGeometryMode;
  length_m: number | null;
  width_m: number | null;
  area_m2: number | null;
  perimeter_m: number | null;
};

export type CeilingTimberStructure = {
  size: CeilingTimberSize;
  spacing_mm: number;
  direction: CeilingDirection;
};

export type CeilingSteelStructure = {
  primary_spacing_mm: number;
  furring_spacing_mm: number;
  direction: CeilingDirection | null;
};

export type CeilingSuspendedStructure = {
  drop_height_m: number;
  max_spacing_m: number;
  edge_offset_m: number;
};

export type CeilingStructure = {
  job_scope: CeilingJobScope | null;
  family: CeilingStructureFamily | null;
  timber?: CeilingTimberStructure;
  steel?: CeilingSteelStructure;
  suspended?: CeilingSuspendedStructure;
};

export type CeilingTimberLined = {
  board_width_mm: number;
  gap_mm: number;
  direction: CeilingDirection;
};

export type CeilingTile = {
  size: CeilingTileSize;
};

export type CeilingLining = {
  family: CeilingLiningFamily | null;
  plasterboard_product?: CeilingPlasterboardProduct;
  thickness_mm?: CeilingPlasterboardThicknessMm;
  plywood_spec?: string | null;
  sheet_length_mm?: number;
  sheet_width_mm?: number;
  layers?: number | null;
  timber_lined?: CeilingTimberLined;
  tile?: CeilingTile;
};

export type CeilingFinish = {
  insulation_included: boolean | null;
  insulation_type: string | null;
  stopping_included: boolean | null;
  painting_included: boolean | null;
  demolition_included: boolean | null;
};

export type CeilingBulkhead = {
  id: string;
  label: string | null;
  length_m: number | null;
  depth_m: number | null;
  height_m: number | null;
  framing_type: CeilingBulkheadFraming | null;
  lining_type: CeilingBulkheadLining | null;
  thickness_mm?: CeilingPlasterboardThicknessMm;
  form: CeilingBulkheadForm | null;
  topology: CeilingBulkheadTopology;
};

export type CeilingPortion = {
  id: string;
  label: string | null;
  geometry: CeilingGeometry;
  height_m: number | null;
  structure: CeilingStructure;
  lining: CeilingLining;
  finish: CeilingFinish;
  has_bulkheads: boolean | null;
  active_bulkhead_id: string | null;
  bulkheads: CeilingBulkhead[];
  significant_penetrations: boolean | null;
  penetrations: string | null;
  fire_acoustic_requirement: "none" | "specified" | "unknown_proprietary" | null;
  fire_acoustic_system: string | null;
  specialist_kind: CeilingSpecialistKind | null;
};

export type CeilingPortionSource = "canonical" | "legacy_dual_read";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (allowed as readonly string[]).includes(trimmed)
    ? (trimmed as T)
    : null;
}

function parseTriBool(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (normalised === "yes" || normalised === "included") return true;
    if (
      normalised === "no" ||
      normalised === "not_included" ||
      normalised === "not included"
    ) {
      return false;
    }
  }
  return null;
}

export function createCeilingPortionId(): string {
  return createStableClientId("cp");
}

export function createCeilingBulkheadId(): string {
  return createStableClientId("bh");
}

export function isClientCeilingPortionId(value: unknown): value is string {
  return isStableClientId(value, "cp");
}

export function isClientCeilingBulkheadId(value: unknown): value is string {
  return isStableClientId(value, "bh");
}

function emptyGeometry(): CeilingGeometry {
  return {
    mode: "area_only",
    length_m: null,
    width_m: null,
    area_m2: null,
    perimeter_m: null,
  };
}

function emptyStructure(): CeilingStructure {
  return {
    job_scope: null,
    family: null,
  };
}

function emptyLining(): CeilingLining {
  return { family: null };
}

function emptyFinish(): CeilingFinish {
  return {
    insulation_included: null,
    insulation_type: null,
    stopping_included: null,
    painting_included: null,
    demolition_included: null,
  };
}

export function createEmptyCeilingBulkhead(params?: {
  id?: string;
  label?: string | null;
}): CeilingBulkhead {
  return {
    id: params?.id ?? createCeilingBulkheadId(),
    label: params?.label ?? null,
    length_m: null,
    depth_m: null,
    height_m: null,
    framing_type: null,
    lining_type: null,
    thickness_mm: undefined,
    form: null,
    topology: CEILINGS_BULKHEAD_TOPOLOGY_V1,
  };
}

export function createEmptyCeilingPortion(params?: {
  id?: string;
  label?: string | null;
}): CeilingPortion {
  return {
    id: params?.id ?? createCeilingPortionId(),
    label: params?.label ?? null,
    geometry: emptyGeometry(),
    height_m: null,
    structure: emptyStructure(),
    lining: emptyLining(),
    finish: emptyFinish(),
    has_bulkheads: null,
    active_bulkhead_id: null,
    bulkheads: [],
    significant_penetrations: null,
    penetrations: null,
    fire_acoustic_requirement: null,
    fire_acoustic_system: null,
    specialist_kind: null,
  };
}

export function cloneCeilingBulkhead(
  bulkhead: CeilingBulkhead
): CeilingBulkhead {
  return { ...bulkhead };
}

export function duplicateCeilingBulkhead(
  source: CeilingBulkhead,
  newId?: string
): CeilingBulkhead {
  return {
    ...cloneCeilingBulkhead(source),
    id: newId ?? createCeilingBulkheadId(),
    label: source.label ? `${source.label} copy` : null,
  };
}

function cloneGeometry(geometry: CeilingGeometry): CeilingGeometry {
  return { ...geometry };
}

function cloneStructure(structure: CeilingStructure): CeilingStructure {
  return {
    job_scope: structure.job_scope,
    family: structure.family,
    timber: structure.timber ? { ...structure.timber } : undefined,
    steel: structure.steel ? { ...structure.steel } : undefined,
    suspended: structure.suspended ? { ...structure.suspended } : undefined,
  };
}

function cloneLining(lining: CeilingLining): CeilingLining {
  return {
    family: lining.family,
    plasterboard_product: lining.plasterboard_product,
    thickness_mm: lining.thickness_mm,
    plywood_spec: lining.plywood_spec,
    sheet_length_mm: lining.sheet_length_mm,
    sheet_width_mm: lining.sheet_width_mm,
    layers: lining.layers,
    timber_lined: lining.timber_lined ? { ...lining.timber_lined } : undefined,
    tile: lining.tile ? { ...lining.tile } : undefined,
  };
}

/**
 * Tile & Grid cannot carry plasterboard-style timber/steel/suspended
 * framing sub-objects. Family-specific sub-objects are stripped when the
 * family does not match.
 */
export function applyCeilingFamilyExclusivity(
  portion: CeilingPortion
): CeilingPortion {
  const tile =
    portion.structure.family === "tile_and_grid" ||
    portion.lining.family === "tile_and_grid";
  if (tile) {
    portion.structure.family = "tile_and_grid";
    portion.lining.family = "tile_and_grid";
    portion.structure.timber = undefined;
    portion.structure.steel = undefined;
    portion.structure.suspended = undefined;
    portion.lining.timber_lined = undefined;
    portion.lining.plasterboard_product = undefined;
    portion.lining.thickness_mm = undefined;
  }
  if (portion.structure.family !== "timber_direct_fix") {
    portion.structure.timber = undefined;
  }
  if (
    portion.structure.family !== "steel_direct_fix" &&
    portion.structure.family !== "suspended_steel"
  ) {
    portion.structure.steel = undefined;
  }
  if (portion.structure.family !== "suspended_steel") {
    portion.structure.suspended = undefined;
  }
  if (portion.lining.family !== "timber_lined") {
    portion.lining.timber_lined = undefined;
  }
  if (portion.lining.family !== "tile_and_grid") {
    portion.lining.tile = undefined;
  }
  if (portion.lining.family !== "plasterboard") {
    portion.lining.plasterboard_product = undefined;
    portion.lining.thickness_mm = undefined;
  }
  return portion;
}

export function ceilingPortionHasIncompatibleFraming(
  portion: CeilingPortion
): boolean {
  const tile =
    portion.structure.family === "tile_and_grid" ||
    portion.lining.family === "tile_and_grid";
  if (!tile) return false;
  return Boolean(
    portion.structure.timber ||
      portion.structure.steel ||
      portion.structure.suspended
  );
}

export function recommendedCeilingGeometryMode(
  portion: Pick<CeilingPortion, "structure" | "lining">
): CeilingGeometryMode {
  const family = portion.structure.family;
  if (
    family === "timber_direct_fix" ||
    family === "steel_direct_fix" ||
    family === "suspended_steel"
  ) {
    return "length_width";
  }
  if (portion.lining.family === "timber_lined") return "length_width";
  if (family === "existing_framing" || family === "tile_and_grid") {
    return "area_only";
  }
  if (portion.lining.family === "tile_and_grid") return "area_only";
  return "area_only";
}

function syncGeometryDerived(geometry: CeilingGeometry): void {
  if (
    geometry.length_m != null &&
    geometry.width_m != null &&
    geometry.length_m > 0 &&
    geometry.width_m > 0
  ) {
    geometry.mode = "length_width";
    geometry.area_m2 = round2(geometry.length_m * geometry.width_m);
    geometry.perimeter_m = round2(2 * (geometry.length_m + geometry.width_m));
  } else if (geometry.area_m2 != null && geometry.area_m2 > 0) {
    if (geometry.length_m == null || geometry.width_m == null) {
      geometry.mode = "area_only";
    }
  }
}

export function duplicateCeilingPortion(
  source: CeilingPortion,
  newId?: string
): CeilingPortion {
  const copy: CeilingPortion = {
    ...source,
    id: newId ?? createCeilingPortionId(),
    label: source.label ? `${source.label} copy` : null,
    geometry: cloneGeometry(source.geometry),
    structure: cloneStructure(source.structure),
    lining: cloneLining(source.lining),
    finish: { ...source.finish },
    has_bulkheads: source.has_bulkheads,
    active_bulkhead_id: null,
    bulkheads: source.bulkheads.map((row) => duplicateCeilingBulkhead(row)),
    significant_penetrations: source.significant_penetrations,
    penetrations: source.penetrations,
    fire_acoustic_requirement: source.fire_acoustic_requirement,
    fire_acoustic_system: source.fire_acoustic_system,
  };
  return applyCeilingFamilyExclusivity(copy);
}

export function ceilingBulkheadTopologyForForm(
  form: CeilingBulkheadForm | null
): CeilingBulkheadTopology {
  if (form === "island" || form === "boxed" || form === "complex") {
    return CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED;
  }
  return CEILINGS_BULKHEAD_TOPOLOGY_V1;
}

export function isUnsupportedCeilingBulkhead(
  bulkhead: Pick<CeilingBulkhead, "form" | "topology">
): boolean {
  return (
    bulkhead.topology === CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED ||
    bulkhead.form === "island" ||
    bulkhead.form === "boxed" ||
    bulkhead.form === "complex"
  );
}

export function parseCeilingBulkhead(value: unknown): CeilingBulkhead | null {
  if (!isRecord(value)) return null;
  const id =
    typeof value.id === "string" && value.id.trim() ? value.id.trim() : null;
  if (!id) return null;
  const form = parseEnum(value.form, CEILINGS_BULKHEAD_FORM_VALUES);
  const storedTopology =
    value.topology === CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED
      ? CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED
      : null;
  return {
    id,
    label:
      typeof value.label === "string" && value.label.trim()
        ? value.label.trim()
        : null,
    length_m: parsePositiveNumber(value.length_m),
    depth_m: parsePositiveNumber(value.depth_m),
    height_m: parsePositiveNumber(value.height_m),
    framing_type: parseEnum(value.framing_type, CEILINGS_BULKHEAD_FRAMING_VALUES),
    lining_type: parseEnum(value.lining_type, CEILINGS_BULKHEAD_LINING_VALUES),
    thickness_mm:
      parseCeilingPlasterboardThickness(value.thickness_mm) ?? undefined,
    form,
    topology:
      storedTopology ??
      ceilingBulkheadTopologyForForm(form),
  };
}

function parseBulkheads(value: unknown): CeilingBulkhead[] {
  if (!Array.isArray(value)) return [];
  const out: CeilingBulkhead[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const parsed = parseCeilingBulkhead(row);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    out.push(parsed);
  }
  return out;
}

function parseGeometry(value: unknown): CeilingGeometry {
  if (!isRecord(value)) return emptyGeometry();
  const geometry: CeilingGeometry = {
    mode:
      parseEnum(value.mode, CEILINGS_GEOMETRY_MODE_VALUES) ??
      (parsePositiveNumber(value.length_m) != null &&
      parsePositiveNumber(value.width_m) != null
        ? "length_width"
        : "area_only"),
    length_m: parsePositiveNumber(value.length_m),
    width_m: parsePositiveNumber(value.width_m),
    area_m2: parsePositiveNumber(value.area_m2),
    perimeter_m: parsePositiveNumber(value.perimeter_m),
  };
  syncGeometryDerived(geometry);
  return geometry;
}

function parseTimber(value: unknown): CeilingTimberStructure | undefined {
  if (!isRecord(value)) return undefined;
  const size = parseEnum(value.size, CEILINGS_TIMBER_SIZE_VALUES);
  if (!size) return undefined;
  const spacing_mm = parsePositiveNumber(value.spacing_mm) ?? 0;
  const direction =
    parseEnum(value.direction, CEILINGS_DIRECTION_VALUES) ?? "along_length";
  return { size, spacing_mm, direction };
}

function parseSteel(value: unknown): CeilingSteelStructure | undefined {
  if (!isRecord(value)) return undefined;
  const direction = parseEnum(value.direction, CEILINGS_DIRECTION_VALUES);
  const primary_spacing_mm = parsePositiveNumber(value.primary_spacing_mm) ?? 0;
  const furring_spacing_mm = parsePositiveNumber(value.furring_spacing_mm) ?? 0;
  if (primary_spacing_mm <= 0 && furring_spacing_mm <= 0 && direction == null) {
    return undefined;
  }
  return { primary_spacing_mm, furring_spacing_mm, direction };
}

function parseSuspended(value: unknown): CeilingSuspendedStructure | undefined {
  if (!isRecord(value)) return undefined;
  const drop_height_m = parsePositiveNumber(value.drop_height_m) ?? 0;
  const max_spacing_m = parsePositiveNumber(value.max_spacing_m) ?? 0;
  const edge_offset_m = parsePositiveNumber(value.edge_offset_m) ?? 0;
  if (drop_height_m <= 0 && max_spacing_m <= 0 && edge_offset_m <= 0) {
    return undefined;
  }
  return { drop_height_m, max_spacing_m, edge_offset_m };
}

function liningRecord(value: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(value.lining) ? value.lining : null;
}

function liningField(
  value: Record<string, unknown>,
  key: string
): unknown {
  const nested = liningRecord(value);
  if (nested && nested[key] != null && nested[key] !== "") return nested[key];
  return value[key];
}

export function parseCeilingPortion(value: unknown): CeilingPortion | null {
  if (!isRecord(value)) return null;
  const id =
    typeof value.id === "string" && value.id.trim() ? value.id.trim() : null;
  if (!id) return null;
  const bulkheads = parseBulkheads(value.bulkheads);
  const plywoodSpecRaw = liningField(value, "plywood_spec");
  const portion: CeilingPortion = {
    id,
    label:
      typeof value.label === "string" && value.label.trim()
        ? value.label.trim()
        : null,
    geometry: parseGeometry(
      isRecord(value.geometry)
        ? value.geometry
        : {
            length_m: value.length_m,
            width_m: value.width_m,
            area_m2: value.area_m2,
            perimeter_m: value.perimeter_m,
            mode: value.geometry_mode ?? value.mode,
          }
    ),
    height_m: parsePositiveNumber(value.height_m),
    structure: {
      job_scope: parseEnum(value.structure && isRecord(value.structure) ? value.structure.job_scope : value.job_scope, CEILINGS_JOB_SCOPE_VALUES),
      family: parseEnum(
        isRecord(value.structure) ? value.structure.family : value.structure_family,
        CEILINGS_STRUCTURE_FAMILY_VALUES
      ),
      timber: isRecord(value.structure)
        ? parseTimber(value.structure.timber)
        : parseTimber(value.timber),
      steel: isRecord(value.structure)
        ? parseSteel(value.structure.steel)
        : parseSteel(value.steel),
      suspended: isRecord(value.structure)
        ? parseSuspended(value.structure.suspended)
        : parseSuspended(value.suspended),
    },
    lining: {
      family: parseEnum(
        liningField(value, "family") ?? value.lining_family,
        CEILINGS_LINING_FAMILY_VALUES
      ),
      plasterboard_product:
        parseEnum(
          liningField(value, "plasterboard_product"),
          CEILINGS_PLASTERBOARD_PRODUCT_VALUES
        ) ?? undefined,
      thickness_mm:
        parseCeilingPlasterboardThickness(liningField(value, "thickness_mm")) ??
        undefined,
      plywood_spec:
        typeof plywoodSpecRaw === "string" && plywoodSpecRaw.trim()
          ? plywoodSpecRaw.trim()
          : undefined,
      sheet_length_mm: isRecord(value.lining)
        ? parsePositiveNumber(value.lining.sheet_length_mm) ?? undefined
        : undefined,
      sheet_width_mm: isRecord(value.lining)
        ? parsePositiveNumber(value.lining.sheet_width_mm) ?? undefined
        : undefined,
      layers: isRecord(value.lining)
        ? parsePositiveNumber(value.lining.layers)
        : null,
      timber_lined:
        isRecord(value.lining) && isRecord(value.lining.timber_lined)
          ? (() => {
              const board_width_mm = parsePositiveNumber(
                value.lining.timber_lined.board_width_mm
              );
              const gap_mm =
                typeof value.lining.timber_lined.gap_mm === "number" &&
                Number.isFinite(value.lining.timber_lined.gap_mm) &&
                value.lining.timber_lined.gap_mm >= 0
                  ? value.lining.timber_lined.gap_mm
                  : parsePositiveNumber(value.lining.timber_lined.gap_mm) ?? 0;
              const direction = parseEnum(
                value.lining.timber_lined.direction,
                CEILINGS_DIRECTION_VALUES
              );
              if (board_width_mm == null || !direction) {
                return undefined;
              }
              return { board_width_mm, gap_mm, direction };
            })()
          : undefined,
      tile:
        isRecord(value.lining) && isRecord(value.lining.tile)
          ? (() => {
              const size = parseEnum(value.lining.tile.size, CEILINGS_TILE_SIZE_VALUES);
              return size ? { size } : undefined;
            })()
          : undefined,
    },
    finish: isRecord(value.finish)
      ? {
          insulation_included: parseTriBool(value.finish.insulation_included),
          insulation_type:
            typeof value.finish.insulation_type === "string" &&
            value.finish.insulation_type.trim()
              ? value.finish.insulation_type.trim()
              : null,
          stopping_included: parseTriBool(value.finish.stopping_included),
          painting_included: parseTriBool(value.finish.painting_included),
          demolition_included: parseTriBool(value.finish.demolition_included),
        }
      : emptyFinish(),
    has_bulkheads:
      parseTriBool(value.has_bulkheads) ??
      (bulkheads.length > 0 ? true : null),
    active_bulkhead_id: (() => {
      const stored =
        typeof value.active_bulkhead_id === "string"
          ? value.active_bulkhead_id.trim()
          : "";
      if (stored && bulkheads.some((row) => row.id === stored)) return stored;
      return bulkheads[0]?.id ?? null;
    })(),
    bulkheads,
    significant_penetrations: parseTriBool(value.significant_penetrations),
    penetrations:
      typeof value.penetrations === "string" && value.penetrations.trim()
        ? value.penetrations.trim()
        : null,
    fire_acoustic_requirement: parseEnum(value.fire_acoustic_requirement, [
      "none",
      "specified",
      "unknown_proprietary",
    ] as const),
    fire_acoustic_system:
      typeof value.fire_acoustic_system === "string" &&
      value.fire_acoustic_system.trim()
        ? value.fire_acoustic_system.trim()
        : null,
    specialist_kind: parseEnum(
      value.specialist_kind,
      CEILINGS_SPECIALIST_KIND_VALUES
    ),
  };
  return applyCeilingFamilyExclusivity(portion);
}

export function parseCeilingsCollectionEnvelope(value: unknown): {
  v: number;
  portions: CeilingPortion[];
} {
  if (Array.isArray(value)) {
    return { v: 0, portions: parseCeilingPortionList(value) };
  }
  if (isRecord(value) && Array.isArray(value.portions)) {
    const v =
      typeof value.v === "number" && Number.isFinite(value.v) ? value.v : 0;
    return { v, portions: parseCeilingPortionList(value.portions) };
  }
  return { v: 0, portions: [] };
}

function parseCeilingPortionList(value: unknown[]): CeilingPortion[] {
  const portions: CeilingPortion[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const parsed = parseCeilingPortion(row);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    portions.push(parsed);
  }
  return portions;
}

export function parseCeilingsPortions(value: unknown): CeilingPortion[] {
  return parseCeilingsCollectionEnvelope(value).portions;
}

export function isUsableExtractedCeilingPortion(
  portion: CeilingPortion
): boolean {
  return (
    Boolean(portion.label?.trim()) ||
    portion.geometry.length_m != null ||
    portion.geometry.width_m != null ||
    portion.geometry.area_m2 != null ||
    portion.structure.family != null ||
    portion.structure.job_scope != null ||
    portion.lining.family != null ||
    portion.lining.plasterboard_product != null ||
    portion.lining.thickness_mm != null ||
    Boolean(portion.lining.plywood_spec?.trim()) ||
    portion.specialist_kind != null ||
    portion.fire_acoustic_requirement != null ||
    portion.bulkheads.length > 0
  );
}

function withAssignedCeilingIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((row) =>
      isRecord(row) && (typeof row.id !== "string" || !row.id.trim())
        ? { ...row, id: createCeilingPortionId() }
        : row
    );
  }
  if (isRecord(value) && Array.isArray(value.portions)) {
    return {
      ...value,
      portions: withAssignedCeilingIds(value.portions),
    };
  }
  return value;
}

/**
 * Validate / canonicalise AI or deterministic `ceilings.portions`.
 * Invalid rows are dropped. Missing ids are assigned, not trusted blindly.
 */
export function normalizeExtractedCeilingPortions(
  value: unknown
): CeilingPortion[] {
  return parseCeilingsCollectionEnvelope(withAssignedCeilingIds(value)).portions.filter(
    isUsableExtractedCeilingPortion
  );
}

export function isCeilingsPortionWriteKey(key: string): boolean {
  return (
    key === CEILINGS_PORTIONS_FACT_KEY ||
    key === CEILINGS_ACTIVE_PORTION_ID_FACT_KEY ||
    key === CEILINGS_ACTIVE_BULKHEAD_ID_FACT_KEY ||
    key === CEILINGS_ADD_PORTION_KEY ||
    key === CEILINGS_DUPLICATE_PORTION_KEY ||
    key === CEILINGS_DELETE_PORTION_KEY ||
    key === CEILINGS_ADD_BULKHEAD_KEY ||
    key === CEILINGS_DELETE_BULKHEAD_KEY ||
    key.startsWith(CEILINGS_PORTION_FIELD_PREFIX) ||
    key.startsWith(CEILINGS_BULKHEAD_FIELD_PREFIX)
  );
}

export function isCeilingsNestedFactKey(factKey: string): boolean {
  return (
    factKey.startsWith(CEILINGS_PORTION_FIELD_PREFIX) ||
    factKey.startsWith(CEILINGS_BULKHEAD_FIELD_PREFIX)
  );
}

export function isCeilingsBulkheadFactKey(factKey: string): boolean {
  return factKey.startsWith(CEILINGS_BULKHEAD_FIELD_PREFIX);
}

export function storedCeilingsPortions(
  facts: readonly EstimateFact[],
  workAreaId: string
): CeilingPortion[] {
  const raw = getFact(
    facts as EstimateFact[],
    workAreaId,
    CEILINGS_PORTIONS_FACT_KEY
  )?.value;
  return parseCeilingsPortions(raw);
}

export function hasCanonicalCeilingsPortions(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return storedCeilingsPortions(facts, workAreaId).length > 0;
}

export const CEILINGS_NESTED_NOT_CALCULATED_MESSAGE =
  "Ceiling quantities for this package are not available yet.";

export function resolveCeilingsActivePortionId(
  facts: readonly EstimateFact[],
  workAreaId: string,
  portions: readonly CeilingPortion[]
): string | null {
  const stored = getFact(
    facts as EstimateFact[],
    workAreaId,
    CEILINGS_ACTIVE_PORTION_ID_FACT_KEY
  )?.value;
  if (typeof stored === "string" && portions.some((row) => row.id === stored)) {
    return stored;
  }
  return portions[0]?.id ?? null;
}

export function resolveCeilingsPortions(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): {
  portions: CeilingPortion[];
  source: CeilingPortionSource;
  activeId: string | null;
} {
  const stored = storedCeilingsPortions(params.facts, params.workAreaId);
  if (stored.length > 0) {
    return {
      portions: stored,
      source: "canonical",
      activeId: resolveCeilingsActivePortionId(
        params.facts,
        params.workAreaId,
        stored
      ),
    };
  }
  const legacy = legacyPortionFromFlatFacts(params);
  if (legacy) {
    return {
      portions: [legacy],
      source: "legacy_dual_read",
      activeId: legacy.id,
    };
  }
  return { portions: [], source: "canonical", activeId: null };
}

export function findCeilingPortion(
  portions: readonly CeilingPortion[],
  portionId: string | null | undefined
): CeilingPortion | null {
  if (!portionId) return null;
  return portions.find((row) => row.id === portionId) ?? null;
}

export function findCeilingBulkhead(
  portion: CeilingPortion | null,
  bulkheadId: string | null | undefined
): CeilingBulkhead | null {
  if (!portion || !bulkheadId) return null;
  return portion.bulkheads.find((row) => row.id === bulkheadId) ?? null;
}

export function updateCeilingPortion(
  portions: readonly CeilingPortion[],
  portionId: string,
  patch: (portion: CeilingPortion) => void
): CeilingPortion[] {
  if (!portions.some((row) => row.id === portionId)) {
    return portions.map((row) => row);
  }
  return portions.map((row) => {
    if (row.id !== portionId) return row;
    const next: CeilingPortion = {
      ...row,
      geometry: cloneGeometry(row.geometry),
      structure: cloneStructure(row.structure),
      lining: cloneLining(row.lining),
      finish: { ...row.finish },
      bulkheads: row.bulkheads.map((bulkhead) => cloneCeilingBulkhead(bulkhead)),
    };
    patch(next);
    syncGeometryDerived(next.geometry);
    applyCeilingFamilyExclusivity(next);
    return next;
  });
}

function upsertFact(
  facts: EstimateFact[],
  workAreaId: string,
  key: string,
  value: unknown
): EstimateFact[] {
  const without = facts.filter(
    (row) => !(row.key === key && row.work_area_id === workAreaId)
  );
  return [
    ...without,
    { key, work_area_id: workAreaId, value, source: "user" },
  ];
}

function mapLegacyStructureFamily(
  value: string | null
): CeilingStructureFamily | null {
  if (!value) return null;
  const normalised = value.trim().toLowerCase();
  if (normalised.includes("grid") || normalised.includes("tile")) {
    return "tile_and_grid";
  }
  if (normalised.includes("rondo") || normalised.includes("steel")) {
    return "steel_direct_fix";
  }
  if (normalised.includes("timber") || normalised.includes("batten")) {
    return "timber_direct_fix";
  }
  if (normalised.includes("existing")) return "existing_framing";
  if (normalised.includes("suspend")) return "suspended_steel";
  return null;
}

function mapLegacyLiningFamily(value: string | null): CeilingLiningFamily | null {
  if (!value) return null;
  const normalised = value.trim().toLowerCase();
  if (normalised.includes("tile")) return "tile_and_grid";
  if (normalised.includes("ply")) return "plywood";
  if (normalised.includes("timber")) return "timber_lined";
  if (normalised.includes("plaster") || normalised.includes("gib")) {
    return "plasterboard";
  }
  return null;
}

export function legacyPortionFromFlatFacts(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): CeilingPortion | null {
  const area = getNumberFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "ceilings.area_m2"
  );
  const structure = getStringFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "ceilings.structure_type"
  );
  const lining = getStringFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "ceilings.ceiling_type"
  );
  if (area == null && !structure && !lining) return null;
  const portion = createEmptyCeilingPortion({
    id: `legacy:${params.workAreaId}`,
    label: "Existing ceiling details",
  });
  portion.geometry.mode = "area_only";
  portion.geometry.area_m2 = area;
  portion.structure.family = mapLegacyStructureFamily(structure);
  portion.lining.family = mapLegacyLiningFamily(lining);
  return applyCeilingFamilyExclusivity(portion);
}

/**
 * Pure fact write for Ceilings collection keys.
 * Used by persistence and optimistic overlay. Does not regenerate IDs on
 * normal field edits.
 */
export function applyCeilingsFactWrite(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  key: string;
  value: unknown;
  nestedItemId?: string | null;
  componentId?: string | null;
}): EstimateFact[] {
  const facts = params.facts.map((row) => ({ ...row })) as EstimateFact[];
  if (params.key === CEILINGS_PORTIONS_FACT_KEY) {
    return upsertFact(
      facts,
      params.workAreaId,
      CEILINGS_PORTIONS_FACT_KEY,
      parseCeilingsPortions(params.value)
    );
  }

  let portions = storedCeilingsPortions(facts, params.workAreaId);
  if (portions.length === 0) {
    const legacy = legacyPortionFromFlatFacts({
      facts,
      workAreaId: params.workAreaId,
    });
    if (legacy) {
      portions = [
        {
          ...legacy,
          id: createCeilingPortionId(),
        },
      ];
    }
  }
  let activeId = resolveCeilingsActivePortionId(
    facts,
    params.workAreaId,
    portions
  );

  if (params.key === CEILINGS_ACTIVE_PORTION_ID_FACT_KEY) {
    const nextId = typeof params.value === "string" ? params.value : null;
    if (nextId && portions.some((row) => row.id === nextId)) {
      return upsertFact(
        facts,
        params.workAreaId,
        CEILINGS_ACTIVE_PORTION_ID_FACT_KEY,
        nextId
      );
    }
    return facts;
  }

  if (
    params.key === CEILINGS_ADD_PORTION_KEY &&
    (params.value === true ||
      params.value === "Yes" ||
      params.value === "Add ceiling portion" ||
      isClientCeilingPortionId(params.value))
  ) {
    const requestedId = isClientCeilingPortionId(params.value)
      ? params.value.trim()
      : null;
    const existing = requestedId
      ? portions.find((row) => row.id === requestedId)
      : null;
    if (existing) {
      activeId = existing.id;
    } else {
      const created = createEmptyCeilingPortion({
        id: requestedId ?? undefined,
      });
      portions = [...portions, created];
      activeId = created.id;
    }
  } else if (params.key === CEILINGS_DUPLICATE_PORTION_KEY) {
    const sourceId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    const source = portions.find((row) => row.id === sourceId);
    if (source && !source.id.startsWith("legacy:")) {
      const copyId =
        params.nestedItemId &&
        params.nestedItemId !== source.id &&
        isClientCeilingPortionId(params.nestedItemId)
          ? params.nestedItemId
          : undefined;
      const existingCopy = copyId
        ? portions.find((row) => row.id === copyId)
        : null;
      if (existingCopy) {
        activeId = existingCopy.id;
      } else {
        const copy = duplicateCeilingPortion(source, copyId);
        const index = portions.findIndex((row) => row.id === source.id);
        portions = [
          ...portions.slice(0, index + 1),
          copy,
          ...portions.slice(index + 1),
        ];
        activeId = copy.id;
      }
    }
  } else if (params.key === CEILINGS_DELETE_PORTION_KEY) {
    const deleteId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    if (deleteId && !deleteId.startsWith("legacy:")) {
      portions = portions.filter((row) => row.id !== deleteId);
      activeId = portions[0]?.id ?? null;
    }
  } else if (
    params.key === CEILINGS_ADD_BULKHEAD_KEY ||
    params.key === CEILINGS_DELETE_BULKHEAD_KEY ||
    params.key === CEILINGS_ACTIVE_BULKHEAD_ID_FACT_KEY ||
    params.key.startsWith(CEILINGS_BULKHEAD_FIELD_PREFIX)
  ) {
    if (portions.length === 0) {
      const created = createEmptyCeilingPortion();
      portions = [created];
      activeId = created.id;
    }
    const requested = params.nestedItemId?.trim() || null;
    const targetId =
      requested && portions.some((row) => row.id === requested)
        ? requested
        : activeId && portions.some((row) => row.id === activeId)
          ? activeId
          : portions[0]!.id;
    activeId = targetId;
    portions = updateCeilingPortion(portions, targetId, (portion) => {
      if (params.key === CEILINGS_ADD_BULKHEAD_KEY) {
        const requestedId = isClientCeilingBulkheadId(params.value)
          ? params.value.trim()
          : params.componentId && isClientCeilingBulkheadId(params.componentId)
            ? params.componentId.trim()
            : null;
        const existing = requestedId
          ? portion.bulkheads.find((row) => row.id === requestedId)
          : null;
        if (existing) {
          portion.active_bulkhead_id = existing.id;
          portion.has_bulkheads = true;
          return;
        }
        const created = createEmptyCeilingBulkhead({
          id: requestedId ?? createCeilingBulkheadId(),
        });
        portion.bulkheads = [...portion.bulkheads, created];
        portion.active_bulkhead_id = created.id;
        portion.has_bulkheads = true;
        return;
      }
      if (params.key === CEILINGS_DELETE_BULKHEAD_KEY) {
        const deleteId =
          (typeof params.value === "string" && params.value.trim()
            ? params.value.trim()
            : null) ??
          params.componentId?.trim() ??
          portion.active_bulkhead_id;
        if (!deleteId) return;
        portion.bulkheads = portion.bulkheads.filter(
          (row) => row.id !== deleteId
        );
        portion.active_bulkhead_id = portion.bulkheads[0]?.id ?? null;
        if (portion.bulkheads.length === 0) portion.has_bulkheads = false;
        return;
      }
      if (params.key === CEILINGS_ACTIVE_BULKHEAD_ID_FACT_KEY) {
        const nextId =
          typeof params.value === "string" ? params.value.trim() : "";
        if (nextId && portion.bulkheads.some((row) => row.id === nextId)) {
          portion.active_bulkhead_id = nextId;
        }
        return;
      }
      if (portion.bulkheads.length === 0) {
        const created = createEmptyCeilingBulkhead({
          id:
            params.componentId && isClientCeilingBulkheadId(params.componentId)
              ? params.componentId
              : undefined,
        });
        portion.bulkheads = [created];
        portion.active_bulkhead_id = created.id;
        portion.has_bulkheads = true;
      }
      const bulkheadId =
        params.componentId?.trim() || portion.active_bulkhead_id;
      const target =
        portion.bulkheads.find((row) => row.id === bulkheadId) ??
        portion.bulkheads[0]!;
      portion.active_bulkhead_id = target.id;
      const field = params.key.slice(CEILINGS_BULKHEAD_FIELD_PREFIX.length);
      portion.bulkheads = portion.bulkheads.map((row) => {
        if (row.id !== target.id) return row;
        const next = cloneCeilingBulkhead(row);
        if (field === "label") {
          next.label =
            typeof params.value === "string" && params.value.trim()
              ? params.value.trim()
              : null;
        } else if (field === "length_m") {
          next.length_m = parsePositiveNumber(params.value);
        } else if (field === "depth_m") {
          next.depth_m = parsePositiveNumber(params.value);
        } else if (field === "height_m") {
          next.height_m = parsePositiveNumber(params.value);
        } else if (field === "framing_type") {
          next.framing_type = parseEnum(
            params.value,
            CEILINGS_BULKHEAD_FRAMING_VALUES
          );
        } else if (field === "lining_type") {
          next.lining_type = parseEnum(
            params.value,
            CEILINGS_BULKHEAD_LINING_VALUES
          );
        } else if (field === "thickness_mm") {
          next.thickness_mm =
            parseCeilingPlasterboardThickness(params.value) ?? undefined;
        } else if (field === "form") {
          next.form = parseEnum(params.value, CEILINGS_BULKHEAD_FORM_VALUES);
          next.topology = ceilingBulkheadTopologyForForm(next.form);
        }
        if (next.form == null && next.topology !== CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED) {
          next.topology = CEILINGS_BULKHEAD_TOPOLOGY_V1;
        }
        return next;
      });
    });
  } else if (params.key.startsWith(CEILINGS_PORTION_FIELD_PREFIX)) {
    if (portions.length === 0) {
      const created = createEmptyCeilingPortion();
      portions = [created];
      activeId = created.id;
    }
    const requested = params.nestedItemId?.trim() || null;
    const targetId =
      requested && portions.some((row) => row.id === requested)
        ? requested
        : activeId && portions.some((row) => row.id === activeId)
          ? activeId
          : portions[0]!.id;
    activeId = targetId;
    const field = params.key.slice(CEILINGS_PORTION_FIELD_PREFIX.length);
    portions = updateCeilingPortion(portions, targetId, (portion) => {
      applyPortionField(portion, field, params.value);
    });
  } else {
    return facts;
  }

  let next = upsertFact(
    facts,
    params.workAreaId,
    CEILINGS_PORTIONS_FACT_KEY,
    portions
  );
  if (activeId) {
    next = upsertFact(
      next,
      params.workAreaId,
      CEILINGS_ACTIVE_PORTION_ID_FACT_KEY,
      activeId
    );
  } else {
    next = next.filter(
      (row) =>
        !(
          row.key === CEILINGS_ACTIVE_PORTION_ID_FACT_KEY &&
          row.work_area_id === params.workAreaId
        )
    );
  }
  return next;
}

function applyPortionField(
  portion: CeilingPortion,
  field: string,
  value: unknown
): void {
  if (field === "label") {
    portion.label =
      typeof value === "string" && value.trim() ? value.trim() : null;
    return;
  }
  if (field === "geometry_mode") {
    portion.geometry.mode =
      parseEnum(value, CEILINGS_GEOMETRY_MODE_VALUES) ?? portion.geometry.mode;
    return;
  }
  if (field === "length_m") {
    portion.geometry.length_m = parsePositiveNumber(value);
    return;
  }
  if (field === "width_m") {
    portion.geometry.width_m = parsePositiveNumber(value);
    return;
  }
  if (field === "area_m2") {
    portion.geometry.area_m2 = parsePositiveNumber(value);
    return;
  }
  if (field === "height_m") {
    portion.height_m = parsePositiveNumber(value);
    return;
  }
  if (field === "job_scope") {
    portion.structure.job_scope = parseEnum(value, CEILINGS_JOB_SCOPE_VALUES);
    return;
  }
  if (field === "structure_family") {
    portion.structure.family = parseEnum(
      value,
      CEILINGS_STRUCTURE_FAMILY_VALUES
    );
    return;
  }
  if (field === "lining_family") {
    portion.lining.family = parseEnum(value, CEILINGS_LINING_FAMILY_VALUES);
    return;
  }
  if (field === "plasterboard_product") {
    portion.lining.plasterboard_product =
      parseEnum(value, CEILINGS_PLASTERBOARD_PRODUCT_VALUES) ?? undefined;
    if (portion.lining.plasterboard_product) {
      portion.lining.family = "plasterboard";
    }
    return;
  }
  if (field === "thickness_mm") {
    portion.lining.thickness_mm =
      parseCeilingPlasterboardThickness(value) ?? undefined;
    if (portion.lining.thickness_mm != null) {
      portion.lining.family = "plasterboard";
    }
    return;
  }
  if (field === "plywood_spec") {
    portion.lining.family = portion.lining.family ?? "plywood";
    portion.lining.plywood_spec =
      typeof value === "string" && value.trim() ? value.trim() : null;
    return;
  }
  if (field === "tile_size") {
    const size = parseEnum(value, CEILINGS_TILE_SIZE_VALUES);
    if (!size) return;
    portion.lining.family = "tile_and_grid";
    portion.structure.family = "tile_and_grid";
    portion.lining.tile = { size };
    return;
  }
  if (field === "board_width_mm") {
    const width = parsePositiveNumber(value);
    if (width == null) return;
    portion.lining.family = "timber_lined";
    portion.lining.timber_lined = {
      board_width_mm: width,
      gap_mm: portion.lining.timber_lined?.gap_mm ?? 0,
      direction: portion.lining.timber_lined?.direction ?? "along_length",
    };
    return;
  }
  if (field === "gap_mm") {
    const gap =
      typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : parsePositiveNumber(value);
    if (gap == null) return;
    portion.lining.family = "timber_lined";
    portion.lining.timber_lined = {
      board_width_mm: portion.lining.timber_lined?.board_width_mm ?? 0,
      gap_mm: gap,
      direction: portion.lining.timber_lined?.direction ?? "along_length",
    };
    return;
  }
  if (field === "primary_spacing_mm") {
    const spacing = parsePositiveNumber(value);
    if (spacing == null) return;
    if (portion.structure.family !== "suspended_steel") {
      portion.structure.family = "steel_direct_fix";
    }
    portion.structure.steel = {
      primary_spacing_mm: spacing,
      furring_spacing_mm: portion.structure.steel?.furring_spacing_mm ?? 0,
      direction: portion.structure.steel?.direction ?? null,
    };
    return;
  }
  if (field === "furring_spacing_mm") {
    const spacing = parsePositiveNumber(value);
    if (spacing == null) return;
    if (portion.structure.family !== "suspended_steel") {
      portion.structure.family = "steel_direct_fix";
    }
    portion.structure.steel = {
      primary_spacing_mm: portion.structure.steel?.primary_spacing_mm ?? 0,
      furring_spacing_mm: spacing,
      direction: portion.structure.steel?.direction ?? null,
    };
    return;
  }
  if (field === "sheet_length_mm") {
    portion.lining.sheet_length_mm =
      parsePositiveNumber(value) ?? undefined;
    return;
  }
  if (field === "sheet_width_mm") {
    portion.lining.sheet_width_mm =
      parsePositiveNumber(value) ?? undefined;
    return;
  }
  if (field === "layers") {
    portion.lining.layers = parsePositiveNumber(value);
    return;
  }
  if (field === "insulation_included") {
    portion.finish.insulation_included = parseTriBool(value);
    if (portion.finish.insulation_included === false) {
      portion.finish.insulation_type = null;
    }
    return;
  }
  if (field === "insulation_type") {
    portion.finish.insulation_type =
      typeof value === "string" && value.trim() ? value.trim() : null;
    if (portion.finish.insulation_type) {
      portion.finish.insulation_included = true;
    }
    return;
  }
  if (field === "stopping_included") {
    portion.finish.stopping_included = parseTriBool(value);
    return;
  }
  if (field === "painting_included") {
    portion.finish.painting_included = parseTriBool(value);
    return;
  }
  if (field === "demolition_included") {
    portion.finish.demolition_included = parseTriBool(value);
    return;
  }
  if (field === "bulkheads_present") {
    const present = parseTriBool(value);
    portion.has_bulkheads = present;
    if (present === false) {
      portion.bulkheads = [];
      portion.active_bulkhead_id = null;
    }
    return;
  }
  if (field === "penetrations") {
    portion.penetrations =
      typeof value === "string" && value.trim() ? value.trim() : null;
    return;
  }
  if (field === "significant_penetrations") {
    portion.significant_penetrations = parseTriBool(value);
    if (portion.significant_penetrations === false) {
      portion.penetrations = null;
    }
    return;
  }
  if (field === "fire_acoustic_requirement") {
    portion.fire_acoustic_requirement = parseEnum(value, [
      "none",
      "specified",
      "unknown_proprietary",
    ] as const);
    return;
  }
  if (field === "fire_acoustic_system") {
    portion.fire_acoustic_system =
      typeof value === "string" && value.trim() ? value.trim() : null;
    if (portion.fire_acoustic_system) {
      portion.fire_acoustic_requirement =
        portion.fire_acoustic_requirement ?? "specified";
    }
    return;
  }
  if (field === "specialist_kind") {
    portion.specialist_kind = parseEnum(
      value,
      CEILINGS_SPECIALIST_KIND_VALUES
    );
    return;
  }
  if (field === "drop_height_m") {
    portion.structure.family = portion.structure.family ?? "suspended_steel";
    portion.structure.suspended = {
      drop_height_m: parsePositiveNumber(value) ?? 0,
      max_spacing_m: portion.structure.suspended?.max_spacing_m ?? 0,
      edge_offset_m: portion.structure.suspended?.edge_offset_m ?? 0,
    };
    return;
  }
  if (field === "suspension_spacing_m") {
    portion.structure.family = portion.structure.family ?? "suspended_steel";
    portion.structure.suspended = {
      drop_height_m: portion.structure.suspended?.drop_height_m ?? 0,
      max_spacing_m: parsePositiveNumber(value) ?? 0,
      edge_offset_m: portion.structure.suspended?.edge_offset_m ?? 0,
    };
    return;
  }
  if (field === "edge_offset_m") {
    portion.structure.family = portion.structure.family ?? "suspended_steel";
    portion.structure.suspended = {
      drop_height_m: portion.structure.suspended?.drop_height_m ?? 0,
      max_spacing_m: portion.structure.suspended?.max_spacing_m ?? 0,
      edge_offset_m: parsePositiveNumber(value) ?? 0,
    };
    return;
  }
  if (field === "timber_size") {
    const size = parseEnum(value, CEILINGS_TIMBER_SIZE_VALUES);
    if (!size) return;
    portion.structure.family = "timber_direct_fix";
    portion.structure.timber = {
      size,
      spacing_mm: portion.structure.timber?.spacing_mm ?? 0,
      direction: portion.structure.timber?.direction ?? "along_length",
    };
    return;
  }
  if (field === "spacing_mm") {
    const spacing = parsePositiveNumber(value);
    if (spacing == null) return;
    if (
      portion.structure.family === "steel_direct_fix" ||
      portion.structure.family === "suspended_steel"
    ) {
      portion.structure.steel = {
        primary_spacing_mm:
          portion.structure.steel?.primary_spacing_mm ?? spacing,
        furring_spacing_mm: spacing,
        direction: portion.structure.steel?.direction ?? null,
      };
      return;
    }
    portion.structure.family = portion.structure.family ?? "timber_direct_fix";
    portion.structure.timber = {
      size: portion.structure.timber?.size ?? "140x45_h1.2",
      spacing_mm: spacing,
      direction: portion.structure.timber?.direction ?? "along_length",
    };
    return;
  }
  if (field === "direction") {
    const direction = parseEnum(value, CEILINGS_DIRECTION_VALUES);
    if (!direction) return;
    if (
      portion.structure.family === "steel_direct_fix" ||
      portion.structure.family === "suspended_steel"
    ) {
      portion.structure.steel = {
        primary_spacing_mm: portion.structure.steel?.primary_spacing_mm ?? 0,
        furring_spacing_mm: portion.structure.steel?.furring_spacing_mm ?? 0,
        direction,
      };
      return;
    }
    if (portion.lining.family === "timber_lined") {
      portion.lining.timber_lined = {
        board_width_mm: portion.lining.timber_lined?.board_width_mm ?? 90,
        gap_mm: portion.lining.timber_lined?.gap_mm ?? 0,
        direction,
      };
      return;
    }
    portion.structure.family = portion.structure.family ?? "timber_direct_fix";
    portion.structure.timber = {
      size: portion.structure.timber?.size ?? "140x45_h1.2",
      spacing_mm: portion.structure.timber?.spacing_mm ?? 0,
      direction,
    };
  }
}
