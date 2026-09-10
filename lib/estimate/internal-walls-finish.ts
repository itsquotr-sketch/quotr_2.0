/**
 * WA-INTERNAL-WALLS-07 — insulation, skirting, cornice, electrical
 * quantities. Physical only. No invented products, waste %, hours, or $
 * allowances. Do not change IW-03–06 framing / lining / opening formulas.
 */

import { round2 } from "@/lib/estimate/facts";
import {
  openingHasCompleteGeometry,
  openingsEligibleForTakeoff,
  sumOpeningAreaM2,
  type InternalWallsOpening,
} from "@/lib/estimate/internal-walls-openings";
import type { InternalWallsJobScope } from "@/lib/estimate/internal-walls-scope";

export type InternalWallsFinishHost = {
  length_lm: number | null;
  height_m: number | null;
  openings: InternalWallsOpening[];
  insulation_included: boolean | null;
  insulation_type: InternalWallsInsulationType | null;
  skirting: InternalWallsSideSelection | null;
  cornice: InternalWallsSideSelection | null;
  electrical: InternalWallsElectricalTier | null;
  electrical_note: string | null;
};

export const INTERNAL_WALLS_INSULATION_INCLUDED_KEY =
  "internal_walls.wall_type.insulation_included" as const;
export const INTERNAL_WALLS_INSULATION_TYPE_KEY =
  "internal_walls.wall_type.insulation" as const;
export const INTERNAL_WALLS_SKIRTING_SIDES_KEY =
  "internal_walls.wall_type.skirting" as const;
export const INTERNAL_WALLS_CORNICE_SIDES_KEY =
  "internal_walls.wall_type.cornice" as const;
export const INTERNAL_WALLS_ELECTRICAL_KEY =
  "internal_walls.wall_type.electrical" as const;
export const INTERNAL_WALLS_ELECTRICAL_NOTE_KEY =
  "internal_walls.wall_type.electrical_note" as const;

export const INTERNAL_WALLS_FINISH_FIELD_KEYS = [
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_INSULATION_TYPE_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_ELECTRICAL_KEY,
  INTERNAL_WALLS_ELECTRICAL_NOTE_KEY,
] as const;

export const INTERNAL_WALLS_INSULATION_INCLUDED_OPTIONS = [
  "No",
  "Yes",
] as const;

export const INTERNAL_WALLS_INSULATION_TYPE_VALUES = [
  "acoustic",
  "thermal",
  "fire_acoustic",
  "other",
] as const;

export type InternalWallsInsulationType =
  (typeof INTERNAL_WALLS_INSULATION_TYPE_VALUES)[number];

export const INTERNAL_WALLS_INSULATION_TYPE_OPTIONS = [
  "Acoustic",
  "Thermal",
  "Fire / acoustic",
  "Other",
] as const;

export const INTERNAL_WALLS_SIDE_SELECTION_VALUES = [
  "none",
  "side_a",
  "side_b",
  "both",
] as const;

export type InternalWallsSideSelection =
  (typeof INTERNAL_WALLS_SIDE_SELECTION_VALUES)[number];

export const INTERNAL_WALLS_SIDE_SELECTION_OPTIONS = [
  "No",
  "Side A",
  "Side B",
  "Both sides",
] as const;

export const INTERNAL_WALLS_ELECTRICAL_VALUES = [
  "none",
  "minor",
  "standard",
  "heavy",
  "custom",
] as const;

export type InternalWallsElectricalTier =
  (typeof INTERNAL_WALLS_ELECTRICAL_VALUES)[number];

export const INTERNAL_WALLS_ELECTRICAL_OPTIONS = [
  "No",
  "Minor",
  "Standard",
  "Heavy",
  "Custom",
] as const;

export const INTERNAL_WALLS_INSULATION_TYPE_REQUIRED_MESSAGE =
  "Choose an insulation type." as const;

export const INTERNAL_WALLS_INSULATION_AREA_REQUIRED_MESSAGE =
  "Add wall length and height to calculate insulation area." as const;

export const INTERNAL_WALLS_INSULATION_INFILL_REQUIRED_MESSAGE =
  "Add the infill opening width and height to calculate insulation." as const;

export const INTERNAL_WALLS_INSULATION_LABOUR_OWNER_REQUIRED_MESSAGE =
  "Insulation labour Pricing Required — no owner-approved hours/m²." as const;

export const INTERNAL_WALLS_SKIRTING_PROFILE_REQUIRED_MESSAGE =
  "Skirting profile — Pricing Required. No canonical wall-skirting identity or rate." as const;

