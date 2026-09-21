/**
 * FLOORING-01B — nested Flooring Area collection.
 *
 * Canonical store: `flooring.portions` on project_facts (jsonb).
 * Persistence may wrap `{ v, portions }` so concurrent nested writes
 * compare-and-swap an integer revision.
 *
 * Stable UUID per Flooring Area. Do not flatten portion_1 keys.
 * Logical `flooring.portion.*` keys are write addresses for later Details /
 * Refine. They patch the JSON collection and are not persisted as sibling
 * rows.
 *
 * No takeoff, material COST, subcontract COST, productivity, or money
 * in this module. Do not invent area, finish, substrate, removal, waste,
 * or dimensions.
 *
 * Dual-path calculator boundary:
 * - Canonical nested `flooring.portions` is not calculated on the legacy
 *   fitout package path. Nested portions must not fall through to the
 *   legacy generic Flooring m² allowance merely because fields are incomplete.
 * - Legacy flat `flooring.area_m2` / calculateFlooring lumps remain for
 *   hosted projects without portions.
 *
 * FLOORING-02 leftovers (not claimed here):
 * - Extraction, Details questions, takeoff, rates, productivity, money.
 * - Deleted-portion tombstones: this module does not persist a deletion
 *   marker. A later extracted collection without user authority on a
 *   deleted id may recreate a portion. FLOORING-02 must decide tombstones
 *   versus extraction matching.
 * - Substrate-removal Details gating after finish-removal = Yes.
 */

import { getFact } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  createStableClientId,
  isStableClientId,
} from "@/lib/ids/stable-client-id";

export const FLOORING_PORTIONS_FACT_KEY = "flooring.portions" as const;
export const FLOORING_ACTIVE_PORTION_ID_FACT_KEY =
  "flooring.active_portion_id" as const;

export const FLOORING_PORTION_FIELD_PREFIX = "flooring.portion." as const;

export const FLOORING_ADD_PORTION_KEY = "flooring.add_portion" as const;
export const FLOORING_DUPLICATE_PORTION_KEY =
  "flooring.duplicate_portion" as const;
export const FLOORING_DELETE_PORTION_KEY = "flooring.delete_portion" as const;

export const FLOORING_NESTED_NOT_CALCULATED_MESSAGE =
  "Canonical nested Flooring Areas are not calculated on the legacy Flooring allowance path." as const;

export const FLOORING_FINISH_TYPE_VALUES = [
  "carpet",
  "vinyl_plank",
  "tile",
  "hardwood",
  "other",
] as const;
export type FlooringFinishType = (typeof FLOORING_FINISH_TYPE_VALUES)[number];

export const FLOORING_AREA_INPUT_METHOD_VALUES = [
  "direct_m2",
  "length_width",
] as const;
export type FlooringAreaInputMethod =
  (typeof FLOORING_AREA_INPUT_METHOD_VALUES)[number];

export const FLOORING_TILE_WIDTH_MM_VALUES = [300, 500, 600] as const;
export const FLOORING_TILE_LENGTH_MM_VALUES = [500, 600, 1200] as const;
export const FLOORING_ORDINARY_TILE_SIZES_MM = [
  { width_mm: 500, length_mm: 500 },
  { width_mm: 600, length_mm: 600 },
  { width_mm: 300, length_mm: 600 },
  { width_mm: 600, length_mm: 1200 },
] as const;

export const FLOORING_HARDWOOD_BOARD_WIDTH_MM_VALUES = [
  145, 165, 186, 190, 220,
] as const;
export type FlooringHardwoodBoardWidthMm =
  (typeof FLOORING_HARDWOOD_BOARD_WIDTH_MM_VALUES)[number];

export function isOrdinaryFlooringHardwoodBoardWidth(
  value: number | null | undefined
): value is FlooringHardwoodBoardWidthMm {
  return (
    value != null &&
    (FLOORING_HARDWOOD_BOARD_WIDTH_MM_VALUES as readonly number[]).includes(
      value
    )
  );
}

export const FLOORING_SUBSTRATE_FAMILY_VALUES = [
  "particleboard",
  "structural_plywood",
  "fibre_cement",
  "secura",
  "other",
] as const;
export type FlooringSubstrateFamily =
  (typeof FLOORING_SUBSTRATE_FAMILY_VALUES)[number];

export const FLOORING_FRAMING_ALLOWANCE_LEVEL_VALUES = [
  "minor",
  "standard",
  "major",
] as const;
export type FlooringFramingAllowanceLevel =
  (typeof FLOORING_FRAMING_ALLOWANCE_LEVEL_VALUES)[number];

export const FLOORING_EXISTING_FINISH_TYPE_VALUES = [
  "carpet",
  "vinyl",
  "tile",
  "hardwood",
  "other",
] as const;
export type FlooringExistingFinishType =
  (typeof FLOORING_EXISTING_FINISH_TYPE_VALUES)[number];

export const FLOORING_FIELD_AUTHORITY_VALUES = [
  "extracted",
  "assumed_disclosed",
  "user",
] as const;
export type FlooringFieldAuthority =
  (typeof FLOORING_FIELD_AUTHORITY_VALUES)[number];

export const FLOORING_SPECIALIST_KIND_VALUES = [
  "laminate",
  "engineered_timber",
  "sheet_vinyl",
  "client_supplied",
  "stairs_landings",
  "waterproofing",
  "structural",
  "other_unsupported",
] as const;
export type FlooringSpecialistKind =
  (typeof FLOORING_SPECIALIST_KIND_VALUES)[number];

