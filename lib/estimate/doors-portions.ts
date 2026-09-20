/**
 * DOORS-01B — nested Door Set collection.
 *
 * Canonical store: `doors.portions` on project_facts (jsonb).
 * Persistence may wrap `{ v, portions }` so concurrent nested writes
 * compare-and-swap an integer revision.
 *
 * Stable UUID per Door Set. Do not flatten portion_1 keys.
 * Logical `doors.portion.*` keys are write addresses for later Details /
 * Refine. They patch the JSON collection and are not persisted as sibling
 * rows.
 *
 * No takeoff, material COST, productivity, or money in this module.
 *
 * Dual-path calculator boundary (later ticket):
 * - Canonical nested `doors.portions` → future physical + commercial path.
 * - Legacy flat `doors.count` / `calculateDoors` lumps remain for hosted
 *   projects without portions. Nested portions must not fall through to
 *   FITOUT_BENCHMARKS.doorsEach merely because fields are incomplete.
 */

import { getFact } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  createStableClientId,
  isStableClientId,
} from "@/lib/ids/stable-client-id";

export const DOORS_PORTIONS_FACT_KEY = "doors.portions" as const;
export const DOORS_ACTIVE_PORTION_ID_FACT_KEY =
  "doors.active_portion_id" as const;

export const DOORS_PORTION_FIELD_PREFIX = "doors.portion." as const;

export const DOORS_ADD_PORTION_KEY = "doors.add_portion" as const;
export const DOORS_DUPLICATE_PORTION_KEY = "doors.duplicate_portion" as const;
export const DOORS_DELETE_PORTION_KEY = "doors.delete_portion" as const;

export const DOORS_NESTED_NOT_CALCULATED_MESSAGE =
  "Canonical nested Door Sets are not calculated on the legacy Doors allowance path." as const;

export const DOORS_HEIGHT_DISCLOSED_DEFAULT_MM = 1980 as const;
export const DOORS_HEIGHT_DISCLOSED_DEFAULT_STATEMENT =
  "Door height assumed 1980 mm unless specified." as const;

export const DOORS_INSTALLATION_TYPE_VALUES = [
  "prehung_internal",
  "replacement_leaf",
  "other_unsupported",
] as const;
export type DoorInstallationType =
  (typeof DOORS_INSTALLATION_TYPE_VALUES)[number];

export const DOORS_LEAF_CONSTRUCTION_VALUES = [
  "hollow_core",
  "solid_core",
  "other",
] as const;
export type DoorLeafConstruction =
  (typeof DOORS_LEAF_CONSTRUCTION_VALUES)[number];

export const DOORS_HEIGHT_MM_VALUES = [1980, 2200, 2400] as const;
export type DoorHeightMm = (typeof DOORS_HEIGHT_MM_VALUES)[number];

export const DOORS_WIDTH_MM_VALUES = [410, 610, 760, 810, 860, 910] as const;
export type DoorWidthMm = (typeof DOORS_WIDTH_MM_VALUES)[number];

export const DOORS_FIELD_AUTHORITY_VALUES = [
  "extracted",
  "assumed_disclosed",
  "user",
] as const;
export type DoorFieldAuthority =
  (typeof DOORS_FIELD_AUTHORITY_VALUES)[number];

export const DOORS_SPECIALIST_KIND_VALUES = [
  "fire_rated",
  "acoustic",
  "exterior",
  "aluminium",
  "automatic",
  "security_access_control",
  "cavity_slider",
  "barn",
  "bifold",
  "glazed_specialist",
  "oversized",
  "heritage_custom",
  "specialist_hardware",
  "other_unsupported",
] as const;
export type DoorSpecialistKind =
  (typeof DOORS_SPECIALIST_KIND_VALUES)[number];