export const INTERNAL_WALLS_SKIRTING_LABOUR_OWNER_REQUIRED_MESSAGE =
  "Skirting labour Pricing Required — no owner-approved hours/lm." as const;

export const INTERNAL_WALLS_CORNICE_PRODUCT_REQUIRED_MESSAGE =
  "Cornice product — Pricing Required. No canonical cornice identity or rate." as const;

export const INTERNAL_WALLS_CORNICE_LABOUR_OWNER_REQUIRED_MESSAGE =
  "Cornice labour Pricing Required — no owner-approved hours/lm." as const;

export const INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_REQUIRED_MESSAGE =
  "Electrical allowance — Pricing Required." as const;

export const INTERNAL_WALLS_INSULATION_WASTE_DECISION =
  "No canonical insulation wastage category. V1 purchase m² = net cavity m². Do not invent a percent." as const;

export const INTERNAL_WALLS_SKIRTING_OPENING_RULE =
  "Door, passage, and other openings deduct their width from skirting on each selected face. Passage is not deducted twice on the same face." as const;

export const INTERNAL_WALLS_CORNICE_OPENING_RULE =
  "Ordinary door and passage openings below wall height do not reduce cornice. Full-height openings that reach wall height deduct width." as const;

const INSULATION_TYPE_BY_NORMALISED: Record<string, InternalWallsInsulationType> =
  {
    acoustic: "acoustic",
    thermal: "thermal",
    fire_acoustic: "fire_acoustic",
    "fire / acoustic": "fire_acoustic",
    "fire and acoustic": "fire_acoustic",
    "fire/acoustic": "fire_acoustic",
    other: "other",
  };

const SIDE_BY_NORMALISED: Record<string, InternalWallsSideSelection> = {
  none: "none",
  no: "none",
  side_a: "side_a",
  "side a": "side_a",
  side_b: "side_b",
  "side b": "side_b",
  both: "both",
  "both sides": "both",
};

const ELECTRICAL_BY_NORMALISED: Record<string, InternalWallsElectricalTier> = {
  none: "none",
  no: "none",
  minor: "minor",
  standard: "standard",
  heavy: "heavy",
  custom: "custom",
};

export function parseYesNo(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  const normalised = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalised === "yes" || normalised === "included") return true;
  if (
    normalised === "no" ||
    normalised === "none" ||
    normalised === "not_included" ||
    normalised === "not included"
  ) {
    return false;
  }
  return null;
}

export function parseInternalWallsInsulationType(
  value: unknown
): InternalWallsInsulationType | null {
  if (value == null) return null;
  const normalised = String(value).trim().toLowerCase();
  if (!normalised) return null;
  return INSULATION_TYPE_BY_NORMALISED[normalised] ?? null;
}

export function parseInternalWallsSideSelection(
  value: unknown
): InternalWallsSideSelection | null {
  if (value == null) return null;
  const normalised = String(value).trim().toLowerCase();
  if (!normalised) return null;
  return SIDE_BY_NORMALISED[normalised] ?? null;
}

export function parseInternalWallsElectricalTier(
  value: unknown
): InternalWallsElectricalTier | null {
  if (value == null) return null;
  const normalised = String(value).trim().toLowerCase();
  if (!normalised) return null;
  return ELECTRICAL_BY_NORMALISED[normalised] ?? null;
}

export function insulationTypeDisplay(
  value: InternalWallsInsulationType | null
): string | null {
  if (value === "acoustic") return "Acoustic";
  if (value === "thermal") return "Thermal";
  if (value === "fire_acoustic") return "Fire / acoustic";
  if (value === "other") return "Other";
  return null;
}

export function sideSelectionDisplay(
  value: InternalWallsSideSelection | null
): string | null {
  if (value === "none") return "No";
  if (value === "side_a") return "Side A";
  if (value === "side_b") return "Side B";
  if (value === "both") return "Both sides";
  return null;
}

export function electricalTierDisplay(
  value: InternalWallsElectricalTier | null
): string | null {
  if (value === "none") return "No";
  if (value === "minor") return "Minor";
  if (value === "standard") return "Standard";
  if (value === "heavy") return "Heavy";
  if (value === "custom") return "Custom";
  return null;
}

export function insulationAsksForScope(
  jobScope: InternalWallsJobScope | null
): boolean {
  if (jobScope === "remove_partition" || jobScope === "form_opening") {
    return false;
  }
  return true;
}

export function selectedSides(
  selection: InternalWallsSideSelection | null
): Array<"side_a" | "side_b"> {
  if (selection === "side_a") return ["side_a"];
  if (selection === "side_b") return ["side_b"];
  if (selection === "both") return ["side_a", "side_b"];
  return [];
}

