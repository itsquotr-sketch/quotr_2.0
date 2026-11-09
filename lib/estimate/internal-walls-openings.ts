/**
 * WA-INTERNAL-WALLS-06 — opening collection, validation, lining deduction,
 * and additive opening-framing formulas.
 *
 * Nested under each Wall Type (`openings[]`). Stable UUID identity.
 * Do not flatten opening_1 / opening_2 keys. Do not invent 810×1980.
 *
 * Door type = framed opening only. No door leaf / jamb / hardware money.
 */

import { round2 } from "@/lib/estimate/facts";

export const INTERNAL_WALLS_ACTIVE_OPENING_ID_FACT_KEY =
  "internal_walls.active_opening_id" as const;

export const INTERNAL_WALLS_ADD_OPENING_KEY =
  "internal_walls.add_opening" as const;
export const INTERNAL_WALLS_DELETE_OPENING_KEY =
  "internal_walls.delete_opening" as const;

export const INTERNAL_WALLS_OPENING_FIELD_PREFIX =
  "internal_walls.opening." as const;

export const INTERNAL_WALLS_OPENING_FIELD_KEYS = [
  "internal_walls.opening.type",
  "internal_walls.opening.width_m",
  "internal_walls.opening.height_m",
  "internal_walls.opening.label",
  "internal_walls.opening.formation_hours",
] as const;

export const INTERNAL_WALLS_HAS_OPENINGS_KEY =
  "internal_walls.wall_type.has_openings" as const;

export const INTERNAL_WALLS_OPENING_TYPE_VALUES = [
  "door",
  "passage",
  "other",
] as const;

export type InternalWallsOpeningType =
  (typeof INTERNAL_WALLS_OPENING_TYPE_VALUES)[number];

export const INTERNAL_WALLS_OPENING_TYPE_OPTIONS = [
  "Door opening",
  "Passage",
  "Other opening",
] as const;

export const INTERNAL_WALLS_HAS_OPENINGS_OPTIONS = ["No", "Yes"] as const;

export type InternalWallsOpening = {
  id: string;
  type: InternalWallsOpeningType | null;
  width_m: number | null;
  height_m: number | null;
  label: string | null;
  /** Hours to form this opening. Used only when no company or benchmark hours exist. */
  formation_hours?: number | null;
};

export const INTERNAL_WALLS_OPENING_DIMENSIONS_REQUIRED_MESSAGE =
  "Add the opening width and height." as const;

export const INTERNAL_WALLS_OPENING_EXCEEDS_WALL_MESSAGE =
  "Opening size is larger than the wall. Check the dimensions." as const;

export const INTERNAL_WALLS_OPENING_REQUIRED_MESSAGE =
  "Add at least one opening." as const;

export const INTERNAL_WALLS_OPENING_LABOUR_OWNER_REQUIRED_MESSAGE =
  "Opening formation is not priced. Wall framing labour already covers the stud grid. This line is the extra work to form the opening, and it stays separate from the door set and its hardware. No company hours and no documented benchmark exist. Enter the formation hours for this opening, then regenerate." as const;

export const INTERNAL_WALLS_OPENING_LABOUR_RATE_REQUIRED_MESSAGE =
  "Opening formation hours are recorded, but the carpenter hourly cost is missing. Add a carpenter hourly rate, then regenerate." as const;

export const INTERNAL_WALLS_DOOR_LEAF_NOT_INCLUDED_STATEMENT =
  "Door leaf / hardware: Not included" as const;

export const INTERNAL_WALLS_LINING_SHEET_RUN_WITH_OPENINGS_ASSUMPTION =
  "Lining sheet count stays on the full-height sheet run. Known openings are deducted from net lined area only." as const;

export const INTERNAL_WALLS_OPENING_MAKE_GOOD_MESSAGE =
  "Lining make-good around the opening is Pricing Required." as const;

export const INTERNAL_WALLS_OPENING_CRIPPLES_DEFERRED_STATEMENT =
  "Cripple studs are not modelled. Opening framing is two full-height trimmers plus a header." as const;

/** Company productivity key. There is no documented hours-per-opening benchmark. */
export const INTERNAL_WALLS_OPENING_FORM_HOURS_EACH_KEY =
  "internal_walls.opening.form.hours_each" as const;

export function createOpeningId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function isClientOpeningId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  ) {
    return true;
  }
  return /^op-[0-9a-f]+-[0-9a-f]+$/i.test(trimmed);
}

