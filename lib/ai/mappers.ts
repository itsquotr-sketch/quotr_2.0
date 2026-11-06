import type { AIExtractionOutput } from "@/lib/ai/schema";
import type { ScopeCatalogueItem } from "@/lib/scopes/catalogue";
import {
  bindFactToWorkAreaId,
  nextWorkAreaInstanceLabel,
} from "@/lib/work-areas/instances";

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
  value: string | number | boolean | string[] | Record<string, unknown>[];
  unit: string | null;
  source: "ai_extracted";
  confidence: number;
};

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
  const usedNamesByType = new Map<string, string[]>();
  return params.output.workAreas.map((wa, index) => {
    const usedNames = usedNamesByType.get(wa.type) ?? [];
    const named = typeof wa.name === "string" ? wa.name.trim() : "";
    const collision = usedNames.some(
      (row) => row.toLowerCase() === named.toLowerCase()
    );
    const name =
      named && !collision
        ? named
        : nextWorkAreaInstanceLabel(wa.type, usedNames);
    usedNames.push(name);
    usedNamesByType.set(wa.type, usedNames);
    return {
      org_id: params.orgId,
      project_id: params.projectId,
      type: wa.type,
      name,
      status: "suggested" as const,
      ai_confidence: wa.confidence,
      summary: getWorkAreaSummary(wa.type, wa.rationale, params.catalogueByType),
      sort_order: index + 1,
    };
  });
}

export function aiFactsToRows(params: {
  output: AIExtractionOutput;
  orgId: string;
  projectId: string;
  workAreaIdByType: Map<string, string>;
  workAreas?: readonly { id: string; type: string; name: string }[];
}): ProjectFactInsertRow[] {
  const rows: ProjectFactInsertRow[] = [];

  for (const fact of params.output.facts) {
    if (fact.value === null) continue;

    let workAreaId: string | null = null;

    if (fact.work_area_type !== null) {
      if (params.workAreas && params.workAreas.length > 0) {
        const bound = bindFactToWorkAreaId({
          fact,
          workAreas: params.workAreas,
        });
        if (!bound) continue;
        workAreaId = bound;
      } else {
        const mappedId = params.workAreaIdByType.get(fact.work_area_type);
        if (!mappedId) continue;
        workAreaId = mappedId;
      }
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

  return dedupePendingFactRows(rows);
}

export const CONFIRMED_ANSWER_CONFLICT =
  "New analysis disagrees with the saved answer. The saved answer was kept." as const;

const PROTECTED_FACT_SOURCES = new Set(["user", "assumption"]);

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${key}:${stableValue(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

/**
 * A user answer or an assumption stays stored. A different extracted value
 * is a review warning and does not change the source.
 * A derived value is replaced when extraction disagrees, because it is
 * not a confirmed answer.
 */
export function reanalysisFactWrite(params: {
  existingSource: string | null | undefined;
  existingValue: unknown;
  extractedValue: unknown;
}):
  | { readonly action: "replace" }
  | { readonly action: "keep"; readonly conflictWarning: string | null } {
  const disagrees = stableValue(params.existingValue) !== stableValue(params.extractedValue);
  if (params.existingSource === "derived") {
    return disagrees
      ? { action: "replace" }
      : { action: "keep", conflictWarning: null };
  }
  if (!PROTECTED_FACT_SOURCES.has(params.existingSource ?? "")) {
    return { action: "replace" };
  }
  return {
    action: "keep",
    conflictWarning: disagrees ? CONFIRMED_ANSWER_CONFLICT : null,
  };
}

export function factDedupeKey(
  workAreaId: string | null,
  key: string
): string {
  return workAreaId ? `${workAreaId}:${key}` : `project:${key}`;
}

/**
 * Safety guard before project_facts insert.
 * Last-write-wins only for the SAME work_area_id + key.
 * Distinct workAreaIds with the same key stay as separate rows.
 */
export function dedupePendingFactRows(
  rows: readonly ProjectFactInsertRow[]
): ProjectFactInsertRow[] {
  const lastByKey = new Map<string, ProjectFactInsertRow>();
  const order: string[] = [];
  for (const row of rows) {
    const key = factDedupeKey(row.work_area_id, row.key);
    if (!lastByKey.has(key)) order.push(key);
    lastByKey.set(key, row);
  }
  return order.map((key) => lastByKey.get(key)!);
}
