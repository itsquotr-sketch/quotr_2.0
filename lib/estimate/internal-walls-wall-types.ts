/**
 * WA-INTERNAL-WALLS-02 — structured Wall Type collection.
 *
 * Canonical store: one `internal_walls.wall_types` JSON array on project_facts
 * (jsonb). Stable UUID per Wall Type. Do not flatten wall_1 / wall_2 keys.
 *
 * Logical `internal_walls.wall_type.*` keys are write addresses for Clarify /
 * Refine. They patch the JSON collection and are not persisted as sibling rows.
 *
 * No timber/steel takeoff, sheet count, or money in this module.
 */

import {
  getFact,
  getNumberFact,
  getStringFact,
  hasFactValue,
  isNotSureValue,
  round2,
} from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

export const INTERNAL_WALLS_WALL_TYPES_FACT_KEY =
  "internal_walls.wall_types" as const;
export const INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY =
  "internal_walls.active_wall_type_id" as const;

export const INTERNAL_WALLS_WALL_TYPE_FIELD_PREFIX =
  "internal_walls.wall_type." as const;

export const INTERNAL_WALLS_WALL_TYPE_FIELD_KEYS = [
  "internal_walls.wall_type.label",
  "internal_walls.wall_type.frame_system",
  "internal_walls.wall_type.frame_size",
  "internal_walls.wall_type.length_lm",
  "internal_walls.wall_type.height_m",
  "internal_walls.wall_type.stud_centres_mm",
  "internal_walls.wall_type.same_lining_both_sides",
  "internal_walls.wall_type.side_a_lined",
  "internal_walls.wall_type.side_a_product",
  "internal_walls.wall_type.side_a_thickness_mm",
  "internal_walls.wall_type.side_a_sheet_length_mm",
  "internal_walls.wall_type.side_a_layers",
  "internal_walls.wall_type.side_b_lined",
  "internal_walls.wall_type.side_b_product",
  "internal_walls.wall_type.side_b_thickness_mm",
  "internal_walls.wall_type.side_b_sheet_length_mm",
  "internal_walls.wall_type.side_b_layers",
] as const;

export const INTERNAL_WALLS_ADD_WALL_TYPE_KEY =
  "internal_walls.add_wall_type" as const;
export const INTERNAL_WALLS_DUPLICATE_WALL_TYPE_KEY =
  "internal_walls.duplicate_wall_type" as const;
export const INTERNAL_WALLS_DELETE_WALL_TYPE_KEY =
  "internal_walls.delete_wall_type" as const;

export const INTERNAL_WALLS_HEIGHT_ASSUMPTION_M = 2.4;
export const INTERNAL_WALLS_HEIGHT_ASSUMPTION_STATEMENT =
  "Wall height assumed at 2.4 m.";

export const INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE =
  "Add the total wall length for this wall type.";

export const INTERNAL_WALLS_WALL_TYPE_REQUIRED_MESSAGE =
  "Add at least one wall type.";

export const INTERNAL_WALLS_STRUCTURAL_REQUIRED_MESSAGE =
  "Confirm whether this wall could be load-bearing or structural.";

export const INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE =
  "A specialist or engineer is required before this wall work can be estimated.";

export const INTERNAL_WALLS_TAKEOFF_NOT_PRICED_STATEMENT =
  "Framing and lining are recorded. Materials and labour are not priced yet.";

export const INTERNAL_WALLS_SHEET_WIDTH_MM = 1200;

export const INTERNAL_WALLS_SHEET_LENGTHS_MM = [
  2400, 2700, 3000, 3600, 4800, 6000,
] as const;

export const INTERNAL_WALLS_THICKNESSES_MM = [10, 13, 16, 25] as const;

export const INTERNAL_WALLS_FRAME_SYSTEM_VALUES = [
  "timber",
  "steel",
  "existing_frame",
  "other",
] as const;

export type InternalWallsFrameSystem =
  (typeof INTERNAL_WALLS_FRAME_SYSTEM_VALUES)[number];

export const INTERNAL_WALLS_FRAME_SYSTEM_OPTIONS = [
  "Timber framing",
  "Steel framing",
  "Existing frame",
  "Other",
  "Not sure",
] as const;

export const INTERNAL_WALLS_TIMBER_SIZE_VALUES = [
  "90x45",
  "140x45",
  "other",
] as const;

export type InternalWallsTimberSize =
  (typeof INTERNAL_WALLS_TIMBER_SIZE_VALUES)[number];

export const INTERNAL_WALLS_TIMBER_SIZE_OPTIONS = [
  "90 mm timber framing — 90×45",
  "140 mm timber framing — 140×45",
  "Other",
] as const;

export const INTERNAL_WALLS_STUD_CENTRES_OPTIONS = [
  "400 mm",
  "600 mm",
  "Custom",
] as const;

export const INTERNAL_WALLS_LINING_PRODUCT_VALUES = [
  "standard_gib",
  "aqualine",
  "fyreline",
  "braceline",
  "noiseline",
  "weatherline",
  "barrierline",
  "plywood",
  "fibre_cement",
  "other",
] as const;