export type FlooringPortion = {
  id: string;
  label: string | null;
  finish_type: FlooringFinishType | null;
  area_input_method: FlooringAreaInputMethod | null;
  length_m: number | null;
  width_m: number | null;
  area_m2: number | null;
  underlay_required: boolean | null;
  floor_preparation_required: boolean | null;
  tile_width_mm: number | null;
  tile_length_mm: number | null;
  /** Ordinary 145–220 mm or a safe custom positive millimetre width. */
  hardwood_board_width_mm: number | null;
  substrate_required: boolean | null;
  substrate_family: FlooringSubstrateFamily | null;
  substrate_item_key: string | null;
  framing_required: boolean | null;
  framing_allowance_level: FlooringFramingAllowanceLevel | null;
  finish_removal_required: boolean | null;
  existing_finish_type: FlooringExistingFinishType | null;
  substrate_removal_required: boolean | null;
  other_description: string | null;
  specialist_kind: FlooringSpecialistKind | null;
  finish_authority?: FlooringFieldAuthority;
  area_method_authority?: FlooringFieldAuthority;
  length_authority?: FlooringFieldAuthority;
  width_authority?: FlooringFieldAuthority;
  area_authority?: FlooringFieldAuthority;
  underlay_authority?: FlooringFieldAuthority;
  preparation_authority?: FlooringFieldAuthority;
  tile_width_authority?: FlooringFieldAuthority;
  tile_length_authority?: FlooringFieldAuthority;
  hardwood_width_authority?: FlooringFieldAuthority;
  substrate_required_authority?: FlooringFieldAuthority;
  substrate_family_authority?: FlooringFieldAuthority;
  substrate_item_authority?: FlooringFieldAuthority;
  framing_required_authority?: FlooringFieldAuthority;
  framing_level_authority?: FlooringFieldAuthority;
  finish_removal_authority?: FlooringFieldAuthority;
  existing_finish_authority?: FlooringFieldAuthority;
  substrate_removal_authority?: FlooringFieldAuthority;
  label_authority?: FlooringFieldAuthority;
  other_description_authority?: FlooringFieldAuthority;
  specialist_authority?: FlooringFieldAuthority;
  /** 0-based clause index from brief segmentation. Stable on re-analysis. */
  clause_ordinal?: number;
};

export type FlooringPortionSource = "canonical";

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
): FlooringFieldAuthority | undefined {
  return parseEnum(value, FLOORING_FIELD_AUTHORITY_VALUES) ?? undefined;
}

function parseTriBool(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (
      normalised === "yes" ||
      normalised === "included" ||
      normalised === "true"
    ) {
      return true;
    }
    if (
      normalised === "no" ||
      normalised === "not_included" ||
      normalised === "not included" ||
      normalised === "excluded" ||
      normalised === "false" ||
      normalised === "not sure"
    ) {
      return normalised === "not sure" ? null : false;
    }
  }
  return null;
}

export function createFlooringPortionId(): string {
  return createStableClientId("fa");
}

export function isClientFlooringPortionId(value: unknown): value is string {
  return isStableClientId(value, "fa");
}

function normalisedText(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function parseFlooringFinishType(
  value: unknown
): FlooringFinishType | null {
  const direct = parseEnum(value, FLOORING_FINISH_TYPE_VALUES);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const normalised = normalisedText(value);
  if (normalised.includes("laminate") || normalised.includes("engineered")) {
    return "other";
  }
  if (normalised.includes("sheet vinyl")) {
    return "other";
  }
  if (
    normalised.includes("vinyl plank") ||
    normalised.includes("lvt") ||
    normalised.includes("luxury vinyl") ||
    normalised.includes("slat vinyl") ||
    normalised === "slat" ||
    normalised === "vinyl"
  ) {
    return "vinyl_plank";
  }
  if (normalised.includes("carpet")) return "carpet";
  if (normalised.includes("tile")) return "tile";
  if (
    normalised.includes("hardwood") ||
    normalised.includes("timber") ||
    normalised === "wood" ||
    normalised.includes("wooden")
  ) {
    return "hardwood";
  }
  if (normalised === "other" || normalised === "custom") return "other";
  return null;
}

export function flooringFinishUsesUnderlay(
  finish: FlooringFinishType | null
): boolean {
  return finish === "carpet";
}

export function flooringFinishUsesPreparation(
  finish: FlooringFinishType | null
): boolean {
  return finish === "vinyl_plank" || finish === "tile";
}

export function flooringFinishUsesTileDimensions(
  finish: FlooringFinishType | null
): boolean {
  return finish === "tile";
}

export function flooringFinishUsesHardwoodWidth(
  finish: FlooringFinishType | null
): boolean {
  return finish === "hardwood";
}

export function flooringFinishUsesOtherDescription(
  finish: FlooringFinishType | null
): boolean {
  return finish === "other";
}

export function parseFlooringAreaInputMethod(
  value: unknown
): FlooringAreaInputMethod | null {
  const direct = parseEnum(value, FLOORING_AREA_INPUT_METHOD_VALUES);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const normalised = normalisedText(value);
  if (
    normalised === "direct" ||
    normalised === "direct m2" ||
    normalised === "area" ||
    normalised === "area only" ||
    normalised === "m2"
  ) {
    return "direct_m2";
  }
  if (
    normalised === "length width" ||
    normalised === "length x width" ||
    normalised === "l x w" ||
    normalised === "dimensions"
  ) {
    return "length_width";
  }
  return null;
}

/**
 * Positive finite quantity. Rejects zero, negatives, and non-numeric strings.
 * Does not invent a default area.
 */
export function parseFlooringPositiveMeasure(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(/m²|m2|m$/i, "").trim());
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }
  return null;
}

