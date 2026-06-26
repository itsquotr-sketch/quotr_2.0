import type { AIExtractionOutput } from "@/lib/ai/schema";
import type { ScopeCatalogueItem } from "@/lib/scopes/catalogue";

export type WorkAreaInsertRow = {
  org_id: string;
  project_id: string;
  type: string;
  name: string;
  status: "suggested";
  ai_confidence: number;
  summary: string | null;
  sort_order: number;
};

export type ProjectFactInsertRow = {
  org_id: string;
  project_id: string;
  work_area_id: string | null;
  key: string;
  label: string;
  value: string | number | boolean | string[];
  unit: string | null;
  source: "ai_extracted";
  confidence: number;
};

function getCatalogueLabel(
  type: string,
  catalogueByType: Map<string, ScopeCatalogueItem>
): string {
  return catalogueByType.get(type)?.label ?? type;
}

function getWorkAreaSummary(
  type: string,
  rationale: string | undefined,
  catalogueByType: Map<string, ScopeCatalogueItem>
): string | null {
  const trimmedRationale = rationale?.trim();
  if (trimmedRationale) return trimmedRationale;
  return catalogueByType.get(type)?.description ?? null;
}

export function aiWorkAreasToRows(params: {
  output: AIExtractionOutput;
  orgId: string;
  projectId: string;
  catalogueByType: Map<string, ScopeCatalogueItem>;
}): WorkAreaInsertRow[] {
  return params.output.workAreas.map((wa, index) => ({
    org_id: params.orgId,
    project_id: params.projectId,
    type: wa.type,
    name: getCatalogueLabel(wa.type, params.catalogueByType),
    status: "suggested" as const,
    ai_confidence: wa.confidence,
    summary: getWorkAreaSummary(wa.type, wa.rationale, params.catalogueByType),
    sort_order: index + 1,
  }));
}

export function aiFactsToRows(params: {
  output: AIExtractionOutput;
  orgId: string;
  projectId: string;
  workAreaIdByType: Map<string, string>;
}): ProjectFactInsertRow[] {
  const rows: ProjectFactInsertRow[] = [];

  for (const fact of params.output.facts) {
    let workAreaId: string | null = null;

    if (fact.work_area_type !== null) {
      const mappedId = params.workAreaIdByType.get(fact.work_area_type);
      if (!mappedId) continue;
      workAreaId = mappedId;
    }

    rows.push({
      org_id: params.orgId,
      project_id: params.projectId,
      work_area_id: workAreaId,
      key: fact.key,
      label: fact.label,
      value: fact.value,
      unit: fact.unit ?? null,
      source: "ai_extracted",
      confidence: fact.confidence,
    });
  }

  return rows;
}

export function factDedupeKey(
  workAreaId: string | null,
  key: string
): string {
  return workAreaId ? `${workAreaId}:${key}` : `project:${key}`;
}