export function createEmptyOpening(params?: {
  id?: string;
}): InternalWallsOpening {
  return {
    id: params?.id ?? createOpeningId(),
    type: null,
    width_m: null,
    height_m: null,
    label: null,
    formation_hours: null,
  };
}

export function cloneOpening(
  opening: InternalWallsOpening
): InternalWallsOpening {
  return { ...opening };
}

export function duplicateOpening(
  source: InternalWallsOpening,
  newId?: string
): InternalWallsOpening {
  return {
    ...source,
    id: newId ?? createOpeningId(),
  };
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

const OPENING_TYPE_BY_NORMALISED: Record<string, InternalWallsOpeningType> = {
  door: "door",
  "door opening": "door",
  doorway: "door",
  passage: "passage",
  "passage opening": "passage",
  other: "other",
  "other opening": "other",
};

export function parseInternalWallsOpeningType(
  value: unknown
): InternalWallsOpeningType | null {
  if (value == null || value === "") return null;
  const normalised = String(value).trim().toLowerCase();
  return OPENING_TYPE_BY_NORMALISED[normalised] ?? null;
}

export function openingTypeDisplay(
  value: InternalWallsOpeningType | null
): string | null {
  if (value === "door") return "Door opening";
  if (value === "passage") return "Passage";
  if (value === "other") return "Other opening";
  return null;
}

function metresFromStoredDimension(
  row: Record<string, unknown>,
  metreKey: string,
  millimetreKey: string
): number | null {
  const metres = parsePositiveNumber(row[metreKey]);
  if (metres != null) return metres;
  const millimetres = parsePositiveNumber(row[millimetreKey]);
  if (millimetres == null) return null;
  return millimetres / 1000;
}

export function parseInternalWallsOpening(
  value: unknown
): InternalWallsOpening | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : null;
  if (!id) return null;
  return {
    id,
    type: parseInternalWallsOpeningType(row.type ?? row.opening_type),
    width_m: metresFromStoredDimension(row, "width_m", "width_mm"),
    height_m: metresFromStoredDimension(row, "height_m", "height_mm"),
    label:
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim()
        : null,
    formation_hours: parsePositiveNumber(row.formation_hours),
  };
}

function isOpeningRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Stored analysis rows may use width_mm / height_mm and opening_type, and may
 * omit the canonical opening id. A door set is never read here.
 * Returns no openings when more than one stored wall could own them.
 */
/**
 * One stated door opening, with its size in the same sentence, belongs to
 * the single wall. A door set alone does not. Two walls leave the choice open.
 */
export function statedSingleDoorOpeningMetres(
  briefText: string | null | undefined
): { widthM: number; heightM: number } | null {
  if (!briefText?.trim()) return null;
  if (/\bthe other wall\b/i.test(briefText)) return null;
  const counted = briefText.match(
    /\b(one|two|three|four|five|six|\d{1,2})(?:\s+\d{3,4}\s*[x×]\s*\d{3,4}\s*mm)?\s+(?:door\s+)?openings?\b/i
  );
  if (!counted || counted[1]?.toLowerCase() !== "one") return null;
  const sentences = briefText.split(/[.!?;]/);
  const found: { widthM: number; heightM: number }[] = [];
  for (const sentence of sentences) {
    if (!/\bdoor\s+openings?\b/i.test(sentence)) continue;
    const pairs = [...sentence.matchAll(/(\d{3,4})\s*[x×]\s*(\d{3,4})\s*mm/gi)];
    if (pairs.length !== 1) continue;
    found.push({
      widthM: Number(pairs[0]?.[1]) / 1000,
      heightM: Number(pairs[0]?.[2]) / 1000,
    });
  }
  return found.length === 1 ? (found[0] ?? null) : null;
}

export function withStatedSingleDoorOpening<T extends InternalWallsOpeningHost>(
  types: readonly T[],
  briefText: string | null | undefined
): T[] {
  const stated = statedSingleDoorOpeningMetres(briefText);
  if (!stated) return [...types];
  const openHosts = types.filter(
    (type) => type.has_openings !== false && type.openings.length === 0
  );
  if (openHosts.length !== 1) return [...types];
  const host = openHosts[0]!;
  const opening: InternalWallsOpening = {
    id: "brief-door-opening-1",
    type: "door",
    width_m: stated.widthM,
    height_m: stated.heightM,
    label: null,
    formation_hours: null,
  };
  return types.map((type) =>
    type === host
      ? {
          ...type,
          has_openings: true,
          active_opening_id: opening.id,
          openings: [opening],
        }
      : type
  );
}

