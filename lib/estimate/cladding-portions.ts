/**
 * CLADDING-01B — nested Cladding Section collection.
 *
 * Canonical store: `cladding.portions` on project_facts (jsonb).
 * Persistence wraps `{ v, portions }` so concurrent nested writes
 * compare-and-swap an integer revision.
 *
 * Stable id per Cladding Section. Logical `cladding.portion.*` keys patch
 * the JSON collection and are not persisted as sibling rows.
 *
 * No takeoff, material COST, productivity, labour COST, waste, or quote
 * wording in this module. Derived quantities are not stored.
 *
 * CLADDING-01B is domain only. Ordinary nested Cladding is not human-QA
 * frozen and is not an L5 commercial close.
 */

import { getFact } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  claddingApprovedProfileById,
  isApprovedCladdingBattenThickness,
  isApprovedCladdingBattenWidth,
  type CladdingApprovedProfile,
} from "@/lib/estimate/cladding-profiles";
import {
  createStableClientId,
  isStableClientId,
} from "@/lib/ids/stable-client-id";

export const CLADDING_V1_HUMAN_QA_FROZEN = false as const;
export const CLADDING_SUPPORT_NOTES =
  "Canonical nested domain, brief extraction and Details are wired. Physical takeoff, rates, commercialisation, Pricing and Quote remain unwired." as const;
export const CLADDING_STAGED_NOT_CALCULATED_MESSAGE =
  "Cladding quantities and pricing will be calculated after the remaining section details are confirmed." as const;

export const CLADDING_PORTIONS_FACT_KEY = "cladding.portions" as const;
export const CLADDING_ACTIVE_PORTION_ID_FACT_KEY =
  "cladding.active_portion_id" as const;
export const CLADDING_PORTION_FIELD_PREFIX = "cladding.portion." as const;
export const CLADDING_ADD_PORTION_KEY = "cladding.add_portion" as const;
export const CLADDING_DUPLICATE_PORTION_KEY =
  "cladding.duplicate_portion" as const;
export const CLADDING_DELETE_PORTION_KEY = "cladding.delete_portion" as const;
export const CLADDING_ID_PREFIX = "cs" as const;

export const CLADDING_SCOPE_INTENT_VALUES = [
  "install",
  "replace",
  "removal_only",
  "suppressed",
] as const;
export type CladdingScopeIntent =
  (typeof CLADDING_SCOPE_INTENT_VALUES)[number];

export const CLADDING_FAMILY_VALUES = [
  "timber",
  "fibre_cement",
  "brick_veneer",
  "masonry",
  "other",
] as const;
export type CladdingFamily = (typeof CLADDING_FAMILY_VALUES)[number];

export const CLADDING_SYSTEM_VALUES = [
  "timber_bevelback",
  "timber_rusticated",
  "timber_vertical_shiplap",
  "timber_sheet_board_and_batten",
  "fibre_cement_horizontal_weatherboard",
  "specialist_unresolved",
] as const;
export type CladdingSystem = (typeof CLADDING_SYSTEM_VALUES)[number];

export const CLADDING_ORIENTATION_VALUES = ["horizontal", "vertical"] as const;
export type CladdingOrientation =
  (typeof CLADDING_ORIENTATION_VALUES)[number];

export const CLADDING_AREA_METHOD_VALUES = ["direct_m2", "length_height"] as const;
export type CladdingAreaMethod =
  (typeof CLADDING_AREA_METHOD_VALUES)[number];

export const CLADDING_FIELD_AUTHORITY_VALUES = [
  "extracted",
  "assumed_disclosed",
  "user",
] as const;
export type CladdingFieldAuthority =
  (typeof CLADDING_FIELD_AUTHORITY_VALUES)[number];

export const CLADDING_SPECIALIST_KIND_VALUES = [
  "brick_veneer",
  "masonry",
  "custom_profile",
  "unsupported_proprietary",
  "other_custom",
] as const;
export type CladdingSpecialistKind =
  (typeof CLADDING_SPECIALIST_KIND_VALUES)[number];

export type CladdingPortion = {
  id: string;
  clause_ordinal?: number;
  label: string | null;
  scope_intent: CladdingScopeIntent | null;
  cladding_family: CladdingFamily | null;
  cladding_system: CladdingSystem | null;
  orientation: CladdingOrientation | null;
  approved_profile_id: string | null;
  nominal_width_mm: number | null;
  nominal_thickness_mm: number | null;
  effective_cover_mm: number | null;
  board_sheet_length_mm: number | null;
  board_sheet_width_mm: number | null;
  board_gap_mm: number | null;
  batten_width_mm: number | null;
  batten_thickness_mm: number | null;
  area_method: CladdingAreaMethod | null;
  direct_area_m2: number | null;
  length_m: number | null;
  height_m: number | null;
  openings_already_deducted: boolean | null;
  opening_area_m2: number | null;
  cavity_included: boolean | null;
  wall_underlay_or_rab_included: boolean | null;
  trims_flashings_corners_included: boolean | null;
  existing_cladding_removal_required: boolean | null;
  painting_or_coating_included: boolean | null;
  specialist_kind: CladdingSpecialistKind | null;
  other_description: string | null;
  label_authority?: CladdingFieldAuthority;
  scope_intent_authority?: CladdingFieldAuthority;
  family_authority?: CladdingFieldAuthority;
  system_authority?: CladdingFieldAuthority;
  orientation_authority?: CladdingFieldAuthority;
  approved_profile_authority?: CladdingFieldAuthority;
  nominal_width_authority?: CladdingFieldAuthority;
  nominal_thickness_authority?: CladdingFieldAuthority;
  effective_cover_authority?: CladdingFieldAuthority;
  board_sheet_length_authority?: CladdingFieldAuthority;
  board_sheet_width_authority?: CladdingFieldAuthority;
  board_gap_authority?: CladdingFieldAuthority;
  batten_width_authority?: CladdingFieldAuthority;
  batten_thickness_authority?: CladdingFieldAuthority;
  area_method_authority?: CladdingFieldAuthority;
  direct_area_authority?: CladdingFieldAuthority;
  length_authority?: CladdingFieldAuthority;
  height_authority?: CladdingFieldAuthority;
  openings_deducted_authority?: CladdingFieldAuthority;
  opening_area_authority?: CladdingFieldAuthority;
  cavity_authority?: CladdingFieldAuthority;
  underlay_authority?: CladdingFieldAuthority;
  trims_authority?: CladdingFieldAuthority;
  removal_authority?: CladdingFieldAuthority;
  painting_authority?: CladdingFieldAuthority;
  specialist_kind_authority?: CladdingFieldAuthority;
  other_description_authority?: CladdingFieldAuthority;
};