export type DoorPortion = {
  id: string;
  label: string | null;
  installation_type: DoorInstallationType | null;
  leaf_construction: DoorLeafConstruction | null;
  height_mm: DoorHeightMm | null;
  width_mm: DoorWidthMm | null;
  quantity: number | null;
  hardware_included: boolean | null;
  installation_authority?: DoorFieldAuthority;
  leaf_authority?: DoorFieldAuthority;
  height_authority?: DoorFieldAuthority;
  width_authority?: DoorFieldAuthority;
  quantity_authority?: DoorFieldAuthority;
  hardware_authority?: DoorFieldAuthority;
  label_authority?: DoorFieldAuthority;
  specialist_kind: DoorSpecialistKind | null;
};

export type DoorPortionSource = "canonical";

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

function parseFieldAuthority(value: unknown): DoorFieldAuthority | undefined {
  return parseEnum(value, DOORS_FIELD_AUTHORITY_VALUES) ?? undefined;
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
      normalised === "false"
    ) {
      return false;
    }
  }
  return null;
}

export function createDoorPortionId(): string {
  return createStableClientId("ds");
}

export function isClientDoorPortionId(value: unknown): value is string {
  return isStableClientId(value, "ds");
}

export function parseDoorInstallationType(
  value: unknown
): DoorInstallationType | null {
  const direct = parseEnum(value, DOORS_INSTALLATION_TYPE_VALUES);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const normalised = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (
    normalised === "prehung" ||
    normalised === "pre hung" ||
    normalised === "prehung internal" ||
    normalised === "pre hung internal" ||
    normalised === "internal prehung"
  ) {
    return "prehung_internal";
  }
  if (
    normalised === "replacement" ||
    normalised === "replacement leaf" ||
    normalised === "leaf only" ||
    normalised === "leaf"
  ) {
    return "replacement_leaf";
  }
  if (
    normalised === "other" ||
    normalised === "unsupported" ||
    normalised === "other unsupported"
  ) {
    return "other_unsupported";
  }
  return null;
}

export function parseDoorLeafConstruction(
  value: unknown
): DoorLeafConstruction | null {
  const direct = parseEnum(value, DOORS_LEAF_CONSTRUCTION_VALUES);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const normalised = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (normalised === "hollow" || normalised === "hollow core") {
    return "hollow_core";
  }
  if (normalised === "solid" || normalised === "solid core") {
    return "solid_core";
  }
  if (normalised === "other") return "other";
  return null;
}

function parseAllowedMm<T extends number>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return (allowed as readonly number[]).includes(rounded)
      ? (rounded as T)
      : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/mm/i, "").trim());
    if (!Number.isFinite(parsed)) return null;
    const rounded = Math.round(parsed);
    return (allowed as readonly number[]).includes(rounded)
      ? (rounded as T)
      : null;
  }
  return null;
}

export function parseDoorHeightMm(value: unknown): DoorHeightMm | null {
  return parseAllowedMm(value, DOORS_HEIGHT_MM_VALUES);
}

export function parseDoorWidthMm(value: unknown): DoorWidthMm | null {
  return parseAllowedMm(value, DOORS_WIDTH_MM_VALUES);
}

/**
 * Whole doors only. Rejects zero, negatives, and non-integers.
 * Does not invent a default of 3.
 */
export function parseDoorQuantity(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
      return null;
    }
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      return null;
    }
    return parsed;
  }
  return null;
}

export function parseDoorSpecialistKind(
  value: unknown
): DoorSpecialistKind | null {
  return parseEnum(value, DOORS_SPECIALIST_KIND_VALUES);
}

export function doorPortionIsUnsupported(portion: DoorPortion): boolean {
  return (
    portion.installation_type === "other_unsupported" ||
    portion.specialist_kind != null
  );
}

export function createEmptyDoorPortion(params?: {
  id?: string;
  label?: string | null;
}): DoorPortion {
  return {
    id: params?.id ?? createDoorPortionId(),
    label: params?.label ?? null,
    installation_type: null,
    leaf_construction: null,
    height_mm: DOORS_HEIGHT_DISCLOSED_DEFAULT_MM,
    width_mm: null,
    quantity: null,
    hardware_included: null,
    height_authority: "assumed_disclosed",
    specialist_kind: null,
  };
}

