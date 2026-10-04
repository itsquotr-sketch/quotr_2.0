/**
 * Estimate workspace section URLs.
 * Presentation only. Unknown values fall back to Overview.
 */

export type EstimatePresentationView =
  | "overview"
  | "work_areas"
  | "materials"
  | "labour"
  | "checks";

export const ESTIMATE_SECTION_PARAM = "estimate";

const QUERY: Record<EstimatePresentationView, string | null> = {
  overview: null,
  work_areas: "work-area",
  materials: "materials",
  labour: "labour",
  checks: "assumptions",
};

const ALIASES: Record<string, EstimatePresentationView> = {
  overview: "overview",
  work_areas: "work_areas",
  "work-area": "work_areas",
  "work-areas": "work_areas",
  "by-work-area": "work_areas",
  materials: "materials",
  "materials-takeoff": "materials",
  labour: "labour",
  labor: "labour",
  "labour-takeoff": "labour",
  checks: "checks",
  assumptions: "checks",
  "assumptions-checks": "checks",
  "assumptions-and-checks": "checks",
};

export function parseEstimateSection(
  value: string | null | undefined
): EstimatePresentationView {
  if (!value) return "overview";
  return ALIASES[value.trim().toLowerCase()] ?? "overview";
}

/** Canonical query value. Overview omits the parameter. */
export function estimateSectionQuery(
  view: EstimatePresentationView
): string | null {
  return QUERY[view];
}
