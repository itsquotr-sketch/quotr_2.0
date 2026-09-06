/**
 * Canonical DNA task lookup for save / reset / task pages.
 * Resolves both V1 catalogue rows and approved V2 foundation rows.
 */
import type { CompanyDnaFoundationTask } from "@/lib/company-dna/v2-foundation";
import { getCompanyDnaFoundationTask } from "@/lib/company-dna/v2-foundation";

export function resolveCompanyDnaTask(
  taskKey: string
): CompanyDnaFoundationTask | undefined {
  return getCompanyDnaFoundationTask(taskKey);
}
