import type { Subcontractor } from "@/lib/subcontractors/types";
import { workAreaLabel } from "@/lib/subcontractors/work-areas";

export function subcontractorSearchText(subcontractor: Subcontractor): string {
  const contactText = subcontractor.contacts.flatMap((contact) => [
    contact.name,
    contact.role,
    contact.email,
    contact.phone,
  ]);
  return [
    subcontractor.trading_name,
    subcontractor.legal_name,
    subcontractor.country,
    subcontractor.specialties,
    ...subcontractor.service_regions,
    ...subcontractor.work_area_types.map((type) => workAreaLabel(type)),
    ...contactText,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
}

export function filterSubcontractors(
  subcontractors: readonly Subcontractor[],
  search: string,
  workAreaType: string
): Subcontractor[] {
  const needle = search.trim().toLowerCase();
  const area = workAreaType.trim();
  return subcontractors.filter((subcontractor) => {
    if (area && !subcontractor.work_area_types.includes(area)) return false;
    if (!needle) return true;
    return subcontractorSearchText(subcontractor).includes(needle);
  });
}

/**
 * Active businesses whose capability tags include this job work area.
 * A match is a suggestion only. It is not a rate, a quotation, or a selection.
 */
export function suggestSubcontractorsForWorkArea<
  T extends { archived_at: string | null; work_area_types: readonly string[] },
>(subcontractors: readonly T[], workAreaType: string): T[] {
  const type = workAreaType.trim();
  if (!type) return [];
  return subcontractors.filter(
    (subcontractor) =>
      subcontractor.archived_at == null &&
      subcontractor.work_area_types.includes(type)
  );
}