export function parseFlooringPositiveMm(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    const parsed = match ? Number(match[1]) : Number(value.replace(/mm/i, "").trim());
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
  }
  return null;
}

export function parseFlooringHardwoodBoardWidthMm(value: unknown): number | null {
  return parseFlooringPositiveMm(value);
}

export function parseFlooringSubstrateFamily(
  value: unknown
): FlooringSubstrateFamily | null {
  const direct = parseEnum(value, FLOORING_SUBSTRATE_FAMILY_VALUES);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const normalised = normalisedText(value);
  if (normalised.includes("particle") || normalised.includes("chipboard")) {
    return "particleboard";
  }
  if (normalised.includes("plywood") || normalised.includes("ply")) {
    return "structural_plywood";
  }
  if (normalised.includes("secura")) return "secura";
  if (
    normalised.includes("fibre cement") ||
    normalised.includes("fiber cement") ||
    normalised.includes("hardie")
  ) {
    return "fibre_cement";
  }
  if (normalised === "other") return "other";
  return null;
}

export function parseFlooringFramingAllowanceLevel(
  value: unknown
): FlooringFramingAllowanceLevel | null {
  return parseEnum(value, FLOORING_FRAMING_ALLOWANCE_LEVEL_VALUES);
}

export function parseFlooringExistingFinishType(
  value: unknown
): FlooringExistingFinishType | null {
  const direct = parseEnum(value, FLOORING_EXISTING_FINISH_TYPE_VALUES);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const normalised = normalisedText(value);
  if (normalised.includes("carpet")) return "carpet";
  if (normalised.includes("vinyl") || normalised.includes("lvt")) return "vinyl";
  if (normalised.includes("tile")) return "tile";
  if (
    normalised.includes("hardwood") ||
    normalised.includes("timber") ||
    normalised.includes("wood")
  ) {
    return "hardwood";
  }
  if (normalised === "other" || normalised === "custom") return "other";
  return null;
}

export function parseFlooringSpecialistKind(
  value: unknown
): FlooringSpecialistKind | null {
  const direct = parseEnum(value, FLOORING_SPECIALIST_KIND_VALUES);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const normalised = normalisedText(value);
  if (normalised.includes("laminate")) return "laminate";
  if (normalised.includes("engineered")) return "engineered_timber";
  if (normalised.includes("sheet vinyl")) return "sheet_vinyl";
  if (normalised.includes("client supplied") || normalised.includes("install only")) {
    return "client_supplied";
  }
  if (normalised.includes("stair") || normalised.includes("landing")) {
    return "stairs_landings";
  }
  if (normalised.includes("waterproof")) return "waterproofing";
  if (normalised.includes("structural") || normalised.includes("joist")) {
    return "structural";
  }
  if (normalised.includes("unsupported") || normalised === "other") {
    return "other_unsupported";
  }
  return null;
}

export function parseFlooringOtherDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseFlooringSubstrateItemKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function flooringPortionIsUnsupported(portion: FlooringPortion): boolean {
  return (
    portion.finish_type === "other" ||
    portion.specialist_kind != null
  );
}

function clearMachineOwnedField<K extends keyof FlooringPortion>(
  portion: FlooringPortion,
  field: K,
  authorityField: keyof FlooringPortion
): void {
  if (portion[authorityField] === "user") return;
  portion[field] = null as FlooringPortion[K];
  delete (portion as Record<string, unknown>)[String(authorityField)];
}

/**
 * Machine-owned stale inapplicable fields may be cleared.
 * User-owned inapplicable data is never silently destroyed.
 */
export function sanitizeFlooringPortionInapplicableFields(
  portion: FlooringPortion
): FlooringPortion {
  const finish = portion.finish_type;
  if (!finish) return portion;
  if (!flooringFinishUsesUnderlay(finish)) {
    clearMachineOwnedField(portion, "underlay_required", "underlay_authority");
  }
  if (!flooringFinishUsesPreparation(finish)) {
    clearMachineOwnedField(
      portion,
      "floor_preparation_required",
      "preparation_authority"
    );
  }
  if (!flooringFinishUsesTileDimensions(finish)) {
    clearMachineOwnedField(portion, "tile_width_mm", "tile_width_authority");
    clearMachineOwnedField(portion, "tile_length_mm", "tile_length_authority");
  }
  if (!flooringFinishUsesHardwoodWidth(finish)) {
    clearMachineOwnedField(
      portion,
      "hardwood_board_width_mm",
      "hardwood_width_authority"
    );
  }
  if (!flooringFinishUsesOtherDescription(finish)) {
    clearMachineOwnedField(
      portion,
      "other_description",
      "other_description_authority"
    );
    clearMachineOwnedField(portion, "specialist_kind", "specialist_authority");
  }
  return portion;
}