type InternalWallsOpeningHost = {
  has_openings: boolean | null;
  active_opening_id: string | null;
  openings: InternalWallsOpening[];
};

export function openingsFromStoredWallTypeBlob(params: {
  raw: unknown;
  lengthLm: number | null;
  heightM: number | null;
}): InternalWallsOpening[] {
  if (!Array.isArray(params.raw)) return [];
  const walls = params.raw.filter(isOpeningRecord);
  const withOpenings = walls.filter(
    (wall) => Array.isArray(wall.openings) && wall.openings.length > 0
  );
  const matched = withOpenings.filter((wall) =>
    storedWallMatchesHost(wall, params.lengthLm, params.heightM)
  );
  const chosen =
    matched.length === 1
      ? matched[0]
      : withOpenings.length === 1 && walls.length === 1
        ? withOpenings[0]
        : null;
  if (!chosen || !Array.isArray(chosen.openings)) return [];
  return parseStoredOpenings(chosen.openings);
}

function storedWallMatchesHost(
  wall: Record<string, unknown>,
  lengthLm: number | null,
  heightM: number | null
): boolean {
  const length = parsePositiveNumber(wall.length_lm);
  const height = parsePositiveNumber(wall.height_m);
  if (lengthLm == null || length == null) return false;
  if (Math.abs(length - lengthLm) > 0.01) return false;
  if (heightM != null && height != null && Math.abs(height - heightM) > 0.01) {
    return false;
  }
  return true;
}

function storedOpeningsFromRow(item: unknown, index: number): InternalWallsOpening[] {
  if (!isOpeningRecord(item)) return [];
  const width = metresFromStoredDimension(item, "width_m", "width_mm");
  const height = metresFromStoredDimension(item, "height_m", "height_mm");
  if (width == null || height == null) return [];
  const quantityRaw = parsePositiveNumber(item.quantity);
  const quantity =
    quantityRaw != null && Number.isInteger(quantityRaw)
      ? Math.min(quantityRaw, 12)
      : 1;
  const type = parseInternalWallsOpeningType(item.type ?? item.opening_type);
  const label =
    typeof item.label === "string" && item.label.trim() ? item.label.trim() : null;
  const explicitId =
    typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const openings: InternalWallsOpening[] = [];
  for (let copy = 0; copy < quantity; copy += 1) {
    const id =
      explicitId && quantity === 1
        ? explicitId
        : explicitId
          ? `${explicitId}-${copy + 1}`
          : `stored-opening-${index + 1}-${copy + 1}`;
    openings.push({
      id,
      type,
      width_m: width,
      height_m: height,
      label,
      formation_hours: parsePositiveNumber(item.formation_hours),
    });
  }
  return openings;
}

function parseStoredOpenings(value: unknown[]): InternalWallsOpening[] {
  return value.flatMap((item, index) => storedOpeningsFromRow(item, index));
}

export function parseInternalWallsOpenings(
  value: unknown
): InternalWallsOpening[] {
  if (!Array.isArray(value)) return [];
  const openings: InternalWallsOpening[] = [];
  const seen = new Set<string>();
  value.forEach((row, index) => {
    const parsed = parseInternalWallsOpening(row);
    const rows = parsed ? [parsed] : storedOpeningsFromRow(row, index);
    for (const item of rows) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      openings.push(item);
    }
  });
  return openings;
}

export function openingAreaM2(
  opening: Pick<InternalWallsOpening, "width_m" | "height_m">
): number | null {
  if (
    opening.width_m == null ||
    opening.height_m == null ||
    !(opening.width_m > 0) ||
    !(opening.height_m > 0)
  ) {
    return null;
  }
  return opening.width_m * opening.height_m;
}

export function sumOpeningAreaM2(
  openings: readonly InternalWallsOpening[]
): number {
  return openings.reduce((sum, row) => {
    const area = openingAreaM2(row);
    return area != null ? sum + area : sum;
  }, 0);
}

export function netLinedFaceAreaM2(params: {
  grossFaceAreaM2: number | null;
  openingAreaM2: number;
}): number | null {
  if (params.grossFaceAreaM2 == null) return null;
  return Math.max(0, params.grossFaceAreaM2 - params.openingAreaM2);
}

export function deductOpeningsFromLining(jobScope: string | null): boolean {
  if (jobScope === "infill_opening") return false;
  if (jobScope === "remove_partition") return false;
  if (jobScope === "form_opening") return false;
  return true;
}