export type InternalWallsLiningProduct =
  (typeof INTERNAL_WALLS_LINING_PRODUCT_VALUES)[number];

export const INTERNAL_WALLS_LINING_PRODUCT_OPTIONS = [
  "Standard GIB",
  "Aqualine",
  "Fyreline",
  "Braceline",
  "Noiseline",
  "Weatherline",
  "Barrierline",
  "Plywood",
  "Fibre cement",
  "Other",
  "Not sure",
] as const;

export const INTERNAL_WALLS_LAYER_OPTIONS = ["1 layer", "2 layers"] as const;

export const INTERNAL_WALLS_FACE_LINED_OPTIONS = [
  "Lined",
  "None",
] as const;

export type InternalWallsMaterialFamily =
  | "plasterboard"
  | "plywood"
  | "fibre_cement"
  | "other";

export type InternalWallsFace = {
  lined: boolean;
  material_family: InternalWallsMaterialFamily | null;
  product: InternalWallsLiningProduct | null;
  thickness_mm: number | null;
  sheet_length_mm: number | null;
  layers: number | null;
};

export type InternalWallsSteelMeta = {
  system: "track_and_stud" | null;
  stud_width_mm: number | null;
};

export type InternalWallsWallType = {
  id: string;
  label: string | null;
  length_lm: number | null;
  height_m: number | null;
  height_source: "known" | "assumed_disclosed" | null;
  frame_system: InternalWallsFrameSystem | null;
  frame_size: InternalWallsTimberSize | null;
  steel: InternalWallsSteelMeta | null;
  stud_centres_mm: number | null;
  stud_centres_source: "recommended" | "override" | "custom" | null;
  same_lining_both_sides: boolean | null;
  side_a: InternalWallsFace;
  side_b: InternalWallsFace;
  /** Future openings model. Empty in 02. */
  openings: unknown[];
};

export type InternalWallsWallTypeSource = "canonical" | "legacy_dual_read";

export type InternalWallsWallTypeSummary = {
  id: string;
  displayName: string;
  frameLine: string | null;
  geometryLine: string | null;
  centresLine: string | null;
  liningLine: string | null;
  grossFaceAreaM2: number | null;
  linedFaceCount: number;
  source: InternalWallsWallTypeSource;
};

const FRAME_SYSTEM_BY_NORMALISED: Record<string, InternalWallsFrameSystem> = {
  timber: "timber",
  "timber framing": "timber",
  "timber framed": "timber",
  "90x45": "timber",
  "90×45": "timber",
  steel: "steel",
  "steel framing": "steel",
  "steel stud": "steel",
  "steel track": "steel",
  "steel track & stud": "steel",
  "steel track and stud": "steel",
  "track and stud": "steel",
  existing_frame: "existing_frame",
  "existing frame": "existing_frame",
  other: "other",
};

const TIMBER_SIZE_BY_NORMALISED: Record<string, InternalWallsTimberSize> = {
  "90x45": "90x45",
  "90×45": "90x45",
  "90 mm timber framing — 90×45": "90x45",
  "90 mm timber framing": "90x45",
  "90mm": "90x45",
  "140x45": "140x45",
  "140×45": "140x45",
  "140 mm timber framing — 140×45": "140x45",
  "140 mm timber framing": "140x45",
  "140mm": "140x45",
  other: "other",
};

const LINING_PRODUCT_BY_NORMALISED: Record<string, InternalWallsLiningProduct> =
  {
    standard_gib: "standard_gib",
    "standard gib": "standard_gib",
    standard: "standard_gib",
    gib: "standard_gib",
    plasterboard: "standard_gib",
    aqualine: "aqualine",
    fyreline: "fyreline",
    braceline: "braceline",
    noiseline: "noiseline",
    "noise control": "noiseline",
    weatherline: "weatherline",
    barrierline: "barrierline",
    plywood: "plywood",
    fibre_cement: "fibre_cement",
    "fibre cement": "fibre_cement",
    other: "other",
  };

function emptyFace(): InternalWallsFace {
  return {
    lined: false,
    material_family: null,
    product: null,
    thickness_mm: null,
    sheet_length_mm: null,
    layers: null,
  };
}

function cloneFace(face: InternalWallsFace): InternalWallsFace {
  return { ...face };
}

export function createWallTypeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wt-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createEmptyWallType(params?: {
  id?: string;
  label?: string | null;
}): InternalWallsWallType {
  return {
    id: params?.id ?? createWallTypeId(),
    label: params?.label ?? null,
    length_lm: null,
    height_m: null,
    height_source: null,
    frame_system: null,
    frame_size: null,
    steel: null,
    stud_centres_mm: null,
    stud_centres_source: null,
    same_lining_both_sides: null,
    side_a: emptyFace(),
    side_b: emptyFace(),
    openings: [],
  };
}

export function duplicateWallType(
  source: InternalWallsWallType,
  newId?: string
): InternalWallsWallType {
  return {
    ...source,
    id: newId ?? createWallTypeId(),
    label: source.label ? `${source.label} copy` : null,
    side_a: cloneFace(source.side_a),
    side_b: cloneFace(source.side_b),
    steel: source.steel ? { ...source.steel } : null,
    openings: Array.isArray(source.openings) ? [...source.openings] : [],
  };
}