export function createEmptyFlooringPortion(params?: {
  id?: string;
  label?: string | null;
}): FlooringPortion {
  return {
    id: params?.id ?? createFlooringPortionId(),
    label: params?.label ?? null,
    finish_type: null,
    area_input_method: null,
    length_m: null,
    width_m: null,
    area_m2: null,
    underlay_required: null,
    floor_preparation_required: null,
    tile_width_mm: null,
    tile_length_mm: null,
    hardwood_board_width_mm: null,
    substrate_required: null,
    substrate_family: null,
    substrate_item_key: null,
    framing_required: null,
    framing_allowance_level: null,
    finish_removal_required: null,
    existing_finish_type: null,
    substrate_removal_required: null,
    other_description: null,
    specialist_kind: null,
  };
}

export function cloneFlooringPortion(portion: FlooringPortion): FlooringPortion {
  return { ...portion };
}

export function duplicateFlooringPortion(
  source: FlooringPortion,
  newId?: string
): FlooringPortion {
  return {
    ...cloneFlooringPortion(source),
    id: newId ?? createFlooringPortionId(),
    label: source.label ? `${source.label} copy` : null,
  };
}

export function parseFlooringPortion(value: unknown): FlooringPortion | null {
  if (!isRecord(value)) return null;
  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : createFlooringPortionId();
  const label =
    typeof value.label === "string" && value.label.trim()
      ? value.label.trim()
      : null;
  const portion: FlooringPortion = {
    id,
    label,
    finish_type: parseFlooringFinishType(value.finish_type),
    area_input_method: parseFlooringAreaInputMethod(value.area_input_method),
    length_m: parseFlooringPositiveMeasure(value.length_m),
    width_m: parseFlooringPositiveMeasure(value.width_m),
    area_m2: parseFlooringPositiveMeasure(value.area_m2),
    underlay_required: parseTriBool(value.underlay_required),
    floor_preparation_required: parseTriBool(value.floor_preparation_required),
    tile_width_mm: parseFlooringPositiveMm(value.tile_width_mm),
    tile_length_mm: parseFlooringPositiveMm(value.tile_length_mm),
    hardwood_board_width_mm: parseFlooringHardwoodBoardWidthMm(
      value.hardwood_board_width_mm
    ),
    substrate_required: parseTriBool(value.substrate_required),
    substrate_family: parseFlooringSubstrateFamily(value.substrate_family),
    substrate_item_key: parseFlooringSubstrateItemKey(value.substrate_item_key),
    framing_required: parseTriBool(value.framing_required),
    framing_allowance_level: parseFlooringFramingAllowanceLevel(
      value.framing_allowance_level
    ),
    finish_removal_required: parseTriBool(value.finish_removal_required),
    existing_finish_type: parseFlooringExistingFinishType(
      value.existing_finish_type
    ),
    substrate_removal_required: parseTriBool(value.substrate_removal_required),
    other_description: parseFlooringOtherDescription(value.other_description),
    specialist_kind: parseFlooringSpecialistKind(value.specialist_kind),
    finish_authority: parseFieldAuthority(value.finish_authority),
    area_method_authority: parseFieldAuthority(value.area_method_authority),
    length_authority: parseFieldAuthority(value.length_authority),
    width_authority: parseFieldAuthority(value.width_authority),
    area_authority: parseFieldAuthority(value.area_authority),
    underlay_authority: parseFieldAuthority(value.underlay_authority),
    preparation_authority: parseFieldAuthority(value.preparation_authority),
    tile_width_authority: parseFieldAuthority(value.tile_width_authority),
    tile_length_authority: parseFieldAuthority(value.tile_length_authority),
    hardwood_width_authority: parseFieldAuthority(value.hardwood_width_authority),
    substrate_required_authority: parseFieldAuthority(
      value.substrate_required_authority
    ),
    substrate_family_authority: parseFieldAuthority(
      value.substrate_family_authority
    ),
    substrate_item_authority: parseFieldAuthority(value.substrate_item_authority),
    framing_required_authority: parseFieldAuthority(
      value.framing_required_authority
    ),
    framing_level_authority: parseFieldAuthority(value.framing_level_authority),
    finish_removal_authority: parseFieldAuthority(value.finish_removal_authority),
    existing_finish_authority: parseFieldAuthority(
      value.existing_finish_authority
    ),
    substrate_removal_authority: parseFieldAuthority(
      value.substrate_removal_authority
    ),
    label_authority: parseFieldAuthority(value.label_authority),
    other_description_authority: parseFieldAuthority(
      value.other_description_authority
    ),
    specialist_authority: parseFieldAuthority(value.specialist_authority),
    clause_ordinal:
      typeof value.clause_ordinal === "number" &&
      Number.isInteger(value.clause_ordinal) &&
      value.clause_ordinal >= 0
        ? value.clause_ordinal
        : undefined,
  };
  return sanitizeFlooringPortionInapplicableFields(portion);
}

function parseFlooringPortionList(value: unknown[]): FlooringPortion[] {
  const portions: FlooringPortion[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const parsed = parseFlooringPortion(row);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    portions.push(parsed);
  }
  return portions;
}

export function parseFlooringCollectionEnvelope(value: unknown): {
  v: number;
  portions: FlooringPortion[];
} {
  let parsed: unknown = value;
  if (typeof parsed === "string" && parsed.trim()) {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return { v: 0, portions: [] };
    }
  }
  if (Array.isArray(parsed)) {
    return { v: 0, portions: parseFlooringPortionList(parsed) };
  }
  if (isRecord(parsed) && Array.isArray(parsed.portions)) {
    const v =
      typeof parsed.v === "number" && Number.isFinite(parsed.v) ? parsed.v : 0;
    return { v, portions: parseFlooringPortionList(parsed.portions) };
  }
  return { v: 0, portions: [] };
}