export function liningUsesOpeningGeometry(jobScope: string | null): boolean {
  return jobScope === "infill_opening";
}

export function openingHasCompleteGeometry(
  opening: Pick<InternalWallsOpening, "width_m" | "height_m">
): boolean {
  return (
    opening.width_m != null &&
    opening.height_m != null &&
    opening.width_m > 0 &&
    opening.height_m > 0
  );
}

export type InternalWallsOpeningValidation =
  | { ok: true }
  | {
      ok: false;
      kind: "incomplete" | "invalid" | "exceeds_wall";
      message: string;
    };

export function validateInternalWallsOpening(params: {
  opening: InternalWallsOpening;
  wallLengthLm: number | null;
  wallHeightM: number | null;
  compareToWall: boolean;
}): InternalWallsOpeningValidation {
  const { opening } = params;
  if (opening.width_m == null || opening.height_m == null) {
    return {
      ok: false,
      kind: "incomplete",
      message: INTERNAL_WALLS_OPENING_DIMENSIONS_REQUIRED_MESSAGE,
    };
  }
  if (!(opening.width_m > 0) || !(opening.height_m > 0)) {
    return {
      ok: false,
      kind: "invalid",
      message: INTERNAL_WALLS_OPENING_DIMENSIONS_REQUIRED_MESSAGE,
    };
  }
  if (!params.compareToWall) return { ok: true };
  if (
    params.wallLengthLm != null &&
    params.wallLengthLm > 0 &&
    opening.width_m >= params.wallLengthLm
  ) {
    return {
      ok: false,
      kind: "exceeds_wall",
      message: INTERNAL_WALLS_OPENING_EXCEEDS_WALL_MESSAGE,
    };
  }
  if (
    params.wallHeightM != null &&
    params.wallHeightM > 0 &&
    opening.height_m > params.wallHeightM
  ) {
    return {
      ok: false,
      kind: "exceeds_wall",
      message: INTERNAL_WALLS_OPENING_EXCEEDS_WALL_MESSAGE,
    };
  }
  return { ok: true };
}

export function validateOpeningCollection(params: {
  openings: readonly InternalWallsOpening[];
  wallLengthLm: number | null;
  wallHeightM: number | null;
  compareToWall: boolean;
}): InternalWallsOpeningValidation {
  for (const opening of params.openings) {
    const result = validateInternalWallsOpening({
      opening,
      wallLengthLm: params.wallLengthLm,
      wallHeightM: params.wallHeightM,
      compareToWall: params.compareToWall,
    });
    if (!result.ok) return result;
  }
  if (
    params.compareToWall &&
    params.wallLengthLm != null &&
    params.wallLengthLm > 0
  ) {
    const widthSum = params.openings.reduce(
      (sum, row) => sum + (row.width_m ?? 0),
      0
    );
    if (widthSum > params.wallLengthLm) {
      return {
        ok: false,
        kind: "exceeds_wall",
        message: INTERNAL_WALLS_OPENING_EXCEEDS_WALL_MESSAGE,
      };
    }
  }
  return { ok: true };
}

export function openingsEligibleForTakeoff(
  openings: readonly InternalWallsOpening[],
  params: {
    wallLengthLm: number | null;
    wallHeightM: number | null;
    compareToWall: boolean;
  }
): InternalWallsOpening[] {
  return openings.filter((opening) => {
    const result = validateInternalWallsOpening({
      opening,
      ...params,
    });
    return result.ok;
  });
}

/**
 * V1 timber opening framing — additive, keep the base stud grid.
 *
 * trimmer_stud_count = 2 per opening (full-height jambs)
 * trimmer_lm         = 2 × trimmer_height
 * header_lm          = opening_width
 * cripple_lm         = 0 (deferred — false precision)
 * raw_lm             = trimmer_lm + header_lm
 * purchase_lm        = raw_lm × (1 + waste)   // waste once on this raw qty
 *
 * Conservative overtake: existing grid studs at the jambs are not removed.
 */