export function parseInternalWallsFrameSystem(
  value: unknown
): InternalWallsFrameSystem | null {
  if (!hasFactValue(value) || isNotSureValue(value)) return null;
  const normalised = String(value).trim().toLowerCase();
  return FRAME_SYSTEM_BY_NORMALISED[normalised] ?? null;
}

export function parseInternalWallsTimberSize(
  value: unknown
): InternalWallsTimberSize | null {
  if (!hasFactValue(value) || isNotSureValue(value)) return null;
  const normalised = String(value).trim().toLowerCase().replace(/\s+/g, " ");
  return TIMBER_SIZE_BY_NORMALISED[normalised] ?? null;
}

export function parseInternalWallsLiningProduct(
  value: unknown
): InternalWallsLiningProduct | null {
  if (!hasFactValue(value) || isNotSureValue(value)) return null;
  const normalised = String(value).trim().toLowerCase();
  return LINING_PRODUCT_BY_NORMALISED[normalised] ?? null;
}

export function frameSystemDisplay(
  value: InternalWallsFrameSystem | null
): string | null {
  if (value === "timber") return "Timber framing";
  if (value === "steel") return "Steel framing";
  if (value === "existing_frame") return "Existing frame";
  if (value === "other") return "Other";
  return null;
}

export function timberSizeDisplay(
  value: InternalWallsTimberSize | null
): string | null {
  if (value === "90x45") return "90×45 timber";
  if (value === "140x45") return "140×45 timber";
  if (value === "other") return "Other timber size";
  return null;
}

export function liningProductDisplay(
  value: InternalWallsLiningProduct | null
): string | null {
  if (value === "standard_gib") return "Standard GIB";
  if (value === "aqualine") return "Aqualine";
  if (value === "fyreline") return "Fyreline";
  if (value === "braceline") return "Braceline";
  if (value === "noiseline") return "Noiseline";
  if (value === "weatherline") return "Weatherline";
  if (value === "barrierline") return "Barrierline";
  if (value === "plywood") return "Plywood";
  if (value === "fibre_cement") return "Fibre cement";
  if (value === "other") return "Other";
  return null;
}

export function materialFamilyForProduct(
  product: InternalWallsLiningProduct | null
): InternalWallsMaterialFamily | null {
  if (!product) return null;
  if (product === "plywood") return "plywood";
  if (product === "fibre_cement") return "fibre_cement";
  if (product === "other") return "other";
  return "plasterboard";
}

export function defaultThicknessMmForProduct(
  product: InternalWallsLiningProduct | null
): number | null {
  if (!product) return null;
  if (product === "plywood" || product === "fibre_cement" || product === "other") {
    return null;
  }
  return 13;
}

export function recommendedStudCentresMm(heightM: number): 400 | 600 {
  return heightM > 2.4 ? 400 : 600;
}

/**
 * Owner nogging rule — recorded for 03 timber takeoff. Not calculated in 02.
 * height <= 2.4 → 2 rows; >2.4 and <=3.2 → 3 rows; >3.2 → 4 rows.
 */
export function recommendedNoggingRows(heightM: number): 2 | 3 | 4 {
  if (heightM <= 2.4) return 2;
  if (heightM <= 3.2) return 3;
  return 4;
}

export function disclosedWallHeightForNotSure(value: unknown): {
  value: number;
  source: "assumption";
} | null {
  if (!isNotSureValue(value)) return null;
  return {
    value: INTERNAL_WALLS_HEIGHT_ASSUMPTION_M,
    source: "assumption",
  };
}

export function grossFaceAreaM2(
  lengthLm: number | null,
  heightM: number | null
): number | null {
  if (lengthLm == null || heightM == null) return null;
  if (!(lengthLm > 0) || !(heightM > 0)) return null;
  return round2(lengthLm * heightM);
}

export function linedFaceCount(type: InternalWallsWallType): number {
  return (type.side_a.lined ? 1 : 0) + (type.side_b.lined ? 1 : 0);
}

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

function parseFace(value: unknown): InternalWallsFace {
  if (!isRecord(value)) return emptyFace();
  const product = parseInternalWallsLiningProduct(value.product);
  const lined =
    value.lined === true ||
    String(value.lined ?? "").toLowerCase() === "lined" ||
    product != null;
  return {
    lined,
    material_family:
      (value.material_family as InternalWallsMaterialFamily | null) ??
      materialFamilyForProduct(product),
    product,
    thickness_mm: parsePositiveNumber(value.thickness_mm),
    sheet_length_mm: parsePositiveNumber(value.sheet_length_mm),
    layers: parsePositiveNumber(value.layers),
  };
}

function parseSteel(value: unknown): InternalWallsSteelMeta | null {
  if (!isRecord(value)) return null;
  return {
    system: value.system === "track_and_stud" ? "track_and_stud" : null,
    stud_width_mm: parsePositiveNumber(value.stud_width_mm),
  };
}

