/**
 * First-run "Your work" catalogue.
 *
 * Preference storage remains organisation_work_areas.enabled.
 * Types are a subset of SCOPE_CATALOGUE — not a second taxonomy.
 * Unfinished / nested component types are omitted from first-run.
 */

import { SCOPE_CATALOGUE, type ScopeCatalogueItem } from "@/lib/scopes/catalogue";
import {
  getWorkAreaCapabilityBand,
  isUnsupportedWorkAreaType,
} from "@/lib/work-areas/support-contract";

/**
 * Estimate-ready Work Areas meaningful for external beta first-run.
 * Canonical type ids only. Labels come from SCOPE_CATALOGUE.
 */
export const FIRST_RUN_PRIMARY_WORK_AREA_TYPES = [
  "deck",
  "fence",
  "retaining_wall",
  "bathroom",
  "kitchen",
  "pergola",
  "internal_walls",
  "flooring",
  "painting",
  "demolition",
] as const;

export type FirstRunPrimaryWorkAreaType =
  (typeof FIRST_RUN_PRIMARY_WORK_AREA_TYPES)[number];

const FIRST_RUN_TYPE_SET = new Set<string>(FIRST_RUN_PRIMARY_WORK_AREA_TYPES);

export function isFirstRunPrimaryWorkAreaType(type: string): boolean {
  return FIRST_RUN_TYPE_SET.has(type);
}

export function getFirstRunPrimaryWorkAreas(): ScopeCatalogueItem[] {
  const byType = new Map(SCOPE_CATALOGUE.map((item) => [item.type, item]));
  return FIRST_RUN_PRIMARY_WORK_AREA_TYPES.flatMap((type) => {
    const item = byType.get(type);
    if (!item) return [];
    if (isUnsupportedWorkAreaType(item.type)) return [];
    const band = getWorkAreaCapabilityBand(item.type);
    if (
      band !== "trial_supported" &&
      band !== "developing" &&
      band !== "component"
    ) {
      return [];
    }
    return [item];
  });
}

/** Do not add an "Other" bucket — unsupported types cannot be estimated. */
export const FIRST_RUN_ALLOW_OTHER = false;

export function hasEnabledPrimaryWorkArea(
  workAreas: ReadonlyArray<{ work_area_type: string; enabled: boolean }>
): boolean {
  return workAreas.some((area) => area.enabled === true);
}
