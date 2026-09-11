/**
 * Work Area Instance helpers.
 *
 * Work Area Type (kind) is the calculator/domain. It is not unique per Project.
 * A Work Area Instance is one labelled row with a stable UUID.
 *
 * Nested items (Wall Types, Door Types) live inside an instance — they are
 * not separate Work Areas.
 */

import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";

export const WORK_AREA_SHORT_LABEL: Record<string, string> = {
  bathroom: "Bathroom",
  kitchen: "Kitchen",
  deck: "Deck",
  fence: "Fence",
  pergola: "Pergola",
  external_stairs: "External Stairs",
  demolition: "Demolition / strip-out",
  internal_walls: "Internal walls",
  ceilings: "Ceilings",
  doors: "Doors",
  flooring: "Flooring",
  painting: "Painting",
  plastering: "Plastering",
  retaining_wall: "Retaining wall",
};

export type WorkAreaInstanceRef = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly status?: string | null;
};

export function catalogueWorkAreaLabel(type: string): string {
  return SCOPE_CATALOGUE.find((row) => row.type === type)?.label ?? type;
}

export function shortWorkAreaLabel(type: string): string {
  return WORK_AREA_SHORT_LABEL[type] ?? catalogueWorkAreaLabel(type);
}

export function normaliseWorkAreaInstanceName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ");
}

export function workAreaInstanceKey(
  type: string,
  name: string | null | undefined
): string {
  return `${type}::${normaliseWorkAreaInstanceName(name).toLowerCase()}`;
}

export function nextWorkAreaInstanceLabel(
  type: string,
  existingNames: readonly string[]
): string {
  const base = catalogueWorkAreaLabel(type);
  const short = shortWorkAreaLabel(type);
  const used = new Set(
    existingNames.map((name) => normaliseWorkAreaInstanceName(name).toLowerCase())
  );
  if (!used.has(base.toLowerCase()) && !used.has(short.toLowerCase())) {
    return existingNames.length === 0 ? base : `${short} 2`;
  }
  let index = existingNames.length + 1;
  let candidate = `${short} ${index}`;
  while (used.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${short} ${index}`;
  }
  return candidate;
}

/**
 * When several instances share a catalogue default name, number them for UI.
 * Persisted names are left unchanged.
 */
export function distinguishWorkAreaInstanceLabels<
  T extends WorkAreaInstanceRef,
>(areas: readonly T[]): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  const byType = new Map<string, T[]>();
  for (const area of areas) {
    const list = byType.get(area.type) ?? [];
    list.push(area);
    byType.set(area.type, list);
  }
  for (const [type, list] of byType) {
    const short = shortWorkAreaLabel(type);
    const catalogue = catalogueWorkAreaLabel(type);
    const names = list.map((row) => normaliseWorkAreaInstanceName(row.name));
    const allDefault = names.every(
      (name) =>
        !name ||
        name.toLowerCase() === short.toLowerCase() ||
        name.toLowerCase() === catalogue.toLowerCase()
    );
    if (list.length > 1 && allDefault) {
      list.forEach((row, index) => {
        labels.set(row.id, `${short} ${index + 1}`);
      });
      continue;
    }
    const seen = new Map<string, number>();
    for (const row of list) {
      const name = normaliseWorkAreaInstanceName(row.name) || short;
      const count = (seen.get(name.toLowerCase()) ?? 0) + 1;
      seen.set(name.toLowerCase(), count);
      labels.set(
        row.id,
        count === 1 ? name : `${short} ${list.indexOf(row) + 1}`
      );
    }
    const collisions = names.filter(
      (name, index) =>
        names.findIndex((other) => other.toLowerCase() === name.toLowerCase()) !==
        index
    );
    if (collisions.length > 0) {
      list.forEach((row, index) => {
        const name = normaliseWorkAreaInstanceName(row.name) || short;
        const dupes = list.filter(
          (other) =>
            normaliseWorkAreaInstanceName(other.name).toLowerCase() ===
            name.toLowerCase()
        );
        labels.set(row.id, dupes.length > 1 ? `${short} ${index + 1}` : name);
      });
    }
  }
  return labels;
}

export function displayWorkAreaInstanceName(
  area: WorkAreaInstanceRef,
  siblings: readonly WorkAreaInstanceRef[]
): string {
  return distinguishWorkAreaInstanceLabels(siblings).get(area.id) ?? area.name;
}

export type ExtractionWorkArea = {
  readonly type: string;
  readonly name?: string;
  readonly instance_key?: string;
  readonly confidence: number;
  readonly rationale?: string;
};

export type ExtractionFact = {
  readonly work_area_type: string | null;
  readonly work_area_name?: string | null;
  readonly work_area_instance?: string | null;
  readonly key: string;
};

function instanceHintMatchesName(name: string, hint: string): boolean {
  if (!hint) return false;
  if (name === hint) return true;
  if (name.startsWith(`${hint} `) || hint.startsWith(`${name} `)) return true;
  return false;
}

/**
 * Bind an extracted fact to a Work Area Instance.
 *
 * One instance of the type: bind to it.
 * Several instances: require work_area_name / instance hint.
 * Never silently attach an ambiguous same-key fact to ofType[0].
 */
export function bindFactToWorkAreaId(params: {
  fact: ExtractionFact;
  workAreas: readonly { id: string; type: string; name: string }[];
}): string | null {
  if (!params.fact.work_area_type) return null;
  const ofType = params.workAreas.filter(
    (row) => row.type === params.fact.work_area_type
  );
  if (ofType.length === 0) return null;
  if (ofType.length === 1) return ofType[0]?.id ?? null;

  const instanceHint = normaliseWorkAreaInstanceName(
    params.fact.work_area_instance ?? params.fact.work_area_name ?? ""
  ).toLowerCase();
  if (!instanceHint) return null;

  const matches = ofType.filter((row) => {
    const name = normaliseWorkAreaInstanceName(row.name).toLowerCase();
    return (
      instanceHintMatchesName(name, instanceHint) ||
      workAreaInstanceKey(row.type, row.name) ===
        `${row.type}::${instanceHint}`
    );
  });
  if (matches.length === 1) return matches[0]?.id ?? null;
  return null;
}

export function existingWorkAreaInstanceKeys(
  rows: readonly { type: string; name: string }[]
): Set<string> {
  return new Set(rows.map((row) => workAreaInstanceKey(row.type, row.name)));
}

export function shouldInsertWorkAreaInstance(
  row: { type: string; name: string },
  existingKeys: ReadonlySet<string>
): boolean {
  return !existingKeys.has(workAreaInstanceKey(row.type, row.name));
}

/**
 * Accidental duplicate INSTANCE — same type + normalised name.
 * Same type with a different label is a new instance and must be allowed.
 */
export function isDuplicateWorkAreaInstance(params: {
  readonly type: string;
  readonly name: string;
  readonly confirmed: readonly { type: string; name: string }[];
}): boolean {
  const type = params.type.trim();
  const name = normaliseWorkAreaInstanceName(params.name);
  if (!type || !name) return false;
  const key = workAreaInstanceKey(type, name);
  return params.confirmed.some(
    (row) => workAreaInstanceKey(row.type, row.name) === key
  );
}