export function parseInternalWallsWallType(
  value: unknown
): InternalWallsWallType | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : null;
  if (!id) return null;
  const frameSystem = parseInternalWallsFrameSystem(value.frame_system);
  const height = parsePositiveNumber(value.height_m);
  const length = parsePositiveNumber(value.length_lm);
  const studCentres = parsePositiveNumber(value.stud_centres_mm);
  const sameBoth =
    value.same_lining_both_sides === true
      ? true
      : value.same_lining_both_sides === false
        ? false
        : null;
  const sideA = parseFace(value.side_a);
  const sideB = sameBoth === true ? cloneFace(sideA) : parseFace(value.side_b);
  return {
    id,
    label:
      typeof value.label === "string" && value.label.trim()
        ? value.label.trim()
        : null,
    length_lm: length,
    height_m: height,
    height_source:
      value.height_source === "assumed_disclosed" ||
      value.height_source === "known"
        ? value.height_source
        : height != null
          ? "known"
          : null,
    frame_system: frameSystem,
    frame_size:
      frameSystem === "timber"
        ? parseInternalWallsTimberSize(value.frame_size)
        : null,
    steel:
      frameSystem === "steel"
        ? parseSteel(value.steel) ?? {
            system: "track_and_stud",
            stud_width_mm: null,
          }
        : null,
    stud_centres_mm: studCentres,
    stud_centres_source:
      value.stud_centres_source === "recommended" ||
      value.stud_centres_source === "override" ||
      value.stud_centres_source === "custom"
        ? value.stud_centres_source
        : studCentres != null
          ? "override"
          : null,
    same_lining_both_sides: sameBoth,
    side_a: sideA,
    side_b: sideB,
    openings: Array.isArray(value.openings) ? value.openings : [],
  };
}

export function parseInternalWallsWallTypes(
  value: unknown
): InternalWallsWallType[] {
  if (!Array.isArray(value)) return [];
  const types: InternalWallsWallType[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const parsed = parseInternalWallsWallType(row);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    types.push(parsed);
  }
  return types;
}

export function isInternalWallsWallTypeWriteKey(key: string): boolean {
  return (
    key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY ||
    key === INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY ||
    key === INTERNAL_WALLS_ADD_WALL_TYPE_KEY ||
    key === INTERNAL_WALLS_DUPLICATE_WALL_TYPE_KEY ||
    key === INTERNAL_WALLS_DELETE_WALL_TYPE_KEY ||
    key.startsWith(INTERNAL_WALLS_WALL_TYPE_FIELD_PREFIX)
  );
}

function applyRecommendedCentres(type: InternalWallsWallType): void {
  if (type.height_m == null) return;
  const recommended = recommendedStudCentresMm(type.height_m);
  if (type.stud_centres_mm == null || type.stud_centres_source === "recommended") {
    type.stud_centres_mm = recommended;
    type.stud_centres_source = "recommended";
  }
}

function applySteelFoundation(type: InternalWallsWallType): void {
  if (type.frame_system === "steel") {
    type.steel = type.steel ?? {
      system: "track_and_stud",
      stud_width_mm: null,
    };
    type.steel.system = "track_and_stud";
    type.frame_size = null;
  } else if (type.frame_system !== null) {
    type.steel = null;
  }
}

function applyLiningDefaults(face: InternalWallsFace): void {
  if (!face.lined) {
    face.material_family = null;
    face.product = null;
    face.thickness_mm = null;
    face.sheet_length_mm = null;
    face.layers = null;
    return;
  }
  if (face.product) {
    face.material_family = materialFamilyForProduct(face.product);
    if (face.thickness_mm == null) {
      face.thickness_mm = defaultThicknessMmForProduct(face.product);
    }
    if (face.sheet_length_mm == null && face.material_family === "plasterboard") {
      face.sheet_length_mm = 2400;
    }
    if (face.layers == null) {
      face.layers = 1;
    }
  }
}

function syncSameBothSides(type: InternalWallsWallType): void {
  if (type.same_lining_both_sides === true) {
    type.side_b = cloneFace(type.side_a);
  }
}

function parseLinedFlag(value: unknown): boolean | null {
  if (value === true || value === "Lined" || value === "lined") return true;
  if (
    value === false ||
    value === "None" ||
    value === "none" ||
    value === "Not lined"
  ) {
    return false;
  }
  return null;
}

function parseLayers(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+)/);
    if (match) return Number(match[1]);
  }
  return parsePositiveNumber(value);
}

function parseStudCentresInput(value: unknown): {
  mm: number | null;
  source: "override" | "custom" | "recommended";
} | null {
  if (isNotSureValue(value)) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const source = value === 400 || value === 600 ? "override" : "custom";
    return { mm: value, source };
  }
  const text = String(value).trim().toLowerCase();
  if (text === "400" || text === "400 mm") {
    return { mm: 400, source: "override" };
  }
  if (text === "600" || text === "600 mm") {
    return { mm: 600, source: "override" };
  }
  if (text === "custom") {
    return { mm: null, source: "custom" };
  }
  const parsed = parsePositiveNumber(value);
  if (parsed != null) {
    return {
      mm: parsed,
      source: parsed === 400 || parsed === 600 ? "override" : "custom",
    };
  }
  return null;
}