function eligibleOpenings(
  type: InternalWallsFinishHost
): InternalWallsOpening[] {
  return openingsEligibleForTakeoff(type.openings, {
    wallLengthLm: type.length_lm,
    wallHeightM: type.height_m,
    compareToWall: type.length_lm != null && type.height_m != null,
  });
}

export function cavityGrossAreaM2(params: {
  lengthLm: number | null;
  heightM: number | null;
}): number | null {
  if (params.lengthLm == null || params.heightM == null) return null;
  if (!(params.lengthLm > 0) || !(params.heightM > 0)) return null;
  return params.lengthLm * params.heightM;
}

/** Once per cavity. Do not multiply by lined faces. */
export function insulationNetAreaM2(params: {
  lengthLm: number | null;
  heightM: number | null;
  openings: readonly InternalWallsOpening[];
  deductOpenings: boolean;
}): number | null {
  const gross = cavityGrossAreaM2(params);
  if (gross == null) return null;
  const deduction = params.deductOpenings
    ? sumOpeningAreaM2(params.openings)
    : 0;
  return Math.max(0, gross - deduction);
}

export function insulationAreaForWallType(params: {
  type: InternalWallsFinishHost;
  jobScope: InternalWallsJobScope | null;
}):
  | { ok: true; areaM2: number; grossM2: number; openingDeductionM2: number }
  | { ok: false; message: string } {
  const { type, jobScope } = params;
  if (jobScope === "infill_opening") {
    const openings = type.openings.filter(openingHasCompleteGeometry);
    if (openings.length === 0) {
      return { ok: false, message: INTERNAL_WALLS_INSULATION_INFILL_REQUIRED_MESSAGE };
    }
    const area = sumOpeningAreaM2(openings);
    return {
      ok: true,
      areaM2: area,
      grossM2: area,
      openingDeductionM2: 0,
    };
  }
  const openings = eligibleOpenings(type);
  const gross = cavityGrossAreaM2({
    lengthLm: type.length_lm,
    heightM: type.height_m,
  });
  if (gross == null) {
    return { ok: false, message: INTERNAL_WALLS_INSULATION_AREA_REQUIRED_MESSAGE };
  }
  const deduction = sumOpeningAreaM2(openings);
  return {
    ok: true,
    areaM2: Math.max(0, gross - deduction),
    grossM2: gross,
    openingDeductionM2: deduction,
  };
}

/**
 * Per selected face: max(0, wall_length − Σ opening widths).
 * All V1 opening types interrupt floor skirting. One deduction per face.
 */
export function skirtingLmForFace(params: {
  lengthLm: number | null;
  openings: readonly InternalWallsOpening[];
  deductOpenings: boolean;
}): number | null {
  if (params.lengthLm == null || !(params.lengthLm > 0)) return null;
  if (!params.deductOpenings) return params.lengthLm;
  const deducted = params.openings.reduce((sum, row) => {
    return row.width_m != null && row.width_m > 0 ? sum + row.width_m : sum;
  }, 0);
  return Math.max(0, params.lengthLm - deducted);
}

export function skirtingTakeoff(params: {
  type: InternalWallsFinishHost;
  jobScope: InternalWallsJobScope | null;
}): {
  sideALm: number | null;
  sideBLm: number | null;
  totalLm: number;
} | null {
  const sides = selectedSides(params.type.skirting);
  if (sides.length === 0) return null;
  if (params.jobScope === "infill_opening") {
    const openings = params.type.openings.filter(openingHasCompleteGeometry);
    const width = openings.reduce(
      (sum, row) => sum + (row.width_m ?? 0),
      0
    );
    if (!(width > 0)) return { sideALm: null, sideBLm: null, totalLm: 0 };
    const sideALm = sides.includes("side_a") ? width : null;
    const sideBLm = sides.includes("side_b") ? width : null;
    return {
      sideALm,
      sideBLm,
      totalLm: (sideALm ?? 0) + (sideBLm ?? 0),
    };
  }
  const openings = eligibleOpenings(params.type);
  const sideALm = sides.includes("side_a")
    ? skirtingLmForFace({
        lengthLm: params.type.length_lm,
        openings,
        deductOpenings: true,
      })
    : null;
  const sideBLm = sides.includes("side_b")
    ? skirtingLmForFace({
        lengthLm: params.type.length_lm,
        openings,
        deductOpenings: true,
      })
    : null;
  if (sideALm == null && sideBLm == null) return null;
  return {
    sideALm,
    sideBLm,
    totalLm: (sideALm ?? 0) + (sideBLm ?? 0),
  };
}