export function cloneDoorPortion(portion: DoorPortion): DoorPortion {
  return { ...portion };
}

export function duplicateDoorPortion(
  source: DoorPortion,
  newId?: string
): DoorPortion {
  return {
    ...cloneDoorPortion(source),
    id: newId ?? createDoorPortionId(),
    label: source.label ? `${source.label} copy` : null,
  };
}

export function parseDoorPortion(value: unknown): DoorPortion | null {
  if (!isRecord(value)) return null;
  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : createDoorPortionId();
  const label =
    typeof value.label === "string" && value.label.trim()
      ? value.label.trim()
      : null;
  return {
    id,
    label,
    installation_type: parseDoorInstallationType(value.installation_type),
    leaf_construction: parseDoorLeafConstruction(value.leaf_construction),
    height_mm: parseDoorHeightMm(value.height_mm),
    width_mm: parseDoorWidthMm(value.width_mm),
    quantity: parseDoorQuantity(value.quantity),
    hardware_included: parseTriBool(value.hardware_included),
    installation_authority: parseFieldAuthority(value.installation_authority),
    leaf_authority: parseFieldAuthority(value.leaf_authority),
    height_authority: parseFieldAuthority(value.height_authority),
    width_authority: parseFieldAuthority(value.width_authority),
    quantity_authority: parseFieldAuthority(value.quantity_authority),
    hardware_authority: parseFieldAuthority(value.hardware_authority),
    label_authority: parseFieldAuthority(value.label_authority),
    specialist_kind: parseDoorSpecialistKind(value.specialist_kind),
  };
}

function parseDoorPortionList(value: unknown[]): DoorPortion[] {
  const portions: DoorPortion[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const parsed = parseDoorPortion(row);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    portions.push(parsed);
  }
  return portions;
}

export function parseDoorsCollectionEnvelope(value: unknown): {
  v: number;
  portions: DoorPortion[];
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
    return { v: 0, portions: parseDoorPortionList(parsed) };
  }
  if (isRecord(parsed) && Array.isArray(parsed.portions)) {
    const v =
      typeof parsed.v === "number" && Number.isFinite(parsed.v) ? parsed.v : 0;
    return { v, portions: parseDoorPortionList(parsed.portions) };
  }
  return { v: 0, portions: [] };
}

export function parseDoorsPortions(value: unknown): DoorPortion[] {
  return parseDoorsCollectionEnvelope(value).portions;
}

function withAssignedDoorIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((row) => {
      if (!isRecord(row)) return row;
      if (typeof row.id === "string" && row.id.trim()) return row;
      return { ...row, id: createDoorPortionId() };
    });
  }
  if (isRecord(value) && Array.isArray(value.portions)) {
    return {
      ...value,
      portions: withAssignedDoorIds(value.portions),
    };
  }
  return value;
}

export function normalizeExtractedDoorPortions(value: unknown): DoorPortion[] {
  return parseDoorsCollectionEnvelope(withAssignedDoorIds(value)).portions;
}

export function isDoorsPortionWriteKey(key: string): boolean {
  return (
    key === DOORS_PORTIONS_FACT_KEY ||
    key === DOORS_ACTIVE_PORTION_ID_FACT_KEY ||
    key === DOORS_ADD_PORTION_KEY ||
    key === DOORS_DUPLICATE_PORTION_KEY ||
    key === DOORS_DELETE_PORTION_KEY ||
    key.startsWith(DOORS_PORTION_FIELD_PREFIX)
  );
}

export function isDoorsNestedFactKey(factKey: string): boolean {
  return factKey.startsWith(DOORS_PORTION_FIELD_PREFIX);
}