function wallTypeDisplayName(
  type: InternalWallsWallType,
  index: number
): string {
  if (type.label && type.label.trim()) return type.label.trim();
  return `Wall Type ${index + 1}`;
}

export function summariseWallType(
  type: InternalWallsWallType,
  index: number,
  source: InternalWallsWallTypeSource = "canonical"
): InternalWallsWallTypeSummary {
  const area = grossFaceAreaM2(type.length_lm, type.height_m);
  const frameBits = [
    type.frame_system === "timber" ? timberSizeDisplay(type.frame_size) : null,
    type.frame_system === "timber" && !type.frame_size ? "Timber framing" : null,
    type.frame_system === "steel" ? "Steel framing" : null,
    type.frame_system === "existing_frame" ? "Existing frame" : null,
    type.frame_system === "other" ? "Other framing" : null,
  ].filter(Boolean);
  const geometry =
    type.length_lm != null && type.height_m != null
      ? `${type.length_lm} m × ${type.height_m} m`
      : null;
  const centres =
    type.stud_centres_mm != null ? `${type.stud_centres_mm} mm centres` : null;
  let liningLine: string | null = null;
  const lined = linedFaceCount(type);
  if (lined === 0) {
    liningLine = "No lining";
  } else if (
    type.same_lining_both_sides === true ||
    (type.side_a.lined &&
      type.side_b.lined &&
      type.side_a.product === type.side_b.product &&
      type.side_a.layers === type.side_b.layers &&
      type.side_a.thickness_mm === type.side_b.thickness_mm)
  ) {
    const product = liningProductDisplay(type.side_a.product) ?? "Lined";
    const thickness =
      type.side_a.thickness_mm != null ? `${type.side_a.thickness_mm} mm ` : "";
    const layers =
      type.side_a.layers != null && type.side_a.layers > 1
        ? ` · ${type.side_a.layers} layers`
        : "";
    liningLine = `${thickness}${product}${layers} — both sides`;
  } else {
    const sideA = type.side_a.lined
      ? `${type.side_a.thickness_mm != null ? `${type.side_a.thickness_mm} mm ` : ""}${liningProductDisplay(type.side_a.product) ?? "Lined"}`
      : "None";
    const sideB = type.side_b.lined
      ? `${type.side_b.thickness_mm != null ? `${type.side_b.thickness_mm} mm ` : ""}${liningProductDisplay(type.side_b.product) ?? "Lined"}`
      : "None";
    liningLine = `Side A ${sideA} · Side B ${sideB}`;
  }
  return {
    id: type.id,
    displayName: wallTypeDisplayName(type, index),
    frameLine: frameBits[0] ?? null,
    geometryLine: geometry,
    centresLine: centres,
    liningLine,
    grossFaceAreaM2: area,
    linedFaceCount: lined,
    source,
  };
}

function mapLegacyFrameSystem(value: string | null): InternalWallsFrameSystem | null {
  return parseInternalWallsFrameSystem(value);
}

function mapLegacyLiningProduct(
  liningType: string | null,
  plasterboardType: string | null
): InternalWallsLiningProduct | null {
  const fromPb = parseInternalWallsLiningProduct(plasterboardType);
  if (fromPb) return fromPb;
  const lining = liningType?.toLowerCase() ?? "";
  if (lining.includes("plywood")) return "plywood";
  if (lining.includes("fibre")) return "fibre_cement";
  if (lining.includes("plasterboard") || lining.includes("gib")) {
    return "standard_gib";
  }
  return parseInternalWallsLiningProduct(liningType);
}

export function legacyWallTypeFromFlatFacts(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): InternalWallsWallType | null {
  const length = getNumberFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "internal_walls.length_lm"
  );
  const height = getNumberFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "internal_walls.height_m"
  );
  const framing = getStringFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "internal_walls.framing_type"
  );
  const liningType = getStringFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "internal_walls.wall_lining_type"
  );
  const plasterboard = getStringFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "internal_walls.plasterboard_type"
  );
  const sides = getStringFact(
    params.facts as EstimateFact[],
    params.workAreaId,
    "internal_walls.lining_sides"
  );
  if (
    length == null &&
    height == null &&
    !framing &&
    !liningType &&
    !sides
  ) {
    return null;
  }
  const type = createEmptyWallType({
    id: `legacy:${params.workAreaId}`,
    label: "Existing wall details",
  });
  type.length_lm = length;
  type.height_m = height;
  type.height_source = height != null ? "known" : null;
  type.frame_system = mapLegacyFrameSystem(framing);
  if (type.frame_system === "timber") {
    type.frame_size = "90x45";
  }
  applySteelFoundation(type);
  if (height != null) applyRecommendedCentres(type);
  const both = sides?.toLowerCase().includes("both") === true;
  const product = mapLegacyLiningProduct(liningType, plasterboard);
  if (product || liningType) {
    type.side_a.lined = true;
    type.side_a.product = product;
    applyLiningDefaults(type.side_a);
    type.same_lining_both_sides = both;
    if (both) {
      type.side_b = cloneFace(type.side_a);
    }
  }
  return type;
}

