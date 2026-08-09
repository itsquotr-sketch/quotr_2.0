/**
 * Quotr Work Area capability catalogue (Stage 3.1C.3-R2B).
 *
 * Authority A — what Quotr can recognise / estimate.
 * Distinct from company preferences (organisation_work_areas.enabled)
 * and project work areas (work_areas rows).
 *
 * Single source: SCOPE_CATALOGUE. Do not fork type lists for Setup.
 */

import { SCOPE_CATALOGUE, type ScopeCatalogueItem } from "@/lib/scopes/catalogue";

/** Canonical supported work-area type ids (capability catalogue). */
export const SUPPORTED_WORK_AREA_TYPES: readonly string[] =
  SCOPE_CATALOGUE.map((item) => item.type);

export function getSupportedWorkAreaTypes(): string[] {
  return [...SUPPORTED_WORK_AREA_TYPES];
}

export function isSupportedWorkAreaType(type: string): boolean {
  return SUPPORTED_WORK_AREA_TYPES.includes(type);
}

export function getSupportedWorkAreaCatalogue(): readonly ScopeCatalogueItem[] {
  return SCOPE_CATALOGUE;
}

/**
 * Types Analyse Job / note analysis may extract.
 * Always the full capability catalogue — never org preferences.
 */
export function getAnalysisCapableWorkAreaTypes(): string[] {
  return getSupportedWorkAreaTypes();
}