export const DOORS_PORTION_FIELD_KEYS = [
  "doors.portion.installation_type",
  "doors.portion.leaf_construction",
  "doors.portion.height_mm",
  "doors.portion.width_mm",
  "doors.portion.quantity",
  "doors.portion.hardware_included",
  "doors.portion.label",
] as const;

/** Calculator-owned nested contract. Logical keys patch `doors.portions`. */
export const DOORS_CALCULATOR_CONSUMED_FACTS = [
  DOORS_PORTIONS_FACT_KEY,
  DOORS_ACTIVE_PORTION_ID_FACT_KEY,
  DOORS_ADD_PORTION_KEY,
  DOORS_DUPLICATE_PORTION_KEY,
  DOORS_DELETE_PORTION_KEY,
  ...DOORS_PORTION_FIELD_KEYS,
  "doors.count",
  "doors.door_type",
  "doors.supply_scope",
  "doors.client_supplied",
  "doors.existing_removal",
  "doors.architraves_included",
  "doors.painting_included",
  "doors.prehung",
  "doors.frames_included",
  "doors.hardware_install_included",
] as const;

export function storedDoorsPortions(
  facts: readonly EstimateFact[],
  workAreaId: string
): DoorPortion[] {
  const raw = getFact(
    facts as EstimateFact[],
    workAreaId,
    DOORS_PORTIONS_FACT_KEY
  )?.value;
  return parseDoorsPortions(raw);
}

export function hasCanonicalDoorsPortions(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return storedDoorsPortions(facts, workAreaId).length > 0;
}

export function resolveDoorsActivePortionId(
  facts: readonly EstimateFact[],
  workAreaId: string,
  portions: readonly DoorPortion[]
): string | null {
  const stored = getFact(
    facts as EstimateFact[],
    workAreaId,
    DOORS_ACTIVE_PORTION_ID_FACT_KEY
  )?.value;
  if (typeof stored === "string" && portions.some((row) => row.id === stored)) {
    return stored;
  }
  return portions[0]?.id ?? null;
}

export function resolveDoorsPortions(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): {
  portions: DoorPortion[];
  source: DoorPortionSource;
  activeId: string | null;
} {
  const portions = storedDoorsPortions(params.facts, params.workAreaId);
  return {
    portions,
    source: "canonical",
    activeId: resolveDoorsActivePortionId(
      params.facts,
      params.workAreaId,
      portions
    ),
  };
}

export function findDoorPortion(
  portions: readonly DoorPortion[],
  portionId: string | null | undefined
): DoorPortion | null {
  if (!portionId) return null;
  return portions.find((row) => row.id === portionId) ?? null;
}