export function storedInternalWallsWallTypes(
  facts: readonly EstimateFact[],
  workAreaId: string
): InternalWallsWallType[] {
  const raw = getFact(
    facts as EstimateFact[],
    workAreaId,
    INTERNAL_WALLS_WALL_TYPES_FACT_KEY
  )?.value;
  return parseInternalWallsWallTypes(raw);
}

export function hasCanonicalWallTypes(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return storedInternalWallsWallTypes(facts, workAreaId).length > 0;
}

export function resolveInternalWallsActiveWallTypeId(
  facts: readonly EstimateFact[],
  workAreaId: string,
  types: readonly InternalWallsWallType[]
): string | null {
  const stored = getStringFact(
    facts as EstimateFact[],
    workAreaId,
    INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY
  );
  if (stored && types.some((row) => row.id === stored)) return stored;
  return types[0]?.id ?? null;
}

export function resolveInternalWallsWallTypes(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): {
  types: InternalWallsWallType[];
  source: InternalWallsWallTypeSource;
  activeId: string | null;
} {
  const stored = storedInternalWallsWallTypes(params.facts, params.workAreaId);
  if (stored.length > 0) {
    return {
      types: stored,
      source: "canonical",
      activeId: resolveInternalWallsActiveWallTypeId(
        params.facts,
        params.workAreaId,
        stored
      ),
    };
  }
  const legacy = legacyWallTypeFromFlatFacts(params);
  if (legacy) {
    return {
      types: [legacy],
      source: "legacy_dual_read",
      activeId: legacy.id,
    };
  }
  return { types: [], source: "canonical", activeId: null };
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

function ensureActiveType(
  types: InternalWallsWallType[],
  activeId: string | null
): { types: InternalWallsWallType[]; activeId: string } {
  if (types.length === 0) {
    const created = createEmptyWallType();
    return { types: [created], activeId: created.id };
  }
  if (activeId && types.some((row) => row.id === activeId)) {
    return { types, activeId };
  }
  return { types, activeId: types[0]!.id };
}

function patchActiveType(
  types: InternalWallsWallType[],
  activeId: string,
  patch: (type: InternalWallsWallType) => void
): InternalWallsWallType[] {
  return types.map((row) => {
    if (row.id !== activeId) return row;
    const next = {
      ...row,
      side_a: cloneFace(row.side_a),
      side_b: cloneFace(row.side_b),
      steel: row.steel ? { ...row.steel } : null,
      openings: Array.isArray(row.openings) ? [...row.openings] : [],
    };
    patch(next);
    applySteelFoundation(next);
    applyLiningDefaults(next.side_a);
    applyLiningDefaults(next.side_b);
    syncSameBothSides(next);
    applyRecommendedCentres(next);
    return next;
  });
}

/**
 * Pure fact write for Internal Walls collection keys.
 * Used by persistence and optimistic overlay.
 */
export function applyInternalWallsFactWrite(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  key: string;
  value: unknown;
}): EstimateFact[] {
  const facts = params.facts.map((row) => ({ ...row })) as EstimateFact[];
  if (params.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY) {
    return upsertFact(
      facts,
      params.workAreaId,
      INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
      parseInternalWallsWallTypes(params.value)
    );
  }

  let types = storedInternalWallsWallTypes(facts, params.workAreaId);
  let activeId = resolveInternalWallsActiveWallTypeId(
    facts,
    params.workAreaId,
    types
  );

  if (params.key === INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY) {
    const nextId = typeof params.value === "string" ? params.value : null;
    if (nextId && types.some((row) => row.id === nextId)) {
      return upsertFact(
        facts,
        params.workAreaId,
        INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
        nextId
      );
    }
    return facts;
  }

  if (
    params.key === INTERNAL_WALLS_ADD_WALL_TYPE_KEY &&
    (params.value === true ||
      params.value === "Yes" ||
      params.value === "Add wall type")
  ) {
    const created = createEmptyWallType();
    types = [...types, created];
    activeId = created.id;
  } else if (params.key === INTERNAL_WALLS_DUPLICATE_WALL_TYPE_KEY) {
    const sourceId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    const source = types.find((row) => row.id === sourceId);
    if (source && !source.id.startsWith("legacy:")) {
      const copy = duplicateWallType(source);
      const index = types.findIndex((row) => row.id === source.id);
      types = [
        ...types.slice(0, index + 1),
        copy,
        ...types.slice(index + 1),
      ];
      activeId = copy.id;
    }
  } else if (params.key === INTERNAL_WALLS_DELETE_WALL_TYPE_KEY) {
    const deleteId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    if (deleteId && !deleteId.startsWith("legacy:")) {
      types = types.filter((row) => row.id !== deleteId);
      activeId = types[0]?.id ?? null;
    }
  } else if (params.key.startsWith(INTERNAL_WALLS_WALL_TYPE_FIELD_PREFIX)) {
    const ensured = ensureActiveType(types, activeId);
    types = ensured.types;
    activeId = ensured.activeId;
    const field = params.key.slice(INTERNAL_WALLS_WALL_TYPE_FIELD_PREFIX.length);
    types = patchActiveType(types, activeId, (type) => {
      if (field === "label") {
        type.label =
          typeof params.value === "string" && params.value.trim()
            ? params.value.trim()
            : null;
        return;
      }
      if (field === "frame_system") {
        type.frame_system = parseInternalWallsFrameSystem(params.value);
        if (type.frame_system === "existing_frame") {
          type.frame_size = null;
        }
        return;
      }
      if (field === "frame_size") {
        type.frame_size = parseInternalWallsTimberSize(params.value);
        return;
      }
      if (field === "length_lm") {
        type.length_lm = parsePositiveNumber(params.value);
        return;
      }
      if (field === "height_m") {
        const assumed = disclosedWallHeightForNotSure(params.value);
        if (assumed) {
          type.height_m = assumed.value;
          type.height_source = "assumed_disclosed";
        } else {
          type.height_m = parsePositiveNumber(params.value);
          type.height_source = type.height_m != null ? "known" : null;
        }
        return;
      }
      if (field === "stud_centres_mm") {
        const parsed = parseStudCentresInput(params.value);
        if (parsed) {
          type.stud_centres_mm = parsed.mm;
          type.stud_centres_source = parsed.source;
        }
        return;
      }
      if (field === "same_lining_both_sides") {
        const yes =
          params.value === true ||
          params.value === "Yes" ||
          String(params.value).toLowerCase() === "yes" ||
          String(params.value).toLowerCase().includes("same");
        const no =
          params.value === false ||
          params.value === "No" ||
          String(params.value).toLowerCase() === "no";
        type.same_lining_both_sides = yes ? true : no ? false : null;
        return;
      }
      if (field === "side_a_lined") {
        const lined = parseLinedFlag(params.value);
        if (lined != null) type.side_a.lined = lined;
        return;
      }
      if (field === "side_a_product") {
        const product = parseInternalWallsLiningProduct(params.value);
        type.side_a.product = product;
        type.side_a.lined = product != null;
        type.side_a.thickness_mm = defaultThicknessMmForProduct(product);
        type.side_a.sheet_length_mm =
          materialFamilyForProduct(product) === "plasterboard" ? 2400 : null;
        type.side_a.layers = product != null ? type.side_a.layers ?? 1 : null;
        return;
      }
      if (field === "side_a_thickness_mm") {
        type.side_a.thickness_mm = parsePositiveNumber(params.value);
        return;
      }
      if (field === "side_a_sheet_length_mm") {
        type.side_a.sheet_length_mm = parsePositiveNumber(params.value);
        return;
      }
      if (field === "side_a_layers") {
        type.side_a.layers = parseLayers(params.value);
        if (type.side_a.layers != null) type.side_a.lined = true;
        return;
      }
      if (field === "side_b_lined") {
        const lined = parseLinedFlag(params.value);
        if (lined != null) {
          type.side_b.lined = lined;
          type.same_lining_both_sides = false;
        }
        return;
      }
      if (field === "side_b_product") {
        const product = parseInternalWallsLiningProduct(params.value);
        type.side_b.product = product;
        type.side_b.lined = product != null;
        type.side_b.thickness_mm = defaultThicknessMmForProduct(product);
        type.side_b.sheet_length_mm =
          materialFamilyForProduct(product) === "plasterboard" ? 2400 : null;
        type.side_b.layers = product != null ? type.side_b.layers ?? 1 : null;
        type.same_lining_both_sides = false;
        return;
      }
      if (field === "side_b_thickness_mm") {
        type.side_b.thickness_mm = parsePositiveNumber(params.value);
        type.same_lining_both_sides = false;
        return;
      }
      if (field === "side_b_sheet_length_mm") {
        type.side_b.sheet_length_mm = parsePositiveNumber(params.value);
        type.same_lining_both_sides = false;
        return;
      }
      if (field === "side_b_layers") {
        type.side_b.layers = parseLayers(params.value);
        if (type.side_b.layers != null) type.side_b.lined = true;
        type.same_lining_both_sides = false;
      }
    });
  } else {
    return facts;
  }

  let next = upsertFact(
    facts,
    params.workAreaId,
    INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
    types
  );
  if (activeId) {
    next = upsertFact(
      next,
      params.workAreaId,
      INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
      activeId
    );
  } else {
    next = next.filter(
      (row) =>
        !(
          row.key === INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY &&
          row.work_area_id === params.workAreaId
        )
    );
  }
  return next;
}