export function parseFlooringPortions(value: unknown): FlooringPortion[] {
  return parseFlooringCollectionEnvelope(value).portions;
}

function withAssignedFlooringIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((row) => {
      if (!isRecord(row)) return row;
      if (typeof row.id === "string" && row.id.trim()) return row;
      return { ...row, id: createFlooringPortionId() };
    });
  }
  if (isRecord(value) && Array.isArray(value.portions)) {
    return {
      ...value,
      portions: withAssignedFlooringIds(value.portions),
    };
  }
  return value;
}

export function normalizeExtractedFlooringPortions(
  value: unknown
): FlooringPortion[] {
  return parseFlooringCollectionEnvelope(withAssignedFlooringIds(value))
    .portions;
}

export function isFlooringPortionWriteKey(key: string): boolean {
  return (
    key === FLOORING_PORTIONS_FACT_KEY ||
    key === FLOORING_ACTIVE_PORTION_ID_FACT_KEY ||
    key === FLOORING_ADD_PORTION_KEY ||
    key === FLOORING_DUPLICATE_PORTION_KEY ||
    key === FLOORING_DELETE_PORTION_KEY ||
    key.startsWith(FLOORING_PORTION_FIELD_PREFIX)
  );
}

export function isFlooringNestedFactKey(factKey: string): boolean {
  return factKey.startsWith(FLOORING_PORTION_FIELD_PREFIX);
}

export const FLOORING_PORTION_FIELD_KEYS = [
  "flooring.portion.finish_type",
  "flooring.portion.area_input_method",
  "flooring.portion.length_m",
  "flooring.portion.width_m",
  "flooring.portion.area_m2",
  "flooring.portion.underlay_required",
  "flooring.portion.floor_preparation_required",
  "flooring.portion.tile_width_mm",
  "flooring.portion.tile_length_mm",
  "flooring.portion.hardwood_board_width_mm",
  "flooring.portion.substrate_required",
  "flooring.portion.substrate_family",
  "flooring.portion.substrate_item_key",
  "flooring.portion.framing_required",
  "flooring.portion.framing_allowance_level",
  "flooring.portion.finish_removal_required",
  "flooring.portion.existing_finish_type",
  "flooring.portion.substrate_removal_required",
  "flooring.portion.label",
  "flooring.portion.other_description",
  "flooring.portion.specialist_kind",
] as const;

/** Calculator-owned nested contract. Logical keys patch `flooring.portions`. */
export const FLOORING_CALCULATOR_CONSUMED_FACTS = [
  FLOORING_PORTIONS_FACT_KEY,
  FLOORING_ACTIVE_PORTION_ID_FACT_KEY,
  FLOORING_ADD_PORTION_KEY,
  FLOORING_DUPLICATE_PORTION_KEY,
  FLOORING_DELETE_PORTION_KEY,
  ...FLOORING_PORTION_FIELD_KEYS,
  "flooring.area_m2",
  "flooring.type",
  "flooring.supply_scope",
  "flooring.client_supplied",
  "flooring.existing_flooring_removal",
  "flooring.floor_prep_level",
  "flooring.subfloor_replacement_required",
  "flooring.underlay_included",
  "flooring.scotia_included",
  "flooring.disposal_included",
  "flooring.stairs_or_landings_included",
  "flooring.stair_count",
  "flooring.landing_area_m2",
  "flooring.new_flooring_included",
] as const;

export function storedFlooringPortions(
  facts: readonly EstimateFact[],
  workAreaId: string
): FlooringPortion[] {
  const raw = getFact(
    facts as EstimateFact[],
    workAreaId,
    FLOORING_PORTIONS_FACT_KEY
  )?.value;
  return parseFlooringPortions(raw);
}

export function hasCanonicalFlooringPortions(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return storedFlooringPortions(facts, workAreaId).length > 0;
}

/** Nested collection row exists, including an intentional empty Flooring Area list. */
export function hasFlooringPortionsFact(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return (
    getFact(facts as EstimateFact[], workAreaId, FLOORING_PORTIONS_FACT_KEY) !=
    null
  );
}

export function resolveFlooringActivePortionId(
  facts: readonly EstimateFact[],
  workAreaId: string,
  portions: readonly FlooringPortion[]
): string | null {
  const stored = getFact(
    facts as EstimateFact[],
    workAreaId,
    FLOORING_ACTIVE_PORTION_ID_FACT_KEY
  )?.value;
  if (typeof stored === "string" && portions.some((row) => row.id === stored)) {
    return stored;
  }
  return portions[0]?.id ?? null;
}

export function resolveFlooringPortions(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): {
  portions: FlooringPortion[];
  source: FlooringPortionSource;
  activeId: string | null;
} {
  const portions = storedFlooringPortions(params.facts, params.workAreaId);
  return {
    portions,
    source: "canonical",
    activeId: resolveFlooringActivePortionId(
      params.facts,
      params.workAreaId,
      portions
    ),
  };
}