export const CLADDING_PORTION_FIELD_KEYS = [
  "cladding.portion.label",
  "cladding.portion.scope_intent",
  "cladding.portion.cladding_family",
  "cladding.portion.cladding_system",
  "cladding.portion.orientation",
  "cladding.portion.approved_profile",
  "cladding.portion.nominal_width_mm",
  "cladding.portion.nominal_thickness_mm",
  "cladding.portion.effective_cover_mm",
  "cladding.portion.board_sheet_length_mm",
  "cladding.portion.board_sheet_width_mm",
  "cladding.portion.board_gap_mm",
  "cladding.portion.batten_width_mm",
  "cladding.portion.batten_thickness_mm",
  "cladding.portion.area_method",
  "cladding.portion.direct_area_m2",
  "cladding.portion.length_m",
  "cladding.portion.height_m",
  "cladding.portion.openings_already_deducted",
  "cladding.portion.opening_area_m2",
  "cladding.portion.cavity_included",
  "cladding.portion.wall_underlay_or_rab_included",
  "cladding.portion.trims_flashings_corners_included",
  "cladding.portion.existing_cladding_removal_required",
  "cladding.portion.painting_or_coating_included",
  "cladding.portion.specialist_kind",
  "cladding.portion.other_description",
] as const;

/** Staged calculator reads the collection only. Physical fields are not consumed. */
export const CLADDING_CALCULATOR_CONSUMED_FACTS = [
  CLADDING_PORTIONS_FACT_KEY,
] as const;

const USER_AUTHORITY_FIELDS = [
  "label_authority",
  "scope_intent_authority",
  "family_authority",
  "system_authority",
  "orientation_authority",
  "approved_profile_authority",
  "nominal_width_authority",
  "nominal_thickness_authority",
  "effective_cover_authority",
  "board_sheet_length_authority",
  "board_sheet_width_authority",
  "board_gap_authority",
  "batten_width_authority",
  "batten_thickness_authority",
  "area_method_authority",
  "direct_area_authority",
  "length_authority",
  "height_authority",
  "openings_deducted_authority",
  "opening_area_authority",
  "cavity_authority",
  "underlay_authority",
  "trims_authority",
  "removal_authority",
  "painting_authority",
  "specialist_kind_authority",
  "other_description_authority",
] as const satisfies readonly (keyof CladdingPortion)[];