export function wallTypeNeedsLength(
  type: InternalWallsWallType,
  jobScope: string | null
): boolean {
  if (jobScope === "remove_partition") return false;
  if (type.frame_system === "existing_frame" || jobScope === "reline_existing") {
    return type.length_lm == null;
  }
  if (
    jobScope === "new_partition" ||
    jobScope === "extend_partition" ||
    jobScope === "mixed" ||
    jobScope === "custom" ||
    jobScope == null
  ) {
    return type.length_lm == null;
  }
  if (jobScope === "infill_opening" || jobScope === "form_opening") {
    return false;
  }
  return type.length_lm == null;
}

export function wallTypeIsBuildOrReline(
  type: InternalWallsWallType,
  jobScope: string | null
): boolean {
  if (jobScope === "remove_partition") return false;
  if (jobScope === "form_opening") return false;
  return (
    jobScope === "new_partition" ||
    jobScope === "extend_partition" ||
    jobScope === "reline_existing" ||
    jobScope === "mixed" ||
    jobScope === "custom" ||
    type.frame_system === "timber" ||
    type.frame_system === "steel" ||
    type.frame_system === "existing_frame"
  );
}

export function nextInternalWallsWallTypeField(params: {
  type: InternalWallsWallType | null;
  jobScope: string | null;
}): string | null {
  if (params.jobScope === "remove_partition") return null;
  if (params.jobScope === "form_opening" || params.jobScope === "infill_opening") {
    return null;
  }
  const type = params.type;
  if (!type) return "internal_walls.wall_type.frame_system";
  if (params.jobScope === "reline_existing") {
    if (type.frame_system == null) return "internal_walls.wall_type.frame_system";
    if (type.length_lm == null) return "internal_walls.wall_type.length_lm";
    if (type.height_m == null) return "internal_walls.wall_type.height_m";
    if (!type.side_a.lined && !type.side_b.lined) {
      return "internal_walls.wall_type.side_a_product";
    }
    return null;
  }
  if (type.frame_system == null) return "internal_walls.wall_type.frame_system";
  if (type.frame_system === "timber" && type.frame_size == null) {
    return "internal_walls.wall_type.frame_size";
  }
  if (type.length_lm == null) return "internal_walls.wall_type.length_lm";
  if (type.height_m == null) return "internal_walls.wall_type.height_m";
  if (type.stud_centres_mm == null && type.frame_system !== "existing_frame") {
    return "internal_walls.wall_type.stud_centres_mm";
  }
  if (!type.side_a.lined && type.side_a.product == null) {
    return "internal_walls.wall_type.side_a_product";
  }
  if (type.side_a.lined && type.side_a.layers == null) {
    return "internal_walls.wall_type.side_a_layers";
  }
  if (type.same_lining_both_sides == null && type.side_a.lined) {
    return "internal_walls.wall_type.same_lining_both_sides";
  }
  if (type.same_lining_both_sides === false && !type.side_b.lined) {
    return "internal_walls.wall_type.side_b_product";
  }
  return null;
}