export function findFlooringPortion(
  portions: readonly FlooringPortion[],
  portionId: string | null | undefined
): FlooringPortion | null {
  if (!portionId) return null;
  return portions.find((row) => row.id === portionId) ?? null;
}

export function updateFlooringPortion(
  portions: readonly FlooringPortion[],
  portionId: string,
  patch: (portion: FlooringPortion) => void
): FlooringPortion[] {
  if (!portions.some((row) => row.id === portionId)) {
    return portions.map((row) => row);
  }
  return portions.map((row) => {
    if (row.id !== portionId) return row;
    const next = cloneFlooringPortion(row);
    patch(next);
    return next;
  });
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

export function flooringPortionsFactSourceForWrite(params: {
  readonly key: string;
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

function overlayUserField<K extends keyof FlooringPortion>(
  next: FlooringPortion,
  persisted: FlooringPortion,
  field: K,
  authorityField: keyof FlooringPortion
): void {
  if (persisted[authorityField] === "user") {
    next[field] = persisted[field];
    (next as FlooringPortion)[authorityField] = "user" as never;
  }
}

const FLOORING_USER_AUTHORITY_FIELDS = [
  "finish_authority",
  "area_method_authority",
  "length_authority",
  "width_authority",
  "area_authority",
  "underlay_authority",
  "preparation_authority",
  "tile_width_authority",
  "tile_length_authority",
  "hardwood_width_authority",
  "substrate_required_authority",
  "substrate_family_authority",
  "substrate_item_authority",
  "framing_required_authority",
  "framing_level_authority",
  "finish_removal_authority",
  "existing_finish_authority",
  "substrate_removal_authority",
  "label_authority",
  "other_description_authority",
  "specialist_authority",
] as const;

export function flooringPortionHasUserAuthority(
  portion: FlooringPortion
): boolean {
  return FLOORING_USER_AUTHORITY_FIELDS.some(
    (field) => portion[field] === "user"
  );
}

export function flooringPortionFieldsCompatible(
  left: FlooringPortion,
  right: FlooringPortion
): boolean {
  const pairs: readonly [unknown, unknown][] = [
    [left.finish_type, right.finish_type],
    [left.area_input_method, right.area_input_method],
    [left.length_m, right.length_m],
    [left.width_m, right.width_m],
    [left.area_m2, right.area_m2],
    [left.tile_width_mm, right.tile_width_mm],
    [left.tile_length_mm, right.tile_length_mm],
    [left.hardwood_board_width_mm, right.hardwood_board_width_mm],
    [left.specialist_kind, right.specialist_kind],
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
  persisted: readonly FlooringPortion[],
  extracted: readonly FlooringPortion[]
): boolean {
  const used = new Set<number>();
  for (const row of persisted) {
    const idx = extracted.findIndex(
      (candidate, i) =>
        !used.has(i) && flooringPortionFieldsCompatible(row, candidate)
    );
    if (idx < 0) return false;
    used.add(idx);
  }
  return persisted.length > 0;
}

export function overlayUserAuthoritativeFlooringPortion(
  extracted: FlooringPortion,
  persisted: FlooringPortion
): FlooringPortion {
  const next = cloneFlooringPortion(extracted);
  next.id = persisted.id;
  overlayUserField(next, persisted, "label", "label_authority");
  overlayUserField(next, persisted, "finish_type", "finish_authority");
  overlayUserField(
    next,
    persisted,
    "area_input_method",
    "area_method_authority"
  );
  overlayUserField(next, persisted, "length_m", "length_authority");
  overlayUserField(next, persisted, "width_m", "width_authority");
  overlayUserField(next, persisted, "area_m2", "area_authority");
  overlayUserField(next, persisted, "underlay_required", "underlay_authority");
  overlayUserField(
    next,
    persisted,
    "floor_preparation_required",
    "preparation_authority"
  );
  overlayUserField(next, persisted, "tile_width_mm", "tile_width_authority");
  overlayUserField(next, persisted, "tile_length_mm", "tile_length_authority");
  overlayUserField(
    next,
    persisted,
    "hardwood_board_width_mm",
    "hardwood_width_authority"
  );
  overlayUserField(
    next,
    persisted,
    "substrate_required",
    "substrate_required_authority"
  );
  overlayUserField(
    next,
    persisted,
    "substrate_family",
    "substrate_family_authority"
  );
  overlayUserField(
    next,
    persisted,
    "substrate_item_key",
    "substrate_item_authority"
  );
  overlayUserField(
    next,
    persisted,
    "framing_required",
    "framing_required_authority"
  );
  overlayUserField(
    next,
    persisted,
    "framing_allowance_level",
    "framing_level_authority"
  );
  overlayUserField(
    next,
    persisted,
    "finish_removal_required",
    "finish_removal_authority"
  );
  overlayUserField(
    next,
    persisted,
    "existing_finish_type",
    "existing_finish_authority"
  );
  overlayUserField(
    next,
    persisted,
    "substrate_removal_required",
    "substrate_removal_authority"
  );
  overlayUserField(
    next,
    persisted,
    "other_description",
    "other_description_authority"
  );
  overlayUserField(next, persisted, "specialist_kind", "specialist_authority");
  if (persisted.specialist_kind != null && extracted.specialist_kind == null) {
    next.specialist_kind = persisted.specialist_kind;
  }
  if (
    persisted.finish_authority === "user" &&
    persisted.finish_type === "other"
  ) {
    next.finish_type = "other";
    next.finish_authority = "user";
    next.specialist_kind = persisted.specialist_kind;
    if (persisted.specialist_authority) {
      next.specialist_authority = persisted.specialist_authority;
    }
  }
  return sanitizeFlooringPortionInapplicableFields(next);
}

function takeExtractedMatch(
  extracted: readonly FlooringPortion[],
  used: Set<number>,
  predicate: (row: FlooringPortion, index: number) => boolean
): FlooringPortion | null {
  const index = extracted.findIndex(
    (row, i) => !used.has(i) && predicate(row, i)
  );
  if (index < 0) return null;
  used.add(index);
  return extracted[index] ?? null;
}

function matchReanalysePortion(
  extracted: readonly FlooringPortion[],
  persisted: FlooringPortion,
  index: number,
  used: Set<number>
): FlooringPortion | null {
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
        flooringPortionFieldsCompatible(row, persisted)
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
        flooringPortionFieldsCompatible(row, persisted)
    );
    if (byLabel) return byLabel;
  }
  const byIndex = takeExtractedMatch(
    extracted,
    used,
    (row, i) => i === index && flooringPortionFieldsCompatible(row, persisted)
  );
  if (byIndex) return byIndex;
  return takeExtractedMatch(extracted, used, (row) =>
    flooringPortionFieldsCompatible(row, persisted)
  );
}

/**
 * Re-analysis merge:
 * - Match by stable id, then clause ordinal, then compatible label/product.
 * - User-owned fields overlay onto the matched extracted portion.
 * - User-owned collections are never auto-split.
 */
export function mergePersistedFlooringPortionsOnReanalyse(params: {
  readonly extracted: unknown;
  readonly persisted: unknown;
}): FlooringPortion[] {
  const extracted = parseFlooringPortions(params.extracted);
  const persisted = parseFlooringPortions(params.persisted);
  if (persisted.length === 0) return extracted.map(cloneFlooringPortion);
  if (extracted.length === 0) return persisted.map(cloneFlooringPortion);
  const hasUser = persisted.some(flooringPortionHasUserAuthority);
  const consistentSubset = isConsistentProductSubset(persisted, extracted);
  if (!hasUser && extracted.length > persisted.length && !consistentSubset) {
    return extracted.map((row, i) => {
      const next = cloneFlooringPortion(row);
      const previous = persisted[i];
      if (previous) next.id = previous.id;
      return next;
    });
  }
  const used = new Set<number>();
  const merged = persisted.map((portion, index) => {
    const match = matchReanalysePortion(extracted, portion, index, used);
    return match
      ? overlayUserAuthoritativeFlooringPortion(match, portion)
      : cloneFlooringPortion(portion);
  });
  if (!hasUser && !consistentSubset) {
    extracted.forEach((row, index) => {
      if (!used.has(index)) merged.push(cloneFlooringPortion(row));
    });
  }
  return merged;
}

function applyPortionField(
  portion: FlooringPortion,
  field: string,
  value: unknown
): void {
  if (field === "label") {
    portion.label =
      typeof value === "string" && value.trim() ? value.trim() : null;
    portion.label_authority = "user";
    return;
  }
  if (field === "finish_type") {
    portion.finish_type = parseFlooringFinishType(value);
    portion.finish_authority = "user";
    sanitizeFlooringPortionInapplicableFields(portion);
    return;
  }
  if (field === "area_input_method") {
    portion.area_input_method = parseFlooringAreaInputMethod(value);
    portion.area_method_authority = "user";
    return;
  }
  if (field === "length_m") {
    portion.length_m = parseFlooringPositiveMeasure(value);
    portion.length_authority = "user";
    return;
  }
  if (field === "width_m") {
    portion.width_m = parseFlooringPositiveMeasure(value);
    portion.width_authority = "user";
    return;
  }
  if (field === "area_m2") {
    portion.area_m2 = parseFlooringPositiveMeasure(value);
    portion.area_authority = "user";
    return;
  }
  if (field === "underlay_required") {
    portion.underlay_required = parseTriBool(value);
    portion.underlay_authority = "user";
    return;
  }
  if (field === "floor_preparation_required") {
    portion.floor_preparation_required = parseTriBool(value);
    portion.preparation_authority = "user";
    return;
  }
  if (field === "tile_width_mm") {
    portion.tile_width_mm = parseFlooringPositiveMm(value);
    portion.tile_width_authority = "user";
    return;
  }
  if (field === "tile_length_mm") {
    portion.tile_length_mm = parseFlooringPositiveMm(value);
    portion.tile_length_authority = "user";
    return;
  }
  if (field === "hardwood_board_width_mm") {
    portion.hardwood_board_width_mm = parseFlooringHardwoodBoardWidthMm(value);
    portion.hardwood_width_authority = "user";
    return;
  }
  if (field === "substrate_required") {
    portion.substrate_required = parseTriBool(value);
    portion.substrate_required_authority = "user";
    return;
  }
  if (field === "substrate_family") {
    portion.substrate_family = parseFlooringSubstrateFamily(value);
    portion.substrate_family_authority = "user";
    return;
  }
  if (field === "substrate_item_key") {
    portion.substrate_item_key = parseFlooringSubstrateItemKey(value);
    portion.substrate_item_authority = "user";
    return;
  }
  if (field === "framing_required") {
    portion.framing_required = parseTriBool(value);
    portion.framing_required_authority = "user";
    return;
  }
  if (field === "framing_allowance_level") {
    portion.framing_allowance_level = parseFlooringFramingAllowanceLevel(value);
    portion.framing_level_authority = "user";
    return;
  }
  if (field === "finish_removal_required") {
    portion.finish_removal_required = parseTriBool(value);
    portion.finish_removal_authority = "user";
    return;
  }
  if (field === "existing_finish_type") {
    portion.existing_finish_type = parseFlooringExistingFinishType(value);
    portion.existing_finish_authority = "user";
    return;
  }
  if (field === "substrate_removal_required") {
    portion.substrate_removal_required = parseTriBool(value);
    portion.substrate_removal_authority = "user";
    return;
  }
  if (field === "other_description") {
    portion.other_description = parseFlooringOtherDescription(value);
    portion.other_description_authority = "user";
    return;
  }
  if (field === "specialist_kind") {
    portion.specialist_kind = parseFlooringSpecialistKind(value);
    portion.specialist_authority = "user";
  }
}

/**
 * Pure fact write for Flooring collection keys.
 * Used by persistence and optimistic overlay. Does not regenerate IDs on
 * normal field edits. Does not mutate Bathroom, Kitchen, or Demolition facts.
 */
export function applyFlooringFactWrite(params: {
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
      row.key === FLOORING_PORTIONS_FACT_KEY &&
      row.work_area_id === params.workAreaId
  );
  const nextSource = flooringPortionsFactSourceForWrite({
    key: params.key,
    previousSource: previousPortions?.source,
    factSource: params.factSource,
  });

  if (params.key === FLOORING_PORTIONS_FACT_KEY) {
    const incoming = parseFlooringPortions(params.value);
    const previous = parseFlooringPortions(previousPortions?.value);
    const portions =
      params.factSource === "ai_extracted"
        ? mergePersistedFlooringPortionsOnReanalyse({
            extracted: incoming,
            persisted: previous,
          })
        : incoming;
    return upsertFact(
      facts,
      params.workAreaId,
      FLOORING_PORTIONS_FACT_KEY,
      portions,
      nextSource
    );
  }

  let portions = storedFlooringPortions(facts, params.workAreaId);
  let activeId = resolveFlooringActivePortionId(
    facts,
    params.workAreaId,
    portions
  );

  if (params.key === FLOORING_ACTIVE_PORTION_ID_FACT_KEY) {
    const nextId = typeof params.value === "string" ? params.value : null;
    if (nextId && portions.some((row) => row.id === nextId)) {
      return upsertFact(
        facts,
        params.workAreaId,
        FLOORING_ACTIVE_PORTION_ID_FACT_KEY,
        nextId
      );
    }
    return facts;
  }

  if (
    params.key === FLOORING_ADD_PORTION_KEY &&
    (params.value === true ||
      params.value === "Yes" ||
      params.value === "Add flooring area" ||
      isClientFlooringPortionId(params.value))
  ) {
    const requestedId = isClientFlooringPortionId(params.value)
      ? params.value.trim()
      : null;
    const existing = requestedId
      ? portions.find((row) => row.id === requestedId)
      : null;
    if (existing) {
      activeId = existing.id;
    } else {
      const created = createEmptyFlooringPortion({
        id: requestedId ?? undefined,
      });
      portions = [...portions, created];
      activeId = created.id;
    }
  } else if (params.key === FLOORING_DUPLICATE_PORTION_KEY) {
    const sourceId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    const source = portions.find((row) => row.id === sourceId);
    if (source) {
      const copyId =
        params.nestedItemId &&
        params.nestedItemId !== source.id &&
        isClientFlooringPortionId(params.nestedItemId)
          ? params.nestedItemId
          : undefined;
      const existingCopy = copyId
        ? portions.find((row) => row.id === copyId)
        : null;
      if (existingCopy) {
        activeId = existingCopy.id;
      } else {
        const copy = duplicateFlooringPortion(source, copyId);
        const index = portions.findIndex((row) => row.id === source.id);
        portions = [
          ...portions.slice(0, index + 1),
          copy,
          ...portions.slice(index + 1),
        ];
        activeId = copy.id;
      }
    }
  } else if (params.key === FLOORING_DELETE_PORTION_KEY) {
    const deleteId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    if (deleteId) {
      portions = portions.filter((row) => row.id !== deleteId);
      activeId = portions[0]?.id ?? null;
    }
  } else if (params.key.startsWith(FLOORING_PORTION_FIELD_PREFIX)) {
    if (portions.length === 0) {
      const created = createEmptyFlooringPortion();
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
    const field = params.key.slice(FLOORING_PORTION_FIELD_PREFIX.length);
    portions = updateFlooringPortion(portions, targetId, (portion) => {
      applyPortionField(portion, field, params.value);
    });
  } else {
    return facts;
  }

  let next = upsertFact(
    facts,
    params.workAreaId,
    FLOORING_PORTIONS_FACT_KEY,
    portions,
    nextSource
  );
  if (activeId) {
    next = upsertFact(
      next,
      params.workAreaId,
      FLOORING_ACTIVE_PORTION_ID_FACT_KEY,
      activeId
    );
  } else {
    next = next.filter(
      (row) =>
        !(
          row.key === FLOORING_ACTIVE_PORTION_ID_FACT_KEY &&
          row.work_area_id === params.workAreaId
        )
    );
  }
  return next;
}