const SPECIALIST_FAMILIES = new Set<CladdingFamily>([
  "brick_veneer",
  "masonry",
  "other",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function parseFieldAuthority(
  value: unknown
): CladdingFieldAuthority | undefined {
  return parseEnum(value, CLADDING_FIELD_AUTHORITY_VALUES) ?? undefined;
}

function parsePositiveMeasure(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function parseNonNegativeMeasure(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function parseTriBool(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value !== "string") return null;
  const normalised = value.trim().toLowerCase();
  if (normalised === "yes" || normalised === "true" || normalised === "included") {
    return true;
  }
  if (
    normalised === "no" ||
    normalised === "false" ||
    normalised === "not_included" ||
    normalised === "not included" ||
    normalised === "excluded"
  ) {
    return false;
  }
  return null;
}

function parseText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function createCladdingPortionId(): string {
  return createStableClientId(CLADDING_ID_PREFIX);
}

export function isClientCladdingPortionId(value: unknown): value is string {
  return isStableClientId(value, CLADDING_ID_PREFIX);
}

export function createEmptyCladdingPortion(params?: {
  id?: string;
}): CladdingPortion {
  return {
    id: params?.id ?? createCladdingPortionId(),
    label: null,
    scope_intent: null,
    cladding_family: null,
    cladding_system: null,
    orientation: null,
    approved_profile_id: null,
    nominal_width_mm: null,
    nominal_thickness_mm: null,
    effective_cover_mm: null,
    board_sheet_length_mm: null,
    board_sheet_width_mm: null,
    board_gap_mm: null,
    batten_width_mm: null,
    batten_thickness_mm: null,
    area_method: null,
    direct_area_m2: null,
    length_m: null,
    height_m: null,
    openings_already_deducted: null,
    opening_area_m2: null,
    cavity_included: null,
    wall_underlay_or_rab_included: null,
    trims_flashings_corners_included: null,
    existing_cladding_removal_required: null,
    painting_or_coating_included: null,
    specialist_kind: null,
    other_description: null,
  };
}

export function cloneCladdingPortion(portion: CladdingPortion): CladdingPortion {
  return { ...portion };
}

export function duplicateCladdingPortion(
  source: CladdingPortion,
  newId?: string
): CladdingPortion {
  return {
    ...cloneCladdingPortion(source),
    id: newId ?? createCladdingPortionId(),
  };
}

function assignProfileMetadata(
  portion: CladdingPortion,
  profile: CladdingApprovedProfile
): void {
  portion.approved_profile_id = profile.id;
  portion.cladding_family = profile.family;
  portion.cladding_system = profile.system;
  if (profile.orientation) portion.orientation = profile.orientation;
  portion.nominal_width_mm = profile.nominal_width_mm;
  portion.nominal_thickness_mm = profile.nominal_thickness_mm;
  portion.effective_cover_mm = profile.effective_cover_mm;
  portion.board_sheet_length_mm = profile.board_sheet_length_mm;
  portion.board_sheet_width_mm = profile.board_sheet_width_mm;
  portion.board_gap_mm = profile.board_gap_mm;
  portion.nominal_width_authority = undefined;
  portion.nominal_thickness_authority = undefined;
  portion.effective_cover_authority = undefined;
  portion.board_sheet_length_authority = undefined;
  portion.board_sheet_width_authority = undefined;
  portion.board_gap_authority = undefined;
}

function clearMachineField(
  portion: CladdingPortion,
  field: keyof CladdingPortion,
  authorityField: keyof CladdingPortion
): void {
  if (portion[authorityField] === "user") return;
  (portion as unknown as Record<string, unknown>)[field] = null;
  (portion as unknown as Record<string, unknown>)[authorityField] = undefined;
}

const HORIZONTAL_TIMBER_SYSTEMS = new Set<CladdingSystem>([
  "timber_bevelback",
  "timber_rusticated",
]);
const VERTICAL_TIMBER_SYSTEMS = new Set<CladdingSystem>([
  "timber_vertical_shiplap",
  "timber_sheet_board_and_batten",
]);

function profileConflictsWithParents(portion: CladdingPortion): boolean {
  const profile = claddingApprovedProfileById(portion.approved_profile_id);
  if (!profile) return false;
  if (portion.cladding_family && portion.cladding_family !== profile.family) {
    return true;
  }
  if (portion.cladding_system && portion.cladding_system !== profile.system) {
    return true;
  }
  if (
    portion.orientation &&
    profile.orientation &&
    portion.orientation !== profile.orientation
  ) {
    return true;
  }
  if (
    portion.orientation === "horizontal" &&
    VERTICAL_TIMBER_SYSTEMS.has(profile.system)
  ) {
    return true;
  }
  if (
    portion.orientation === "vertical" &&
    HORIZONTAL_TIMBER_SYSTEMS.has(profile.system)
  ) {
    return true;
  }
  return false;
}

function clearMachineProfile(portion: CladdingPortion): void {
  if (portion.approved_profile_authority === "user") return;
  portion.approved_profile_id = null;
  portion.approved_profile_authority = undefined;
  clearMachineField(portion, "nominal_width_mm", "nominal_width_authority");
  clearMachineField(portion, "nominal_thickness_mm", "nominal_thickness_authority");
  clearMachineField(portion, "effective_cover_mm", "effective_cover_authority");
  clearMachineField(portion, "board_sheet_length_mm", "board_sheet_length_authority");
  clearMachineField(portion, "board_sheet_width_mm", "board_sheet_width_authority");
  clearMachineField(portion, "board_gap_mm", "board_gap_authority");
}

function reconcileMachineChildren(portion: CladdingPortion): void {
  if (
    portion.cladding_family != null &&
    SPECIALIST_FAMILIES.has(portion.cladding_family)
  ) {
    settleSpecialistFamily(portion);
    return;
  }
  if (portion.cladding_family === "fibre_cement") {
    if (
      portion.orientation_authority !== "user" &&
      portion.orientation === "vertical"
    ) {
      portion.orientation = null;
      portion.orientation_authority = undefined;
    }
    if (
      portion.system_authority !== "user" &&
      portion.cladding_system &&
      portion.cladding_system !== "fibre_cement_horizontal_weatherboard" &&
      portion.cladding_system !== "specialist_unresolved"
    ) {
      portion.cladding_system = null;
      portion.system_authority = undefined;
    }
  }
  if (portion.cladding_family === "timber") {
    if (
      portion.system_authority !== "user" &&
      portion.cladding_system === "fibre_cement_horizontal_weatherboard"
    ) {
      portion.cladding_system = null;
      portion.system_authority = undefined;
    }
    if (
      portion.orientation === "horizontal" &&
      portion.system_authority !== "user" &&
      portion.cladding_system &&
      VERTICAL_TIMBER_SYSTEMS.has(portion.cladding_system)
    ) {
      portion.cladding_system = null;
      portion.system_authority = undefined;
    }
    if (
      portion.orientation === "vertical" &&
      portion.system_authority !== "user" &&
      portion.cladding_system &&
      HORIZONTAL_TIMBER_SYSTEMS.has(portion.cladding_system)
    ) {
      portion.cladding_system = null;
      portion.system_authority = undefined;
    }
  }
  if (profileConflictsWithParents(portion)) clearMachineProfile(portion);
}

/** Profile that still matches the current family, system and orientation. */
export function claddingVisibleApprovedProfile(
  portion: CladdingPortion
): CladdingApprovedProfile | null {
  if (!portion.approved_profile_id) return null;
  if (profileConflictsWithParents(portion)) return null;
  return claddingApprovedProfileById(portion.approved_profile_id);
}

function markCustomProfile(portion: CladdingPortion): void {
  portion.approved_profile_id = null;
  portion.approved_profile_authority = "user";
  if (portion.family_authority !== "user") {
    portion.cladding_family = "other";
    portion.family_authority = "user";
  } else if (
    portion.cladding_family === "timber" ||
    portion.cladding_family === "fibre_cement"
  ) {
    portion.cladding_family = "other";
  }
  if (portion.system_authority !== "user") {
    portion.cladding_system = "specialist_unresolved";
    portion.system_authority = "user";
  } else if (portion.cladding_system !== "specialist_unresolved") {
    portion.cladding_system = "specialist_unresolved";
  }
  if (portion.specialist_kind_authority !== "user") {
    portion.specialist_kind = "custom_profile";
    portion.specialist_kind_authority = "user";
  }
}

function settleSpecialistFamily(portion: CladdingPortion): void {
  if (
    portion.cladding_family == null ||
    !SPECIALIST_FAMILIES.has(portion.cladding_family)
  ) {
    return;
  }
  portion.approved_profile_id = null;
  if (portion.approved_profile_authority !== "user") {
    portion.approved_profile_authority = undefined;
  }
  clearMachineField(portion, "nominal_width_mm", "nominal_width_authority");
  clearMachineField(
    portion,
    "nominal_thickness_mm",
    "nominal_thickness_authority"
  );
  clearMachineField(portion, "effective_cover_mm", "effective_cover_authority");
  clearMachineField(
    portion,
    "board_sheet_length_mm",
    "board_sheet_length_authority"
  );
  clearMachineField(portion, "board_sheet_width_mm", "board_sheet_width_authority");
  clearMachineField(portion, "board_gap_mm", "board_gap_authority");
  portion.cladding_system = "specialist_unresolved";
  if (portion.system_authority !== "user") {
    portion.system_authority = undefined;
  }
}

function bindApprovedProfile(
  portion: CladdingPortion,
  profileId: string
): boolean {
  const profile = claddingApprovedProfileById(profileId);
  if (!profile) return false;
  assignProfileMetadata(portion, profile);
  portion.approved_profile_authority = "user";
  portion.family_authority = "user";
  portion.system_authority = "user";
  if (profile.orientation) portion.orientation_authority = "user";
  return true;
}

export function claddingPortionProfileConsistent(
  portion: CladdingPortion
): boolean {
  if (!portion.approved_profile_id) return true;
  const profile = claddingApprovedProfileById(portion.approved_profile_id);
  if (!profile) return false;
  return (
    portion.cladding_family === profile.family &&
    portion.cladding_system === profile.system &&
    portion.orientation === profile.orientation &&
    portion.nominal_width_mm === profile.nominal_width_mm &&
    portion.nominal_thickness_mm === profile.nominal_thickness_mm &&
    portion.effective_cover_mm === profile.effective_cover_mm &&
    portion.board_sheet_length_mm === profile.board_sheet_length_mm &&
    portion.board_sheet_width_mm === profile.board_sheet_width_mm &&
    portion.board_gap_mm === profile.board_gap_mm
  );
}

export function claddingPortionIsOrdinary(
  portion: CladdingPortion
): boolean {
  if (!portion.approved_profile_id) return false;
  if (!claddingPortionProfileConsistent(portion)) return false;
  if (portion.cladding_system === "timber_sheet_board_and_batten") {
    if (
      portion.batten_width_mm != null &&
      !isApprovedCladdingBattenWidth(portion.batten_width_mm)
    ) {
      return false;
    }
    if (
      portion.batten_thickness_mm != null &&
      !isApprovedCladdingBattenThickness(portion.batten_thickness_mm)
    ) {
      return false;
    }
  }
  return (
    portion.cladding_family === "timber" ||
    portion.cladding_family === "fibre_cement"
  );
}

export function parseCladdingPortion(value: unknown): CladdingPortion | null {
  if (!isRecord(value)) return null;
  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : createCladdingPortionId();
  const portion = createEmptyCladdingPortion({ id });
  portion.label = parseText(value.label);
  portion.scope_intent = parseEnum(value.scope_intent, CLADDING_SCOPE_INTENT_VALUES);
  portion.cladding_family = parseEnum(value.cladding_family, CLADDING_FAMILY_VALUES);
  portion.cladding_system = parseEnum(value.cladding_system, CLADDING_SYSTEM_VALUES);
  portion.orientation = parseEnum(value.orientation, CLADDING_ORIENTATION_VALUES);
  portion.approved_profile_id = parseText(value.approved_profile_id);
  portion.nominal_width_mm = parsePositiveMeasure(value.nominal_width_mm);
  portion.nominal_thickness_mm = parsePositiveMeasure(value.nominal_thickness_mm);
  portion.effective_cover_mm = parsePositiveMeasure(value.effective_cover_mm);
  portion.board_sheet_length_mm = parsePositiveMeasure(value.board_sheet_length_mm);
  portion.board_sheet_width_mm = parsePositiveMeasure(value.board_sheet_width_mm);
  portion.board_gap_mm = parsePositiveMeasure(value.board_gap_mm);
  portion.batten_width_mm = parsePositiveMeasure(value.batten_width_mm);
  portion.batten_thickness_mm = parsePositiveMeasure(value.batten_thickness_mm);
  portion.area_method = parseEnum(value.area_method, CLADDING_AREA_METHOD_VALUES);
  portion.direct_area_m2 = parsePositiveMeasure(value.direct_area_m2);
  portion.length_m = parsePositiveMeasure(value.length_m);
  portion.height_m = parsePositiveMeasure(value.height_m);
  portion.openings_already_deducted = parseTriBool(value.openings_already_deducted);
  portion.opening_area_m2 = parseNonNegativeMeasure(value.opening_area_m2);
  portion.cavity_included = parseTriBool(value.cavity_included);
  portion.wall_underlay_or_rab_included = parseTriBool(
    value.wall_underlay_or_rab_included
  );
  portion.trims_flashings_corners_included = parseTriBool(
    value.trims_flashings_corners_included
  );
  portion.existing_cladding_removal_required = parseTriBool(
    value.existing_cladding_removal_required
  );
  portion.painting_or_coating_included = parseTriBool(
    value.painting_or_coating_included
  );
  portion.specialist_kind = parseEnum(
    value.specialist_kind,
    CLADDING_SPECIALIST_KIND_VALUES
  );
  portion.other_description = parseText(value.other_description);
  portion.label_authority = parseFieldAuthority(value.label_authority);
  portion.scope_intent_authority = parseFieldAuthority(value.scope_intent_authority);
  portion.family_authority = parseFieldAuthority(value.family_authority);
  portion.system_authority = parseFieldAuthority(value.system_authority);
  portion.orientation_authority = parseFieldAuthority(value.orientation_authority);
  portion.approved_profile_authority = parseFieldAuthority(
    value.approved_profile_authority
  );
  portion.nominal_width_authority = parseFieldAuthority(value.nominal_width_authority);
  portion.nominal_thickness_authority = parseFieldAuthority(
    value.nominal_thickness_authority
  );
  portion.effective_cover_authority = parseFieldAuthority(
    value.effective_cover_authority
  );
  portion.board_sheet_length_authority = parseFieldAuthority(
    value.board_sheet_length_authority
  );
  portion.board_sheet_width_authority = parseFieldAuthority(
    value.board_sheet_width_authority
  );
  portion.board_gap_authority = parseFieldAuthority(value.board_gap_authority);
  portion.batten_width_authority = parseFieldAuthority(value.batten_width_authority);
  portion.batten_thickness_authority = parseFieldAuthority(
    value.batten_thickness_authority
  );
  portion.area_method_authority = parseFieldAuthority(value.area_method_authority);
  portion.direct_area_authority = parseFieldAuthority(value.direct_area_authority);
  portion.length_authority = parseFieldAuthority(value.length_authority);
  portion.height_authority = parseFieldAuthority(value.height_authority);
  portion.openings_deducted_authority = parseFieldAuthority(
    value.openings_deducted_authority
  );
  portion.opening_area_authority = parseFieldAuthority(value.opening_area_authority);
  portion.cavity_authority = parseFieldAuthority(value.cavity_authority);
  portion.underlay_authority = parseFieldAuthority(value.underlay_authority);
  portion.trims_authority = parseFieldAuthority(value.trims_authority);
  portion.removal_authority = parseFieldAuthority(value.removal_authority);
  portion.painting_authority = parseFieldAuthority(value.painting_authority);
  portion.specialist_kind_authority = parseFieldAuthority(
    value.specialist_kind_authority
  );
  portion.other_description_authority = parseFieldAuthority(
    value.other_description_authority
  );
  if (
    typeof value.clause_ordinal === "number" &&
    Number.isInteger(value.clause_ordinal) &&
    value.clause_ordinal >= 0
  ) {
    portion.clause_ordinal = value.clause_ordinal;
  }
  if (portion.approved_profile_id) {
    const profile = claddingApprovedProfileById(portion.approved_profile_id);
    if (!profile) {
      portion.approved_profile_id = null;
    } else {
      assignProfileMetadata(portion, profile);
      portion.approved_profile_authority =
        parseFieldAuthority(value.approved_profile_authority) ??
        portion.approved_profile_authority;
      portion.family_authority =
        parseFieldAuthority(value.family_authority) ?? portion.family_authority;
      portion.system_authority =
        parseFieldAuthority(value.system_authority) ?? portion.system_authority;
    }
  }
  if (
    portion.cladding_system === "timber_sheet_board_and_batten" &&
    portion.approved_profile_id &&
    ((portion.batten_width_mm != null &&
      !isApprovedCladdingBattenWidth(portion.batten_width_mm)) ||
      (portion.batten_thickness_mm != null &&
        !isApprovedCladdingBattenThickness(portion.batten_thickness_mm)))
  ) {
    markCustomProfile(portion);
  }
  settleSpecialistFamily(portion);
  return portion;
}

function parseCladdingPortionList(value: unknown[]): CladdingPortion[] {
  const portions: CladdingPortion[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const parsed = parseCladdingPortion(row);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    portions.push(parsed);
  }
  return portions;
}

export function parseCladdingCollectionEnvelope(value: unknown): {
  v: number;
  portions: CladdingPortion[];
} {
  if (Array.isArray(value)) {
    return { v: 0, portions: parseCladdingPortionList(value) };
  }
  if (isRecord(value) && Array.isArray(value.portions)) {
    const version =
      typeof value.v === "number" && Number.isInteger(value.v) && value.v >= 0
        ? value.v
        : 0;
    return { v: version, portions: parseCladdingPortionList(value.portions) };
  }
  return { v: 0, portions: [] };
}

export function parseCladdingPortions(value: unknown): CladdingPortion[] {
  return parseCladdingCollectionEnvelope(value).portions;
}

export function nextCladdingCollectionEnvelope(
  stored: unknown,
  portions: readonly CladdingPortion[]
): { v: number; portions: CladdingPortion[] } {
  const current = parseCladdingCollectionEnvelope(stored);
  return {
    v: current.v + 1,
    portions: portions.map(cloneCladdingPortion),
  };
}

export function rejectStaleCladdingCas(
  stored: unknown,
  expectedV: number
): boolean {
  return parseCladdingCollectionEnvelope(stored).v !== expectedV;
}

export function isCladdingPortionWriteKey(key: string): boolean {
  return (
    key === CLADDING_PORTIONS_FACT_KEY ||
    key === CLADDING_ACTIVE_PORTION_ID_FACT_KEY ||
    key === CLADDING_ADD_PORTION_KEY ||
    key === CLADDING_DUPLICATE_PORTION_KEY ||
    key === CLADDING_DELETE_PORTION_KEY ||
    key.startsWith(CLADDING_PORTION_FIELD_PREFIX)
  );
}

export function hasCladdingPortionsFact(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return (
    getFact(facts as EstimateFact[], workAreaId, CLADDING_PORTIONS_FACT_KEY) !=
    null
  );
}

export function resolveCladdingPortions(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): {
  portions: CladdingPortion[];
  activeId: string | null;
} {
  const portions = storedCladdingPortions(params.facts, params.workAreaId);
  return {
    portions,
    activeId: resolveCladdingActivePortionId(
      params.facts,
      params.workAreaId,
      portions
    ),
  };
}

export function findCladdingPortion(
  portions: readonly CladdingPortion[],
  portionId: string | null | undefined
): CladdingPortion | null {
  if (!portionId) return null;
  return portions.find((row) => row.id === portionId) ?? null;
}

export function storedCladdingPortions(
  facts: readonly EstimateFact[],
  workAreaId: string
): CladdingPortion[] {
  const raw = getFact(
    facts as EstimateFact[],
    workAreaId,
    CLADDING_PORTIONS_FACT_KEY
  )?.value;
  return parseCladdingPortions(raw);
}

export function resolveCladdingActivePortionId(
  facts: readonly EstimateFact[],
  workAreaId: string,
  portions: readonly CladdingPortion[]
): string | null {
  const stored = getFact(
    facts as EstimateFact[],
    workAreaId,
    CLADDING_ACTIVE_PORTION_ID_FACT_KEY
  )?.value;
  if (typeof stored === "string" && portions.some((row) => row.id === stored)) {
    return stored;
  }
  return portions[0]?.id ?? null;
}

export function claddingPortionsFactSourceForWrite(params: {
  readonly previousSource?: string | null;
  readonly factSource?: string | null;
}): "user" | "ai_extracted" | "default" | "assumption" | "system" {
  const allowed = [
    "user",
    "ai_extracted",
    "default",
    "assumption",
    "system",
  ] as const;
  if (
    params.factSource &&
    (allowed as readonly string[]).includes(params.factSource)
  ) {
    return params.factSource as (typeof allowed)[number];
  }
  if (
    params.previousSource &&
    (allowed as readonly string[]).includes(params.previousSource)
  ) {
    return params.previousSource as (typeof allowed)[number];
  }
  return "user";
}

export function claddingPortionHasUserAuthority(
  portion: CladdingPortion
): boolean {
  return USER_AUTHORITY_FIELDS.some((field) => portion[field] === "user");
}

export function claddingPortionFieldsCompatible(
  left: CladdingPortion,
  right: CladdingPortion
): boolean {
  const pairs: readonly [unknown, unknown][] = [
    [left.scope_intent, right.scope_intent],
    [left.cladding_family, right.cladding_family],
    [left.cladding_system, right.cladding_system],
    [left.orientation, right.orientation],
    [left.specialist_kind, right.specialist_kind],
    [left.approved_profile_id, right.approved_profile_id],
  ];
  for (const [a, b] of pairs) {
    if (a != null && b != null && a !== b) return false;
  }
  const labelA = left.label?.trim().toLowerCase() ?? "";
  const labelB = right.label?.trim().toLowerCase() ?? "";
  if (labelA && labelB && labelA !== labelB) return false;
  return true;
}

function isConsistentProductSubset(
  persisted: readonly CladdingPortion[],
  extracted: readonly CladdingPortion[]
): boolean {
  const used = new Set<number>();
  for (const row of persisted) {
    const idx = extracted.findIndex(
      (candidate, i) =>
        !used.has(i) && claddingPortionFieldsCompatible(row, candidate)
    );
    if (idx < 0) return false;
    used.add(idx);
  }
  return persisted.length > 0;
}

function overlayUserField<K extends keyof CladdingPortion>(
  next: CladdingPortion,
  persisted: CladdingPortion,
  field: K,
  authorityField: keyof CladdingPortion
): void {
  if (persisted[authorityField] === "user") {
    next[field] = persisted[field];
    (next as CladdingPortion)[authorityField] = "user" as never;
  }
}

export function overlayUserAuthoritativeCladdingPortion(
  extracted: CladdingPortion,
  persisted: CladdingPortion
): CladdingPortion {
  const next = cloneCladdingPortion(extracted);
  next.id = persisted.id;
  if (persisted.clause_ordinal != null) next.clause_ordinal = persisted.clause_ordinal;
  const profileBound =
    persisted.approved_profile_authority === "user" &&
    persisted.approved_profile_id != null &&
    claddingApprovedProfileById(persisted.approved_profile_id) != null;
  if (profileBound && persisted.approved_profile_id) {
    bindApprovedProfile(next, persisted.approved_profile_id);
  } else {
    overlayUserField(next, persisted, "nominal_width_mm", "nominal_width_authority");
    overlayUserField(
      next,
      persisted,
      "nominal_thickness_mm",
      "nominal_thickness_authority"
    );
    overlayUserField(
      next,
      persisted,
      "effective_cover_mm",
      "effective_cover_authority"
    );
    overlayUserField(
      next,
      persisted,
      "board_sheet_length_mm",
      "board_sheet_length_authority"
    );
    overlayUserField(
      next,
      persisted,
      "board_sheet_width_mm",
      "board_sheet_width_authority"
    );
    overlayUserField(next, persisted, "board_gap_mm", "board_gap_authority");
    overlayUserField(
      next,
      persisted,
      "approved_profile_id",
      "approved_profile_authority"
    );
    overlayUserField(next, persisted, "cladding_family", "family_authority");
    overlayUserField(next, persisted, "cladding_system", "system_authority");
    overlayUserField(next, persisted, "orientation", "orientation_authority");
  }
  overlayUserField(next, persisted, "label", "label_authority");
  overlayUserField(next, persisted, "scope_intent", "scope_intent_authority");
  overlayUserField(next, persisted, "batten_width_mm", "batten_width_authority");
  overlayUserField(
    next,
    persisted,
    "batten_thickness_mm",
    "batten_thickness_authority"
  );
  overlayUserField(next, persisted, "area_method", "area_method_authority");
  overlayUserField(next, persisted, "direct_area_m2", "direct_area_authority");
  overlayUserField(next, persisted, "length_m", "length_authority");
  overlayUserField(next, persisted, "height_m", "height_authority");
  overlayUserField(
    next,
    persisted,
    "openings_already_deducted",
    "openings_deducted_authority"
  );
  overlayUserField(next, persisted, "opening_area_m2", "opening_area_authority");
  overlayUserField(next, persisted, "cavity_included", "cavity_authority");
  overlayUserField(
    next,
    persisted,
    "wall_underlay_or_rab_included",
    "underlay_authority"
  );
  overlayUserField(
    next,
    persisted,
    "trims_flashings_corners_included",
    "trims_authority"
  );
  overlayUserField(
    next,
    persisted,
    "existing_cladding_removal_required",
    "removal_authority"
  );
  overlayUserField(
    next,
    persisted,
    "painting_or_coating_included",
    "painting_authority"
  );
  overlayUserField(next, persisted, "specialist_kind", "specialist_kind_authority");
  overlayUserField(
    next,
    persisted,
    "other_description",
    "other_description_authority"
  );
  if (!profileBound) settleSpecialistFamily(next);
  return next;
}

function takeExtractedMatch(
  extracted: readonly CladdingPortion[],
  used: Set<number>,
  predicate: (row: CladdingPortion, index: number) => boolean
): CladdingPortion | null {
  const index = extracted.findIndex(
    (row, i) => !used.has(i) && predicate(row, i)
  );
  if (index < 0) return null;
  used.add(index);
  return extracted[index] ?? null;
}

function matchReanalysePortion(
  extracted: readonly CladdingPortion[],
  persisted: CladdingPortion,
  index: number,
  used: Set<number>
): CladdingPortion | null {
  const byId = takeExtractedMatch(
    extracted,
    used,
    (row) => row.id === persisted.id
  );
  if (byId) return byId;
  if (persisted.clause_ordinal != null) {
    const byOrdinal = takeExtractedMatch(
      extracted,
      used,
      (row) =>
        row.clause_ordinal === persisted.clause_ordinal &&
        claddingPortionFieldsCompatible(row, persisted)
    );
    if (byOrdinal) return byOrdinal;
  }
  const label = persisted.label?.trim().toLowerCase();
  if (label) {
    const byLabel = takeExtractedMatch(
      extracted,
      used,
      (row) =>
        row.label?.trim().toLowerCase() === label &&
        claddingPortionFieldsCompatible(row, persisted)
    );
    if (byLabel) return byLabel;
  }
  const byIndex = takeExtractedMatch(
    extracted,
    used,
    (row, i) => i === index && claddingPortionFieldsCompatible(row, persisted)
  );
  if (byIndex) return byIndex;
  return takeExtractedMatch(extracted, used, (row) =>
    claddingPortionFieldsCompatible(row, persisted)
  );
}

/**
 * Re-analysis merge. User-owned fields win. Identical sections stay distinct.
 * A consistent persisted subset is an intentional deletion and is not recreated.
 * A user-owned collection is not auto-split. A machine-owned hybrid that is
 * not a consistent subset is replaced, keeping leading persisted ids.
 */
export function mergePersistedCladdingPortionsOnReanalyse(params: {
  readonly extracted: unknown;
  readonly persisted: unknown;
}): CladdingPortion[] {
  const extracted = parseCladdingPortions(params.extracted);
  const persisted = parseCladdingPortions(params.persisted);
  if (persisted.length === 0) return extracted.map(cloneCladdingPortion);
  if (extracted.length === 0) return persisted.map(cloneCladdingPortion);
  const hasUser = persisted.some(claddingPortionHasUserAuthority);
  const consistentSubset = isConsistentProductSubset(persisted, extracted);
  if (!hasUser && extracted.length > persisted.length && !consistentSubset) {
    return extracted.map((row, i) => {
      const next = cloneCladdingPortion(row);
      const previous = persisted[i];
      if (previous) next.id = previous.id;
      return next;
    });
  }
  const used = new Set<number>();
  const merged = persisted.map((portion, index) => {
    const match = matchReanalysePortion(extracted, portion, index, used);
    return match
      ? overlayUserAuthoritativeCladdingPortion(match, portion)
      : cloneCladdingPortion(portion);
  });
  if (!hasUser && !consistentSubset) {
    extracted.forEach((row, index) => {
      if (!used.has(index)) merged.push(cloneCladdingPortion(row));
    });
  }
  return merged;
}

function setMeasure(
  portion: CladdingPortion,
  field: keyof CladdingPortion,
  authorityField: keyof CladdingPortion,
  value: unknown
): void {
  if (value == null || value === "") {
    (portion as unknown as Record<string, unknown>)[field] = null;
    (portion as unknown as Record<string, unknown>)[authorityField] = "user";
    return;
  }
  const parsed = parsePositiveMeasure(value);
  if (parsed == null) return;
  (portion as unknown as Record<string, unknown>)[field] = parsed;
  (portion as unknown as Record<string, unknown>)[authorityField] = "user";
}

function maybeUnbindMeasure(
  portion: CladdingPortion,
  profileField: keyof CladdingApprovedProfile,
  value: number
): boolean {
  const profile = claddingApprovedProfileById(portion.approved_profile_id);
  if (!profile) return false;
  const expected = profile[profileField];
  if (expected == null || expected === value) return false;
  markCustomProfile(portion);
  return true;
}

function normalisedChoice(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

export function parseCladdingScopeInput(value: unknown): CladdingScopeIntent | null {
  const direct = parseEnum(value, CLADDING_SCOPE_INTENT_VALUES);
  if (direct) return direct;
  const text = normalisedChoice(value);
  if (!text) return null;
  if (text.includes("removal only") || text === "removal_only") return "removal_only";
  if (text.includes("replace") || text.includes("reclad")) return "replace";
  if (text.includes("new cladding") || text === "install") return "install";
  if (text.includes("suppress")) return "suppressed";
  return null;
}

export function parseCladdingFamilyInput(value: unknown): CladdingFamily | null {
  const direct = parseEnum(value, CLADDING_FAMILY_VALUES);
  if (direct) return direct;
  const text = normalisedChoice(value);
  if (!text) return null;
  if (text.includes("fibre") || text.includes("fiber")) return "fibre_cement";
  if (text.includes("brick")) return "brick_veneer";
  if (text.includes("masonry")) return "masonry";
  if (text === "timber" || text.startsWith("timber")) return "timber";
  if (text.includes("other") || text.includes("custom")) return "other";
  return null;
}

export function parseCladdingOrientationInput(
  value: unknown
): CladdingOrientation | null {
  const direct = parseEnum(value, CLADDING_ORIENTATION_VALUES);
  if (direct) return direct;
  const text = normalisedChoice(value);
  if (text === "horizontal") return "horizontal";
  if (text === "vertical") return "vertical";
  return null;
}

function isCustomSystemChoice(value: unknown): boolean {
  const text = normalisedChoice(value);
  return text.includes("other") || text.includes("custom");
}

export function parseCladdingSystemInput(value: unknown): CladdingSystem | null {
  const direct = parseEnum(value, CLADDING_SYSTEM_VALUES);
  if (direct) return direct;
  const text = normalisedChoice(value);
  if (!text) return null;
  if (text.includes("bevel")) return "timber_bevelback";
  if (text.includes("rustic")) return "timber_rusticated";
  if (text.includes("shiplap")) return "timber_vertical_shiplap";
  if (text.includes("board") && text.includes("batten")) {
    return "timber_sheet_board_and_batten";
  }
  if (text.includes("fibre") || text.includes("fiber") || text.includes("weatherboard")) {
    if (text.includes("other") || text.includes("custom")) return "specialist_unresolved";
    return "fibre_cement_horizontal_weatherboard";
  }
  if (isCustomSystemChoice(value)) return "specialist_unresolved";
  return null;
}

export function parseCladdingAreaMethodInput(
  value: unknown
): CladdingAreaMethod | null {
  const direct = parseEnum(value, CLADDING_AREA_METHOD_VALUES);
  if (direct) return direct;
  const text = normalisedChoice(value);
  if (!text) return null;
  if (text.includes("length")) return "length_height";
  if (text.includes("direct")) return "direct_m2";
  return null;
}

export function parseCladdingProfileInput(
  value: unknown,
  portion: CladdingPortion
): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (claddingApprovedProfileById(text)) return text;
  const choice = normalisedChoice(text);
  if (choice.includes("other") || choice.includes("custom")) return null;
  const width = choice.match(/(\d+)\s*(?:mm|×|x)/);
  const thickness = choice.match(/[x×]\s*(\d+)/);
  const widthMm = width ? Number(width[1]) : null;
  const thicknessMm = thickness ? Number(thickness[1]) : null;
  const match = claddingApprovedProfileById(
    portion.cladding_system === "timber_bevelback" && widthMm && thicknessMm
      ? `timber_bevelback_${widthMm}x${thicknessMm}`
      : portion.cladding_system === "timber_rusticated" && widthMm && thicknessMm
        ? `timber_rusticated_${widthMm}x${thicknessMm}`
        : portion.cladding_system === "timber_vertical_shiplap" && widthMm && thicknessMm
          ? `timber_vertical_shiplap_${widthMm}x${thicknessMm}`
          : portion.cladding_system === "fibre_cement_horizontal_weatherboard" && widthMm
            ? `fibre_cement_horizontal_weatherboard_${widthMm}`
            : portion.cladding_system === "timber_sheet_board_and_batten" &&
                choice.includes("2400")
              ? "timber_sheet_board_and_batten"
              : ""
  );
  return match?.id ?? null;
}

function applyPortionField(
  portion: CladdingPortion,
  field: string,
  value: unknown
): void {
  if (field === "approved_profile") {
    if (value == null || value === "") {
      portion.approved_profile_id = null;
      portion.approved_profile_authority = "user";
      return;
    }
    if (isCustomSystemChoice(value) && !claddingApprovedProfileById(parseText(value) ?? "")) {
      markCustomProfile(portion);
      return;
    }
    const id = parseCladdingProfileInput(value, portion) ?? parseText(value);
    if (!id || !bindApprovedProfile(portion, id)) return;
    return;
  }
  if (field === "label") {
    portion.label = parseText(value);
    portion.label_authority = "user";
    return;
  }
  if (field === "scope_intent") {
    const parsed = parseCladdingScopeInput(value);
    if (value != null && value !== "" && parsed == null) return;
    portion.scope_intent = parsed;
    portion.scope_intent_authority = "user";
    if (parsed === "removal_only" && portion.removal_authority !== "user") {
      portion.existing_cladding_removal_required = true;
      portion.removal_authority = "user";
    }
    return;
  }
  if (field === "cladding_family") {
    const parsed = parseCladdingFamilyInput(value);
    if (value != null && value !== "" && parsed == null) return;
    portion.cladding_family = parsed;
    portion.family_authority = "user";
    reconcileMachineChildren(portion);
    return;
  }
  if (field === "cladding_system") {
    const parsed = parseCladdingSystemInput(value);
    if (value != null && value !== "" && parsed == null) return;
    if (parsed === "specialist_unresolved" && isCustomSystemChoice(value)) {
      portion.cladding_family = "other";
      portion.family_authority = "user";
      portion.specialist_kind = "other_custom";
      portion.specialist_kind_authority = "user";
    }
    portion.cladding_system = parsed;
    portion.system_authority = "user";
    reconcileMachineChildren(portion);
    return;
  }
  if (field === "orientation") {
    const parsed = parseCladdingOrientationInput(value);
    if (value != null && value !== "" && parsed == null) return;
    portion.orientation = parsed;
    portion.orientation_authority = "user";
    reconcileMachineChildren(portion);
    return;
  }
  if (field === "specialist_kind") {
    const parsed = parseEnum(value, CLADDING_SPECIALIST_KIND_VALUES);
    if (value != null && value !== "" && parsed == null) return;
    portion.specialist_kind = parsed;
    portion.specialist_kind_authority = "user";
    return;
  }
  if (field === "other_description") {
    portion.other_description = parseText(value);
    portion.other_description_authority = "user";
    return;
  }
  if (field === "area_method") {
    const parsed = parseCladdingAreaMethodInput(value);
    if (value != null && value !== "" && parsed == null) return;
    portion.area_method = parsed;
    portion.area_method_authority = "user";
    return;
  }
  if (field === "opening_area_m2") {
    if (value == null || value === "") {
      portion.opening_area_m2 = null;
      portion.opening_area_authority = "user";
      return;
    }
    const parsed = parseNonNegativeMeasure(value);
    if (parsed == null) return;
    portion.opening_area_m2 = parsed;
    portion.opening_area_authority = "user";
    return;
  }
  const measureMap: Record<
    string,
    [keyof CladdingPortion, keyof CladdingPortion, keyof CladdingApprovedProfile | null]
  > = {
    nominal_width_mm: ["nominal_width_mm", "nominal_width_authority", "nominal_width_mm"],
    nominal_thickness_mm: [
      "nominal_thickness_mm",
      "nominal_thickness_authority",
      "nominal_thickness_mm",
    ],
    effective_cover_mm: [
      "effective_cover_mm",
      "effective_cover_authority",
      "effective_cover_mm",
    ],
    board_sheet_length_mm: [
      "board_sheet_length_mm",
      "board_sheet_length_authority",
      "board_sheet_length_mm",
    ],
    board_sheet_width_mm: [
      "board_sheet_width_mm",
      "board_sheet_width_authority",
      "board_sheet_width_mm",
    ],
    board_gap_mm: ["board_gap_mm", "board_gap_authority", "board_gap_mm"],
    direct_area_m2: ["direct_area_m2", "direct_area_authority", null],
    length_m: ["length_m", "length_authority", null],
    height_m: ["height_m", "height_authority", null],
  };
  if (measureMap[field]) {
    const [target, authority, profileField] = measureMap[field];
    const parsed = value == null || value === "" ? null : parsePositiveMeasure(value);
    if (value != null && value !== "" && parsed == null) return;
    if (
      parsed != null &&
      profileField &&
      maybeUnbindMeasure(portion, profileField, parsed)
    ) {
      (portion as unknown as Record<string, unknown>)[target] = parsed;
      (portion as unknown as Record<string, unknown>)[authority] = "user";
      return;
    }
    setMeasure(portion, target, authority, value);
    return;
  }
  if (field === "batten_width_mm" || field === "batten_thickness_mm") {
    const parsed = value == null || value === "" ? null : parsePositiveMeasure(value);
    if (value != null && value !== "" && parsed == null) return;
    const approved =
      field === "batten_width_mm"
        ? parsed == null || isApprovedCladdingBattenWidth(parsed)
        : parsed == null || isApprovedCladdingBattenThickness(parsed);
    if (
      parsed != null &&
      !approved &&
      portion.approved_profile_id &&
      portion.cladding_system === "timber_sheet_board_and_batten"
    ) {
      markCustomProfile(portion);
    }
    if (field === "batten_width_mm") {
      portion.batten_width_mm = parsed;
      portion.batten_width_authority = "user";
    } else {
      portion.batten_thickness_mm = parsed;
      portion.batten_thickness_authority = "user";
    }
    return;
  }
  const boolMap: Record<string, [keyof CladdingPortion, keyof CladdingPortion]> = {
    openings_already_deducted: [
      "openings_already_deducted",
      "openings_deducted_authority",
    ],
    cavity_included: ["cavity_included", "cavity_authority"],
    wall_underlay_or_rab_included: [
      "wall_underlay_or_rab_included",
      "underlay_authority",
    ],
    trims_flashings_corners_included: [
      "trims_flashings_corners_included",
      "trims_authority",
    ],
    existing_cladding_removal_required: [
      "existing_cladding_removal_required",
      "removal_authority",
    ],
    painting_or_coating_included: [
      "painting_or_coating_included",
      "painting_authority",
    ],
  };
  if (boolMap[field]) {
    if (value != null && value !== "" && parseTriBool(value) == null && value !== true && value !== false) {
      return;
    }
    const [target, authority] = boolMap[field];
    (portion as unknown as Record<string, unknown>)[target] =
      value == null || value === "" ? null : parseTriBool(value);
    (portion as unknown as Record<string, unknown>)[authority] = "user";
  }
}

function upsertFact(
  facts: EstimateFact[],
  workAreaId: string,
  key: string,
  value: unknown,
  source?: string | null
): EstimateFact[] {
  const without = facts.filter(
    (row) => !(row.key === key && row.work_area_id === workAreaId)
  );
  return [
    ...without,
    {
      key,
      work_area_id: workAreaId,
      value,
      source: source ?? "user",
    },
  ];
}

export function applyCladdingFactWrite(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  key: string;
  value: unknown;
  nestedItemId?: string | null;
  factSource?: string | null;
}): EstimateFact[] {
  const facts = params.facts.map((row) => ({ ...row })) as EstimateFact[];
  const previousPortions = facts.find(
    (row) =>
      row.key === CLADDING_PORTIONS_FACT_KEY &&
      row.work_area_id === params.workAreaId
  );
  const nextSource = claddingPortionsFactSourceForWrite({
    previousSource: previousPortions?.source,
    factSource: params.factSource,
  });

  if (params.key === CLADDING_PORTIONS_FACT_KEY) {
    const incoming = parseCladdingPortions(params.value);
    const previous = parseCladdingPortions(previousPortions?.value);
    const portions =
      params.factSource === "ai_extracted"
        ? mergePersistedCladdingPortionsOnReanalyse({
            extracted: incoming,
            persisted: previous,
          })
        : incoming;
    return upsertFact(
      facts,
      params.workAreaId,
      CLADDING_PORTIONS_FACT_KEY,
      portions,
      nextSource
    );
  }

  let portions = storedCladdingPortions(facts, params.workAreaId);
  let activeId = resolveCladdingActivePortionId(
    facts,
    params.workAreaId,
    portions
  );

  if (params.key === CLADDING_ACTIVE_PORTION_ID_FACT_KEY) {
    const nextId = typeof params.value === "string" ? params.value : null;
    if (nextId && portions.some((row) => row.id === nextId)) {
      return upsertFact(
        facts,
        params.workAreaId,
        CLADDING_ACTIVE_PORTION_ID_FACT_KEY,
        nextId,
        nextSource
      );
    }
    return facts;
  }

  if (
    params.key === CLADDING_ADD_PORTION_KEY &&
    (params.value === true ||
      params.value === "Yes" ||
      params.value === "Add cladding section" ||
      isClientCladdingPortionId(params.value))
  ) {
    const requestedId = isClientCladdingPortionId(params.value)
      ? params.value.trim()
      : null;
    const existing = requestedId
      ? portions.find((row) => row.id === requestedId)
      : null;
    if (existing) {
      activeId = existing.id;
    } else {
      const created = createEmptyCladdingPortion({
        id: requestedId ?? undefined,
      });
      portions = [...portions, created];
      activeId = created.id;
    }
  } else if (params.key === CLADDING_DUPLICATE_PORTION_KEY) {
    const sourceId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    const source = portions.find((row) => row.id === sourceId);
    if (source) {
      const copyId =
        params.nestedItemId &&
        params.nestedItemId !== source.id &&
        isClientCladdingPortionId(params.nestedItemId)
          ? params.nestedItemId
          : undefined;
      const existingCopy = copyId
        ? portions.find((row) => row.id === copyId)
        : null;
      if (existingCopy) {
        activeId = existingCopy.id;
      } else {
        const copy = duplicateCladdingPortion(source, copyId);
        const index = portions.findIndex((row) => row.id === source.id);
        portions = [
          ...portions.slice(0, index + 1),
          copy,
          ...portions.slice(index + 1),
        ];
        activeId = copy.id;
      }
    }
  } else if (params.key === CLADDING_DELETE_PORTION_KEY) {
    const deleteId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    if (deleteId) {
      const remaining = portions.filter((row) => row.id !== deleteId);
      if (remaining.length !== portions.length) {
        portions = remaining;
        activeId =
          activeId === deleteId ? (portions[0]?.id ?? null) : activeId;
        if (activeId && !portions.some((row) => row.id === activeId)) {
          activeId = portions[0]?.id ?? null;
        }
      }
    }
  } else if (params.key.startsWith(CLADDING_PORTION_FIELD_PREFIX)) {
    const requested = params.nestedItemId?.trim() || null;
    const targetId =
      requested && portions.some((row) => row.id === requested)
        ? requested
        : activeId && portions.some((row) => row.id === activeId)
          ? activeId
          : null;
    if (!targetId) return facts;
    const field = params.key.slice(CLADDING_PORTION_FIELD_PREFIX.length);
    portions = portions.map((row) => {
      if (row.id !== targetId) return row;
      const next = cloneCladdingPortion(row);
      applyPortionField(next, field, params.value);
      return next;
    });
    activeId = targetId;
  } else {
    return facts;
  }

  let next = upsertFact(
    facts,
    params.workAreaId,
    CLADDING_PORTIONS_FACT_KEY,
    portions,
    nextSource
  );
  if (activeId) {
    next = upsertFact(
      next,
      params.workAreaId,
      CLADDING_ACTIVE_PORTION_ID_FACT_KEY,
      activeId,
      nextSource
    );
  } else {
    next = next.filter(
      (row) =>
        !(
          row.key === CLADDING_ACTIVE_PORTION_ID_FACT_KEY &&
          row.work_area_id === params.workAreaId
        )
    );
  }
  return next;
}