export function wallTypeFieldCurrentValue(
  type: InternalWallsWallType | null,
  factKey: string
): string | number | boolean | null {
  if (!type) return null;
  switch (factKey) {
    case "internal_walls.wall_type.label":
      return type.label;
    case "internal_walls.wall_type.frame_system":
      return frameSystemDisplay(type.frame_system);
    case "internal_walls.wall_type.frame_size":
      if (type.frame_size === "90x45") return INTERNAL_WALLS_TIMBER_SIZE_OPTIONS[0];
      if (type.frame_size === "140x45") return INTERNAL_WALLS_TIMBER_SIZE_OPTIONS[1];
      if (type.frame_size === "other") return "Other";
      return null;
    case "internal_walls.wall_type.length_lm":
      return type.length_lm;
    case "internal_walls.wall_type.height_m":
      return type.height_m;
    case "internal_walls.wall_type.stud_centres_mm":
      if (type.stud_centres_mm === 400) return "400 mm";
      if (type.stud_centres_mm === 600) return "600 mm";
      if (type.stud_centres_mm != null) return type.stud_centres_mm;
      return null;
    case "internal_walls.wall_type.same_lining_both_sides":
      if (type.same_lining_both_sides === true) return "Yes";
      if (type.same_lining_both_sides === false) return "No";
      return null;
    case "internal_walls.wall_type.side_a_lined":
      return type.side_a.lined ? "Lined" : "None";
    case "internal_walls.wall_type.side_a_product":
      return liningProductDisplay(type.side_a.product);
    case "internal_walls.wall_type.side_a_thickness_mm":
      return type.side_a.thickness_mm;
    case "internal_walls.wall_type.side_a_sheet_length_mm":
      return type.side_a.sheet_length_mm;
    case "internal_walls.wall_type.side_a_layers":
      if (type.side_a.layers === 1) return "1 layer";
      if (type.side_a.layers === 2) return "2 layers";
      return type.side_a.layers;
    case "internal_walls.wall_type.side_b_lined":
      return type.side_b.lined ? "Lined" : "None";
    case "internal_walls.wall_type.side_b_product":
      return liningProductDisplay(type.side_b.product);
    case "internal_walls.wall_type.side_b_thickness_mm":
      return type.side_b.thickness_mm;
    case "internal_walls.wall_type.side_b_sheet_length_mm":
      return type.side_b.sheet_length_mm;
    case "internal_walls.wall_type.side_b_layers":
      if (type.side_b.layers === 1) return "1 layer";
      if (type.side_b.layers === 2) return "2 layers";
      return type.side_b.layers;
    default:
      return null;
  }
}
