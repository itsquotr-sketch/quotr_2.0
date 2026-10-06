import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";

/** Product work-area types. A tag is a capability, not a priced rate. */
export const SUBCONTRACTOR_WORK_AREA_TYPES = SCOPE_CATALOGUE.map(
  (item) => item.type
);

const LABELS = new Map(
  SCOPE_CATALOGUE.map((item) => [item.type, item.label] as const)
);

export function isSubcontractorWorkAreaType(value: string): boolean {
  return LABELS.has(value);
}

export function workAreaLabel(type: string): string {
  return LABELS.get(type) ?? type;
}

export function workAreaLabels(types: readonly string[]): string {
  return types.map((type) => workAreaLabel(type)).join(", ");
}