export function openingInterruptsCornice(params: {
  opening: Pick<InternalWallsOpening, "width_m" | "height_m">;
  wallHeightM: number | null;
}): boolean {
  if (params.opening.width_m == null || !(params.opening.width_m > 0)) {
    return false;
  }
  if (params.wallHeightM == null || params.opening.height_m == null) {
    return false;
  }
  return params.opening.height_m + 1e-9 >= params.wallHeightM;
}

/** Per selected face. Standard doors/passages below wall height do not deduct. */
export function corniceLmForFace(params: {
  lengthLm: number | null;
  wallHeightM: number | null;
  openings: readonly InternalWallsOpening[];
}): number | null {
  if (params.lengthLm == null || !(params.lengthLm > 0)) return null;
  const deducted = params.openings.reduce((sum, row) => {
    return openingInterruptsCornice({
      opening: row,
      wallHeightM: params.wallHeightM,
    })
      ? sum + (row.width_m ?? 0)
      : sum;
  }, 0);
  return Math.max(0, params.lengthLm - deducted);
}

export function corniceTakeoff(params: {
  type: InternalWallsFinishHost;
  jobScope: InternalWallsJobScope | null;
}): {
  sideALm: number | null;
  sideBLm: number | null;
  totalLm: number;
} | null {
  const sides = selectedSides(params.type.cornice);
  if (sides.length === 0) return null;
  if (params.jobScope === "infill_opening") {
    const openings = params.type.openings.filter(openingHasCompleteGeometry);
    const width = openings.reduce(
      (sum, row) => sum + (row.width_m ?? 0),
      0
    );
    if (!(width > 0)) return { sideALm: null, sideBLm: null, totalLm: 0 };
    const sideALm = sides.includes("side_a") ? width : null;
    const sideBLm = sides.includes("side_b") ? width : null;
    return {
      sideALm,
      sideBLm,
      totalLm: (sideALm ?? 0) + (sideBLm ?? 0),
    };
  }
  const openings = eligibleOpenings(params.type);
  const sideALm = sides.includes("side_a")
    ? corniceLmForFace({
        lengthLm: params.type.length_lm,
        wallHeightM: params.type.height_m,
        openings,
      })
    : null;
  const sideBLm = sides.includes("side_b")
    ? corniceLmForFace({
        lengthLm: params.type.length_lm,
        wallHeightM: params.type.height_m,
        openings,
      })
    : null;
  if (sideALm == null && sideBLm == null) return null;
  return {
    sideALm,
    sideBLm,
    totalLm: (sideALm ?? 0) + (sideBLm ?? 0),
  };
}

export function presentFinishQty(value: number, digits = 2): string {
  return String(round2(Number(value.toFixed(digits))));
}

export function nextInternalWallsFinishField(params: {
  type: InternalWallsFinishHost | null;
  jobScope: InternalWallsJobScope | null;
}): string | null {
  if (params.jobScope === "remove_partition") return null;
  const type = params.type;
  if (!type) return null;
  if (insulationAsksForScope(params.jobScope)) {
    if (type.insulation_included == null) {
      return INTERNAL_WALLS_INSULATION_INCLUDED_KEY;
    }
    if (type.insulation_included === true && type.insulation_type == null) {
      return INTERNAL_WALLS_INSULATION_TYPE_KEY;
    }
  }
  if (type.skirting == null) return INTERNAL_WALLS_SKIRTING_SIDES_KEY;
  if (type.cornice == null) return INTERNAL_WALLS_CORNICE_SIDES_KEY;
  if (type.electrical == null) return INTERNAL_WALLS_ELECTRICAL_KEY;
  if (type.electrical === "custom" && !type.electrical_note) {
    return INTERNAL_WALLS_ELECTRICAL_NOTE_KEY;
  }
  return null;
}

export function summariseFinishLine(type: InternalWallsFinishHost): string | null {
  const bits: string[] = [];
  if (type.insulation_included === true) {
    bits.push(
      `Insulation ${insulationTypeDisplay(type.insulation_type) ?? "yes"}`
    );
  } else if (type.insulation_included === false) {
    bits.push("No insulation");
  }
  if (type.skirting && type.skirting !== "none") {
    bits.push(`Skirting ${sideSelectionDisplay(type.skirting)}`);
  }
  if (type.cornice && type.cornice !== "none") {
    bits.push(`Cornice ${sideSelectionDisplay(type.cornice)}`);
  }
  if (type.electrical && type.electrical !== "none") {
    bits.push(`Electrical ${electricalTierDisplay(type.electrical)}`);
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}