export function internalWallsTimberOpeningTakeoff(params: {
  opening: InternalWallsOpening;
  trimmerHeightM: number;
  wasteFactor: number;
}): {
  openingId: string;
  trimmerStudCount: number;
  trimmerLm: number;
  headerLm: number;
  crippleLm: number;
  rawTimberLm: number;
  purchaseTimberLm: number;
  wasteFactor: number;
} | null {
  const width = params.opening.width_m;
  if (width == null || !(width > 0) || !(params.trimmerHeightM > 0)) {
    return null;
  }
  const wasteFactor =
    Number.isFinite(params.wasteFactor) && params.wasteFactor >= 0
      ? params.wasteFactor
      : 0;
  const trimmerStudCount = 2;
  const trimmerLm = round2(trimmerStudCount * params.trimmerHeightM);
  const headerLm = round2(width);
  const crippleLm = 0;
  const rawTimberLm = round2(trimmerLm + headerLm + crippleLm);
  const purchaseTimberLm = round2(rawTimberLm * (1 + wasteFactor));
  return {
    openingId: params.opening.id,
    trimmerStudCount,
    trimmerLm,
    headerLm,
    crippleLm,
    rawTimberLm,
    purchaseTimberLm,
    wasteFactor,
  };
}

/**
 * V1 steel opening framing — additive track/stud only.
 * 2 extra full-height jamb studs + head track = opening width.
 * No boxed / proprietary jamb systems. Waste factor remains 0 (IW-04).
 */
export function internalWallsSteelOpeningTakeoff(params: {
  opening: InternalWallsOpening;
  trimmerHeightM: number;
  wasteFactor?: number;
}): {
  openingId: string;
  jambStudCount: number;
  jambStudLm: number;
  headerTrackLm: number;
  wasteFactor: number;
} | null {
  const width = params.opening.width_m;
  if (width == null || !(width > 0) || !(params.trimmerHeightM > 0)) {
    return null;
  }
  const wasteFactor = params.wasteFactor ?? 0;
  return {
    openingId: params.opening.id,
    jambStudCount: 2,
    jambStudLm: round2(2 * params.trimmerHeightM),
    headerTrackLm: round2(width),
    wasteFactor,
  };
}

export function trimmerHeightM(params: {
  wallHeightM: number | null;
  openingHeightM: number | null;
}): number | null {
  if (params.wallHeightM != null && params.wallHeightM > 0) {
    return params.wallHeightM;
  }
  if (params.openingHeightM != null && params.openingHeightM > 0) {
    return params.openingHeightM;
  }
  return null;
}

export function formatOpeningDimensionsMm(
  widthM: number | null,
  heightM: number | null
): string | null {
  if (widthM == null || heightM == null) return null;
  return `${Math.round(widthM * 1000)}×${Math.round(heightM * 1000)} mm`;
}

export function formatOpeningCompactLine(
  opening: InternalWallsOpening
): string {
  const type = openingTypeDisplay(opening.type) ?? "Opening";
  const dims = formatOpeningDimensionsMm(opening.width_m, opening.height_m);
  return dims ? `${type} · ${dims}` : type;
}

export function summariseOpeningsLine(
  openings: readonly InternalWallsOpening[],
  hasOpenings: boolean | null
): string | null {
  if (hasOpenings === false && openings.length === 0) return "No openings";
  if (openings.length === 0) return null;
  if (openings.length === 1) {
    const row = openings[0]!;
    const typeLabel =
      row.type === "door"
        ? "door opening"
        : row.type === "passage"
          ? "passage"
          : "opening";
    const dims = formatOpeningDimensionsMm(row.width_m, row.height_m);
    return dims
      ? `1 × ${typeLabel} · ${dims.replace(" mm", "")}`
      : `1 × ${typeLabel}`;
  }
  return `${openings.length} openings`;
}

export function formatInternalWallsOpeningFramingTakeoff(params: {
  typeLabel: string;
  dimensions: string | null;
  trimmerStudCount: number;
  headerLm: number;
}): string {
  return [
    params.typeLabel,
    params.dimensions,
    `${params.trimmerStudCount} trimmer studs`,
    `${params.headerLm} lm header`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function resolveActiveOpeningId(
  openings: readonly InternalWallsOpening[],
  requested: string | null | undefined
): string | null {
  if (requested && openings.some((row) => row.id === requested)) {
    return requested;
  }
  return openings[0]?.id ?? null;
}

export function isInternalWallsOpeningWriteKey(key: string): boolean {
  return (
    key === INTERNAL_WALLS_ADD_OPENING_KEY ||
    key === INTERNAL_WALLS_DELETE_OPENING_KEY ||
    key === INTERNAL_WALLS_ACTIVE_OPENING_ID_FACT_KEY ||
    key === INTERNAL_WALLS_HAS_OPENINGS_KEY ||
    key.startsWith(INTERNAL_WALLS_OPENING_FIELD_PREFIX)
  );
}