export function updateDoorPortion(
  portions: readonly DoorPortion[],
  portionId: string,
  patch: (portion: DoorPortion) => void
): DoorPortion[] {
  if (!portions.some((row) => row.id === portionId)) {
    return portions.map((row) => row);
  }
  return portions.map((row) => {
    if (row.id !== portionId) return row;
    const next = cloneDoorPortion(row);
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

export function doorsPortionsFactSourceForWrite(params: {
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

function overlayUserField<K extends keyof DoorPortion>(
  next: DoorPortion,
  persisted: DoorPortion,
  field: K,
  authorityField: keyof DoorPortion
): void {
  const authority = persisted[authorityField];
  if (authority === "user") {
    next[field] = persisted[field];
    (next as DoorPortion)[authorityField] = "user" as never;
  }
}

export function overlayUserAuthoritativeDoorPortion(
  extracted: DoorPortion,
  persisted: DoorPortion
): DoorPortion {
  const next = cloneDoorPortion(extracted);
  next.id = persisted.id;
  overlayUserField(next, persisted, "label", "label_authority");
  overlayUserField(
    next,
    persisted,
    "installation_type",
    "installation_authority"
  );
  overlayUserField(next, persisted, "leaf_construction", "leaf_authority");
  overlayUserField(next, persisted, "height_mm", "height_authority");
  overlayUserField(next, persisted, "width_mm", "width_authority");
  overlayUserField(next, persisted, "quantity", "quantity_authority");
  overlayUserField(
    next,
    persisted,
    "hardware_included",
    "hardware_authority"
  );
  if (persisted.specialist_kind != null && extracted.specialist_kind == null) {
    next.specialist_kind = persisted.specialist_kind;
  }
  return next;
}

function matchReanalysePortion(
  extracted: readonly DoorPortion[],
  persisted: DoorPortion,
  index: number,
  used: Set<number>
): DoorPortion | null {
  const byId = extracted.findIndex(
    (row, i) => !used.has(i) && row.id === persisted.id
  );
  if (byId >= 0) {
    used.add(byId);
    return extracted[byId] ?? null;
  }
  const label = persisted.label?.trim().toLowerCase();
  if (label) {
    const byLabel = extracted.findIndex(
      (row, i) => !used.has(i) && row.label?.trim().toLowerCase() === label
    );
    if (byLabel >= 0) {
      used.add(byLabel);
      return extracted[byLabel] ?? null;
    }
  }
  if (extracted.length === 1 && !used.has(0) && index === 0) {
    used.add(0);
    return extracted[0] ?? null;
  }
  if (!used.has(index) && extracted[index]) {
    used.add(index);
    return extracted[index] ?? null;
  }
  return null;
}

export function mergePersistedDoorsPortionsOnReanalyse(params: {
  readonly extracted: unknown;
  readonly persisted: unknown;
}): DoorPortion[] {
  const extracted = parseDoorsPortions(params.extracted);
  const persisted = parseDoorsPortions(params.persisted);
  if (persisted.length === 0) return extracted.map(cloneDoorPortion);
  if (extracted.length === 0) return persisted.map(cloneDoorPortion);
  const used = new Set<number>();
  const merged = persisted.map((portion, index) => {
    const match = matchReanalysePortion(extracted, portion, index, used);
    return match
      ? overlayUserAuthoritativeDoorPortion(match, portion)
      : cloneDoorPortion(portion);
  });
  extracted.forEach((row, index) => {
    if (!used.has(index)) merged.push(cloneDoorPortion(row));
  });
  return merged;
}

function applyPortionField(
  portion: DoorPortion,
  field: string,
  value: unknown
): void {
  if (field === "label") {
    portion.label =
      typeof value === "string" && value.trim() ? value.trim() : null;
    portion.label_authority = "user";
    return;
  }
  if (field === "installation_type") {
    portion.installation_type = parseDoorInstallationType(value);
    portion.installation_authority = "user";
    return;
  }
  if (field === "leaf_construction") {
    portion.leaf_construction = parseDoorLeafConstruction(value);
    portion.leaf_authority = "user";
    return;
  }
  if (field === "height_mm") {
    portion.height_mm = parseDoorHeightMm(value);
    portion.height_authority = "user";
    return;
  }
  if (field === "width_mm") {
    portion.width_mm = parseDoorWidthMm(value);
    portion.width_authority = "user";
    return;
  }
  if (field === "quantity") {
    portion.quantity = parseDoorQuantity(value);
    portion.quantity_authority = "user";
    return;
  }
  if (field === "hardware_included") {
    portion.hardware_included = parseTriBool(value);
    portion.hardware_authority = "user";
    return;
  }
  if (field === "specialist_kind") {
    portion.specialist_kind = parseDoorSpecialistKind(value);
  }
}

/**
 * Pure fact write for Doors collection keys.
 * Used by persistence and optimistic overlay. Does not regenerate IDs on
 * normal field edits. Does not mutate Internal Walls facts.
 */
export function applyDoorsFactWrite(params: {
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
      row.key === DOORS_PORTIONS_FACT_KEY &&
      row.work_area_id === params.workAreaId
  );
  const nextSource = doorsPortionsFactSourceForWrite({
    key: params.key,
    previousSource: previousPortions?.source,
    factSource: params.factSource,
  });

  if (params.key === DOORS_PORTIONS_FACT_KEY) {
    const incoming = parseDoorsPortions(params.value);
    const previous = parseDoorsPortions(previousPortions?.value);
    const portions =
      params.factSource === "ai_extracted"
        ? mergePersistedDoorsPortionsOnReanalyse({
            extracted: incoming,
            persisted: previous,
          })
        : incoming;
    return upsertFact(
      facts,
      params.workAreaId,
      DOORS_PORTIONS_FACT_KEY,
      portions,
      nextSource
    );
  }

  let portions = storedDoorsPortions(facts, params.workAreaId);
  let activeId = resolveDoorsActivePortionId(
    facts,
    params.workAreaId,
    portions
  );

  if (params.key === DOORS_ACTIVE_PORTION_ID_FACT_KEY) {
    const nextId = typeof params.value === "string" ? params.value : null;
    if (nextId && portions.some((row) => row.id === nextId)) {
      return upsertFact(
        facts,
        params.workAreaId,
        DOORS_ACTIVE_PORTION_ID_FACT_KEY,
        nextId
      );
    }
    return facts;
  }

  if (
    params.key === DOORS_ADD_PORTION_KEY &&
    (params.value === true ||
      params.value === "Yes" ||
      params.value === "Add door set" ||
      isClientDoorPortionId(params.value))
  ) {
    const requestedId = isClientDoorPortionId(params.value)
      ? params.value.trim()
      : null;
    const existing = requestedId
      ? portions.find((row) => row.id === requestedId)
      : null;
    if (existing) {
      activeId = existing.id;
    } else {
      const created = createEmptyDoorPortion({
        id: requestedId ?? undefined,
      });
      portions = [...portions, created];
      activeId = created.id;
    }
  } else if (params.key === DOORS_DUPLICATE_PORTION_KEY) {
    const sourceId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    const source = portions.find((row) => row.id === sourceId);
    if (source) {
      const copyId =
        params.nestedItemId &&
        params.nestedItemId !== source.id &&
        isClientDoorPortionId(params.nestedItemId)
          ? params.nestedItemId
          : undefined;
      const existingCopy = copyId
        ? portions.find((row) => row.id === copyId)
        : null;
      if (existingCopy) {
        activeId = existingCopy.id;
      } else {
        const copy = duplicateDoorPortion(source, copyId);
        const index = portions.findIndex((row) => row.id === source.id);
        portions = [
          ...portions.slice(0, index + 1),
          copy,
          ...portions.slice(index + 1),
        ];
        activeId = copy.id;
      }
    }
  } else if (params.key === DOORS_DELETE_PORTION_KEY) {
    const deleteId =
      typeof params.value === "string" && params.value.trim()
        ? params.value.trim()
        : activeId;
    if (deleteId) {
      portions = portions.filter((row) => row.id !== deleteId);
      activeId = portions[0]?.id ?? null;
    }
  } else if (params.key.startsWith(DOORS_PORTION_FIELD_PREFIX)) {
    if (portions.length === 0) {
      const created = createEmptyDoorPortion();
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
    const field = params.key.slice(DOORS_PORTION_FIELD_PREFIX.length);
    portions = updateDoorPortion(portions, targetId, (portion) => {
      applyPortionField(portion, field, params.value);
    });
  } else {
    return facts;
  }

  let next = upsertFact(
    facts,
    params.workAreaId,
    DOORS_PORTIONS_FACT_KEY,
    portions,
    nextSource
  );
  if (activeId) {
    next = upsertFact(
      next,
      params.workAreaId,
      DOORS_ACTIVE_PORTION_ID_FACT_KEY,
      activeId
    );
  } else {
    next = next.filter(
      (row) =>
        !(
          row.key === DOORS_ACTIVE_PORTION_ID_FACT_KEY &&
          row.work_area_id === params.workAreaId
        )
    );
  }
  return next;
}
