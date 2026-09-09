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
};

export const INTERNAL_WALLS_OPENING_DIMENSIONS_REQUIRED_MESSAGE =
  "Add the opening width and height." as const;

export const INTERNAL_WALLS_OPENING_EXCEEDS_WALL_MESSAGE =
  "Opening size is larger than the wall. Check the dimensions." as const;

export const INTERNAL_WALLS_OPENING_REQUIRED_MESSAGE =
  "Add at least one opening." as const;

export const INTERNAL_WALLS_OPENING_LABOUR_OWNER_REQUIRED_MESSAGE =
  "Opening labour Pricing Required — no owner-approved hours per opening." as const;

export const INTERNAL_WALLS_DOOR_LEAF_NOT_INCLUDED_STATEMENT =
  "Door leaf / hardware: Not included" as const;

export const INTERNAL_WALLS_LINING_SHEET_RUN_WITH_OPENINGS_ASSUMPTION =
  "Lining sheet count stays on the full-height sheet run. Known openings are deducted from net lined area only." as const;

export const INTERNAL_WALLS_OPENING_MAKE_GOOD_MESSAGE =
  "Lining make-good around the opening is Pricing Required." as const;

export const INTERNAL_WALLS_OPENING_CRIPPLES_DEFERRED_STATEMENT =
  "Cripple studs are not modelled. Opening framing is two full-height trimmers plus a header." as const;

/** Future Company DNA task — no owner-approved hours/opening in IW-06. */
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

export function parseInternalWallsOpening(
  value: unknown
): InternalWallsOpening | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : null;
  if (!id) return null;
  return {
    id,
    type: parseInternalWallsOpeningType(row.type),
    width_m: parsePositiveNumber(row.width_m),
    height_m: parsePositiveNumber(row.height_m),
    label:
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim()
        : null,
  };
}

export function parseInternalWallsOpenings(
  value: unknown
): InternalWallsOpening[] {
  if (!Array.isArray(value)) return [];
  const openings: InternalWallsOpening[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const parsed = parseInternalWallsOpening(row);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    openings.push(parsed);
  }
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
